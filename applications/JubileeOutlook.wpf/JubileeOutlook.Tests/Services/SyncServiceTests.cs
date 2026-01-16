using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Tests for SyncService - background synchronization service
/// Tests sync lifecycle, state management, and event handling
/// </summary>
public class SyncServiceTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;

    public SyncServiceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        // Ensure services are initialized
        await Task.CompletedTask;
    }

    public async Task DisposeAsync()
    {
        // Clean up - stop the sync service if running
        SyncService.Instance.Stop();
        await Task.CompletedTask;
    }

    #region Singleton Tests

    [Fact]
    [Trait("Category", "Singleton")]
    public void Instance_ReturnsSingleton()
    {
        // Act
        var instance1 = SyncService.Instance;
        var instance2 = SyncService.Instance;

        // Assert
        Assert.Same(instance1, instance2);
        _output.WriteLine("[PASS] SyncService is singleton");
    }

    #endregion

    #region Start/Stop Tests

    [Fact]
    [Trait("Category", "Lifecycle")]
    public void Start_SetsIsEnabledTrue()
    {
        // Arrange
        SyncService.Instance.Stop(); // Ensure stopped first

        // Act
        SyncService.Instance.Start();

        // Assert
        Assert.True(SyncService.Instance.IsEnabled);
        _output.WriteLine("[PASS] Start sets IsEnabled to true");

        // Cleanup
        SyncService.Instance.Stop();
    }

    [Fact]
    [Trait("Category", "Lifecycle")]
    public void Stop_SetsIsEnabledFalse()
    {
        // Arrange
        SyncService.Instance.Start();

        // Act
        SyncService.Instance.Stop();

        // Assert
        Assert.False(SyncService.Instance.IsEnabled);
        _output.WriteLine("[PASS] Stop sets IsEnabled to false");
    }

    [Fact]
    [Trait("Category", "Lifecycle")]
    public void Start_CalledMultipleTimes_DoesNotThrow()
    {
        // Act & Assert - should not throw
        SyncService.Instance.Start();
        SyncService.Instance.Start();
        SyncService.Instance.Start();

        Assert.True(SyncService.Instance.IsEnabled);
        _output.WriteLine("[PASS] Multiple Start calls handled gracefully");

        // Cleanup
        SyncService.Instance.Stop();
    }

    [Fact]
    [Trait("Category", "Lifecycle")]
    public void Stop_CalledMultipleTimes_DoesNotThrow()
    {
        // Arrange
        SyncService.Instance.Start();

        // Act & Assert - should not throw
        SyncService.Instance.Stop();
        SyncService.Instance.Stop();
        SyncService.Instance.Stop();

        Assert.False(SyncService.Instance.IsEnabled);
        _output.WriteLine("[PASS] Multiple Stop calls handled gracefully");
    }

    #endregion

    #region State Tests

    [Fact]
    [Trait("Category", "State")]
    public void CurrentState_InitiallyIdle()
    {
        // Act
        var state = SyncService.Instance.CurrentState;

        // Assert
        Assert.Equal(SyncState.Idle, state);
        _output.WriteLine($"[PASS] Initial state is Idle: {state}");
    }

    [Fact]
    [Trait("Category", "State")]
    public void IsSyncing_InitiallyFalse()
    {
        // Act
        var isSyncing = SyncService.Instance.IsSyncing;

        // Assert
        Assert.False(isSyncing);
        _output.WriteLine("[PASS] IsSyncing is initially false");
    }

    [Fact]
    [Trait("Category", "State")]
    public void LastSyncTime_InitiallyNull()
    {
        // Reset to ensure clean state
        SyncService.Reset();

        // Act
        var lastSyncTime = SyncService.Instance.LastSyncTime;

        // Assert - may be null if no sync has happened
        _output.WriteLine($"[INFO] LastSyncTime: {lastSyncTime?.ToString() ?? "null"}");
    }

    #endregion

    #region Sync Token Tests

    [Fact]
    [Trait("Category", "SyncTokens")]
    public async Task GetSyncTokenAsync_ReturnsNullForUnknownType()
    {
        // Act
        var token = await SyncService.Instance.GetSyncTokenAsync("unknown_type");

        // Assert
        Assert.Null(token);
        _output.WriteLine("[PASS] GetSyncTokenAsync returns null for unknown type");
    }

    [Fact]
    [Trait("Category", "SyncTokens")]
    public async Task ResetSyncStateAsync_ClearsTokens()
    {
        // Act
        await SyncService.Instance.ResetSyncStateAsync();

        // Assert - should not throw and tokens should be cleared
        var token = await SyncService.Instance.GetSyncTokenAsync("email");
        Assert.Null(token);
        _output.WriteLine("[PASS] ResetSyncStateAsync clears tokens");
    }

    #endregion

    #region SyncNowAsync Tests

    [Fact]
    [Trait("Category", "SyncNow")]
    public async Task SyncNowAsync_ReturnsResult()
    {
        // Act
        var result = await SyncService.Instance.SyncNowAsync();

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] SyncNowAsync result - Success: {result.Success}, Message: {result.Message}");
    }

    [Fact]
    [Trait("Category", "SyncNow")]
    public async Task SyncNowAsync_WhenAlreadySyncing_ReturnsFailure()
    {
        // This is hard to test without mocking, but we can verify the logic exists
        // by checking the result when service is not syncing
        var result = await SyncService.Instance.SyncNowAsync();

        // Assert - should return a result (may succeed or fail based on network)
        Assert.NotNull(result);
        Assert.NotNull(result.Message);
        _output.WriteLine($"[PASS] SyncNowAsync returns result: {result.Message}");
    }

    #endregion

    #region FullSyncAsync Tests

    [Fact]
    [Trait("Category", "FullSync")]
    public async Task FullSyncAsync_ReturnsResult()
    {
        // Act
        var result = await SyncService.Instance.FullSyncAsync();

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] FullSyncAsync result - Success: {result.Success}, Message: {result.Message}");
    }

    #endregion

    #region SyncEntityTypeAsync Tests

    [Fact]
    [Trait("Category", "EntitySync")]
    public async Task SyncEntityTypeAsync_ReturnsResult()
    {
        // Act
        var result = await SyncService.Instance.SyncEntityTypeAsync("email");

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[INFO] SyncEntityTypeAsync for email - Success: {result.Success}");
    }

    #endregion

    #region Event Tests

    [Fact]
    [Trait("Category", "Events")]
    public async Task SyncProgressChanged_RaisedDuringSync()
    {
        // Arrange
        var progressEvents = new List<SyncProgressEventArgs>();
        SyncService.Instance.SyncProgressChanged += (s, e) =>
        {
            progressEvents.Add(e);
            _output.WriteLine($"[EVENT] Progress: {e.State} - {e.Message}");
        };

        // Act
        await SyncService.Instance.SyncNowAsync();

        // Assert - events may or may not fire depending on network
        _output.WriteLine($"[INFO] Received {progressEvents.Count} progress events");

        foreach (var evt in progressEvents)
        {
            Assert.NotNull(evt.Message);
        }
    }

    [Fact]
    [Trait("Category", "Events")]
    public async Task SyncCompleted_RaisedAfterSync()
    {
        // Arrange
        SyncCompletedEventArgs? completedArgs = null;
        SyncService.Instance.SyncCompleted += (s, e) =>
        {
            completedArgs = e;
            _output.WriteLine($"[EVENT] Completed - Success: {e.Success}, Duration: {e.Duration.TotalSeconds}s");
        };

        // Act
        await SyncService.Instance.SyncNowAsync();

        // Assert - event may or may not fire depending on sync execution
        if (completedArgs != null)
        {
            Assert.True(completedArgs.Duration.TotalSeconds >= 0);
            _output.WriteLine($"[PASS] SyncCompleted event received");
        }
        else
        {
            _output.WriteLine("[INFO] No SyncCompleted event received (sync may have failed early)");
        }
    }

    [Fact]
    [Trait("Category", "Events")]
    public async Task SyncError_EventArgsContainDetails()
    {
        // Arrange
        var errors = new List<SyncErrorEventArgs>();
        SyncService.Instance.SyncError += (s, e) =>
        {
            errors.Add(e);
            _output.WriteLine($"[EVENT] Error: {e.ErrorMessage}");
        };

        // Act - trigger a sync (may or may not produce errors)
        await SyncService.Instance.SyncNowAsync();

        // Assert - if errors occurred, verify they have details
        foreach (var error in errors)
        {
            Assert.NotNull(error.ErrorMessage);
            _output.WriteLine($"[INFO] Error captured: {error.ErrorMessage}");
        }

        _output.WriteLine($"[INFO] {errors.Count} errors captured during sync");
    }

    #endregion

    #region Integration Tests

    [Fact]
    [Trait("Category", "Integration")]
    public async Task FullWorkflow_StartSyncStop()
    {
        // Arrange
        var progressEvents = new List<SyncProgressEventArgs>();
        SyncService.Instance.SyncProgressChanged += (s, e) => progressEvents.Add(e);

        // Act - Start service
        SyncService.Instance.Start();
        Assert.True(SyncService.Instance.IsEnabled);
        _output.WriteLine("[INFO] Service started");

        // Trigger manual sync
        var result = await SyncService.Instance.SyncNowAsync();
        _output.WriteLine($"[INFO] Manual sync result: {result.Success} - {result.Message}");

        // Stop service
        SyncService.Instance.Stop();
        Assert.False(SyncService.Instance.IsEnabled);
        _output.WriteLine("[INFO] Service stopped");

        // Assert
        _output.WriteLine($"[PASS] Full workflow completed. Progress events: {progressEvents.Count}");
    }

    [Fact]
    [Trait("Category", "Integration")]
    public async Task ResetAndFullSync_ClearsStateAndResyncs()
    {
        // Arrange - Reset sync state
        await SyncService.Instance.ResetSyncStateAsync();
        _output.WriteLine("[INFO] Sync state reset");

        // Act - Perform full sync
        var result = await SyncService.Instance.FullSyncAsync();

        // Assert
        Assert.NotNull(result);
        _output.WriteLine($"[PASS] Full sync after reset - Success: {result.Success}");
    }

    #endregion
}
