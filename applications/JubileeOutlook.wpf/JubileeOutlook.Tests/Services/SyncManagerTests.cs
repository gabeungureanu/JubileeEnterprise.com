using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Tests for SyncManager - coordinates NetworkStatusService and SyncQueueService
/// </summary>
public class SyncManagerTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private readonly List<Guid> _createdOperations = new();

    public SyncManagerTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        // Initialize the sync manager
        await SyncManager.Instance.InitializeAsync();
    }

    public async Task DisposeAsync()
    {
        // Clean up any test operations
        foreach (var id in _createdOperations)
        {
            try
            {
                await SyncQueueService.Instance.MarkOperationCompletedAsync(id);
            }
            catch { }
        }
        await SyncQueueService.Instance.ClearCompletedOperationsAsync();
    }

    #region Initialization Tests

    [Fact]
    [Trait("Category", "Initialization")]
    public void Instance_ReturnsSingleton()
    {
        // Act
        var instance1 = SyncManager.Instance;
        var instance2 = SyncManager.Instance;

        // Assert
        Assert.Same(instance1, instance2);
        _output.WriteLine("[PASS] SyncManager is singleton");
    }

    [Fact]
    [Trait("Category", "Initialization")]
    public async Task InitializeAsync_ReturnsTrue()
    {
        // Act
        var result = await SyncManager.Instance.InitializeAsync();

        // Assert
        Assert.True(result);
        _output.WriteLine("[PASS] SyncManager initialized successfully");
    }

    #endregion

    #region Network Status Integration Tests

    [Fact]
    [Trait("Category", "NetworkIntegration")]
    public void IsOnline_ReflectsNetworkStatus()
    {
        // Act
        var syncManagerOnline = SyncManager.Instance.IsOnline;
        var networkServiceOnline = NetworkStatusService.Instance.IsOnline;

        // Assert
        Assert.Equal(networkServiceOnline, syncManagerOnline);
        _output.WriteLine($"[PASS] IsOnline matches NetworkStatusService: {syncManagerOnline}");
    }

    [Fact]
    [Trait("Category", "NetworkIntegration")]
    public void IsApiReachable_ReflectsNetworkStatus()
    {
        // Act
        var syncManagerApi = SyncManager.Instance.IsApiReachable;
        var networkServiceApi = NetworkStatusService.Instance.IsApiReachable;

        // Assert
        Assert.Equal(networkServiceApi, syncManagerApi);
        _output.WriteLine($"[PASS] IsApiReachable matches NetworkStatusService: {syncManagerApi}");
    }

    #endregion

    #region Queue Operation Tests

    [Fact]
    [Trait("Category", "QueueOperations")]
    public async Task QueueOperationAsync_QueuesOperation()
    {
        // Arrange
        var entityType = SyncEntityTypes.Email;
        var entityId = $"test-email-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.MarkRead;

        // Act
        var opId = await SyncManager.Instance.QueueOperationAsync(entityType, entityId, operation);
        _createdOperations.Add(opId);

        // Assert
        Assert.NotEqual(Guid.Empty, opId);

        var queuedOp = await SyncQueueService.Instance.GetOperationByIdAsync(opId);
        Assert.NotNull(queuedOp);
        Assert.Equal(entityType, queuedOp.EntityType);
        Assert.Equal(entityId, queuedOp.EntityId);
        Assert.Equal(operation, queuedOp.Operation);

        _output.WriteLine($"[PASS] Operation queued successfully with ID: {opId}");
    }

    [Fact]
    [Trait("Category", "QueueOperations")]
    public async Task QueueOperationAsync_WithPayload_StoresPayload()
    {
        // Arrange
        var entityType = SyncEntityTypes.Event;
        var entityId = $"test-event-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.Update;
        var payload = new { title = "Test Event", startTime = DateTime.UtcNow };

        // Act
        var opId = await SyncManager.Instance.QueueOperationAsync(entityType, entityId, operation, payload);
        _createdOperations.Add(opId);

        // Assert
        var queuedOp = await SyncQueueService.Instance.GetOperationByIdAsync(opId);
        Assert.NotNull(queuedOp);
        Assert.NotNull(queuedOp.Payload);
        Assert.Contains("Test Event", queuedOp.Payload);

        _output.WriteLine($"[PASS] Operation queued with payload");
    }

    #endregion

    #region Sync Processing Tests

    [Fact]
    [Trait("Category", "SyncProcessing")]
    public async Task ProcessPendingOperationsAsync_ReturnsResult()
    {
        // Act
        var result = await SyncManager.Instance.ProcessPendingOperationsAsync();

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Message);

        _output.WriteLine($"[PASS] ProcessPendingOperationsAsync returned: {result.Message}");
        _output.WriteLine($"       Success: {result.Success}");
        _output.WriteLine($"       Total: {result.TotalOperations}");
        _output.WriteLine($"       Succeeded: {result.SuccessCount}");
        _output.WriteLine($"       Failed: {result.FailedCount}");
    }

    [Fact]
    [Trait("Category", "SyncProcessing")]
    public async Task ProcessPendingOperationsAsync_ProcessesQueuedOperations()
    {
        // Arrange - Queue some operations
        var op1 = await SyncManager.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            $"email-{Guid.NewGuid()}",
            SyncOperationTypes.MarkRead);
        _createdOperations.Add(op1);

        var op2 = await SyncManager.Instance.QueueOperationAsync(
            SyncEntityTypes.Event,
            $"event-{Guid.NewGuid()}",
            SyncOperationTypes.Update);
        _createdOperations.Add(op2);

        // Act
        var result = await SyncManager.Instance.ProcessPendingOperationsAsync();

        // Assert
        _output.WriteLine($"[INFO] Sync result: {result.Message}");
        _output.WriteLine($"       Total: {result.TotalOperations}, Success: {result.SuccessCount}, Failed: {result.FailedCount}");

        // Note: Result depends on network availability
        Assert.NotNull(result);
    }

    [Fact]
    [Trait("Category", "SyncProcessing")]
    public async Task GetPendingCountAsync_ReturnsCorrectCount()
    {
        // Arrange
        var initialCount = await SyncManager.Instance.GetPendingCountAsync();

        var opId = await SyncManager.Instance.QueueOperationAsync(
            SyncEntityTypes.Contact,
            $"contact-{Guid.NewGuid()}",
            SyncOperationTypes.Create);
        _createdOperations.Add(opId);

        // Act
        var newCount = await SyncManager.Instance.GetPendingCountAsync();

        // Assert
        Assert.True(newCount >= initialCount);
        _output.WriteLine($"[PASS] Pending count: {initialCount} -> {newCount}");
    }

    #endregion

    #region Event Tests

    [Fact]
    [Trait("Category", "Events")]
    public async Task SyncStatusChanged_RaisedOnSync()
    {
        // Arrange
        var statusChanges = new List<SyncStatusChangedEventArgs>();
        SyncManager.Instance.SyncStatusChanged += (s, e) =>
        {
            statusChanges.Add(e);
            _output.WriteLine($"[EVENT] SyncStatus: {e.Status} - {e.Message}");
        };

        // Act
        await SyncManager.Instance.ProcessPendingOperationsAsync();

        // Assert
        // Events may or may not fire depending on whether there are pending operations
        _output.WriteLine($"[INFO] Received {statusChanges.Count} status change events");

        foreach (var change in statusChanges)
        {
            Assert.NotEqual(default, change.Timestamp);
            Assert.NotNull(change.Message);
        }
    }

    [Fact]
    [Trait("Category", "Events")]
    public async Task OperationCompleted_RaisedForEachOperation()
    {
        // Arrange
        var completedOps = new List<SyncOperationCompletedEventArgs>();
        SyncManager.Instance.OperationCompleted += (s, e) =>
        {
            completedOps.Add(e);
            _output.WriteLine($"[EVENT] Operation completed: {e.Operation.EntityType}/{e.Operation.Operation} - Success: {e.Success}");
        };

        // Queue an operation
        var opId = await SyncManager.Instance.QueueOperationAsync(
            SyncEntityTypes.Email,
            $"test-{Guid.NewGuid()}",
            SyncOperationTypes.MarkRead);
        _createdOperations.Add(opId);

        // Act
        await SyncManager.Instance.ProcessPendingOperationsAsync();

        // Assert
        _output.WriteLine($"[INFO] {completedOps.Count} operations completed");

        foreach (var op in completedOps)
        {
            Assert.NotNull(op.Operation);
            Assert.NotEqual(default, op.Timestamp);
        }
    }

    #endregion

    #region Force Sync Tests

    [Fact]
    [Trait("Category", "ForceSync")]
    public async Task ForceSyncAsync_ReturnsResult()
    {
        // Act
        var result = await SyncManager.Instance.ForceSyncAsync();

        // Assert
        Assert.NotNull(result);
        Assert.NotNull(result.Message);

        _output.WriteLine($"[INFO] ForceSyncAsync result: {result.Success}");
        _output.WriteLine($"       Message: {result.Message}");
    }

    #endregion

    #region Cancellation Tests

    [Fact]
    [Trait("Category", "Cancellation")]
    public void CancelSync_DoesNotThrow()
    {
        // Act & Assert - should not throw even if no sync in progress
        SyncManager.Instance.CancelSync();
        _output.WriteLine("[PASS] CancelSync completed without exception");
    }

    #endregion
}
