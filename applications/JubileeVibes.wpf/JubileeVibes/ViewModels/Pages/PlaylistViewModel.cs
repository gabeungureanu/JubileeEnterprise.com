using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class PlaylistViewModel : ViewModelBase
{
    private readonly IPlaylistService _playlistService;
    private readonly ILibraryService _libraryService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;
    private readonly IDialogService _dialogService;

    private string? _playlistId;

    [ObservableProperty]
    private Playlist? _playlist;

    [ObservableProperty]
    private ObservableCollection<Track> _tracks = new();

    [ObservableProperty]
    private bool _isLikedSongs;

    [ObservableProperty]
    private bool _isOwner;

    public PlaylistViewModel(
        IPlaylistService playlistService,
        ILibraryService libraryService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService,
        IDialogService dialogService)
    {
        _playlistService = playlistService;
        _libraryService = libraryService;
        _playbackService = playbackService;
        _navigationService = navigationService;
        _dialogService = dialogService;
    }

    public override async Task OnNavigatedTo(object? parameter)
    {
        if (parameter is string playlistId)
        {
            _playlistId = playlistId;
            IsLikedSongs = playlistId == "liked-songs";
            await LoadPlaylistAsync();
        }
    }

    private async Task LoadPlaylistAsync()
    {
        IsLoading = true;
        ClearError();

        try
        {
            if (IsLikedSongs)
            {
                Playlist = new Playlist
                {
                    Id = "liked-songs",
                    Name = "Liked Songs",
                    Description = "Songs you've liked"
                };
                var songs = await _libraryService.GetLikedSongsAsync();
                Tracks = new ObservableCollection<Track>(songs);
            }
            else if (_playlistId != null)
            {
                Playlist = await _playlistService.GetPlaylistAsync(_playlistId);
                if (Playlist != null)
                {
                    var tracks = await _playlistService.GetPlaylistTracksAsync(_playlistId);
                    Tracks = new ObservableCollection<Track>(tracks);
                    // IsOwner = Playlist.OwnerId == currentUserId
                    IsOwner = true; // Assume owner for now
                }
            }
        }
        catch (Exception ex)
        {
            SetError($"Failed to load playlist: {ex.Message}");
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
    private async Task RemoveTrack(Track track)
    {
        if (_playlistId == null || IsLikedSongs) return;

        var confirmed = await _dialogService.ShowConfirmationAsync(
            "Remove from playlist",
            $"Remove \"{track.Title}\" from this playlist?");

        if (confirmed)
        {
            await _playlistService.RemoveTrackFromPlaylistAsync(_playlistId, track.Id);
            Tracks.Remove(track);
        }
    }

    [RelayCommand]
    private async Task EditPlaylist()
    {
        if (Playlist == null || IsLikedSongs) return;

        var newName = await _dialogService.ShowInputAsync(
            "Edit Playlist",
            "Enter new name:",
            Playlist.Name);

        if (!string.IsNullOrWhiteSpace(newName) && newName != Playlist.Name)
        {
            await _playlistService.UpdatePlaylistAsync(Playlist.Id, newName);
            Playlist.Name = newName;
        }
    }

    [RelayCommand]
    private async Task DeletePlaylist()
    {
        if (Playlist == null || IsLikedSongs) return;

        var confirmed = await _dialogService.ShowConfirmationAsync(
            "Delete Playlist",
            $"Are you sure you want to delete \"{Playlist.Name}\"?");

        if (confirmed)
        {
            await _playlistService.DeletePlaylistAsync(Playlist.Id);
            _navigationService.GoBack();
        }
    }

    [RelayCommand]
    private void NavigateToArtist(Track track)
    {
        _navigationService.NavigateToArtist(track.ArtistId);
    }

    [RelayCommand]
    private void NavigateToAlbum(Track track)
    {
        _navigationService.NavigateToAlbum(track.AlbumId);
    }
}
