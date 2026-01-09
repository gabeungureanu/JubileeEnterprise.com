using System.Collections.ObjectModel;
using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.ViewModels.Shell;

public partial class SidebarViewModel : ViewModelBase
{
    private readonly INavigationService _navigationService;
    private readonly IPlaylistService _playlistService;
    private readonly IAuthenticationService _authenticationService;
    private readonly IDialogService _dialogService;

    [ObservableProperty]
    private ObservableCollection<Playlist> _playlists = new();

    [ObservableProperty]
    private string _userDisplayName = "Account";

    [ObservableProperty]
    private NavigationTarget _currentPage;

    public SidebarViewModel(
        INavigationService navigationService,
        IPlaylistService playlistService,
        IAuthenticationService authenticationService,
        IDialogService dialogService)
    {
        _navigationService = navigationService;
        _playlistService = playlistService;
        _authenticationService = authenticationService;
        _dialogService = dialogService;

        _navigationService.Navigated += OnNavigated;
        _authenticationService.AuthStateChanged += OnAuthStateChanged;

        LoadPlaylistsAsync();
        UpdateUserInfo();
    }

    private void OnNavigated(object? sender, NavigationEventArgs e)
    {
        CurrentPage = e.Target;
    }

    private void OnAuthStateChanged(object? sender, Core.Events.AuthStateChangedEventArgs e)
    {
        UpdateUserInfo();
    }

    private void UpdateUserInfo()
    {
        UserDisplayName = _authenticationService.CurrentUser?.DisplayName ?? "Account";
    }

    private async void LoadPlaylistsAsync()
    {
        try
        {
            var playlists = await _playlistService.GetUserPlaylistsAsync();
            Playlists = new ObservableCollection<Playlist>(playlists);
        }
        catch
        {
            // Silently fail for sidebar loading
        }
    }

    [RelayCommand]
    private void NavigateHome() => _navigationService.NavigateTo(NavigationTarget.Home);

    [RelayCommand]
    private void NavigateSearch() => _navigationService.NavigateTo(NavigationTarget.Search);

    [RelayCommand]
    private void NavigateLibrary() => _navigationService.NavigateTo(NavigationTarget.Library);

    [RelayCommand]
    private void NavigateSettings() => _navigationService.NavigateTo(NavigationTarget.Settings);

    [RelayCommand]
    private void NavigateAccount() => _navigationService.NavigateTo(NavigationTarget.Account);

    [RelayCommand]
    private void NavigateLikedSongs()
    {
        _navigationService.NavigateToPlaylist("liked-songs");
    }

    [RelayCommand]
    private void NavigatePlaylist(string playlistId)
    {
        _navigationService.NavigateToPlaylist(playlistId);
    }

    [RelayCommand]
    private async Task CreatePlaylist()
    {
        var name = await _dialogService.ShowInputAsync("Create Playlist", "Enter playlist name:", "My Playlist");
        if (!string.IsNullOrWhiteSpace(name))
        {
            try
            {
                var playlist = await _playlistService.CreatePlaylistAsync(name);
                Playlists.Insert(0, playlist);
                _navigationService.NavigateToPlaylist(playlist.Id);
            }
            catch (Exception ex)
            {
                await _dialogService.ShowErrorAsync("Error", $"Failed to create playlist: {ex.Message}");
            }
        }
    }
}
