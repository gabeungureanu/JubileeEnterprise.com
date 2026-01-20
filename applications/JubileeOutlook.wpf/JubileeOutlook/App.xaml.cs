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
        Console.WriteLine("[JubileeOutlook] Showing Authentication Window...");
        var authWindow = new AuthenticationWindow();
        var authResult = authWindow.ShowDialog();

        // Check if authentication was successful
        if (authResult != true || !authWindow.AuthenticationSuccessful)
        {
            Console.WriteLine("[JubileeOutlook] Authentication cancelled or failed. Shutting down.");
            Shutdown();
            return;
        }

        Console.WriteLine("[JubileeOutlook] Authentication successful!");

        // Create and show the main window after successful authentication
        // This ensures the CalendarViewModel gets the properly configured service
        Console.WriteLine("[JubileeOutlook] Creating MainWindow...");
        var mainWindow = new MainWindow();
        Console.WriteLine("[JubileeOutlook] Showing MainWindow...");
        mainWindow.Show();
        Console.WriteLine("[JubileeOutlook] MainWindow shown");
    }
}
