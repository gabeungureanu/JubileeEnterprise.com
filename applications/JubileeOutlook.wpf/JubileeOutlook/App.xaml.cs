using System.Configuration;
using System.Data;
using System.Runtime.InteropServices;
using System.Windows;
using JubileeOutlook.Services;
using JubileeOutlook.Views;

namespace JubileeOutlook;

/// <summary>
/// Interaction logic for App.xaml
/// </summary>
public partial class App : Application
{
    [DllImport("kernel32.dll")]
    private static extern bool AllocConsole();

    protected override void OnStartup(StartupEventArgs e)
    {
        base.OnStartup(e);
#if DEBUG
        AllocConsole();
        Console.WriteLine("[JubileeOutlook] Console attached for debugging");
#endif

        // Add global exception handlers
        AppDomain.CurrentDomain.UnhandledException += (s, args) =>
        {
            var ex = args.ExceptionObject as Exception;
            LogException("AppDomain.UnhandledException", ex);
        };

        DispatcherUnhandledException += (s, args) =>
        {
            LogException("DispatcherUnhandledException", args.Exception);
            args.Handled = true;
        };

        TaskScheduler.UnobservedTaskException += (s, args) =>
        {
            LogException("TaskScheduler.UnobservedTaskException", args.Exception);
            args.SetObserved();
        };

        // Initialize service configuration for database integration
        // Configuration is read from appsettings.json (Features.EnableDatabaseIntegration)
        // Environment variables can override:
        //   - JUBILEE_USE_API: Set to "true" to force API mode, "false" for mock
        //   - CONTINUUM_API_URL: API base URL (overrides config)
        //   - JUBILEE_USER_ID: User ID for API calls (default: demo-user-001)
        var config = ConfigurationService.Instance;

        // Check environment variable first, then fall back to config setting
        var useApiEnv = Environment.GetEnvironmentVariable("JUBILEE_USE_API")?.ToLower();
        bool useApi;

        // Write debug info to log file
        var logPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JubileeOutlook", "startup.log");
        System.IO.Directory.CreateDirectory(System.IO.Path.GetDirectoryName(logPath)!);
        var logLines = new System.Collections.Generic.List<string>
        {
            $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] JubileeOutlook Starting",
            $"JUBILEE_USE_API env: '{useApiEnv ?? "(not set)"}'",
            $"config.Features.EnableDatabaseIntegration: {config.Features.EnableDatabaseIntegration}"
        };

        Console.WriteLine($"[JubileeOutlook] JUBILEE_USE_API env: '{useApiEnv ?? "(not set)"}'");
        Console.WriteLine($"[JubileeOutlook] config.Features.EnableDatabaseIntegration: {config.Features.EnableDatabaseIntegration}");

        if (!string.IsNullOrEmpty(useApiEnv))
        {
            useApi = useApiEnv == "true" || useApiEnv == "1";
            logLines.Add($"Using env var, useApi = {useApi}");
            Console.WriteLine($"[JubileeOutlook] Using env var, useApi = {useApi}");
        }
        else
        {
            // Use config file setting (EnableDatabaseIntegration)
            useApi = config.Features.EnableDatabaseIntegration;
            logLines.Add($"Using config, useApi = {useApi}");
            Console.WriteLine($"[JubileeOutlook] Using config, useApi = {useApi}");
        }

        logLines.Add($"Final useApi = {useApi}");

        // Use config file URL (environment variable may be stale/outdated)
        var apiUrl = config.Api.InspireContinuum.BaseUrl;
        var userId = Environment.GetEnvironmentVariable("JUBILEE_USER_ID") ?? "00000000-0000-0000-0000-000000000001";

        logLines.Add($"apiUrl = {apiUrl}");
        logLines.Add($"userId = {userId}");
        logLines.Add($"Calling ServiceConfiguration.Initialize({useApi}, {apiUrl}, {userId})");
        System.IO.File.WriteAllLines(logPath, logLines);

        ServiceConfiguration.Initialize(useApi, apiUrl, userId);
        Console.WriteLine($"[JubileeOutlook] Service mode: {(useApi ? "API (Persistent)" : "Mock (In-Memory)")}");
        Console.WriteLine($"[JubileeOutlook] API URL: {apiUrl}");
        Console.WriteLine($"[JubileeOutlook] User ID: {ServiceConfiguration.UserId}");
        Console.WriteLine($"[JubileeOutlook] UseApiServices: {ServiceConfiguration.UseApiServices}");

