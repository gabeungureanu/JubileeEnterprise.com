using System.Net.NetworkInformation;
using System.Net.Http;

namespace JubileeOutlook.Services;

/// <summary>
/// Service for monitoring network connectivity and API reachability
/// Provides real-time status updates via events and automatic polling
/// </summary>
public class NetworkStatusService : INetworkStatusService
{
    private static NetworkStatusService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClient _httpClient;
    private readonly string _apiHealthCheckUrl;
    private readonly int _pollingIntervalMs;
    private readonly int _healthCheckTimeoutMs;

    private Timer? _pollingTimer;
    private bool _isOnline;
    private bool _isApiReachable;
    private bool _isMonitoring;
    private bool _disposed;
    private DateTime? _lastCheckTime;
    private DateTime? _lastApiSuccessTime;

    /// <summary>
    /// Gets the singleton instance of NetworkStatusService
    /// </summary>
    public static NetworkStatusService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new NetworkStatusService();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Gets whether the device has network connectivity
    /// </summary>
    public bool IsOnline => _isOnline;

    /// <summary>
    /// Gets whether the API endpoint is reachable
    /// </summary>
    public bool IsApiReachable => _isApiReachable;

    /// <summary>
    /// Gets whether the service is currently monitoring
    /// </summary>
    public bool IsMonitoring => _isMonitoring;

    /// <summary>
    /// Gets the last time the network status was checked
    /// </summary>
    public DateTime? LastCheckTime => _lastCheckTime;

    /// <summary>
    /// Gets the last time the API was successfully reached
    /// </summary>
    public DateTime? LastApiSuccessTime => _lastApiSuccessTime;

    /// <summary>
    /// Event raised when network status changes
    /// </summary>
    public event EventHandler<NetworkStatusChangedEventArgs>? NetworkStatusChanged;

    private NetworkStatusService()
    {
        // Get API URL from configuration
        var config = ConfigurationService.Instance;
        // Health endpoint is at the root, not under /api/v1 or /api
        // Strip /api/v1, /api/v2, or /api from base URL to get the server root
        var baseUrl = config.GetInspireContinuumBaseUrl();
        var healthBaseUrl = baseUrl
            .Replace("/api/v1", "")
            .Replace("/api/v2", "")
            .Replace("/api", "")
            .TrimEnd('/');
        _apiHealthCheckUrl = $"{healthBaseUrl}/health";
        _pollingIntervalMs = 30000; // 30 seconds
        _healthCheckTimeoutMs = 5000; // 5 seconds timeout

        // Create HttpClient with timeout
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromMilliseconds(_healthCheckTimeoutMs)
        };

        // Initialize with current network status
        _isOnline = NetworkInterface.GetIsNetworkAvailable();
        _isApiReachable = false;

        // Subscribe to network availability changes
        NetworkChange.NetworkAvailabilityChanged += OnNetworkAvailabilityChanged;
        NetworkChange.NetworkAddressChanged += OnNetworkAddressChanged;

