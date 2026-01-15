namespace JubileeOutlook.Models;

/// <summary>
/// Configuration settings for PostgreSQL local cache database
/// </summary>
public class LocalCacheSettings
{
    /// <summary>
    /// PostgreSQL connection string for the local cache database
    /// </summary>
    public string ConnectionString { get; set; } = string.Empty;

    /// <summary>
    /// Enable or disable offline mode functionality
    /// </summary>
    public bool EnableOfflineMode { get; set; } = true;

    /// <summary>
    /// Interval in seconds between sync operations
    /// </summary>
    public int SyncIntervalSeconds { get; set; } = 300;

    /// <summary>
    /// Maximum age in days for cached data before cleanup
    /// </summary>
    public int MaxCacheAgeDays { get; set; } = 30;

    /// <summary>
    /// Maximum number of retry attempts for failed sync operations
    /// </summary>
    public int MaxRetryAttempts { get; set; } = 3;

    /// <summary>
    /// Number of connections in the PostgreSQL connection pool
    /// </summary>
    public int ConnectionPoolSize { get; set; } = 10;
}