        // Show authentication window first - this is the mandatory access gate
        try
        {
            // Temporarily prevent app shutdown while showing the auth dialog
            // This ensures the app doesn't exit when the auth dialog closes
            ShutdownMode = ShutdownMode.OnExplicitShutdown;
            Console.WriteLine("[JubileeOutlook] ShutdownMode set to OnExplicitShutdown");

            Console.WriteLine("[JubileeOutlook] Creating Authentication Window...");
            logLines.Add("Creating Authentication Window...");
            System.IO.File.WriteAllLines(logPath, logLines);

            var authWindow = new AuthenticationWindow();

            Console.WriteLine("[JubileeOutlook] Showing Authentication Window...");
            logLines.Add("Showing Authentication Window...");
            System.IO.File.WriteAllLines(logPath, logLines);

            var authResult = authWindow.ShowDialog();

            // Check if authentication was successful
            if (authResult != true || !authWindow.AuthenticationSuccessful)
            {
                Console.WriteLine("[JubileeOutlook] Authentication cancelled or failed. Shutting down.");
                logLines.Add("Authentication cancelled or failed. Shutting down.");
                System.IO.File.WriteAllLines(logPath, logLines);
                Shutdown();
                return;
            }

            Console.WriteLine("[JubileeOutlook] Authentication successful!");
            logLines.Add("Authentication successful!");
            System.IO.File.WriteAllLines(logPath, logLines);

            // Create and show the main window after successful authentication
            Console.WriteLine("[JubileeOutlook] Creating MainWindow...");
            logLines.Add("Creating MainWindow...");
            System.IO.File.WriteAllLines(logPath, logLines);

            var mainWindow = new MainWindow();
            MainWindow = mainWindow;

            // Now switch shutdown mode so app closes when main window closes
            ShutdownMode = ShutdownMode.OnMainWindowClose;
            Console.WriteLine("[JubileeOutlook] ShutdownMode set to OnMainWindowClose");

            Console.WriteLine("[JubileeOutlook] Showing MainWindow...");
            logLines.Add("Showing MainWindow...");
            System.IO.File.WriteAllLines(logPath, logLines);

            mainWindow.Show();
            Console.WriteLine("[JubileeOutlook] MainWindow shown");
            logLines.Add("MainWindow shown - app should now be running");
            System.IO.File.WriteAllLines(logPath, logLines);
        }
        catch (Exception ex)
        {
            LogException("OnStartup", ex);
            MessageBox.Show($"Failed to start application:\n\n{ex.Message}\n\n{ex.StackTrace}",
                "JubileeOutlook Error", MessageBoxButton.OK, MessageBoxImage.Error);
            Shutdown();
        }
    }

    protected override void OnExit(ExitEventArgs e)
    {
        var logPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JubileeOutlook", "exit.log");
        try
        {
            var exitLog = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] Application exiting\n" +
                          $"ExitCode: {e.ApplicationExitCode}\n" +
                          $"MainWindow: {(MainWindow != null ? "exists" : "null")}\n" +
                          $"MainWindow.IsVisible: {(MainWindow?.IsVisible == true ? "true" : "false")}\n" +
                          $"ShutdownMode: {ShutdownMode}\n" +
                          $"---\n";
            System.IO.File.AppendAllText(logPath, exitLog);
            Console.WriteLine($"[JubileeOutlook] Application exiting - ExitCode: {e.ApplicationExitCode}");
        }
        catch { }
        base.OnExit(e);
    }

    private static void LogException(string source, Exception? ex)
    {
        var logPath = System.IO.Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook", "error.log");

        try
        {
            var errorLog = $"[{DateTime.Now:yyyy-MM-dd HH:mm:ss}] {source}\n" +
                           $"Message: {ex?.Message}\n" +
                           $"StackTrace: {ex?.StackTrace}\n" +
                           $"InnerException: {ex?.InnerException?.Message}\n" +
                           $"---\n";
            System.IO.File.AppendAllText(logPath, errorLog);
            Console.WriteLine($"[JubileeOutlook] ERROR in {source}: {ex?.Message}");
            Console.WriteLine($"[JubileeOutlook] StackTrace: {ex?.StackTrace}");
        }
        catch { }
    }

    /// <summary>
    /// Handles user sign out by closing the current MainWindow and showing a fresh Authentication window.
    /// If authentication succeeds, a new MainWindow is created with fresh state.
    /// If authentication fails or is cancelled, the application shuts down.
    /// </summary>
    public void HandleSignOut()
    {
        Console.WriteLine("[JubileeOutlook] HandleSignOut called - closing MainWindow and showing auth");

        // Switch to explicit shutdown mode so closing MainWindow doesn't exit the app
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        // Close the current MainWindow to clear all session state
        var oldMainWindow = MainWindow;
        MainWindow = null;
        oldMainWindow?.Close();

        Console.WriteLine("[JubileeOutlook] MainWindow closed, showing fresh Authentication window");

        // Show a fresh authentication window
        var authWindow = new AuthenticationWindow();
        var authResult = authWindow.ShowDialog();

        if (authResult != true || !authWindow.AuthenticationSuccessful)
        {
            Console.WriteLine("[JubileeOutlook] Re-authentication cancelled or failed. Shutting down.");
            Shutdown();
            return;
        }

        Console.WriteLine("[JubileeOutlook] Re-authentication successful, creating new MainWindow");

        // Create a completely new MainWindow with fresh state
        var newMainWindow = new MainWindow();
        MainWindow = newMainWindow;

        // Switch back to normal shutdown mode
        ShutdownMode = ShutdownMode.OnMainWindowClose;

        newMainWindow.Show();
        Console.WriteLine("[JubileeOutlook] New MainWindow shown");
    }
}
