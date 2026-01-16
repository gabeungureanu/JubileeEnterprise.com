using System.Text.Json;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using Xunit;
using Xunit.Abstractions;

namespace JubileeOutlook.Tests.Services;

/// <summary>
/// Unit tests for SyncQueueService
/// Verifies queue operations, retrieval, and status updates
/// </summary>
public class SyncQueueServiceTests : IAsyncLifetime
{
    private readonly ITestOutputHelper _output;
    private readonly List<Guid> _testOperationIds = new();
    private bool _isInitialized = false;

    public SyncQueueServiceTests(ITestOutputHelper output)
    {
        _output = output;
    }

    public async Task InitializeAsync()
    {
        _isInitialized = await SyncQueueService.Instance.InitializeAsync();

        if (!_isInitialized)
        {
            _output.WriteLine("WARNING: SyncQueueService could not initialize. Database may not be available.");
        }
    }

    public async Task DisposeAsync()
    {
        // Clean up test operations
        if (_isInitialized)
        {
            foreach (var id in _testOperationIds)
            {
                try
                {
                    await SyncQueueService.Instance.MarkOperationCompletedAsync(id);
                }
                catch { /* Ignore cleanup errors */ }
            }
            await SyncQueueService.Instance.ClearCompletedOperationsAsync();
        }
    }

    #region Queue Operations Tests

