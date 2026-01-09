using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class HomeViewModel : ViewModelBase
{
    private readonly IMusicCatalogService _catalogService;
    private readonly ILibraryService _libraryService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    [ObservableProperty]
    private string _greeting = "Good afternoon";

    [ObservableProperty]
    private ObservableCollection<Track> _recentlyPlayed = new();

    [ObservableProperty]
    private ObservableCollection<Album> _newReleases = new();

    [ObservableProperty]
    private ObservableCollection<Playlist> _featuredPlaylists = new();

    [ObservableProperty]
    private ObservableCollection<Track> _featuredTracks = new();

    [ObservableProperty]
    private ObservableCollection<Artist> _topArtists = new();

    public HomeViewModel(
        IMusicCatalogService catalogService,
        ILibraryService libraryService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService)
    {
        _catalogService = catalogService;
        _libraryService = libraryService;
        _playbackService = playbackService;
        _navigationService = navigationService;

        UpdateGreeting();
    }

    public override async Task InitializeAsync()
    {
        IsLoading = true;
        ClearError();

        try
        {
            await Task.WhenAll(
                LoadRecentlyPlayedAsync(),
                LoadNewReleasesAsync(),
                LoadFeaturedPlaylistsAsync(),
                LoadFeaturedTracksAsync(),
                LoadTopArtistsAsync()
            );
        }
        catch (Exception ex)
        {
            SetError($"Failed to load content: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    private void UpdateGreeting()
    {
        var hour = DateTime.Now.Hour;
        Greeting = hour switch
        {
            >= 5 and < 12 => "Good morning",
            >= 12 and < 17 => "Good afternoon",
            >= 17 and < 21 => "Good evening",
            _ => "Good night"
        };
    }

    private async Task LoadRecentlyPlayedAsync()
    {
        var tracks = await _libraryService.GetRecentlyPlayedAsync(20);
        RecentlyPlayed = new ObservableCollection<Track>(tracks);
    }

    private async Task LoadNewReleasesAsync()
    {
        var albums = await _catalogService.GetNewReleasesAsync();
        NewReleases = new ObservableCollection<Album>(albums);
    }

    private async Task LoadFeaturedPlaylistsAsync()
    {
        var playlists = await _catalogService.GetFeaturedPlaylistsAsync();
        FeaturedPlaylists = new ObservableCollection<Playlist>(playlists);
    }

    private async Task LoadFeaturedTracksAsync()
    {
        var tracks = await _catalogService.GetFeaturedTracksAsync();
        FeaturedTracks = new ObservableCollection<Track>(tracks);
    }

    private async Task LoadTopArtistsAsync()
    {
        var artists = await _catalogService.GetTopArtistsAsync();
        TopArtists = new ObservableCollection<Artist>(artists);
    }

    [RelayCommand]
    private async Task PlayTrack(Track track)
    {
        await _playbackService.PlayAsync(track);
        await _libraryService.AddToRecentlyPlayedAsync(track);
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
    private void NavigateToPlaylist(Playlist playlist)
    {
        _navigationService.NavigateToPlaylist(playlist.Id);
    }
}
