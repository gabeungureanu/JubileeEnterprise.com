using CommunityToolkit.Mvvm.ComponentModel;
using Microsoft.Extensions.DependencyInjection;
using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.ViewModels.Pages;

namespace JubileeVibes.ViewModels.Shell;

public partial class ShellViewModel : ViewModelBase
{
    private readonly INavigationService _navigationService;
    private readonly IServiceProvider _serviceProvider;

    [ObservableProperty]
    private ViewModelBase? _currentPageViewModel;

    [ObservableProperty]
    private bool _showNowPlayingPanel = true;

    public NowPlayingBarViewModel NowPlayingBarViewModel { get; }

    public ShellViewModel(
        INavigationService navigationService,
        IServiceProvider serviceProvider,
        NowPlayingBarViewModel nowPlayingBarViewModel)
    {
        _navigationService = navigationService;
        _serviceProvider = serviceProvider;
        NowPlayingBarViewModel = nowPlayingBarViewModel;

        _navigationService.Navigated += OnNavigated;

        // Navigate to Home by default
        _navigationService.NavigateTo(NavigationTarget.Home);
    }

    private async void OnNavigated(object? sender, NavigationEventArgs e)
    {
        // Leave current page
        if (CurrentPageViewModel != null)
        {
            await CurrentPageViewModel.OnNavigatedFrom();
        }

        // Create new view model for the target page
        CurrentPageViewModel = e.Target switch
        {
            NavigationTarget.Home => _serviceProvider.GetRequiredService<HomeViewModel>(),
            NavigationTarget.Search => _serviceProvider.GetRequiredService<SearchViewModel>(),
            NavigationTarget.Library => _serviceProvider.GetRequiredService<LibraryViewModel>(),
            NavigationTarget.Playlist => _serviceProvider.GetRequiredService<PlaylistViewModel>(),
            NavigationTarget.Album => _serviceProvider.GetRequiredService<AlbumViewModel>(),
            NavigationTarget.Artist => _serviceProvider.GetRequiredService<ArtistViewModel>(),
            NavigationTarget.Settings => _serviceProvider.GetRequiredService<SettingsViewModel>(),
            NavigationTarget.Account => _serviceProvider.GetRequiredService<AccountViewModel>(),
            NavigationTarget.Queue => _serviceProvider.GetRequiredService<QueueViewModel>(),
            _ => _serviceProvider.GetRequiredService<HomeViewModel>()
        };

        // Initialize new page
        await CurrentPageViewModel.InitializeAsync();
        await CurrentPageViewModel.OnNavigatedTo(e.Parameter);
    }
}