    [Fact]
    [Trait("Category", "QueueOperations")]
    public async Task QueueOperationAsync_WithValidData_ReturnsGuid()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Email;
        var entityId = $"test-email-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.MarkRead;
        var payload = new { isRead = true };

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            entityType, entityId, operation, payload);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _testOperationIds.Add(operationId);

        _output.WriteLine($"[PASS] Queued operation with ID: {operationId}");
    }

    [Fact]
    [Trait("Category", "QueueOperations")]
    public async Task QueueOperationAsync_WithNullPayload_Succeeds()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Event;
        var entityId = $"test-event-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.Delete;

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            entityType, entityId, operation, null);

        // Assert
        Assert.NotEqual(Guid.Empty, operationId);
        _testOperationIds.Add(operationId);

        // Verify it was stored correctly
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Null(retrieved.Payload);

        _output.WriteLine($"[PASS] Queued operation with null payload, ID: {operationId}");
    }

    [Fact]
    [Trait("Category", "QueueOperations")]
    public async Task QueueOperationAsync_WithComplexPayload_SerializesCorrectly()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Email;
        var entityId = $"test-email-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.Send;
        var payload = new
        {
            to = new[] { "user1@example.com", "user2@example.com" },
            cc = new[] { "cc@example.com" },
            subject = "Test Subject",
            body = "Test body content",
            attachments = new[] { new { name = "file.pdf", size = 1024 } }
        };

        // Act
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            entityType, entityId, operation, payload);
        _testOperationIds.Add(operationId);

        // Retrieve and verify
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);

        // Assert
        Assert.NotNull(retrieved);
        Assert.NotNull(retrieved.Payload);
        Assert.Contains("user1@example.com", retrieved.Payload);
        Assert.Contains("Test Subject", retrieved.Payload);

        _output.WriteLine($"[PASS] Complex payload serialized correctly");
        _output.WriteLine($"       Payload: {retrieved.Payload}");
    }

    #endregion

    #region Queue Retrieval Tests

    [Fact]
    [Trait("Category", "QueueRetrieval")]
    public async Task GetPendingOperationsAsync_ReturnsOperationsInOrder()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange - Create multiple operations
        var id1 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"email-1-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(id1);

        await Task.Delay(100); // Ensure different timestamps

        var id2 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event, $"event-1-{Guid.NewGuid()}", SyncOperationTypes.Update, null);
        _testOperationIds.Add(id2);

        // Act
        var pendingOps = await SyncQueueService.Instance.GetPendingOperationsAsync();

        // Assert
        Assert.True(pendingOps.Count >= 2, "Should have at least 2 pending operations");

        // Find our test operations
        var op1Index = pendingOps.FindIndex(o => o.Id == id1);
        var op2Index = pendingOps.FindIndex(o => o.Id == id2);

        if (op1Index >= 0 && op2Index >= 0)
        {
            Assert.True(op1Index < op2Index, "Operations should be ordered by creation time");
        }

        _output.WriteLine($"[PASS] Retrieved {pendingOps.Count} pending operations in correct order");
    }

    [Fact]
    [Trait("Category", "QueueRetrieval")]
    public async Task GetPendingOperationsAsync_ByEntityType_FiltersCorrectly()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var emailId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"email-filter-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(emailId);

        var eventId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event, $"event-filter-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(eventId);

        // Act
        var emailOps = await SyncQueueService.Instance.GetPendingOperationsAsync(SyncEntityTypes.Email);
        var eventOps = await SyncQueueService.Instance.GetPendingOperationsAsync(SyncEntityTypes.Event);

        // Assert
        Assert.True(emailOps.All(o => o.EntityType == SyncEntityTypes.Email),
            "All email operations should be of type 'email'");
        Assert.True(eventOps.All(o => o.EntityType == SyncEntityTypes.Event),
            "All event operations should be of type 'event'");

        _output.WriteLine($"[PASS] Filtered operations by entity type correctly");
        _output.WriteLine($"       Email ops: {emailOps.Count}, Event ops: {eventOps.Count}");
    }

    [Fact]
    [Trait("Category", "QueueRetrieval")]
    public async Task GetOperationByIdAsync_ReturnsCorrectOperation()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Contact;
        var entityId = $"contact-{Guid.NewGuid()}";
        var operation = SyncOperationTypes.Update;
        var payload = new { firstName = "John", lastName = "Doe" };

        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            entityType, entityId, operation, payload);
        _testOperationIds.Add(operationId);

        // Act
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);

        // Assert
        Assert.NotNull(retrieved);
        Assert.Equal(operationId, retrieved.Id);
        Assert.Equal(entityType, retrieved.EntityType);
        Assert.Equal(entityId, retrieved.EntityId);
        Assert.Equal(operation, retrieved.Operation);
        Assert.Equal(SyncOperationStatus.Pending, retrieved.Status);
        Assert.Equal(0, retrieved.RetryCount);

        _output.WriteLine($"[PASS] Retrieved operation by ID correctly");
        _output.WriteLine($"       EntityType: {retrieved.EntityType}");
        _output.WriteLine($"       Operation: {retrieved.Operation}");
        _output.WriteLine($"       Status: {retrieved.Status}");
    }

    [Fact]
    [Trait("Category", "QueueRetrieval")]
    public async Task GetPendingCountAsync_ReturnsCorrectCount()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange - Get initial count
        var initialCount = await SyncQueueService.Instance.GetPendingCountAsync();

        // Add new operations
        var id1 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"count-test-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(id1);

        var id2 = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"count-test-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(id2);

        // Act
        var newCount = await SyncQueueService.Instance.GetPendingCountAsync();

        // Assert
        Assert.Equal(initialCount + 2, newCount);

        _output.WriteLine($"[PASS] Pending count correct: {initialCount} -> {newCount}");
    }

    #endregion

    #region Status Update Tests

    [Fact]
    [Trait("Category", "StatusUpdates")]
    public async Task MarkOperationCompletedAsync_UpdatesStatus()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"complete-test-{Guid.NewGuid()}", SyncOperationTypes.MarkRead, null);
        _testOperationIds.Add(operationId);

        // Act
        await SyncQueueService.Instance.MarkOperationCompletedAsync(operationId);

        // Assert
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Equal(SyncOperationStatus.Completed, retrieved.Status);
        Assert.Null(retrieved.LastError);

        _output.WriteLine($"[PASS] Operation marked as completed");
    }

    [Fact]
    [Trait("Category", "StatusUpdates")]
    public async Task MarkOperationFailedAsync_UpdatesStatusAndError()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event, $"fail-test-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(operationId);

        var errorMessage = "Network connection failed: Unable to reach server";

        // Act
        await SyncQueueService.Instance.MarkOperationFailedAsync(operationId, errorMessage);

        // Assert
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Equal(SyncOperationStatus.Failed, retrieved.Status);
        Assert.Equal(errorMessage, retrieved.LastError);

        _output.WriteLine($"[PASS] Operation marked as failed with error message");
        _output.WriteLine($"       Error: {retrieved.LastError}");
    }

    [Fact]
    [Trait("Category", "StatusUpdates")]
    public async Task MarkOperationProcessingAsync_UpdatesStatus()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Contact, $"processing-test-{Guid.NewGuid()}", SyncOperationTypes.Update, null);
        _testOperationIds.Add(operationId);

        // Act
        await SyncQueueService.Instance.MarkOperationProcessingAsync(operationId);

        // Assert
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Equal(SyncOperationStatus.Processing, retrieved.Status);

        _output.WriteLine($"[PASS] Operation marked as processing");
    }

    [Fact]
    [Trait("Category", "StatusUpdates")]
    public async Task IncrementRetryAsync_IncrementsCountAndResetsStatus()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"retry-test-{Guid.NewGuid()}", SyncOperationTypes.Send, null);
        _testOperationIds.Add(operationId);

        // Act - First retry
        var canRetry1 = await SyncQueueService.Instance.IncrementRetryAsync(operationId, "First failure");

        // Assert
        var retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Equal(1, retrieved.RetryCount);
        Assert.Equal("First failure", retrieved.LastError);
        Assert.True(canRetry1, "Should be able to retry after first failure");

        // Act - Second retry
        var canRetry2 = await SyncQueueService.Instance.IncrementRetryAsync(operationId, "Second failure");
        retrieved = await SyncQueueService.Instance.GetOperationByIdAsync(operationId);
        Assert.NotNull(retrieved);
        Assert.Equal(2, retrieved.RetryCount);

        _output.WriteLine($"[PASS] Retry count incremented correctly");
        _output.WriteLine($"       Retry count: {retrieved.RetryCount}");
        _output.WriteLine($"       Can retry: {canRetry2}");
    }

    #endregion

    #region Clear Operations Tests

    [Fact]
    [Trait("Category", "ClearOperations")]
    public async Task ClearCompletedOperationsAsync_RemovesOnlyCompleted()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange - Create and complete some operations
        var completedId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"clear-completed-{Guid.NewGuid()}", SyncOperationTypes.MarkRead, null);
        await SyncQueueService.Instance.MarkOperationCompletedAsync(completedId);

        var pendingId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Email, $"clear-pending-{Guid.NewGuid()}", SyncOperationTypes.MarkRead, null);
        _testOperationIds.Add(pendingId);

        // Act
        var clearedCount = await SyncQueueService.Instance.ClearCompletedOperationsAsync();

        // Assert
        var completedOp = await SyncQueueService.Instance.GetOperationByIdAsync(completedId);
        var pendingOp = await SyncQueueService.Instance.GetOperationByIdAsync(pendingId);

        Assert.Null(completedOp);
        Assert.NotNull(pendingOp);

        _output.WriteLine($"[PASS] Cleared {clearedCount} completed operations");
    }

    [Fact]
    [Trait("Category", "ClearOperations")]
    public async Task ClearFailedOperationsAsync_RemovesOnlyFailed()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var failedId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event, $"clear-failed-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        await SyncQueueService.Instance.MarkOperationFailedAsync(failedId, "Test failure");

        var pendingId = await SyncQueueService.Instance.QueueOperationAsync(
            SyncEntityTypes.Event, $"clear-pending2-{Guid.NewGuid()}", SyncOperationTypes.Create, null);
        _testOperationIds.Add(pendingId);

        // Act
        var clearedCount = await SyncQueueService.Instance.ClearFailedOperationsAsync();

        // Assert
        var failedOp = await SyncQueueService.Instance.GetOperationByIdAsync(failedId);
        var pendingOp = await SyncQueueService.Instance.GetOperationByIdAsync(pendingId);

        Assert.Null(failedOp);
        Assert.NotNull(pendingOp);

        _output.WriteLine($"[PASS] Cleared {clearedCount} failed operations");
    }

    #endregion

    #region Entity Operations Tests

    [Fact]
    [Trait("Category", "EntityOperations")]
    public async Task HasPendingOperationsAsync_ReturnsTrueWhenPending()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Email;
        var entityId = $"has-pending-{Guid.NewGuid()}";

        var operationId = await SyncQueueService.Instance.QueueOperationAsync(
            entityType, entityId, SyncOperationTypes.Update, null);
        _testOperationIds.Add(operationId);

        // Act
        var hasPending = await SyncQueueService.Instance.HasPendingOperationsAsync(entityType, entityId);

        // Assert
        Assert.True(hasPending, "Should have pending operations");

        _output.WriteLine($"[PASS] HasPendingOperationsAsync returns true for entity with pending ops");
    }

    [Fact]
    [Trait("Category", "EntityOperations")]
    public async Task HasPendingOperationsAsync_ReturnsFalseWhenNoPending()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange
        var entityType = SyncEntityTypes.Contact;
        var entityId = $"no-pending-{Guid.NewGuid()}";

        // Act (no operations queued for this entity)
        var hasPending = await SyncQueueService.Instance.HasPendingOperationsAsync(entityType, entityId);

        // Assert
        Assert.False(hasPending, "Should not have pending operations");

        _output.WriteLine($"[PASS] HasPendingOperationsAsync returns false for entity with no pending ops");
    }

    [Fact]
    [Trait("Category", "EntityOperations")]
    public async Task RemoveOperationsForEntityAsync_RemovesAllPendingForEntity()
    {
        if (!_isInitialized)
        {
            _output.WriteLine("SKIPPED: Database not available");
            return;
        }

        // Arrange - Create multiple operations for same entity
        var entityType = SyncEntityTypes.Email;
        var entityId = $"remove-entity-{Guid.NewGuid()}";

        await SyncQueueService.Instance.QueueOperationAsync(entityType, entityId, SyncOperationTypes.MarkRead, null);
        await SyncQueueService.Instance.QueueOperationAsync(entityType, entityId, SyncOperationTypes.MarkFlagged, null);
        await SyncQueueService.Instance.QueueOperationAsync(entityType, entityId, SyncOperationTypes.Move, null);

        // Verify they exist
        var hasPendingBefore = await SyncQueueService.Instance.HasPendingOperationsAsync(entityType, entityId);
        Assert.True(hasPendingBefore, "Should have pending operations before removal");

        // Act
        var removedCount = await SyncQueueService.Instance.RemoveOperationsForEntityAsync(entityType, entityId);

        // Assert
        var hasPendingAfter = await SyncQueueService.Instance.HasPendingOperationsAsync(entityType, entityId);
        Assert.False(hasPendingAfter, "Should not have pending operations after removal");
        Assert.Equal(3, removedCount);

        _output.WriteLine($"[PASS] Removed {removedCount} operations for entity");
    }

    #endregion
}
