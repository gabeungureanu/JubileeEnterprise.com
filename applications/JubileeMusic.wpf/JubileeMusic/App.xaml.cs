using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using JubileeMusic.Services;
using JubileeMusic.ViewModels;
using JubileeMusic.Views;

namespace JubileeMusic;

public partial class App : Application
{
    private static IServiceProvider? _serviceProvider;
    public static IServiceProvider Services => _serviceProvider ?? throw new InvalidOperationException("Services not initialized");

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        var services = new ServiceCollection();
        ConfigureServices(services);
        _serviceProvider = services.BuildServiceProvider();

        // Initialize logging
        var logger = Services.GetRequiredService<ILogger<App>>();
        logger.LogInformation("JubileeMusic application starting...");

        // Initialize credential service
        var credentialService = Services.GetRequiredService<ICredentialService>();
        credentialService.Initialize();

        // Create and show main window
        var mainWindow = Services.GetRequiredService<MainWindow>();
        mainWindow.Show();
    }

    private static void ConfigureServices(IServiceCollection services)
    {
        // Logging
        services.AddLogging(builder =>
        {
            builder.AddConsole();
            builder.SetMinimumLevel(LogLevel.Debug);
            builder.AddProvider(new FileLoggerProvider());
        });

        // Singleton services
        services.AddSingleton<ILoggingService, FileLoggingService>();
        services.AddSingleton<ICredentialService, CredentialService>();
        services.AddSingleton<ILibraryService, LibraryService>();
        services.AddSingleton<ISunoAutomationService, SunoAutomationService>();
        services.AddSingleton<IAudioPlayerService, AudioPlayerService>();
        services.AddSingleton<INavigationService, NavigationService>();

        // ViewModels (as singletons to maintain state)
        services.AddSingleton<MainViewModel>();
        services.AddSingleton<BrowserViewModel>();
        services.AddSingleton<CreateViewModel>();
        services.AddSingleton<LibraryViewModel>();
        services.AddSingleton<SettingsViewModel>();

        // Views
        services.AddTransient<MainWindow>();
    }

    protected override void OnExit(ExitEventArgs e)
    {
        var logger = Services.GetService<ILogger<App>>();
        logger?.LogInformation("JubileeMusic application shutting down...");

        // Cleanup services
        var audioPlayer = Services.GetService<IAudioPlayerService>();
        audioPlayer?.Dispose();

        var loggingService = Services.GetService<ILoggingService>();
        (loggingService as IDisposable)?.Dispose();

        base.OnExit(e);
    }
}
