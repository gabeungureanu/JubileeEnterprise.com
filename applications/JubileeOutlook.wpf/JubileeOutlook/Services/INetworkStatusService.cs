namespace JubileeOutlook.Services;

/// <summary>
/// Event arguments for network status changes
/// </summary>
public class NetworkStatusChangedEventArgs : EventArgs
{
    /// <summary>
    /// Gets whether the network is currently online
    /// </summary>
    public bool IsOnline { get; }

    /// <summary>
    /// Gets whether the API endpoint is reachable
    /// </summary>
    public bool IsApiReachable { get; }

    /// <summary>
    /// Gets the timestamp when the status changed
    /// </summary>
    public DateTime Timestamp { get; }

    /// <summary>
    /// Gets the reason for the status change (if available)
    /// </summary>
    public string? Reason { get; }

    public NetworkStatusChangedEventArgs(bool isOnline, bool isApiReachable, string? reason = null)
    {
        IsOnline = isOnline;
        IsApiReachable = isApiReachable;
        Timestamp = DateTime.UtcNow;
        Reason = reason;
    }
}

/// <summary>
/// Interface for the network status service that monitors connectivity
/// Provides real-time network status and API reachability information
/// </summary>
public interface INetworkStatusService : IDisposable
{
    /// <summary>
    /// Gets whether the device has network connectivity
    /// </summary>
    bool IsOnline { get; }

    /// <summary>
    /// Gets whether the API endpoint is reachable
    /// </summary>
    bool IsApiReachable { get; }

    /// <summary>
    /// Gets whether the service is currently monitoring
    /// </summary>
    bool IsMonitoring { get; }

    /// <summary>
    /// Gets the last time the network status was checked
    /// </summary>
    DateTime? LastCheckTime { get; }

    /// <summary>
    /// Gets the last time the API was successfully reached
    /// </summary>
    DateTime? LastApiSuccessTime { get; }

    /// <summary>
    /// Event raised when network status changes
    /// </summary>
    event EventHandler<NetworkStatusChangedEventArgs>? NetworkStatusChanged;

    /// <summary>
    /// Starts monitoring network status with automatic polling
    /// </summary>
    void StartMonitoring();

    /// <summary>
    /// Stops monitoring network status
    /// </summary>
    void StopMonitoring();

    /// <summary>
    /// Forces an immediate network status check
    /// </summary>
    /// <returns>True if online and API is reachable</returns>
    Task<bool> CheckNetworkStatusAsync();

    /// <summary>
    /// Checks if a specific URL is reachable
    /// </summary>
    /// <param name="url">The URL to check</param>
    /// <param name="timeoutMs">Timeout in milliseconds</param>
    /// <returns>True if the URL is reachable</returns>
    Task<bool> IsUrlReachableAsync(string url, int timeoutMs = 5000);
}
