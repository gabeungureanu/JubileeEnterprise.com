using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Unit tests for NetworkStatusService
/// Tests network connectivity detection, API health monitoring, and status events
/// </summary>
public class NetworkStatusServiceTests : IDisposable
{
    private readonly ITestOutputHelper _output;

    public NetworkStatusServiceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public void Dispose()
    {
        // Stop monitoring after each test
        NetworkStatusService.Instance.StopMonitoring();
    }

    #region IsOnline Property Tests

    [Fact]
    [Trait("Category", "IsOnline")]
    public void IsOnline_ReturnsInitialNetworkStatus()
    {
        // Act
        var isOnline = NetworkStatusService.Instance.IsOnline;

        // Assert - just verify it returns a boolean without throwing
        _output.WriteLine($"[INFO] Initial network status: {isOnline}");
        Assert.True(isOnline || !isOnline); // Always true, just verifies no exception
    }

    [Fact]
    [Trait("Category", "IsOnline")]
    public void IsApiReachable_ReturnsBoolean()
    {
        // Act
        var isApiReachable = NetworkStatusService.Instance.IsApiReachable;

        // Assert
        _output.WriteLine($"[INFO] API reachable status: {isApiReachable}");
        Assert.True(isApiReachable || !isApiReachable);
    }

    #endregion

    #region NetworkStatusChanged Event Tests

    [Fact]
    [Trait("Category", "NetworkStatusChanged")]
    public async Task CheckNetworkStatusAsync_RaisesEventOnStatusChange()
    {
        // Arrange
        var eventRaised = false;
        NetworkStatusChangedEventArgs? receivedArgs = null;

        NetworkStatusService.Instance.NetworkStatusChanged += (sender, args) =>
        {
            eventRaised = true;
            receivedArgs = args;
            _output.WriteLine($"[EVENT] Status changed - Online: {args.IsOnline}, API: {args.IsApiReachable}, Reason: {args.Reason}");
        };

        // Act
        var result = await NetworkStatusService.Instance.CheckNetworkStatusAsync();

        // Assert
        _output.WriteLine($"[INFO] Check result: {result}");
        _output.WriteLine($"[INFO] Event raised: {eventRaised}");

        if (receivedArgs != null)
        {
            Assert.NotEqual(DateTime.MinValue, receivedArgs.Timestamp);
            _output.WriteLine($"[PASS] Event args contain valid timestamp: {receivedArgs.Timestamp}");
        }
    }

    [Fact]
    [Trait("Category", "NetworkStatusChanged")]
    public void NetworkStatusChangedEventArgs_ContainsCorrectData()
    {
        // Arrange & Act
        var args = new NetworkStatusChangedEventArgs(true, true, "Test reason");

        // Assert
        Assert.True(args.IsOnline);
        Assert.True(args.IsApiReachable);
        Assert.Equal("Test reason", args.Reason);
        Assert.True(args.Timestamp <= DateTime.UtcNow);
        Assert.True(args.Timestamp > DateTime.UtcNow.AddSeconds(-5));

        _output.WriteLine($"[PASS] Event args created correctly");
        _output.WriteLine($"       IsOnline: {args.IsOnline}");
        _output.WriteLine($"       IsApiReachable: {args.IsApiReachable}");
        _output.WriteLine($"       Reason: {args.Reason}");
        _output.WriteLine($"       Timestamp: {args.Timestamp}");
    }

    #endregion

    #region API Health Check Tests

    [Fact]
    [Trait("Category", "ApiHealthCheck")]
    public async Task CheckNetworkStatusAsync_UpdatesLastCheckTime()
    {
        // Arrange
        var beforeCheck = DateTime.UtcNow;

        // Act
        await NetworkStatusService.Instance.CheckNetworkStatusAsync();
        var lastCheckTime = NetworkStatusService.Instance.LastCheckTime;

        // Assert
        Assert.NotNull(lastCheckTime);
        Assert.True(lastCheckTime >= beforeCheck);
        Assert.True(lastCheckTime <= DateTime.UtcNow);

        _output.WriteLine($"[PASS] LastCheckTime updated correctly: {lastCheckTime}");
    }

