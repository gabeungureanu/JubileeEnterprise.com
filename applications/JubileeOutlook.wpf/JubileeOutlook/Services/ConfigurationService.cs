using System.IO;
using Microsoft.Extensions.Configuration;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Configuration service for loading and managing application settings
/// Supports environment-specific configuration files and environment variables
/// </summary>
public class ConfigurationService
{
    private static ConfigurationService? _instance;
    private static readonly object _lock = new();

    private readonly IConfiguration _configuration;
    private readonly RootConfig _rootConfig;

    /// <summary>
    /// Singleton instance of the configuration service
    /// </summary>
    public static ConfigurationService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ConfigurationService();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Gets the current environment name (Development, Staging, Production)
    /// </summary>
    public string Environment => _rootConfig.AppSettings.Environment;

    /// <summary>
    /// Gets the application version
    /// </summary>
    public string Version => _rootConfig.AppSettings.Version;

    /// <summary>
    /// Gets the API configuration
    /// </summary>
    public ApiConfig Api => _rootConfig.Api;

    /// <summary>
    /// Gets the feature flags configuration
    /// </summary>
    public FeaturesConfig Features => _rootConfig.Features;

    /// <summary>
    /// Gets the storage configuration
    /// </summary>
    public StorageConfig Storage => _rootConfig.Storage;

    /// <summary>
    /// Gets the local cache configuration for PostgreSQL offline support
    /// </summary>
    public LocalCacheSettings LocalCache => _rootConfig.LocalCache;

    /// <summary>
    /// Gets the raw IConfiguration for advanced scenarios
    /// </summary>
    public IConfiguration Configuration => _configuration;

    private ConfigurationService()
    {
        // Determine environment from environment variable or default to Production
        var environmentName = System.Environment.GetEnvironmentVariable("JUBILEE_ENVIRONMENT")
            ?? System.Environment.GetEnvironmentVariable("DOTNET_ENVIRONMENT")
            ?? System.Environment.GetEnvironmentVariable("ASPNETCORE_ENVIRONMENT")
            ?? "Production";

        var basePath = AppDomain.CurrentDomain.BaseDirectory;

        System.Diagnostics.Debug.WriteLine($"ConfigurationService: Loading configuration for environment '{environmentName}'");
        System.Diagnostics.Debug.WriteLine($"ConfigurationService: Base path '{basePath}'");

        // Build configuration with layered approach
        var builder = new ConfigurationBuilder()
            .SetBasePath(basePath)
            .AddJsonFile("appsettings.json", optional: false, reloadOnChange: true)
            .AddJsonFile($"appsettings.{environmentName}.json", optional: true, reloadOnChange: true)
            .AddEnvironmentVariables("JUBILEE_"); // Environment variables prefixed with JUBILEE_

        _configuration = builder.Build();

        // Bind to strongly-typed configuration
        _rootConfig = new RootConfig();
        _configuration.Bind(_rootConfig);

        // Override environment from config if not set by environment variable
        if (string.IsNullOrEmpty(System.Environment.GetEnvironmentVariable("JUBILEE_ENVIRONMENT")))
        {
            var configEnv = _configuration.GetValue<string>("AppSettings:Environment");
            if (!string.IsNullOrEmpty(configEnv))
            {
                _rootConfig.AppSettings.Environment = configEnv;
            }
        }
        else
        {
            _rootConfig.AppSettings.Environment = environmentName;
        }

        LogConfiguration();
    }

    /// <summary>
    /// Gets a configuration value by key
    /// </summary>
    public T? GetValue<T>(string key)
    {
        return _configuration.GetValue<T>(key);
    }

    /// <summary>
    /// Gets a configuration section
    /// </summary>
    public IConfigurationSection GetSection(string key)
    {
        return _configuration.GetSection(key);
    }

    /// <summary>
    /// Gets the InspireContinuum API base URL
    /// </summary>
    public string GetInspireContinuumBaseUrl()
    {
        return Api.InspireContinuum.BaseUrl;
    }

    /// <summary>
    /// Gets the InspireCodex API base URL
    /// </summary>
    public string GetInspireCodexBaseUrl()
    {
        return Api.InspireCodex.BaseUrl;
    }

    /// <summary>
    /// Gets the Auth API base URL
    /// </summary>
    public string GetAuthBaseUrl()
    {
        return Api.Auth.BaseUrl;
    }

    /// <summary>
    /// Checks if debug logging is enabled
    /// </summary>
    public bool IsDebugLoggingEnabled()
    {
        return Features.EnableDebugLogging;
    }

    /// <summary>
    /// Checks if database integration is enabled
    /// </summary>
    public bool IsDatabaseIntegrationEnabled()
    {
        return Features.EnableDatabaseIntegration;
    }

    /// <summary>
    /// Checks if offline mode is enabled
    /// </summary>
    public bool IsOfflineModeEnabled()
    {
        return LocalCache.EnableOfflineMode;
    }

    /// <summary>
    /// Gets the PostgreSQL connection string for local cache
    /// </summary>
    public string GetLocalCacheConnectionString()
    {
        return LocalCache.ConnectionString;
    }

    /// <summary>
    /// Checks if the current environment is Development
    /// </summary>
    public bool IsDevelopment()
    {
        return string.Equals(Environment, "Development", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Checks if the current environment is Staging
    /// </summary>
    public bool IsStaging()
    {
        return string.Equals(Environment, "Staging", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Checks if the current environment is Production
    /// </summary>
    public bool IsProduction()
    {
        return string.Equals(Environment, "Production", StringComparison.OrdinalIgnoreCase);
    }

    /// <summary>
    /// Reloads the configuration (useful for development)
    /// </summary>
    public static void Reload()
    {
        lock (_lock)
        {
            _instance = new ConfigurationService();
        }
    }

    private void LogConfiguration()
    {
        if (!Features.EnableDebugLogging) return;

        System.Diagnostics.Debug.WriteLine("=== JubileeOutlook Configuration ===");
        System.Diagnostics.Debug.WriteLine($"Environment: {Environment}");
        System.Diagnostics.Debug.WriteLine($"Version: {Version}");
        System.Diagnostics.Debug.WriteLine($"InspireContinuum API: {Api.InspireContinuum.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"InspireCodex API: {Api.InspireCodex.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"Auth API: {Api.Auth.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"Database Integration: {Features.EnableDatabaseIntegration}");
        System.Diagnostics.Debug.WriteLine($"Debug Logging: {Features.EnableDebugLogging}");
        System.Diagnostics.Debug.WriteLine($"Telemetry: {Features.EnableTelemetry}");
        System.Diagnostics.Debug.WriteLine($"Offline Mode: {LocalCache.EnableOfflineMode}");
        System.Diagnostics.Debug.WriteLine($"Sync Interval: {LocalCache.SyncIntervalSeconds}s");
        System.Diagnostics.Debug.WriteLine("====================================");
    }
}
