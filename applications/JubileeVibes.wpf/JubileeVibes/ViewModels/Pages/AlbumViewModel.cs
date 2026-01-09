using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class AlbumViewModel : ViewModelBase
{
    private readonly IMusicCatalogService _catalogService;
    private readonly ILibraryService _libraryService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    private string? _albumId;

    [ObservableProperty]
    private Album? _album;

    [ObservableProperty]
    private ObservableCollection<Track> _tracks = new();

    [ObservableProperty]
    private bool _isSaved;

    public AlbumViewModel(
        IMusicCatalogService catalogService,
        ILibraryService libraryService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService)
    {
        _catalogService = catalogService;
        _libraryService = libraryService;
        _playbackService = playbackService;
        _navigationService = navigationService;
    }

    public override async Task OnNavigatedTo(object? parameter)
    {
        if (parameter is string albumId)
        {
            _albumId = albumId;
            await LoadAlbumAsync();
        }
    }

    private async Task LoadAlbumAsync()
    {
        if (_albumId == null) return;

        IsLoading = true;
        ClearError();

        try
        {
            Album = await _catalogService.GetAlbumAsync(_albumId);
            if (Album != null)
            {
                var tracks = await _catalogService.GetAlbumTracksAsync(_albumId);
                Tracks = new ObservableCollection<Track>(tracks);
                IsSaved = await _libraryService.IsAlbumSavedAsync(_albumId);
                Album.IsSaved = IsSaved;
            }
        }
        catch (Exception ex)
        {
            SetError($"Failed to load album: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task PlayAll()
    {
        if (Tracks.Any())
        {
            await _playbackService.PlayAsync(Tracks, 0);
        }
    }

    [RelayCommand]
    private async Task ShufflePlay()
    {
        if (Tracks.Any())
        {
            _playbackService.IsShuffleEnabled = true;
            await _playbackService.PlayAsync(Tracks, 0);
        }
    }

    [RelayCommand]
    private async Task PlayTrack(Track track)
    {
        var index = Tracks.IndexOf(track);
        await _playbackService.PlayAsync(Tracks, index);
    }

    [RelayCommand]
    private async Task ToggleSave()
    {
        if (Album == null || _albumId == null) return;

        if (IsSaved)
        {
            await _libraryService.RemoveAlbumAsync(_albumId);
            IsSaved = false;
        }
        else
        {
            await _libraryService.SaveAlbumAsync(_albumId);
            IsSaved = true;
        }
        Album.IsSaved = IsSaved;
    }

    [RelayCommand]
    private void NavigateToArtist()
    {
        if (Album != null)
        {
            _navigationService.NavigateToArtist(Album.ArtistId);
        }
    }
}
