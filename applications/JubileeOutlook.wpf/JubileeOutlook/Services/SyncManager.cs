using System.Net.Http;
using System.Text.Json;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Coordinates synchronization between local cache and remote API
/// Integrates NetworkStatusService and SyncQueueService for offline-first operation
/// </summary>
public class SyncManager : IDisposable
{
    private static SyncManager? _instance;
    private static readonly object _lock = new();

    private readonly SyncQueueService _syncQueue;
    private readonly NetworkStatusService _networkStatus;
    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions;

    private bool _isProcessing;
    private bool _disposed;
    private CancellationTokenSource? _syncCancellation;

    /// <summary>
    /// Gets the singleton instance of SyncManager
    /// </summary>
    public static SyncManager Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new SyncManager();
                }
            }
            return _instance;
        }
    }

    /// <summary>
    /// Gets whether sync is currently in progress
    /// </summary>
    public bool IsSyncing => _isProcessing;

    /// <summary>
    /// Gets the current network status
    /// </summary>
    public bool IsOnline => _networkStatus.IsOnline;

    /// <summary>
    /// Gets whether the API is reachable
    /// </summary>
    public bool IsApiReachable => _networkStatus.IsApiReachable;

    /// <summary>
    /// Event raised when sync status changes
    /// </summary>
    public event EventHandler<SyncStatusChangedEventArgs>? SyncStatusChanged;

    /// <summary>
    /// Event raised when an individual operation completes
    /// </summary>
    public event EventHandler<SyncOperationCompletedEventArgs>? OperationCompleted;

    private SyncManager()
    {
        _syncQueue = SyncQueueService.Instance;
        _networkStatus = NetworkStatusService.Instance;

        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        // Subscribe to network status changes
        _networkStatus.NetworkStatusChanged += OnNetworkStatusChanged;

        System.Diagnostics.Debug.WriteLine("[SyncManager] Initialized");
    }

    #region Initialization

    /// <summary>
    /// Initializes the sync manager and starts monitoring
    /// </summary>
    public async Task<bool> InitializeAsync()
    {
        try
        {
            // Initialize the sync queue
            var queueInitialized = await _syncQueue.InitializeAsync();
            if (!queueInitialized)
            {
                System.Diagnostics.Debug.WriteLine("[SyncManager] Warning: SyncQueue initialization failed");
            }

            // Start network monitoring
            _networkStatus.StartMonitoring();

            System.Diagnostics.Debug.WriteLine("[SyncManager] Initialized successfully");
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncManager] Initialization failed: {ex.Message}");
            return false;
        }
    }

    #endregion

    #region Network Status Handling

    private async void OnNetworkStatusChanged(object? sender, NetworkStatusChangedEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine($"[SyncManager] Network status changed - Online: {e.IsOnline}, API: {e.IsApiReachable}");

        if (e.IsOnline && e.IsApiReachable)
        {
            // Network restored - process pending operations
            await ProcessPendingOperationsAsync();
        }
        else
        {
            // Network lost - cancel any ongoing sync
            CancelSync();
        }
    }

    #endregion

    #region Sync Operations

    /// <summary>
    /// Processes all pending operations in the sync queue
    /// </summary>
    public async Task<SyncResult> ProcessPendingOperationsAsync()
    {
        if (_isProcessing)
        {
            System.Diagnostics.Debug.WriteLine("[SyncManager] Sync already in progress");
            return new SyncResult { Success = false, Message = "Sync already in progress" };
        }

        if (!_networkStatus.IsOnline || !_networkStatus.IsApiReachable)
        {
            System.Diagnostics.Debug.WriteLine("[SyncManager] Cannot sync - offline or API unreachable");
            return new SyncResult { Success = false, Message = "Network unavailable" };
        }

        _isProcessing = true;
        _syncCancellation = new CancellationTokenSource();

        var result = new SyncResult();
        RaiseSyncStatusChanged(SyncStatus.Started, "Starting sync...");

        try
        {
            var pendingOps = await _syncQueue.GetPendingOperationsAsync();
            result.TotalOperations = pendingOps.Count;

            System.Diagnostics.Debug.WriteLine($"[SyncManager] Processing {pendingOps.Count} pending operations");

            foreach (var operation in pendingOps)
            {
                if (_syncCancellation.Token.IsCancellationRequested)
                {
                    System.Diagnostics.Debug.WriteLine("[SyncManager] Sync cancelled");
                    break;
                }

                var opResult = await ProcessOperationAsync(operation);

                if (opResult.Success)
                {
                    result.SuccessCount++;
                    await _syncQueue.MarkOperationCompletedAsync(operation.Id);
                }
                else
                {
                    result.FailedCount++;
                    var canRetry = await _syncQueue.IncrementRetryAsync(operation.Id, opResult.Error ?? "Unknown error");

                    if (!canRetry)
                    {
                        System.Diagnostics.Debug.WriteLine($"[SyncManager] Operation {operation.Id} exceeded max retries");
                    }
                }

                // Raise operation completed event
                RaiseOperationCompleted(operation, opResult.Success, opResult.Error);
            }

            // Clear completed operations
            await _syncQueue.ClearCompletedOperationsAsync();

            result.Success = result.FailedCount == 0;
            result.Message = $"Synced {result.SuccessCount}/{result.TotalOperations} operations";

            System.Diagnostics.Debug.WriteLine($"[SyncManager] Sync complete: {result.Message}");
            RaiseSyncStatusChanged(SyncStatus.Completed, result.Message);
        }
        catch (Exception ex)
        {
            result.Success = false;
            result.Message = $"Sync failed: {ex.Message}";
            System.Diagnostics.Debug.WriteLine($"[SyncManager] Sync error: {ex.Message}");
            RaiseSyncStatusChanged(SyncStatus.Failed, result.Message);
        }
        finally
        {
            _isProcessing = false;
            _syncCancellation?.Dispose();
            _syncCancellation = null;
        }

        return result;
    }

    /// <summary>
    /// Processes a single sync operation
    /// </summary>
    private async Task<OperationResult> ProcessOperationAsync(SyncQueueOperation operation)
    {
        System.Diagnostics.Debug.WriteLine($"[SyncManager] Processing {operation.EntityType}/{operation.Operation} for {operation.EntityId}");

        try
        {
            switch (operation.EntityType)
            {
                case "email":
                    return await ProcessEmailOperationAsync(operation);
                case "event":
                    return await ProcessEventOperationAsync(operation);
                case "contact":
                    return await ProcessContactOperationAsync(operation);
                case "folder":
                    return await ProcessFolderOperationAsync(operation);
                default:
                    return new OperationResult { Success = false, Error = $"Unknown entity type: {operation.EntityType}" };
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncManager] Operation failed: {ex.Message}");
            return new OperationResult { Success = false, Error = ex.Message };
        }
    }

    private async Task<OperationResult> ProcessEmailOperationAsync(SyncQueueOperation operation)
    {
        // TODO: Implement actual API calls when email API is ready
        // For now, simulate the operation
        await Task.Delay(50); // Simulate network latency

        switch (operation.Operation)
        {
            case "create":
            case "send":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would send email {operation.EntityId}");
                break;
            case "update":
            case "markRead":
            case "markUnread":
            case "markFlagged":
            case "markUnflagged":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would update email {operation.EntityId}");
                break;
            case "delete":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would delete email {operation.EntityId}");
                break;
            case "move":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would move email {operation.EntityId}");
                break;
        }

        return new OperationResult { Success = true };
    }

    private async Task<OperationResult> ProcessEventOperationAsync(SyncQueueOperation operation)
    {
        // TODO: Implement actual API calls to InspireContinuum
        await Task.Delay(50);

        switch (operation.Operation)
        {
            case "create":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would create event {operation.EntityId}");
                break;
            case "update":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would update event {operation.EntityId}");
                break;
            case "delete":
                System.Diagnostics.Debug.WriteLine($"[SyncManager] Would delete event {operation.EntityId}");
                break;
        }

        return new OperationResult { Success = true };
    }

    private async Task<OperationResult> ProcessContactOperationAsync(SyncQueueOperation operation)
    {
        // TODO: Implement actual API calls
        await Task.Delay(50);

        System.Diagnostics.Debug.WriteLine($"[SyncManager] Would {operation.Operation} contact {operation.EntityId}");
        return new OperationResult { Success = true };
    }

    private async Task<OperationResult> ProcessFolderOperationAsync(SyncQueueOperation operation)
    {
        // TODO: Implement actual API calls
        await Task.Delay(50);

        System.Diagnostics.Debug.WriteLine($"[SyncManager] Would {operation.Operation} folder {operation.EntityId}");
        return new OperationResult { Success = true };
    }

    #endregion

    #region Queue Operations

    /// <summary>
    /// Queues an operation for sync (processes immediately if online)
    /// </summary>
    public async Task<Guid> QueueOperationAsync(string entityType, string entityId, string operation, object? payload = null)
    {
        var operationId = await _syncQueue.QueueOperationAsync(entityType, entityId, operation, payload);

        System.Diagnostics.Debug.WriteLine($"[SyncManager] Queued {operation} for {entityType}/{entityId}");

        // If online, try to process immediately
        if (_networkStatus.IsOnline && _networkStatus.IsApiReachable && !_isProcessing)
        {
            _ = ProcessPendingOperationsAsync();
        }

        return operationId;
    }

    /// <summary>
    /// Gets the count of pending operations
    /// </summary>
    public async Task<int> GetPendingCountAsync()
    {
        return await _syncQueue.GetPendingCountAsync();
    }

    #endregion

    #region Control Methods

    /// <summary>
    /// Cancels any ongoing sync operation
    /// </summary>
    public void CancelSync()
    {
        if (_syncCancellation != null && !_syncCancellation.IsCancellationRequested)
        {
            _syncCancellation.Cancel();
            System.Diagnostics.Debug.WriteLine("[SyncManager] Sync cancelled by request");
        }
    }

    /// <summary>
    /// Forces a sync attempt regardless of current state
    /// </summary>
    public async Task<SyncResult> ForceSyncAsync()
    {
        if (!_networkStatus.IsOnline)
        {
            return new SyncResult { Success = false, Message = "No network connection" };
        }

        // Check network status first
        await _networkStatus.CheckNetworkStatusAsync();

        if (!_networkStatus.IsApiReachable)
        {
            return new SyncResult { Success = false, Message = "API not reachable" };
        }

        return await ProcessPendingOperationsAsync();
    }

    #endregion

    #region Event Helpers

    private void RaiseSyncStatusChanged(SyncStatus status, string message)
    {
        try
        {
            SyncStatusChanged?.Invoke(this, new SyncStatusChangedEventArgs(status, message));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncManager] Error raising SyncStatusChanged: {ex.Message}");
        }
    }

    private void RaiseOperationCompleted(SyncQueueOperation operation, bool success, string? error = null)
    {
        try
        {
            OperationCompleted?.Invoke(this, new SyncOperationCompletedEventArgs(operation, success, error));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncManager] Error raising OperationCompleted: {ex.Message}");
        }
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        if (_disposed) return;

        _networkStatus.NetworkStatusChanged -= OnNetworkStatusChanged;
        _syncCancellation?.Cancel();
        _syncCancellation?.Dispose();
        _httpClient.Dispose();

        _disposed = true;
        System.Diagnostics.Debug.WriteLine("[SyncManager] Disposed");
    }

    /// <summary>
    /// Resets the singleton instance
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