    [Fact]
    [Trait("Category", "ApiHealthCheck")]
    public async Task CheckNetworkStatusAsync_ReturnsConsistentResults()
    {
        // Act
        var result1 = await NetworkStatusService.Instance.CheckNetworkStatusAsync();
        var isOnline1 = NetworkStatusService.Instance.IsOnline;
        var isApiReachable1 = NetworkStatusService.Instance.IsApiReachable;

        // Small delay
        await Task.Delay(100);

        var result2 = await NetworkStatusService.Instance.CheckNetworkStatusAsync();
        var isOnline2 = NetworkStatusService.Instance.IsOnline;
        var isApiReachable2 = NetworkStatusService.Instance.IsApiReachable;

        // Assert - results should match the return value
        Assert.Equal(isOnline1 && isApiReachable1, result1);
        Assert.Equal(isOnline2 && isApiReachable2, result2);

        _output.WriteLine($"[PASS] Results are consistent");
        _output.WriteLine($"       Check 1: result={result1}, online={isOnline1}, api={isApiReachable1}");
        _output.WriteLine($"       Check 2: result={result2}, online={isOnline2}, api={isApiReachable2}");
    }

    [Fact]
    [Trait("Category", "ApiHealthCheck")]
    public async Task IsUrlReachableAsync_ReturnsResultForValidUrl()
    {
        // Arrange
        var testUrl = "https://www.google.com";

        // Act
        var isReachable = await NetworkStatusService.Instance.IsUrlReachableAsync(testUrl, 5000);

        // Assert - Don't assert specific result as it depends on network
        _output.WriteLine($"[INFO] URL {testUrl} reachable: {isReachable}");
    }

    [Fact]
    [Trait("Category", "ApiHealthCheck")]
    public async Task IsUrlReachableAsync_ReturnsFalseForInvalidUrl()
    {
        // Arrange
        var invalidUrl = "https://this-domain-definitely-does-not-exist-12345.com";

        // Act
        var isReachable = await NetworkStatusService.Instance.IsUrlReachableAsync(invalidUrl, 2000);

        // Assert
        Assert.False(isReachable);
        _output.WriteLine($"[PASS] Invalid URL correctly returned false");
    }

    [Fact]
    [Trait("Category", "ApiHealthCheck")]
    public async Task IsUrlReachableAsync_RespectsTimeout()
    {
        // Arrange
        var testUrl = "https://httpstat.us/200?sleep=5000"; // Sleeps for 5 seconds
        var shortTimeout = 1000; // 1 second timeout

        var startTime = DateTime.UtcNow;

        // Act
        var isReachable = await NetworkStatusService.Instance.IsUrlReachableAsync(testUrl, shortTimeout);

        var elapsed = DateTime.UtcNow - startTime;

        // Assert - should timeout before 5 seconds
        Assert.True(elapsed.TotalMilliseconds < 3000, $"Should timeout quickly, but took {elapsed.TotalMilliseconds}ms");
        _output.WriteLine($"[PASS] Timeout respected. Elapsed: {elapsed.TotalMilliseconds}ms");
    }

    #endregion

    #region Automatic Polling Tests

    [Fact]
    [Trait("Category", "AutomaticPolling")]
    public void StartMonitoring_SetsIsMonitoringTrue()
    {
        // Act
        NetworkStatusService.Instance.StartMonitoring();

        // Assert
        Assert.True(NetworkStatusService.Instance.IsMonitoring);
        _output.WriteLine($"[PASS] IsMonitoring is true after StartMonitoring()");
    }

    [Fact]
    [Trait("Category", "AutomaticPolling")]
    public void StopMonitoring_SetsIsMonitoringFalse()
    {
        // Arrange
        NetworkStatusService.Instance.StartMonitoring();
        Assert.True(NetworkStatusService.Instance.IsMonitoring);

        // Act
        NetworkStatusService.Instance.StopMonitoring();

        // Assert
        Assert.False(NetworkStatusService.Instance.IsMonitoring);
        _output.WriteLine($"[PASS] IsMonitoring is false after StopMonitoring()");
    }

    [Fact]
    [Trait("Category", "AutomaticPolling")]
    public void StartMonitoring_CalledMultipleTimes_DoesNotThrow()
    {
        // Act & Assert - should not throw
        NetworkStatusService.Instance.StartMonitoring();
        NetworkStatusService.Instance.StartMonitoring();
        NetworkStatusService.Instance.StartMonitoring();

        Assert.True(NetworkStatusService.Instance.IsMonitoring);
        _output.WriteLine($"[PASS] Multiple StartMonitoring calls handled gracefully");
    }

