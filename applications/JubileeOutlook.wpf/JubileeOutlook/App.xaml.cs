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
        // To enable persistent storage via InspireContinuum API:
        //   1. Run the migration: infrastructure/migrations/continuum/0003_jubilee_outlook_schema.sql
        //   2. Restart InspireContinuum server with the new routes
        //   3. Set environment variable: JUBILEE_USE_API=true
        // Environment variables:
        //   - JUBILEE_USE_API: Set to "true" to use database (default: false = mock data)
        //   - CONTINUUM_API_URL: API base URL (default: https://inspirecontinuum.com/api/v1)
        //   - JUBILEE_USER_ID: User ID for API calls (default: demo-user-001)
        var useApi = Environment.GetEnvironmentVariable("JUBILEE_USE_API")?.ToLower() == "true";
        var apiUrl = Environment.GetEnvironmentVariable("CONTINUUM_API_URL") ?? "https://inspirecontinuum.com/api/v1";
        var userId = Environment.GetEnvironmentVariable("JUBILEE_USER_ID") ?? "demo-user-001";

        ServiceConfiguration.Initialize(useApi, apiUrl, userId);
        Console.WriteLine($"[JubileeOutlook] Service mode: {(useApi ? "API (Persistent)" : "Mock (In-Memory)")}");
    }
}
