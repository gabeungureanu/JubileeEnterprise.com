namespace JubileeOutlook.Models;

/// <summary>
/// Represents an operation queued for synchronization when offline
/// Operations are persisted locally and executed when connectivity is restored
/// </summary>
public class SyncQueueOperation
{
    /// <summary>
    /// Unique identifier for the queued operation
    /// </summary>
    public Guid Id { get; set; }

    /// <summary>
    /// Type of entity being operated on (email, event, contact, folder)
    /// </summary>
    public string EntityType { get; set; } = string.Empty;

    /// <summary>
    /// Identifier of the specific entity being operated on
    /// </summary>
    public string EntityId { get; set; } = string.Empty;

    /// <summary>
    /// Type of operation (create, update, delete, move, markRead, markFlagged)
    /// </summary>
    public string Operation { get; set; } = string.Empty;

    /// <summary>
    /// JSON serialized payload containing operation-specific data
    /// </summary>
    public string? Payload { get; set; }

    /// <summary>
    /// Timestamp when the operation was queued
    /// </summary>
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    /// <summary>
    /// Number of times sync has been attempted for this operation
    /// </summary>
    public int RetryCount { get; set; } = 0;

    /// <summary>
    /// Last error message if sync failed
    /// </summary>
    public string? LastError { get; set; }

    /// <summary>
    /// Current status of the operation (pending, processing, completed, failed)
    /// </summary>
    public SyncOperationStatus Status { get; set; } = SyncOperationStatus.Pending;

    /// <summary>
    /// Timestamp when the operation was last attempted
    /// </summary>
    public DateTime? LastAttemptAt { get; set; }

    /// <summary>
    /// Timestamp when the operation was completed
    /// </summary>
    public DateTime? CompletedAt { get; set; }
}

/// <summary>
/// Status of a sync queue operation
/// </summary>
public enum SyncOperationStatus
{
    /// <summary>
    /// Operation is waiting to be processed
    /// </summary>
    Pending,

    /// <summary>
    /// Operation is currently being processed
    /// </summary>
    Processing,

    /// <summary>
    /// Operation completed successfully
    /// </summary>
    Completed,

    /// <summary>
    /// Operation failed after maximum retries
    /// </summary>
    Failed
}

/// <summary>
/// Types of entities that can be synchronized
/// </summary>
public static class SyncEntityTypes
{
    public const string Email = "email";
    public const string Folder = "folder";
    public const string Event = "event";
    public const string Contact = "contact";
    public const string Attachment = "attachment";
}

/// <summary>
/// Types of operations that can be queued
/// </summary>
public static class SyncOperationTypes
{
    public const string Create = "create";
    public const string Update = "update";
    public const string Delete = "delete";
    public const string Move = "move";
    public const string MarkRead = "markRead";
    public const string MarkUnread = "markUnread";
    public const string MarkFlagged = "markFlagged";
    public const string MarkUnflagged = "markUnflagged";
    public const string Send = "send";
    public const string SaveDraft = "saveDraft";
}
