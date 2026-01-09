using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Pages;

public partial class SearchViewModel : ViewModelBase
{
    private readonly IMusicCatalogService _catalogService;
    private readonly IAudioPlaybackService _playbackService;
    private readonly INavigationService _navigationService;

    private System.Timers.Timer? _debounceTimer;

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private bool _hasResults;

    [ObservableProperty]
    private bool _isSearching;

    [ObservableProperty]
    private ObservableCollection<Track> _tracks = new();

    [ObservableProperty]
    private ObservableCollection<Album> _albums = new();

    [ObservableProperty]
    private ObservableCollection<Artist> _artists = new();

    [ObservableProperty]
    private ObservableCollection<Playlist> _playlists = new();

    [ObservableProperty]
    private ObservableCollection<Category> _categories = new();

    [ObservableProperty]
    private string _selectedFilter = "all";

    public SearchViewModel(
        IMusicCatalogService catalogService,
        IAudioPlaybackService playbackService,
        INavigationService navigationService)
    {
        _catalogService = catalogService;
        _playbackService = playbackService;
        _navigationService = navigationService;
    }

    public override async Task InitializeAsync()
    {
        // Load browse categories
        try
        {
            var categories = await _catalogService.GetCategoriesAsync();
            Categories = new ObservableCollection<Category>(categories);
        }
        catch
        {
            // Silently fail
        }
    }

    partial void OnSearchQueryChanged(string value)
    {
        // Debounce search
        _debounceTimer?.Stop();
        _debounceTimer?.Dispose();

        if (string.IsNullOrWhiteSpace(value))
        {
            ClearResults();
            return;
        }

        _debounceTimer = new System.Timers.Timer(300);
        _debounceTimer.Elapsed += async (s, e) =>
        {
            _debounceTimer?.Stop();
            await PerformSearchAsync(value);
        };
        _debounceTimer.Start();
    }

    private void ClearResults()
    {
        HasResults = false;
        Tracks.Clear();
        Albums.Clear();
        Artists.Clear();
        Playlists.Clear();
    }

    private async Task PerformSearchAsync(string query)
    {
        IsSearching = true;

        try
        {
            var filter = new SearchFilter
            {
                IncludeTracks = SelectedFilter == "all" || SelectedFilter == "tracks",
                IncludeAlbums = SelectedFilter == "all" || SelectedFilter == "albums",
                IncludeArtists = SelectedFilter == "all" || SelectedFilter == "artists",
                IncludePlaylists = SelectedFilter == "all" || SelectedFilter == "playlists",
                Limit = 20
            };

            var result = await _catalogService.SearchAsync(query, filter);

            // Update on UI thread
            await System.Windows.Application.Current.Dispatcher.InvokeAsync(() =>
            {
                Tracks = new ObservableCollection<Track>(result.Tracks);
                Albums = new ObservableCollection<Album>(result.Albums);
                Artists = new ObservableCollection<Artist>(result.Artists);
                Playlists = new ObservableCollection<Playlist>(result.Playlists);

                HasResults = Tracks.Any() || Albums.Any() || Artists.Any() || Playlists.Any();
            });
        }
        catch (Exception ex)
        {
            SetError($"Search failed: {ex.Message}");
        }
        finally
        {
            IsSearching = false;
        }
    }

    [RelayCommand]
    private async Task Search()
    {
        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            await PerformSearchAsync(SearchQuery);
        }
    }

    [RelayCommand]
    private void SetFilter(string filter)
    {
        SelectedFilter = filter;
        if (!string.IsNullOrWhiteSpace(SearchQuery))
        {
            _ = PerformSearchAsync(SearchQuery);
        }
    }

    [RelayCommand]
    private async Task PlayTrack(Track track)
    {
        await _playbackService.PlayAsync(track);
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

    [RelayCommand]
    private void NavigateToCategory(Category category)
    {
        // Would navigate to category browse view
    }
}
