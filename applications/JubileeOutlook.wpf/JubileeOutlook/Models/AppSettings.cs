namespace JubileeOutlook.Models;

/// <summary>
/// Application settings model for configuration binding
/// </summary>
public class AppSettingsConfig
{
    public string Environment { get; set; } = "Production";
    public string Version { get; set; } = "1.0.0";
}

/// <summary>
/// API configuration settings
/// </summary>
public class ApiConfig
{
    public ApiEndpointConfig InspireContinuum { get; set; } = new();
    public ApiEndpointConfig InspireCodex { get; set; } = new();
    public AuthEndpointConfig Auth { get; set; } = new();
    public RetryPolicyConfig RetryPolicy { get; set; } = new();
}

/// <summary>
/// Retry policy configuration
/// </summary>
public class RetryPolicyConfig
{
    public int MaxRetries { get; set; } = 3;
    public int InitialDelayMs { get; set; } = 500;
    public int MaxDelayMs { get; set; } = 30000;
    public bool EnableExponentialBackoff { get; set; } = true;
}

/// <summary>
/// Individual API endpoint configuration
/// </summary>
public class ApiEndpointConfig
{
    public string BaseUrl { get; set; } = string.Empty;
    public int Timeout { get; set; } = 30;
    public int RetryCount { get; set; } = 3;
    public int RetryDelayMs { get; set; } = 1000;
}

/// <summary>
/// Authentication endpoint configuration
/// </summary>
public class AuthEndpointConfig
{
    public string BaseUrl { get; set; } = string.Empty;
    public int Timeout { get; set; } = 30;
    public int TokenRefreshBufferMinutes { get; set; } = 5;
}

/// <summary>
/// Feature flags configuration
/// </summary>
public class FeaturesConfig
{
    public bool EnableDatabaseIntegration { get; set; } = true;
    public bool EnableOfflineMode { get; set; } = false;
    public bool EnableDebugLogging { get; set; } = false;
    public bool EnableTelemetry { get; set; } = true;
}

/// <summary>
/// Storage configuration
/// </summary>
public class StorageConfig
{
    public string LocalDataPath { get; set; } = "%LOCALAPPDATA%\\JubileeOutlook";
    public int CacheExpirationMinutes { get; set; } = 60;
    public int MaxCacheSizeMb { get; set; } = 100;

    /// <summary>
    /// Gets the expanded local data path with environment variables resolved
    /// </summary>
    public string GetExpandedLocalDataPath()
    {
        return Environment.ExpandEnvironmentVariables(LocalDataPath);
    }
}

/// <summary>
/// Root configuration model that maps to appsettings.json structure
/// </summary>
public class RootConfig
{
    public AppSettingsConfig AppSettings { get; set; } = new();
    public ApiConfig Api { get; set; } = new();
    public FeaturesConfig Features { get; set; } = new();
    public StorageConfig Storage { get; set; } = new();
    public LocalCacheSettings LocalCache { get; set; } = new();
    public OAuth2Config OAuth2 { get; set; } = new();
}

/// <summary>
/// OAuth2 configuration for email providers
/// </summary>
public class OAuth2Config
{
    public GoogleOAuth2Config Google { get; set; } = new();
    public MicrosoftOAuth2Config Microsoft { get; set; } = new();
    public YahooOAuth2Config Yahoo { get; set; } = new();
}

/// <summary>
/// Google OAuth2 configuration
/// </summary>
public class GoogleOAuth2Config
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "http://localhost:8890/oauth2callback";

    public bool IsConfigured =>
        !string.IsNullOrEmpty(ClientId) &&
        !ClientId.StartsWith("YOUR_") &&
        !string.IsNullOrEmpty(ClientSecret) &&
        !ClientSecret.StartsWith("YOUR_");
}

/// <summary>
/// Microsoft OAuth2 configuration
/// </summary>
public class MicrosoftOAuth2Config
{
    public string ClientId { get; set; } = string.Empty;
    public string TenantId { get; set; } = "common";
    public string RedirectUri { get; set; } = "http://localhost:8891/oauth2callback";

    public bool IsConfigured =>
        !string.IsNullOrEmpty(ClientId) &&
        !ClientId.StartsWith("YOUR_");
}

/// <summary>
/// Yahoo OAuth2 configuration
/// </summary>
public class YahooOAuth2Config
{
    public string ClientId { get; set; } = string.Empty;
    public string ClientSecret { get; set; } = string.Empty;
    public string RedirectUri { get; set; } = "http://localhost:8892/oauth2callback";

    public bool IsConfigured =>
        !string.IsNullOrEmpty(ClientId) &&
        !ClientId.StartsWith("YOUR_") &&
        !string.IsNullOrEmpty(ClientSecret) &&
        !ClientSecret.StartsWith("YOUR_");
}