#region Supporting Types

/// <summary>
/// Result of a sync operation
/// </summary>
public class SyncResult
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public int TotalOperations { get; set; }
    public int SuccessCount { get; set; }
    public int FailedCount { get; set; }
}

/// <summary>
/// Result of processing a single operation
/// </summary>
public class OperationResult
{
    public bool Success { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Sync status enumeration
/// </summary>
public enum SyncStatus
{
    Idle,
    Started,
    InProgress,
    Completed,
    Failed,
    Cancelled
}

/// <summary>
/// Event args for sync status changes
/// </summary>
public class SyncStatusChangedEventArgs : EventArgs
{
    public SyncStatus Status { get; }
    public string Message { get; }
    public DateTime Timestamp { get; }

    public SyncStatusChangedEventArgs(SyncStatus status, string message)
    {
        Status = status;
        Message = message;
        Timestamp = DateTime.UtcNow;
    }
}

/// <summary>
/// Event args for individual operation completion
/// </summary>
public class SyncOperationCompletedEventArgs : EventArgs
{
    public SyncQueueOperation Operation { get; }
    public bool Success { get; }
    public string? Error { get; }
    public DateTime Timestamp { get; }

    public SyncOperationCompletedEventArgs(SyncQueueOperation operation, bool success, string? error = null)
    {
        Operation = operation;
        Success = success;
        Error = error;
        Timestamp = DateTime.UtcNow;
    }
}

#endregion
