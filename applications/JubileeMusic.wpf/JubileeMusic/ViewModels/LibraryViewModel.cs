using System;
using System.Collections.Generic;
using System.Collections.ObjectModel;
using System.IO;
using System.Linq;
using System.Threading.Tasks;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeMusic.Models;
using JubileeMusic.Services;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.ViewModels;

public partial class LibraryViewModel : BaseViewModel
{
    private readonly ILibraryService _libraryService;
    private readonly IAudioPlayerService _audioPlayerService;
    private readonly ILogger<LibraryViewModel> _logger;

    [ObservableProperty]
    private ObservableCollection<MusicTrack> _tracks = new();

    [ObservableProperty]
    private MusicTrack? _selectedTrack;

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private string _sortBy = "Date";

    [ObservableProperty]
    private bool _sortDescending = true;

    [ObservableProperty]
    private GenerationStatus? _filterStatus;

    // Player state
    [ObservableProperty]
    private bool _isPlaying;

    [ObservableProperty]
    private TimeSpan _currentPosition;

    [ObservableProperty]
    private TimeSpan _totalDuration;

    [ObservableProperty]
    private float _volume = 1.0f;

    [ObservableProperty]
    private string _nowPlayingTitle = string.Empty;

    public LibraryViewModel(
        ILibraryService libraryService,
        IAudioPlayerService audioPlayerService,
        ILogger<LibraryViewModel> logger)
    {
        _libraryService = libraryService;
        _audioPlayerService = audioPlayerService;
        _logger = logger;

        // Subscribe to player events
        _audioPlayerService.PlaybackStateChanged += OnPlaybackStateChanged;
        _audioPlayerService.PositionChanged += OnPositionChanged;
        _audioPlayerService.PlaybackEnded += OnPlaybackEnded;
        _audioPlayerService.ErrorOccurred += OnPlayerError;

        // Subscribe to library events
        _libraryService.TrackAdded += OnTrackAdded;
        _libraryService.TrackUpdated += OnTrackUpdated;
        _libraryService.TrackDeleted += OnTrackDeleted;
    }

    [RelayCommand]
    private async Task LoadTracks()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            var tracks = await _libraryService.GetAllTracksAsync();
            ApplySortAndFilter(tracks);

