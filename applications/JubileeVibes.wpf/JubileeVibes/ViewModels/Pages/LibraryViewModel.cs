using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class LibraryViewModel : ViewModelBase
{
    private readonly ILibraryService _libraryService;
    private readonly IPlaylistService _playlistService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private string _selectedTab = "playlists";

    [ObservableProperty]
    private ObservableCollection<Playlist> _playlists = new();

    [ObservableProperty]
    private ObservableCollection<Album> _savedAlbums = new();

    [ObservableProperty]
    private ObservableCollection<Artist> _followedArtists = new();

    [ObservableProperty]
    private ObservableCollection<Track> _likedSongs = new();

    [ObservableProperty]
    private ObservableCollection<Track> _localFiles = new();

    [ObservableProperty]
    private int _likedSongsCount;

    public LibraryViewModel(
        ILibraryService libraryService,
        IPlaylistService playlistService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService)
    {
        _libraryService = libraryService;
        _playlistService = playlistService;
        _playbackService = playbackService;
        _navigationService = navigationService;
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        ClearError();

        try
        {
            await LoadCurrentTabAsync();
        }
        catch (Exception ex)
        {
            SetError($"Failed to load library: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    partial void OnSelectedTabChanged(string value)
    {
        _ = LoadCurrentTabAsync();
    }

    private async Task LoadCurrentTabAsync()
    {
        switch (SelectedTab)
        {
            case "playlists":
                await LoadPlaylistsAsync();
                break;
            case "albums":
                await LoadAlbumsAsync();
                break;
            case "artists":
                await LoadArtistsAsync();
                break;
            case "local":
                await LoadLocalFilesAsync();
                break;
        }
    }

    private async Task LoadPlaylistsAsync()
    {
        var playlists = await _playlistService.GetUserPlaylistsAsync();
        Playlists = new ObservableCollection<Playlist>(playlists);

        var likedSongs = await _libraryService.GetLikedSongsAsync();
        LikedSongsCount = likedSongs.Count();
    }

    private async Task LoadAlbumsAsync()
    {
        var albums = await _libraryService.GetSavedAlbumsAsync();
        SavedAlbums = new ObservableCollection<Album>(albums);
    }

    private async Task LoadArtistsAsync()
    {
        var artists = await _libraryService.GetFollowedArtistsAsync();
        FollowedArtists = new ObservableCollection<Artist>(artists);
    }

    private async Task LoadLocalFilesAsync()
    {
        var files = await _libraryService.GetLocalFilesAsync();
        LocalFiles = new ObservableCollection<Track>(files);
    }

    [RelayCommand]
    private void SelectTab(string tab)
    {
        SelectedTab = tab;
    }

    [RelayCommand]
    private void NavigateToLikedSongs()
    {
        _navigationService.NavigateToPlaylist("liked-songs");
    }

    [RelayCommand]
    private void NavigateToPlaylist(Playlist playlist)
    {
        _navigationService.NavigateToPlaylist(playlist.Id);
    }

    [RelayCommand]
    private void NavigateToAlbum(Album album)
    {
        _navigationService.NavigateToAlbum(album.Id);
    }

    [RelayCommand]
    private void NavigateToArtist(Artist artist)
    {
        _navigationService.NavigateToArtist(artist.Id);
    }

    [RelayCommand]
    private async Task PlayTrack(Track track)
    {
        await _playbackService.PlayAsync(track);
    }

    [RelayCommand]
    private async Task PlayAllLikedSongs()
    {
        if (LikedSongs.Any())
        {
            await _playbackService.PlayAsync(LikedSongs, 0);
        }
        else
        {
            var songs = await _libraryService.GetLikedSongsAsync();
            LikedSongs = new ObservableCollection<Track>(songs);
            if (LikedSongs.Any())
            {
                await _playbackService.PlayAsync(LikedSongs, 0);
            }
        }
    }
}