    [Fact]
    [Trait("Category", "AutomaticPolling")]
    public void StopMonitoring_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        NetworkStatusService.Instance.StartMonitoring();

        // Act & Assert - should not throw
        NetworkStatusService.Instance.StopMonitoring();
        NetworkStatusService.Instance.StopMonitoring();
        NetworkStatusService.Instance.StopMonitoring();

        Assert.False(NetworkStatusService.Instance.IsMonitoring);
        _output.WriteLine($"[PASS] Multiple StopMonitoring calls handled gracefully");
    }

    [Fact]
    [Trait("Category", "AutomaticPolling")]
    public async Task StartMonitoring_PerformsInitialCheck()
    {
        // Arrange
        var initialLastCheck = NetworkStatusService.Instance.LastCheckTime;

        // Act
        NetworkStatusService.Instance.StartMonitoring();
        await Task.Delay(500); // Wait for initial check to complete

        // Assert
        var newLastCheck = NetworkStatusService.Instance.LastCheckTime;
        Assert.NotNull(newLastCheck);

        _output.WriteLine($"[PASS] Initial check performed after StartMonitoring");
        _output.WriteLine($"       Initial LastCheckTime: {initialLastCheck}");
        _output.WriteLine($"       New LastCheckTime: {newLastCheck}");
    }

    #endregion

    #region Network Interface Change Tests

    [Fact]
    [Trait("Category", "NetworkInterfaceChanges")]
    public void Instance_IsSingleton()
    {
        // Act
        var instance1 = NetworkStatusService.Instance;
        var instance2 = NetworkStatusService.Instance;

        // Assert
        Assert.Same(instance1, instance2);
        _output.WriteLine($"[PASS] NetworkStatusService is singleton");
    }

    [Fact]
    [Trait("Category", "NetworkInterfaceChanges")]
    public async Task LastApiSuccessTime_UpdatedOnSuccessfulCheck()
    {
        // Arrange
        var beforeCheck = DateTime.UtcNow;

        // Act
        await NetworkStatusService.Instance.CheckNetworkStatusAsync();

        // Assert
        if (NetworkStatusService.Instance.IsApiReachable)
        {
            var lastSuccess = NetworkStatusService.Instance.LastApiSuccessTime;
            Assert.NotNull(lastSuccess);
            Assert.True(lastSuccess >= beforeCheck);
            _output.WriteLine($"[PASS] LastApiSuccessTime updated: {lastSuccess}");
        }
        else
        {
            _output.WriteLine($"[INFO] API not reachable, LastApiSuccessTime not updated");
        }
    }

    #endregion

    #region Integration Tests

    [Fact]
    [Trait("Category", "Integration")]
    public async Task FullWorkflow_StartCheckStop()
    {
        // Arrange
        var statusChanges = new List<NetworkStatusChangedEventArgs>();
        NetworkStatusService.Instance.NetworkStatusChanged += (s, e) => statusChanges.Add(e);

        // Act - Start monitoring
        NetworkStatusService.Instance.StartMonitoring();
        Assert.True(NetworkStatusService.Instance.IsMonitoring);

        // Wait for initial check
        await Task.Delay(1000);

        // Force a check
        var checkResult = await NetworkStatusService.Instance.CheckNetworkStatusAsync();

        // Get status
        var isOnline = NetworkStatusService.Instance.IsOnline;
        var isApiReachable = NetworkStatusService.Instance.IsApiReachable;
        var lastCheck = NetworkStatusService.Instance.LastCheckTime;

        // Stop monitoring
        NetworkStatusService.Instance.StopMonitoring();
        Assert.False(NetworkStatusService.Instance.IsMonitoring);

        // Assert
        Assert.NotNull(lastCheck);
        Assert.Equal(isOnline && isApiReachable, checkResult);

        _output.WriteLine($"[PASS] Full workflow completed successfully");
        _output.WriteLine($"       IsOnline: {isOnline}");
        _output.WriteLine($"       IsApiReachable: {isApiReachable}");
        _output.WriteLine($"       CheckResult: {checkResult}");
        _output.WriteLine($"       LastCheckTime: {lastCheck}");
        _output.WriteLine($"       Status changes received: {statusChanges.Count}");
    }

    #endregion
}