            _logger.LogInformation("Loaded {Count} tracks", tracks.Count);
            SetStatus($"Loaded {tracks.Count} tracks");
        }, "Loading library...");
    }

    [RelayCommand]
    private async Task Search()
    {
        await ExecuteWithBusyIndicator(async () =>
        {
            List<MusicTrack> tracks;

            if (string.IsNullOrWhiteSpace(SearchQuery))
            {
                tracks = await _libraryService.GetAllTracksAsync();
            }
            else
            {
                tracks = await _libraryService.SearchTracksAsync(SearchQuery);
            }

            ApplySortAndFilter(tracks);
            SetStatus($"Found {tracks.Count} tracks");
        }, "Searching...");
    }

    [RelayCommand]
    private async Task PlayTrack(MusicTrack? track)
    {
        track ??= SelectedTrack;
        if (track == null) return;

        if (string.IsNullOrEmpty(track.AudioFilePath) || !File.Exists(track.AudioFilePath))
        {
            SetError("Audio file not found for this track");
            return;
        }

        try
        {
            await _audioPlayerService.LoadAsync(track.AudioFilePath, track.Id);
            _audioPlayerService.Play();
            NowPlayingTitle = track.Title ?? "Unknown";

            // Update play count
            track.PlayCount++;
            track.LastPlayedAt = DateTime.UtcNow;
            await _libraryService.SaveTrackAsync(track);

            _logger.LogInformation("Playing track: {Id} - {Title}", track.Id, track.Title);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to play track {Id}", track.Id);
            SetError($"Failed to play track: {ex.Message}");
        }
    }

    [RelayCommand]
    private void TogglePlayPause()
    {
        if (_audioPlayerService.IsPlaying)
        {
            _audioPlayerService.Pause();
        }
        else if (_audioPlayerService.IsPaused)
        {
            _audioPlayerService.Play();
        }
        else if (SelectedTrack != null)
        {
            _ = PlayTrack(SelectedTrack);
        }
    }

    [RelayCommand]
    private void Stop()
    {
        _audioPlayerService.Stop();
        NowPlayingTitle = string.Empty;
    }

    [RelayCommand]
    private void Seek(double position)
    {
        _audioPlayerService.Seek(TimeSpan.FromSeconds(position));
    }

    [RelayCommand]
    private async Task DeleteTrack(MusicTrack? track)
    {
        track ??= SelectedTrack;
        if (track == null) return;

        try
        {
            // Stop if currently playing this track
            if (_audioPlayerService.CurrentTrackId == track.Id)
            {
                _audioPlayerService.Stop();
            }

            await _libraryService.DeleteTrackAsync(track.Id);
            Tracks.Remove(track);

            SetStatus($"Deleted: {track.Title}");
            _logger.LogInformation("Deleted track: {Id} - {Title}", track.Id, track.Title);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to delete track {Id}", track.Id);
            SetError($"Failed to delete track: {ex.Message}");
        }
    }

    [RelayCommand]
    private void OpenInExplorer(MusicTrack? track)
    {
        track ??= SelectedTrack;
        if (track == null || string.IsNullOrEmpty(track.AudioFilePath)) return;

        try
        {
            var directory = Path.GetDirectoryName(track.AudioFilePath);
            if (!string.IsNullOrEmpty(directory) && Directory.Exists(directory))
            {
                System.Diagnostics.Process.Start("explorer.exe", $"/select,\"{track.AudioFilePath}\"");
            }
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to open in explorer");
        }
    }

    [RelayCommand]
    private void ApplySort()
    {
        var trackList = Tracks.ToList();
        ApplySortAndFilter(trackList);
    }

    private void ApplySortAndFilter(List<MusicTrack> tracks)
    {
        // Apply status filter
        if (FilterStatus.HasValue)
        {
            tracks = tracks.Where(t => t.GenerationStatus == FilterStatus.Value).ToList();
        }

        // Apply sorting
        tracks = SortBy switch
        {
            "Title" => SortDescending
                ? tracks.OrderByDescending(t => t.Title).ToList()
                : tracks.OrderBy(t => t.Title).ToList(),
            "Date" => SortDescending
                ? tracks.OrderByDescending(t => t.CreatedAt).ToList()
                : tracks.OrderBy(t => t.CreatedAt).ToList(),
            "Duration" => SortDescending
                ? tracks.OrderByDescending(t => t.Duration).ToList()
                : tracks.OrderBy(t => t.Duration).ToList(),
            "PlayCount" => SortDescending
                ? tracks.OrderByDescending(t => t.PlayCount).ToList()
                : tracks.OrderBy(t => t.PlayCount).ToList(),
            _ => tracks
        };

        Tracks.Clear();
        foreach (var track in tracks)
        {
            Tracks.Add(track);
        }
    }

    partial void OnVolumeChanged(float value)
    {
        _audioPlayerService.Volume = value;
    }

    partial void OnSearchQueryChanged(string value)
    {
        // Auto-search on query change with debounce
        _ = Search();
    }

    private void OnPlaybackStateChanged(object? sender, PlaybackStateChangedEventArgs e)
    {
        IsPlaying = e.NewState == PlaybackState.Playing;
        TotalDuration = _audioPlayerService.TotalDuration;
    }

    private void OnPositionChanged(object? sender, TimeSpan position)
    {
        CurrentPosition = position;
    }

    private void OnPlaybackEnded(object? sender, EventArgs e)
    {
        IsPlaying = false;
        CurrentPosition = TimeSpan.Zero;

        // Auto-play next track if available
        var currentIndex = Tracks.IndexOf(Tracks.FirstOrDefault(t => t.Id == _audioPlayerService.CurrentTrackId));
        if (currentIndex >= 0 && currentIndex < Tracks.Count - 1)
        {
            _ = PlayTrack(Tracks[currentIndex + 1]);
        }
    }

    private void OnPlayerError(object? sender, string error)
    {
        SetError(error);
    }

    private void OnTrackAdded(object? sender, MusicTrack track)
    {
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            Tracks.Insert(0, track);
        });
    }

    private void OnTrackUpdated(object? sender, MusicTrack track)
    {
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            var existing = Tracks.FirstOrDefault(t => t.Id == track.Id);
            if (existing != null)
            {
                var index = Tracks.IndexOf(existing);
                Tracks[index] = track;
            }
        });
    }

    private void OnTrackDeleted(object? sender, string trackId)
    {
        System.Windows.Application.Current.Dispatcher.Invoke(() =>
        {
            var track = Tracks.FirstOrDefault(t => t.Id == trackId);
            if (track != null)
            {
                Tracks.Remove(track);
            }
        });
    }
}
