using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Infrastructure.Audio;
using JubileeVibes.Infrastructure.Services;
using JubileeVibes.Infrastructure.Api;
using JubileeVibes.Infrastructure.Cache;
using JubileeVibes.ViewModels;
using JubileeVibes.ViewModels.Shell;
using JubileeVibes.ViewModels.Pages;
using JubileeVibes.Views;

namespace JubileeVibes;

public partial class App : Application
{
    private readonly IHost _host;

    public static IServiceProvider Services { get; private set; } = null!;

    public App()
    {
        _host = Host.CreateDefaultBuilder()
            .ConfigureServices((context, services) =>
            {
                ConfigureServices(services);
            })
            .Build();

        Services = _host.Services;
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // Core Services (Singletons)
        services.AddSingleton<ISettingsService, SettingsService>();
        services.AddSingleton<ISecureStorageService, SecureStorageService>();
        services.AddSingleton<ICacheService, LocalCacheService>();

        // Audio Services
        services.AddSingleton<IAudioPlaybackService, NAudioPlaybackEngine>();
        services.AddSingleton<IQueueService, QueueService>();

        // API Services
        services.AddHttpClient();
        services.AddSingleton<IAuthenticationService, AuthenticationService>();
        services.AddSingleton<IMusicCatalogService, MockMusicCatalogService>();
        services.AddSingleton<IPlaylistService, PlaylistService>();
        services.AddSingleton<ILibraryService, LibraryService>();

        // Navigation & Dialog
        services.AddSingleton<INavigationService, NavigationService>();
        services.AddSingleton<IDialogService, DialogService>();

        // ViewModels (Shell - Singletons for persistence)
        services.AddSingleton<MainWindowViewModel>();
        services.AddSingleton<ShellViewModel>();
        services.AddSingleton<SidebarViewModel>();
        services.AddSingleton<NowPlayingBarViewModel>();

        // ViewModels (Pages - Transient for fresh state)
        services.AddTransient<HomeViewModel>();
        services.AddTransient<SearchViewModel>();
        services.AddTransient<LibraryViewModel>();
        services.AddTransient<PlaylistViewModel>();
        services.AddTransient<AlbumViewModel>();
        services.AddTransient<ArtistViewModel>();
        services.AddTransient<SettingsViewModel>();
        services.AddTransient<AccountViewModel>();
        services.AddTransient<QueueViewModel>();

        // Views
        services.AddSingleton<MainWindow>();
    }

    protected override async void OnStartup(StartupEventArgs e)
    {
        await _host.StartAsync();

        // Initialize settings
        var settingsService = Services.GetRequiredService<ISettingsService>();
        await settingsService.LoadAsync();

        // Initialize authentication (try silent login)
        var authService = Services.GetRequiredService<IAuthenticationService>();
        await authService.InitializeAsync();

        // Show main window
        var mainWindow = Services.GetRequiredService<MainWindow>();
        mainWindow.Show();

        base.OnStartup(e);
    }

    protected override async void OnExit(ExitEventArgs e)
    {
        // Save settings before exit
        var settingsService = Services.GetRequiredService<ISettingsService>();
        await settingsService.SaveAsync();

        // Dispose audio engine
        if (Services.GetRequiredService<IAudioPlaybackService>() is IDisposable audioDisposable)
        {
            audioDisposable.Dispose();
        }

        await _host.StopAsync();
        _host.Dispose();

        base.OnExit(e);
    }
}
