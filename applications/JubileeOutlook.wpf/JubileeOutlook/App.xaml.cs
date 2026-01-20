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

            // Track if MainWindow was created during the event (for seamless transition)
            bool mainWindowCreatedInEvent = false;

            // Subscribe to AuthenticationCompleted to create MainWindow BEFORE auth window closes
            // This ensures a seamless transition with no flicker or gap
            authWindow.AuthenticationCompleted += async (sender, args) =>
            {
                Console.WriteLine("[JubileeOutlook] Authentication successful - preparing MainWindow for seamless transition");
                logLines.Add("Authentication successful!");
                logLines.Add("Creating MainWindow for seamless transition...");
                System.IO.File.WriteAllLines(logPath, logLines);

                // Get auth window reference and its current bounds
                var authWin = sender as AuthenticationWindow;

                // Check if auth window is actually visible (not during auto-login before ShowDialog)
                bool authWindowVisible = authWin != null && authWin.IsVisible;
                Console.WriteLine($"[JubileeOutlook] Auth window visible: {authWindowVisible}");

                // Show the preparing overlay on the auth window to give visual feedback
                if (authWin != null && authWindowVisible)
                {
                    authWin.ShowPreparingOverlay(true, "Preparing your mailbox...");
                    Console.WriteLine("[JubileeOutlook] Showing preparing overlay");

                    // Give the overlay time to render
                    await Task.Delay(50);
                }

                // Create the main window
                var mainWindow = new MainWindow();

                // Match the auth window's position and state for seamless transition (if visible)
                if (authWindowVisible && authWin != null)
                {
                    mainWindow.WindowStartupLocation = WindowStartupLocation.Manual;
                    mainWindow.WindowState = authWin.WindowState;

                    if (authWin.WindowState == WindowState.Maximized)
                    {
                        // For maximized, just match the state - position doesn't matter
                        mainWindow.Left = authWin.RestoreBounds.Left;
                        mainWindow.Top = authWin.RestoreBounds.Top;
                        mainWindow.Width = authWin.RestoreBounds.Width;
                        mainWindow.Height = authWin.RestoreBounds.Height;
                    }
                    else
                    {
                        mainWindow.Left = authWin.Left;
                        mainWindow.Top = authWin.Top;
                        mainWindow.Width = authWin.Width;
                        mainWindow.Height = authWin.Height;
                    }
                }

                MainWindow = mainWindow;

                // Switch shutdown mode
                ShutdownMode = ShutdownMode.OnMainWindowClose;
                Console.WriteLine("[JubileeOutlook] ShutdownMode set to OnMainWindowClose");

                // Create a TaskCompletionSource to wait for MainWindow data to fully load
                var dataLoadingComplete = new TaskCompletionSource<bool>();

                // Subscribe to DataLoadingComplete event to know when mail interface is ready
                void onDataLoadingComplete(object? s, EventArgs e)
                {
                    mainWindow.DataLoadingComplete -= onDataLoadingComplete;
                    Console.WriteLine("[JubileeOutlook] MainWindow DataLoadingComplete event fired");
                    dataLoadingComplete.TrySetResult(true);
                }
                mainWindow.DataLoadingComplete += onDataLoadingComplete;

                // Show MainWindow - it will appear behind the auth window (if visible)
                mainWindow.Show();
                Console.WriteLine("[JubileeOutlook] MainWindow.Show() called");

                // Update overlay message to show loading status
                if (authWin != null && authWindowVisible)
                {
                    authWin.ShowPreparingOverlay(true, "Loading your emails...");
                }

                // Wait for MainWindow data to fully load (includes folders, messages, events)
                await dataLoadingComplete.Task;
                Console.WriteLine("[JubileeOutlook] MainWindow data loading complete");

                // Force a complete render of MainWindow with data
                await mainWindow.Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Loaded);
                await mainWindow.Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Render);

                // Small delay to ensure visual with data is completely ready
                await Task.Delay(100);

                if (authWindowVisible && authWin != null)
                {
                    // Hide auth window - MainWindow is fully loaded with data
                    authWin.Hide();
                    Console.WriteLine("[JubileeOutlook] Auth window hidden - seamless transition complete");
                }

                // Activate MainWindow to bring it to focus
                mainWindow.Activate();

                mainWindowCreatedInEvent = true;
                logLines.Add("MainWindow shown - seamless transition complete");
                System.IO.File.WriteAllLines(logPath, logLines);
            };

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

            // If MainWindow wasn't created in the event (e.g., auto-login before window was visible),
            // create it now as a fallback
            if (!mainWindowCreatedInEvent || MainWindow == null)
            {
                Console.WriteLine("[JubileeOutlook] MainWindow not created in event - creating now as fallback");
                logLines.Add("Creating MainWindow as fallback...");

                var mainWindow = new MainWindow();
                MainWindow = mainWindow;
                ShutdownMode = ShutdownMode.OnMainWindowClose;
                mainWindow.Show();
                mainWindow.Activate();

                logLines.Add("MainWindow created and shown via fallback");
            }

            Console.WriteLine("[JubileeOutlook] Authentication flow complete - MainWindow should be visible");
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
    /// Preserves window state (size, position, maximized) across the transition.
    /// </summary>
    public void HandleSignOut()
    {
        Console.WriteLine("[JubileeOutlook] HandleSignOut called - closing MainWindow and showing auth");

        // Switch to explicit shutdown mode so closing MainWindow doesn't exit the app
        ShutdownMode = ShutdownMode.OnExplicitShutdown;

        // Capture current window state before closing
        var oldMainWindow = MainWindow;
        WindowState savedWindowState = WindowState.Normal;
        double savedWidth = 1200;
        double savedHeight = 800;
        double savedLeft = double.NaN;
        double savedTop = double.NaN;

        if (oldMainWindow != null)
        {
            savedWindowState = oldMainWindow.WindowState;
            // If maximized, get the restore bounds for the normal size
            if (savedWindowState == WindowState.Maximized)
            {
                savedWidth = oldMainWindow.RestoreBounds.Width;
                savedHeight = oldMainWindow.RestoreBounds.Height;
                savedLeft = oldMainWindow.RestoreBounds.Left;
                savedTop = oldMainWindow.RestoreBounds.Top;
            }
            else
            {
                savedWidth = oldMainWindow.Width;
                savedHeight = oldMainWindow.Height;
                savedLeft = oldMainWindow.Left;
                savedTop = oldMainWindow.Top;
            }
            Console.WriteLine($"[JubileeOutlook] Captured window state: {savedWindowState}, Size: {savedWidth}x{savedHeight}, Pos: {savedLeft},{savedTop}");
        }

        // Close the current MainWindow to clear all session state
        MainWindow = null;
        oldMainWindow?.Close();

        Console.WriteLine("[JubileeOutlook] MainWindow closed, showing fresh Authentication window");

        // Show a fresh authentication window - always maximized for consistent UX
        var authWindow = new AuthenticationWindow();
        authWindow.WindowState = WindowState.Maximized;

        // Capture window state for the lambda
        var capturedSavedWindowState = savedWindowState;
        var capturedSavedWidth = savedWidth;
        var capturedSavedHeight = savedHeight;
        var capturedSavedLeft = savedLeft;
        var capturedSavedTop = savedTop;

        // Subscribe to AuthenticationCompleted to create MainWindow BEFORE auth window closes
        // This ensures a seamless transition with no flicker or gap
        authWindow.AuthenticationCompleted += async (sender, args) =>
        {
            Console.WriteLine("[JubileeOutlook] Re-authentication successful - preparing MainWindow for seamless transition");

            // Get auth window reference
            var authWin = sender as AuthenticationWindow;

            // Show the preparing overlay on the auth window
            if (authWin != null && authWin.IsVisible)
            {
                authWin.ShowPreparingOverlay(true, "Preparing your mailbox...");
                Console.WriteLine("[JubileeOutlook] Showing preparing overlay");
                await Task.Delay(50);
            }

            // Create a completely new MainWindow with fresh state, preserving window dimensions
            var newMainWindow = new MainWindow();

            // Apply saved window state to new MainWindow
            newMainWindow.WindowStartupLocation = WindowStartupLocation.Manual;
            newMainWindow.Width = capturedSavedWidth;
            newMainWindow.Height = capturedSavedHeight;
            if (!double.IsNaN(capturedSavedLeft)) newMainWindow.Left = capturedSavedLeft;
            if (!double.IsNaN(capturedSavedTop)) newMainWindow.Top = capturedSavedTop;
            newMainWindow.WindowState = capturedSavedWindowState;

            MainWindow = newMainWindow;

            // Switch back to normal shutdown mode
            ShutdownMode = ShutdownMode.OnMainWindowClose;

            // Create a TaskCompletionSource to wait for MainWindow data to fully load
            var dataLoadingComplete = new TaskCompletionSource<bool>();

            void onDataLoadingComplete(object? s, EventArgs e)
            {
                newMainWindow.DataLoadingComplete -= onDataLoadingComplete;
                Console.WriteLine("[JubileeOutlook] MainWindow DataLoadingComplete event fired");
                dataLoadingComplete.TrySetResult(true);
            }
            newMainWindow.DataLoadingComplete += onDataLoadingComplete;

            // Show MainWindow - it will appear behind the auth window
            newMainWindow.Show();
            Console.WriteLine("[JubileeOutlook] MainWindow.Show() called");

            // Update overlay message to show loading status
            if (authWin != null && authWin.IsVisible)
            {
                authWin.ShowPreparingOverlay(true, "Loading your emails...");
            }

            // Wait for MainWindow data to fully load (includes folders, messages, events)
            await dataLoadingComplete.Task;
            Console.WriteLine("[JubileeOutlook] MainWindow data loading complete");

            // Force a complete render of MainWindow with data
            await newMainWindow.Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Loaded);
            await newMainWindow.Dispatcher.InvokeAsync(() => { }, System.Windows.Threading.DispatcherPriority.Render);

            // Small delay to ensure visual with data is completely ready
            await Task.Delay(100);

            // Now hide auth window - MainWindow is fully loaded with data
            if (authWin != null)
            {
                authWin.Hide();
                Console.WriteLine("[JubileeOutlook] Auth window hidden - seamless transition complete");
            }

            // Activate MainWindow to bring it to focus
            newMainWindow.Activate();

            Console.WriteLine("[JubileeOutlook] New MainWindow shown with preserved window state");
        };

        var authResult = authWindow.ShowDialog();

        if (authResult != true || !authWindow.AuthenticationSuccessful)
        {
            Console.WriteLine("[JubileeOutlook] Re-authentication cancelled or failed. Shutting down.");
            Shutdown();
            return;
        }

        // MainWindow was already created and shown in the AuthenticationCompleted event
        Console.WriteLine("[JubileeOutlook] Sign-out and re-authentication flow complete");
    }
}
