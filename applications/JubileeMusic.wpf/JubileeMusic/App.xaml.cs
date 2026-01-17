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
    private static MainWindow? _mainWindow;
    public static IServiceProvider Services => _serviceProvider ?? throw new InvalidOperationException("Services not initialized");

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);

        // Global exception handlers
        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            var ex = args.ExceptionObject as Exception;
            System.Diagnostics.Debug.WriteLine($"[FATAL] Unhandled domain exception: {ex}");
            MessageBox.Show($"Fatal error: {ex?.Message}\n\n{ex?.StackTrace}", "Application Error", MessageBoxButton.OK, MessageBoxImage.Error);
        };

        DispatcherUnhandledException += (s, args) =>
        {
            System.Diagnostics.Debug.WriteLine($"[FATAL] Dispatcher unhandled exception: {args.Exception}");
            MessageBox.Show($"UI Error: {args.Exception.Message}\n\n{args.Exception.StackTrace}", "UI Error", MessageBoxButton.OK, MessageBoxImage.Error);
            args.Handled = true; // Prevent crash to see error
        };

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
        _mainWindow = Services.GetRequiredService<MainWindow>();
        _mainWindow.Show();
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
        services.AddSingleton<IWindowSettingsService, WindowSettingsService>();
        services.AddSingleton<IWorkflowService, WorkflowService>();

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

        // Ensure window settings are saved (backup in case Closing event didn't fire)
        try
        {
            _mainWindow?.SaveCurrentSettings();
            logger?.LogInformation("Window settings saved during app exit");
        }
        catch (Exception ex)
        {
            logger?.LogError(ex, "Failed to save window settings during app exit");
        }

        // Cleanup services
        var audioPlayer = Services.GetService<IAudioPlayerService>();
        audioPlayer?.Dispose();

        var loggingService = Services.GetService<ILoggingService>();
        (loggingService as IDisposable)?.Dispose();

        base.OnExit(e);
    }
}
