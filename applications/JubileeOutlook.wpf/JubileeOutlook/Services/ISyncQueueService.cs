using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Interface for the sync queue service that manages offline operations
/// Provides methods to queue, retrieve, and manage pending synchronization operations
/// </summary>
public interface ISyncQueueService
{
    /// <summary>
    /// Gets whether the sync queue service is initialized
    /// </summary>
    bool IsInitialized { get; }

    /// <summary>
    /// Initializes the sync queue service and verifies database connectivity
    /// </summary>
    /// <returns>True if initialization successful, false otherwise</returns>
    Task<bool> InitializeAsync();

    /// <summary>
    /// Queues an operation for later synchronization when offline
    /// </summary>
    /// <param name="entityType">Type of entity (email, event, contact, folder)</param>
    /// <param name="entityId">Unique identifier of the entity</param>
    /// <param name="operation">Type of operation (create, update, delete, etc.)</param>
    /// <param name="payload">Optional payload containing operation data</param>
    /// <returns>The ID of the queued operation</returns>
    Task<Guid> QueueOperationAsync(string entityType, string entityId, string operation, object? payload = null);

    /// <summary>
    /// Gets all pending operations that need to be synchronized
    /// </summary>
    /// <returns>List of pending sync operations ordered by creation time</returns>
    Task<List<SyncQueueOperation>> GetPendingOperationsAsync();

    /// <summary>
    /// Gets pending operations for a specific entity type
    /// </summary>
    /// <param name="entityType">Type of entity to filter by</param>
    /// <returns>List of pending sync operations for the entity type</returns>
    Task<List<SyncQueueOperation>> GetPendingOperationsAsync(string entityType);

    /// <summary>
    /// Marks an operation as completed after successful synchronization
    /// </summary>
    /// <param name="operationId">ID of the operation to mark as completed</param>
    Task MarkOperationCompletedAsync(Guid operationId);

    /// <summary>
    /// Marks an operation as failed with an error message
    /// </summary>
    /// <param name="operationId">ID of the operation that failed</param>
    /// <param name="error">Error message describing the failure</param>
    Task MarkOperationFailedAsync(Guid operationId, string error);

    /// <summary>
    /// Marks an operation as processing (being actively synchronized)
    /// </summary>
    /// <param name="operationId">ID of the operation being processed</param>
    Task MarkOperationProcessingAsync(Guid operationId);

    /// <summary>
    /// Increments the retry count for a failed operation and resets to pending
    /// </summary>
    /// <param name="operationId">ID of the operation to retry</param>
    /// <param name="error">Error message from the last attempt</param>
    /// <returns>True if retry is allowed, false if max retries exceeded</returns>
    Task<bool> IncrementRetryAsync(Guid operationId, string error);

    /// <summary>
    /// Clears all completed operations from the queue
    /// </summary>
    /// <returns>Number of operations cleared</returns>
    Task<int> ClearCompletedOperationsAsync();

    /// <summary>
    /// Clears all failed operations from the queue
    /// </summary>
    /// <returns>Number of operations cleared</returns>
    Task<int> ClearFailedOperationsAsync();

    /// <summary>
    /// Gets the count of pending operations
    /// </summary>
    /// <returns>Number of pending operations</returns>
    Task<int> GetPendingCountAsync();

    /// <summary>
    /// Gets an operation by its ID
    /// </summary>
    /// <param name="operationId">ID of the operation to retrieve</param>
    /// <returns>The sync queue operation or null if not found</returns>
    Task<SyncQueueOperation?> GetOperationByIdAsync(Guid operationId);

    /// <summary>
    /// Checks if there are any pending operations for a specific entity
    /// </summary>
    /// <param name="entityType">Type of entity</param>
    /// <param name="entityId">ID of the entity</param>
    /// <returns>True if pending operations exist for the entity</returns>
    Task<bool> HasPendingOperationsAsync(string entityType, string entityId);

    /// <summary>
    /// Removes all pending operations for a specific entity (used when entity is deleted)
    /// </summary>
    /// <param name="entityType">Type of entity</param>
    /// <param name="entityId">ID of the entity</param>
    /// <returns>Number of operations removed</returns>
    Task<int> RemoveOperationsForEntityAsync(string entityType, string entityId);
}
