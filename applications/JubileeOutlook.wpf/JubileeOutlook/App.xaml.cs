using System.Configuration;
using System.Data;
using System.Runtime.InteropServices;
using System.Windows;
using JubileeOutlook.Services;

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
        if (!string.IsNullOrEmpty(useApiEnv))
        {
            useApi = useApiEnv == "true" || useApiEnv == "1";
        }
        else
        {
            // Use config file setting (EnableDatabaseIntegration)
            useApi = config.Features.EnableDatabaseIntegration;
        }

        var apiUrl = Environment.GetEnvironmentVariable("CONTINUUM_API_URL") ?? config.Api.InspireContinuum.BaseUrl;
        var userId = Environment.GetEnvironmentVariable("JUBILEE_USER_ID") ?? "00000000-0000-0000-0000-000000000001";

        ServiceConfiguration.Initialize(useApi, apiUrl, userId);
        Console.WriteLine($"[JubileeOutlook] Service mode: {(useApi ? "API (Persistent)" : "Mock (In-Memory)")}");
        Console.WriteLine($"[JubileeOutlook] API URL: {apiUrl}");
        Console.WriteLine($"[JubileeOutlook] User ID: {ServiceConfiguration.UserId}");
        Console.WriteLine($"[JubileeOutlook] UseApiServices: {ServiceConfiguration.UseApiServices}");

        // Create and show the main window after service configuration is initialized
        // This ensures the CalendarViewModel gets the properly configured service
        Console.WriteLine("[JubileeOutlook] Creating MainWindow...");
        var mainWindow = new MainWindow();
        Console.WriteLine("[JubileeOutlook] Showing MainWindow...");
        mainWindow.Show();
        Console.WriteLine("[JubileeOutlook] MainWindow shown");
    }
}