        System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Created. Initial online status: {_isOnline}");
        System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] API health check URL: {_apiHealthCheckUrl}");
    }

    #region Monitoring Control

    /// <summary>
    /// Starts monitoring network status with automatic polling
    /// </summary>
    public void StartMonitoring()
    {
        if (_isMonitoring)
        {
            System.Diagnostics.Debug.WriteLine("[NetworkStatusService] Already monitoring");
            return;
        }

        _isMonitoring = true;

        // Perform initial check
        _ = CheckNetworkStatusAsync();

        // Start polling timer
        _pollingTimer = new Timer(
            async _ => await PollingTickAsync(),
            null,
            _pollingIntervalMs,
            _pollingIntervalMs);

        System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Started monitoring with {_pollingIntervalMs}ms interval");
    }

    /// <summary>
    /// Stops monitoring network status
    /// </summary>
    public void StopMonitoring()
    {
        if (!_isMonitoring)
        {
            return;
        }

        _isMonitoring = false;

        _pollingTimer?.Dispose();
        _pollingTimer = null;

        System.Diagnostics.Debug.WriteLine("[NetworkStatusService] Stopped monitoring");
    }

    #endregion

    #region Network Checks

    /// <summary>
    /// Forces an immediate network status check
    /// </summary>
    public async Task<bool> CheckNetworkStatusAsync()
    {
        var previousOnline = _isOnline;
        var previousApiReachable = _isApiReachable;

        try
        {
            // Check basic network availability
            _isOnline = NetworkInterface.GetIsNetworkAvailable();

            if (_isOnline)
            {
                // Check if we can reach the API
                _isApiReachable = await CheckApiHealthAsync();

                if (_isApiReachable)
                {
                    _lastApiSuccessTime = DateTime.UtcNow;
                }
            }
            else
            {
                _isApiReachable = false;
            }

            _lastCheckTime = DateTime.UtcNow;

            // Raise event if status changed
            if (previousOnline != _isOnline || previousApiReachable != _isApiReachable)
            {
                var reason = GetStatusChangeReason(previousOnline, _isOnline, previousApiReachable, _isApiReachable);
                RaiseNetworkStatusChanged(reason);
            }

            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Check complete - Online: {_isOnline}, API Reachable: {_isApiReachable}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Check failed: {ex.Message}");
            _isOnline = false;
            _isApiReachable = false;

            if (previousOnline || previousApiReachable)
            {
                RaiseNetworkStatusChanged($"Network check failed: {ex.Message}");
            }
        }

        return _isOnline && _isApiReachable;
    }

    /// <summary>
    /// Checks if the API health endpoint is reachable
    /// </summary>
    private async Task<bool> CheckApiHealthAsync()
    {
        try
        {
            using var cts = new CancellationTokenSource(_healthCheckTimeoutMs);
            var response = await _httpClient.GetAsync(_apiHealthCheckUrl, cts.Token);

            if (response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] API health check succeeded: {response.StatusCode}");
                return true;
            }

            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] API health check returned: {response.StatusCode}");
            return false;
        }
        catch (TaskCanceledException)
        {
            System.Diagnostics.Debug.WriteLine("[NetworkStatusService] API health check timed out");
            return false;
        }
        catch (HttpRequestException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] API health check failed: {ex.Message}");
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] API health check error: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Checks if a specific URL is reachable
    /// </summary>
    public async Task<bool> IsUrlReachableAsync(string url, int timeoutMs = 5000)
    {
        try
        {
            using var client = new HttpClient { Timeout = TimeSpan.FromMilliseconds(timeoutMs) };
            using var cts = new CancellationTokenSource(timeoutMs);

            var request = new HttpRequestMessage(HttpMethod.Head, url);
            var response = await client.SendAsync(request, cts.Token);

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] URL reachability check failed for {url}: {ex.Message}");
            return false;
        }
    }

    #endregion

    #region Event Handlers

    /// <summary>
    /// Handles network availability changes from the OS
    /// </summary>
    private void OnNetworkAvailabilityChanged(object? sender, NetworkAvailabilityEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Network availability changed: {e.IsAvailable}");

        var previousOnline = _isOnline;
        var previousApiReachable = _isApiReachable;

        _isOnline = e.IsAvailable;

        if (!_isOnline)
        {
            _isApiReachable = false;
        }

        _lastCheckTime = DateTime.UtcNow;

        // Raise event if status changed
        if (previousOnline != _isOnline || previousApiReachable != _isApiReachable)
        {
            var reason = e.IsAvailable ? "Network became available" : "Network became unavailable";
            RaiseNetworkStatusChanged(reason);

            // If network came back online, schedule an API check
            if (_isOnline && _isMonitoring)
            {
                _ = Task.Run(async () =>
                {
                    await Task.Delay(1000); // Wait a moment for connection to stabilize
                    await CheckNetworkStatusAsync();
                });
            }
        }
    }

    /// <summary>
    /// Handles network address changes (e.g., switching networks)
    /// </summary>
    private void OnNetworkAddressChanged(object? sender, EventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("[NetworkStatusService] Network address changed");

        // Network address changed, recheck status
        if (_isMonitoring)
        {
            _ = Task.Run(async () =>
            {
                await Task.Delay(500); // Small delay to let the change settle
                await CheckNetworkStatusAsync();
            });
        }
    }

    /// <summary>
    /// Timer callback for polling
    /// </summary>
    private async Task PollingTickAsync()
    {
        if (!_isMonitoring || _disposed)
        {
            return;
        }

        await CheckNetworkStatusAsync();
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Raises the NetworkStatusChanged event
    /// </summary>
    private void RaiseNetworkStatusChanged(string? reason)
    {
        var args = new NetworkStatusChangedEventArgs(_isOnline, _isApiReachable, reason);

        System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Status changed - Online: {_isOnline}, API: {_isApiReachable}, Reason: {reason}");

        try
        {
            NetworkStatusChanged?.Invoke(this, args);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[NetworkStatusService] Error raising event: {ex.Message}");
        }
    }

    /// <summary>
    /// Gets a human-readable reason for status change
    /// </summary>
    private static string GetStatusChangeReason(bool wasOnline, bool isOnline, bool wasApiReachable, bool isApiReachable)
    {
        if (!wasOnline && isOnline && isApiReachable)
            return "Connection restored";
        if (wasOnline && !isOnline)
            return "Network connection lost";
        if (isOnline && !wasApiReachable && isApiReachable)
            return "API became reachable";
        if (isOnline && wasApiReachable && !isApiReachable)
            return "API became unreachable";
        if (!wasOnline && isOnline && !isApiReachable)
            return "Network available but API unreachable";

        return "Status changed";
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (_disposed)
        {
            return;
        }

        if (disposing)
        {
            StopMonitoring();

            // Unsubscribe from network events
            NetworkChange.NetworkAvailabilityChanged -= OnNetworkAvailabilityChanged;
            NetworkChange.NetworkAddressChanged -= OnNetworkAddressChanged;

            _httpClient.Dispose();
            _pollingTimer?.Dispose();
        }

        _disposed = true;
        System.Diagnostics.Debug.WriteLine("[NetworkStatusService] Disposed");
    }

    /// <summary>
    /// Resets the singleton instance (useful for testing)
    /// </summary>
    public static void Reset()
    {
        lock (_lock)
        {
            _instance?.Dispose();
            _instance = null;
        }
    }

    #endregion
}
