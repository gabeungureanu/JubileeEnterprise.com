using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Service configuration for toggling between Mock and API services
/// Manages service instances and authenticated user context
/// </summary>
public static class ServiceConfiguration
{
    private static ICalendarService? _calendarService;
    private static IMailService? _mailService;
    private static bool _useApiServices = false;
    private static string? _apiBaseUrl;
    private static string? _userId;
    private static string? _userEmail;
    private static bool _isInitialized = false;

    /// <summary>
    /// Event fired when services are reconfigured
    /// </summary>
    public static event EventHandler? ServicesChanged;

    /// <summary>
    /// Event fired when authenticated user changes
    /// </summary>
    public static event EventHandler<UserChangedEventArgs>? UserChanged;

    /// <summary>
    /// Gets or sets whether to use API services (true) or Mock services (false)
    /// </summary>
    public static bool UseApiServices
    {
        get => _useApiServices;
        set
        {
            if (_useApiServices != value)
            {
                _useApiServices = value;
                ResetServices();
                System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] UseApiServices changed to: {value}");
            }
        }
    }

    /// <summary>
    /// Gets or sets the InspireContinuum API base URL
    /// </summary>
    public static string? ApiBaseUrl
    {
        get => _apiBaseUrl;
        set
        {
            if (_apiBaseUrl != value)
            {
                _apiBaseUrl = value;
                ResetServices();
                System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] ApiBaseUrl changed to: {value}");
            }
        }
    }

    /// <summary>
    /// Gets the authenticated user ID
    /// </summary>
    public static string? UserId => _userId;

    /// <summary>
    /// Gets the authenticated user email
    /// </summary>
    public static string? UserEmail => _userEmail;

    /// <summary>
    /// Gets whether a user is currently authenticated
    /// </summary>
    public static bool IsAuthenticated => !string.IsNullOrEmpty(_userId);

    /// <summary>
    /// Returns the authenticated user ID or throws if not authenticated.
    /// Use this instead of falling back to a test user ID.
    /// </summary>
    public static string RequireUserId()
    {
        if (string.IsNullOrEmpty(_userId))
        {
            throw new InvalidOperationException("User is not authenticated. Please sign in to continue.");
        }
        return _userId;
    }

    /// <summary>
    /// Initializes the service configuration
    /// Reads from environment variables and configuration settings
    /// </summary>
    public static void Initialize(bool? useApi = null, string? apiUrl = null, string? userId = null)
    {
        if (_isInitialized && useApi == null && apiUrl == null && userId == null)
        {
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Already initialized, skipping");
            return;
        }

        var config = ConfigurationService.Instance;

        // Read CONTINUUM_API_URL from environment, fallback to parameter, then config
        _apiBaseUrl = apiUrl
            ?? Environment.GetEnvironmentVariable("CONTINUUM_API_URL")
            ?? config.Api.InspireContinuum.BaseUrl;

        // Read user ID from parameter or environment
        // No default fallback — authentication is required
        _userId = userId
            ?? Environment.GetEnvironmentVariable("JUBILEE_USER_ID");

        // Determine whether to use API services
        // Priority: Parameter > Environment variable > Config setting
        if (useApi.HasValue)
        {
            _useApiServices = useApi.Value;
        }
        else
        {
            var useApiEnv = Environment.GetEnvironmentVariable("JUBILEE_USE_API_SERVICES");
            if (!string.IsNullOrEmpty(useApiEnv))
            {
                _useApiServices = useApiEnv.Equals("true", StringComparison.OrdinalIgnoreCase) ||
                                 useApiEnv.Equals("1", StringComparison.OrdinalIgnoreCase);
            }
            else
            {
                // Default: Use API services if database integration is enabled in config
                _useApiServices = config.Features.EnableDatabaseIntegration;
            }
        }

        _isInitialized = true;

        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Initialized");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration]   UseApiServices: {_useApiServices}");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration]   ApiBaseUrl: {_apiBaseUrl}");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration]   UserId: {_userId ?? "(not set)"}");
    }

    /// <summary>
    /// Sets the authenticated user context
    /// Call this after successful login
    /// </summary>
    public static void SetAuthenticatedUser(string? userId, string? email)
    {
        var previousUserId = _userId;
        _userId = userId;
        _userEmail = email;

        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] ========== USER AUTHENTICATED ==========");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Previous UserId: {previousUserId ?? "(null)"}");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] New UserId: {userId ?? "(null)"}");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Email: {email ?? "(null)"}");
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] ========================================");

        // Notify listeners of user change
        if (previousUserId != userId)
        {
            OnUserChanged(new UserChangedEventArgs
            {
                PreviousUserId = previousUserId,
                NewUserId = userId,
                NewUserEmail = email
            });

            // Clear cached data when user changes
            ClearServiceCaches();
        }
    }

    /// <summary>
    /// Clears the authenticated user (logout)
    /// </summary>
    public static void ClearAuthenticatedUser()
    {
        SetAuthenticatedUser(null, null);
    }

    /// <summary>
    /// Gets the calendar service (API or Mock based on configuration)
    /// </summary>
    public static ICalendarService GetCalendarService()
    {
        EnsureInitialized();

        if (_calendarService == null)
        {
            _calendarService = CreateCalendarService();
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Created CalendarService (UseAPI: {_useApiServices})");
        }
        return _calendarService;
    }

    /// <summary>
    /// Gets the mail service (API or Mock based on configuration)
    /// </summary>
    public static IMailService GetMailService()
    {
        EnsureInitialized();

        if (_mailService == null)
        {
            _mailService = CreateMailService();
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Created MailService (UseAPI: {_useApiServices})");
        }
        return _mailService;
    }

    /// <summary>
    /// Resets all service instances (forces recreation on next access)
    /// </summary>
    public static void ResetServices()
    {
        _calendarService = null;
        _mailService = null;

        // Reset singleton API service instances
        ApiMailService.Reset();
        ApiCalendarService.Reset();

        OnServicesChanged();
        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Services reset");
    }

    /// <summary>
    /// Clears cached data in services without resetting instances
    /// </summary>
    public static void ClearServiceCaches()
    {
        if (_mailService is ApiMailService apiMailService)
        {
            apiMailService.ClearFoldersCache();
        }

        System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Service caches cleared");
    }

    #region Private Methods

    private static void EnsureInitialized()
    {
        if (!_isInitialized)
        {
            Initialize();
        }
    }

    private static ICalendarService CreateCalendarService()
    {
        // Write to log file for debugging
        var logPath = System.IO.Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData), "JubileeOutlook", "startup.log");
        System.IO.File.AppendAllText(logPath, $"\n[{DateTime.Now:HH:mm:ss}] CreateCalendarService called, _useApiServices = {_useApiServices}\n");

        if (_useApiServices)
        {
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Creating ApiCalendarService");
            System.IO.File.AppendAllText(logPath, $"[{DateTime.Now:HH:mm:ss}] Returning ApiCalendarService.Instance\n");
            return ApiCalendarService.Instance;
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Creating MockCalendarService");
            System.IO.File.AppendAllText(logPath, $"[{DateTime.Now:HH:mm:ss}] Returning MockCalendarService\n");
            return new MockCalendarService();
        }
    }

    private static IMailService CreateMailService()
    {
        if (_useApiServices)
        {
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Creating ApiMailService");
            return ApiMailService.Instance;
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[ServiceConfiguration] Creating MockMailService");
            return new MockMailService();
        }
    }

    private static void OnServicesChanged()
    {
        ServicesChanged?.Invoke(null, EventArgs.Empty);
    }

    private static void OnUserChanged(UserChangedEventArgs e)
    {
        UserChanged?.Invoke(null, e);
    }

    #endregion
}

/// <summary>
/// Event arguments for user changed event
/// </summary>
public class UserChangedEventArgs : EventArgs
{
    public string? PreviousUserId { get; set; }
    public string? NewUserId { get; set; }
    public string? NewUserEmail { get; set; }
}
