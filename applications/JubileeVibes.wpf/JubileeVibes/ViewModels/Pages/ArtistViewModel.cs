using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class ArtistViewModel : ViewModelBase
{
    private readonly IMusicCatalogService _catalogService;
    private readonly ILibraryService _libraryService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    private string? _artistId;

    [ObservableProperty]
    private Artist? _artist;

    [ObservableProperty]
    private ObservableCollection<Track> _topTracks = new();

    [ObservableProperty]
    private ObservableCollection<Album> _albums = new();

    [ObservableProperty]
    private ObservableCollection<Artist> _relatedArtists = new();

    [ObservableProperty]
    private bool _isFollowing;

    public ArtistViewModel(
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
        if (parameter is string artistId)
        {
            _artistId = artistId;
            await LoadArtistAsync();
        }
    }

    private async Task LoadArtistAsync()
    {
        if (_artistId == null) return;

        IsLoading = true;
        ClearError();

        try
        {
            Artist = await _catalogService.GetArtistAsync(_artistId);

            if (Artist != null)
            {
                IsFollowing = await _libraryService.IsArtistFollowedAsync(_artistId);
                Artist.IsFollowed = IsFollowing;

                var topTracks = await _catalogService.GetArtistTopTracksAsync(_artistId);
                TopTracks = new ObservableCollection<Track>(topTracks);

                var albums = await _catalogService.GetArtistAlbumsAsync(_artistId);
                Albums = new ObservableCollection<Album>(albums);

                var related = await _catalogService.GetRelatedArtistsAsync(_artistId);
                RelatedArtists = new ObservableCollection<Artist>(related);
            }
        }
        catch (Exception ex)
        {
            SetError($"Failed to load artist: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    [RelayCommand]
    private async Task PlayTopTracks()
    {
        if (TopTracks.Any())
        {
            await _playbackService.PlayAsync(TopTracks, 0);
        }
    }

    [RelayCommand]
    private async Task PlayTrack(Track track)
    {
        var index = TopTracks.IndexOf(track);
        await _playbackService.PlayAsync(TopTracks, index);
    }

    [RelayCommand]
    private async Task ToggleFollow()
    {
        if (Artist == null || _artistId == null) return;

        if (IsFollowing)
        {
            await _libraryService.UnfollowArtistAsync(_artistId);
            IsFollowing = false;
        }
        else
        {
            await _libraryService.FollowArtistAsync(_artistId);
            IsFollowing = true;
        }
        Artist.IsFollowed = IsFollowing;
    }

    [RelayCommand]
    private void NavigateToAlbum(Album album)
    {
        _navigationService.NavigateToAlbum(album.Id);
    }

    [RelayCommand]
    private void NavigateToRelatedArtist(Artist artist)
    {
        _navigationService.NavigateToArtist(artist.Id);
    }
}
