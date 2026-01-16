namespace JubileeOutlook.Services;

/// <summary>
/// Interface for the background synchronization service
/// Handles bidirectional sync between local cache and remote API
/// </summary>
public interface ISyncService : IDisposable
{
    /// <summary>
    /// Gets whether sync is currently in progress
    /// </summary>
    bool IsSyncing { get; }

    /// <summary>
    /// Gets whether background sync is enabled
    /// </summary>
    bool IsEnabled { get; }

    /// <summary>
    /// Gets the last successful sync time
    /// </summary>
    DateTime? LastSyncTime { get; }

    /// <summary>
    /// Gets the current sync state
    /// </summary>
    SyncState CurrentState { get; }

    /// <summary>
    /// Event raised when sync status changes
    /// </summary>
    event EventHandler<SyncProgressEventArgs>? SyncProgressChanged;

    /// <summary>
    /// Event raised when a sync error occurs
    /// </summary>
    event EventHandler<SyncErrorEventArgs>? SyncError;

    /// <summary>
    /// Event raised when sync completes
    /// </summary>
    event EventHandler<SyncCompletedEventArgs>? SyncCompleted;

    /// <summary>
    /// Starts the background sync service
    /// </summary>
    void Start();

    /// <summary>
    /// Stops the background sync service
    /// </summary>
    void Stop();

    /// <summary>
    /// Triggers an immediate sync
    /// </summary>
    Task<SyncResult> SyncNowAsync();

    /// <summary>
    /// Performs a full sync (ignores delta tokens)
    /// </summary>
    Task<SyncResult> FullSyncAsync();

    /// <summary>
    /// Syncs a specific entity type
    /// </summary>
    Task<SyncResult> SyncEntityTypeAsync(string entityType);

    /// <summary>
    /// Gets the current sync token for an entity type
    /// </summary>
    Task<string?> GetSyncTokenAsync(string entityType);

    /// <summary>
    /// Resets sync state (clears all tokens)
    /// </summary>
    Task ResetSyncStateAsync();
}

/// <summary>
/// Sync state enumeration
/// </summary>
public enum SyncState
{
    Idle,
    Starting,
    PullingChanges,
    PushingChanges,
    ProcessingQueue,
    ResolvingConflicts,
    Completing,
    Failed
}

/// <summary>
/// Event args for sync progress updates
/// </summary>
public class SyncProgressEventArgs : EventArgs
{
    public SyncState State { get; }
    public string Message { get; }
    public int Progress { get; }
    public int Total { get; }
    public string? EntityType { get; }

    public SyncProgressEventArgs(SyncState state, string message, int progress = 0, int total = 0, string? entityType = null)
    {
        State = state;
        Message = message;
        Progress = progress;
        Total = total;
        EntityType = entityType;
    }
}

/// <summary>
/// Event args for sync errors
/// </summary>
public class SyncErrorEventArgs : EventArgs
{
    public string ErrorMessage { get; }
    public Exception? Exception { get; }
    public string? EntityType { get; }
    public string? EntityId { get; }
    public bool IsFatal { get; }

    public SyncErrorEventArgs(string errorMessage, Exception? exception = null, string? entityType = null, string? entityId = null, bool isFatal = false)
    {
        ErrorMessage = errorMessage;
        Exception = exception;
        EntityType = entityType;
        EntityId = entityId;
        IsFatal = isFatal;
    }
}

/// <summary>
/// Event args for sync completion
/// </summary>
public class SyncCompletedEventArgs : EventArgs
{
    public bool Success { get; }
    public int ItemsPulled { get; }
    public int ItemsPushed { get; }
    public int Conflicts { get; }
    public TimeSpan Duration { get; }
    public string? ErrorMessage { get; }

    public SyncCompletedEventArgs(bool success, int itemsPulled, int itemsPushed, int conflicts, TimeSpan duration, string? errorMessage = null)
    {
        Success = success;
        ItemsPulled = itemsPulled;
        ItemsPushed = itemsPushed;
        Conflicts = conflicts;
        Duration = duration;
        ErrorMessage = errorMessage;
    }
}
