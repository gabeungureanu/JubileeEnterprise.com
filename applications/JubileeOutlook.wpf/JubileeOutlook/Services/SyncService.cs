using System.Net.Http;
using System.Text.Json;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Background synchronization service for JubileeOutlook
/// Handles bidirectional sync between local cache and remote API
/// Supports delta sync, conflict resolution, and full sync fallback
/// </summary>
public class SyncService : ISyncService
{
    private static SyncService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClient _httpClient;
    private readonly JsonSerializerOptions _jsonOptions;
    private readonly string _apiBaseUrl;
    private readonly int _syncIntervalMs;

    private Timer? _syncTimer;
    private bool _isSyncing;
    private bool _isEnabled;
    private DateTime? _lastSyncTime;
    private SyncState _currentState;
    private CancellationTokenSource? _syncCancellation;

    // Sync tokens for delta sync
    private readonly Dictionary<string, string> _syncTokens = new();
    private readonly object _tokenLock = new();

    /// <summary>
    /// Gets the singleton instance
    /// </summary>
    public static SyncService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new SyncService();
                }
            }
            return _instance;
        }
    }

    #region Properties

    public bool IsSyncing => _isSyncing;
    public bool IsEnabled => _isEnabled;
    public DateTime? LastSyncTime => _lastSyncTime;
    public SyncState CurrentState => _currentState;

    #endregion

    #region Events

    public event EventHandler<SyncProgressEventArgs>? SyncProgressChanged;
    public event EventHandler<SyncErrorEventArgs>? SyncError;
    public event EventHandler<SyncCompletedEventArgs>? SyncCompleted;

    #endregion

    private SyncService()
    {
        var config = ConfigurationService.Instance;
        _apiBaseUrl = config.GetInspireContinuumBaseUrl();
        _syncIntervalMs = config.LocalCache.SyncIntervalSeconds * 1000;

        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(_apiBaseUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            WriteIndented = false
        };

        _currentState = SyncState.Idle;

        System.Diagnostics.Debug.WriteLine($"[SyncService] Initialized with {_syncIntervalMs}ms interval");
    }

    #region Start/Stop

    public void Start()
    {
        if (_isEnabled)
        {
            System.Diagnostics.Debug.WriteLine("[SyncService] Already running");
            return;
        }

        _isEnabled = true;
        _syncTimer = new Timer(
            async _ => await OnSyncTimerTickAsync(),
            null,
            TimeSpan.FromSeconds(5), // Initial delay
            TimeSpan.FromMilliseconds(_syncIntervalMs)
        );

        System.Diagnostics.Debug.WriteLine("[SyncService] Started");
    }

    public void Stop()
    {
        if (!_isEnabled) return;

        _isEnabled = false;
        _syncTimer?.Dispose();
        _syncTimer = null;

        // Cancel any ongoing sync
        _syncCancellation?.Cancel();

        System.Diagnostics.Debug.WriteLine("[SyncService] Stopped");
    }

    #endregion

    #region Sync Operations

    public async Task<SyncResult> SyncNowAsync()
    {
        if (_isSyncing)
        {
            return new SyncResult
            {
                Success = false,
                Message = "Sync already in progress"
            };
        }

        return await ExecuteSyncAsync(useDeltaSync: true);
    }

    public async Task<SyncResult> FullSyncAsync()
    {
        if (_isSyncing)
        {
            return new SyncResult
            {
                Success = false,
                Message = "Sync already in progress"
            };
        }

        // Clear all sync tokens for full sync
        lock (_tokenLock)
        {
            _syncTokens.Clear();
        }

        return await ExecuteSyncAsync(useDeltaSync: false);
    }

    public async Task<SyncResult> SyncEntityTypeAsync(string entityType)
    {
        if (_isSyncing)
        {
            return new SyncResult
            {
                Success = false,
                Message = "Sync already in progress"
            };
        }

        return await ExecuteSyncAsync(useDeltaSync: true, specificEntityType: entityType);
    }

    private async Task<SyncResult> ExecuteSyncAsync(bool useDeltaSync, string? specificEntityType = null)
    {
        var startTime = DateTime.UtcNow;
        var result = new SyncResult();

        _isSyncing = true;
        _syncCancellation = new CancellationTokenSource();

        try
        {
            // Check network status
            if (!NetworkStatusService.Instance.IsOnline)
            {
                return new SyncResult
                {
                    Success = false,
                    Message = "No network connection"
                };
            }

            UpdateState(SyncState.Starting);
            RaiseProgressChanged(SyncState.Starting, "Starting sync...");

            var entityTypes = specificEntityType != null
                ? new[] { specificEntityType }
                : new[] { "email", "event", "contact", "folder" };

            int totalPulled = 0;
            int totalPushed = 0;
            int totalConflicts = 0;

            foreach (var entityType in entityTypes)
            {
                if (_syncCancellation.Token.IsCancellationRequested)
                    break;

                // Pull changes from server
                var pullResult = await PullChangesFromServerAsync(entityType, useDeltaSync);
                totalPulled += pullResult.ItemsProcessed;

                // Push local changes
                var pushResult = await PushChangesToServerAsync(entityType);
                totalPushed += pushResult.ItemsProcessed;
                totalConflicts += pushResult.Conflicts;
            }

            // Process any remaining queue items
            await ProcessSyncQueueAsync();

            _lastSyncTime = DateTime.UtcNow;
            UpdateState(SyncState.Idle);

            result.Success = true;
            result.Message = $"Sync completed: {totalPulled} pulled, {totalPushed} pushed";
            result.TotalOperations = totalPulled + totalPushed;
            result.SuccessCount = totalPulled + totalPushed;

            var duration = DateTime.UtcNow - startTime;
            RaiseSyncCompleted(true, totalPulled, totalPushed, totalConflicts, duration);

            System.Diagnostics.Debug.WriteLine($"[SyncService] Sync completed in {duration.TotalSeconds:F1}s");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Sync failed: {ex.Message}");

            result.Success = false;
            result.Message = ex.Message;

            UpdateState(SyncState.Failed);
            RaiseError(ex.Message, ex, isFatal: false);
            RaiseSyncCompleted(false, 0, 0, 0, DateTime.UtcNow - startTime, ex.Message);
        }
        finally
        {
            _isSyncing = false;
            _syncCancellation?.Dispose();
            _syncCancellation = null;
        }

        return result;
    }

    #endregion

    #region Pull Changes

    private async Task<SyncOperationResult> PullChangesFromServerAsync(string entityType)
    {
        return await PullChangesFromServerAsync(entityType, useDeltaSync: true);
    }

    private async Task<SyncOperationResult> PullChangesFromServerAsync(string entityType, bool useDeltaSync)
    {
        UpdateState(SyncState.PullingChanges);
        RaiseProgressChanged(SyncState.PullingChanges, $"Pulling {entityType} changes...", entityType: entityType);

        var result = new SyncOperationResult();

        try
        {
            string? syncToken = null;
            if (useDeltaSync)
            {
                syncToken = GetSyncTokenInternal(entityType);
            }

            // Build API request based on entity type
            var changes = await FetchChangesFromApiAsync(entityType, syncToken);

            if (changes != null)
            {
                foreach (var change in changes.Items)
                {
                    if (_syncCancellation?.Token.IsCancellationRequested == true)
                        break;

                    await ApplyServerChangeAsync(entityType, change);
                    result.ItemsProcessed++;
                }

                // Update sync token for next delta sync
                if (!string.IsNullOrEmpty(changes.NextSyncToken))
                {
                    SetSyncToken(entityType, changes.NextSyncToken);
                }
            }

            System.Diagnostics.Debug.WriteLine($"[SyncService] Pulled {result.ItemsProcessed} {entityType} items");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Pull failed for {entityType}: {ex.Message}");
            RaiseError($"Failed to pull {entityType}", ex, entityType: entityType);
        }

        return result;
    }

    private async Task<ServerChangesResponse?> FetchChangesFromApiAsync(string entityType, string? syncToken)
    {
        try
        {
            // Build the API endpoint based on entity type
            var endpoint = entityType switch
            {
                "email" => "/api/v1/outlook/emails/changes",
                "event" => "/api/v1/outlook/events/changes",
                "contact" => "/api/v1/outlook/contacts/changes",
                "folder" => "/api/v1/outlook/folders/changes",
                _ => throw new ArgumentException($"Unknown entity type: {entityType}")
            };

            var url = $"{_apiBaseUrl}{endpoint}";
            if (!string.IsNullOrEmpty(syncToken))
            {
                url += $"?syncToken={Uri.EscapeDataString(syncToken)}";
            }

            var response = await _httpClient.GetAsync(url, _syncCancellation?.Token ?? CancellationToken.None);

            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<ServerChangesResponse>(content, _jsonOptions);
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.Gone)
            {
                // Sync token expired - need full sync
                System.Diagnostics.Debug.WriteLine($"[SyncService] Sync token expired for {entityType}, need full sync");
                ClearSyncToken(entityType);
                return null;
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[SyncService] API error: {response.StatusCode}");
                return null;
            }
        }
        catch (HttpRequestException ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] HTTP error fetching {entityType}: {ex.Message}");
            return null;
        }
        catch (TaskCanceledException)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Request cancelled for {entityType}");
            return null;
        }
    }

    private async Task ApplyServerChangeAsync(string entityType, ServerChange change)
    {
        try
        {
            switch (entityType)
            {
                case "email":
                    await ApplyEmailChangeAsync(change);
                    break;
                case "event":
                    await ApplyEventChangeAsync(change);
                    break;
                case "contact":
                    await ApplyContactChangeAsync(change);
                    break;
                case "folder":
                    await ApplyFolderChangeAsync(change);
                    break;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Failed to apply change for {entityType}/{change.Id}: {ex.Message}");
            RaiseError($"Failed to apply {entityType} change", ex, entityType, change.Id);
        }
    }

    private async Task ApplyEmailChangeAsync(ServerChange change)
    {
        var cache = LocalCacheService.Instance;

        if (change.IsDeleted)
        {
            await cache.MarkEmailDeletedAsync(change.Id);
        }
        else if (change.Data != null)
        {
            // Convert server data to local model and cache
            // TODO: Implement actual conversion when EmailMessage model is finalized
            System.Diagnostics.Debug.WriteLine($"[SyncService] Applied email change: {change.Id}");
        }
    }

    private async Task ApplyEventChangeAsync(ServerChange change)
    {
        // TODO: Implement event change application
        await Task.CompletedTask;
        System.Diagnostics.Debug.WriteLine($"[SyncService] Applied event change: {change.Id}");
    }

    private async Task ApplyContactChangeAsync(ServerChange change)
    {
        // TODO: Implement contact change application
        await Task.CompletedTask;
        System.Diagnostics.Debug.WriteLine($"[SyncService] Applied contact change: {change.Id}");
    }

    private async Task ApplyFolderChangeAsync(ServerChange change)
    {
        // TODO: Implement folder change application
        await Task.CompletedTask;
        System.Diagnostics.Debug.WriteLine($"[SyncService] Applied folder change: {change.Id}");
    }

    #endregion

    #region Push Changes

    private async Task<SyncOperationResult> PushChangesToServerAsync(string entityType)
    {
        UpdateState(SyncState.PushingChanges);
        RaiseProgressChanged(SyncState.PushingChanges, $"Pushing {entityType} changes...", entityType: entityType);

        var result = new SyncOperationResult();

        try
        {
            // Get pending operations for this entity type
            var pendingOps = await SyncQueueService.Instance.GetPendingOperationsAsync();
            var entityOps = pendingOps.Where(op => op.EntityType == entityType).ToList();

            foreach (var op in entityOps)
            {
                if (_syncCancellation?.Token.IsCancellationRequested == true)
                    break;

                var pushResult = await PushOperationToServerAsync(op);

                if (pushResult.Success)
                {
                    await SyncQueueService.Instance.MarkOperationCompletedAsync(op.Id);
                    result.ItemsProcessed++;
                }
                else if (pushResult.IsConflict)
                {
                    // Handle conflict
                    var resolved = await ResolveConflictAsync(op, pushResult.ServerVersion);
                    if (resolved)
                    {
                        await SyncQueueService.Instance.MarkOperationCompletedAsync(op.Id);
                        result.Conflicts++;
                    }
                    else
                    {
                        // Mark as failed if conflict resolution failed
                        await SyncQueueService.Instance.MarkOperationFailedAsync(op.Id, "Conflict resolution failed");
                    }
                }
                else
                {
                    // Retry logic handled by SyncQueueService
                    var canRetry = await SyncQueueService.Instance.IncrementRetryAsync(op.Id, pushResult.Error ?? "Unknown error");
                    if (!canRetry)
                    {
                        System.Diagnostics.Debug.WriteLine($"[SyncService] Operation {op.Id} exceeded max retries");
                    }
                }
            }

            System.Diagnostics.Debug.WriteLine($"[SyncService] Pushed {result.ItemsProcessed} {entityType} items");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Push failed for {entityType}: {ex.Message}");
            RaiseError($"Failed to push {entityType}", ex, entityType: entityType);
        }

        return result;
    }

    private async Task<PushResult> PushOperationToServerAsync(SyncQueueOperation operation)
    {
        try
        {
            // Build the API endpoint based on operation type
            var endpoint = GetApiEndpoint(operation.EntityType, operation.EntityId, operation.Operation);

            HttpResponseMessage response;

            switch (operation.Operation)
            {
                case "create":
                    var createContent = new StringContent(
                        operation.Payload ?? "{}",
                        System.Text.Encoding.UTF8,
                        "application/json");
                    response = await _httpClient.PostAsync(endpoint, createContent);
                    break;

                case "update":
                    var updateContent = new StringContent(
                        operation.Payload ?? "{}",
                        System.Text.Encoding.UTF8,
                        "application/json");
                    response = await _httpClient.PutAsync(endpoint, updateContent);
                    break;

                case "delete":
                    response = await _httpClient.DeleteAsync(endpoint);
                    break;

                default:
                    // For other operations like markRead, markFlagged, etc.
                    var actionContent = new StringContent(
                        operation.Payload ?? "{}",
                        System.Text.Encoding.UTF8,
                        "application/json");
                    response = await _httpClient.PostAsync(endpoint, actionContent);
                    break;
            }

            if (response.IsSuccessStatusCode)
            {
                return new PushResult { Success = true };
            }
            else if (response.StatusCode == System.Net.HttpStatusCode.Conflict)
            {
                // Conflict detected - need to resolve
                var content = await response.Content.ReadAsStringAsync();
                return new PushResult
                {
                    Success = false,
                    IsConflict = true,
                    ServerVersion = content
                };
            }
            else
            {
                return new PushResult
                {
                    Success = false,
                    Error = $"HTTP {(int)response.StatusCode}: {response.ReasonPhrase}"
                };
            }
        }
        catch (Exception ex)
        {
            return new PushResult
            {
                Success = false,
                Error = ex.Message
            };
        }
    }

    private string GetApiEndpoint(string entityType, string entityId, string operation)
    {
        var baseEndpoint = entityType switch
        {
            "email" => "/api/v1/outlook/emails",
            "event" => "/api/v1/outlook/events",
            "contact" => "/api/v1/outlook/contacts",
            "folder" => "/api/v1/outlook/folders",
            _ => throw new ArgumentException($"Unknown entity type: {entityType}")
        };

        return operation switch
        {
            "create" => baseEndpoint,
            "delete" or "update" => $"{baseEndpoint}/{entityId}",
            _ => $"{baseEndpoint}/{entityId}/{operation}"
        };
    }

    #endregion

    #region Conflict Resolution

    private async Task<bool> ResolveConflictAsync(SyncQueueOperation localChange, string? serverVersionJson)
    {
        RaiseProgressChanged(SyncState.ResolvingConflicts, $"Resolving conflict for {localChange.EntityType}...");

        try
        {
            // Default strategy: Server wins (last-write-wins with server priority)
            // For a more sophisticated approach, you'd compare timestamps or implement
            // field-level merging

            if (string.IsNullOrEmpty(serverVersionJson))
            {
                // No server version provided, assume local wins
                return true;
            }

            // Parse server version to get the latest data
            var serverVersion = JsonSerializer.Deserialize<JsonElement>(serverVersionJson);

            // For now, server wins - discard local changes
            // In a real implementation, you might:
            // 1. Compare timestamps and keep the newer version
            // 2. Merge non-conflicting fields
            // 3. Prompt the user to resolve manually

            System.Diagnostics.Debug.WriteLine($"[SyncService] Conflict resolved for {localChange.EntityType}/{localChange.EntityId} - server wins");

            // Re-fetch the server version to update local cache
            await RefreshEntityFromServerAsync(localChange.EntityType, localChange.EntityId);

            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Conflict resolution failed: {ex.Message}");
            return false;
        }
    }

    private async Task RefreshEntityFromServerAsync(string entityType, string entityId)
    {
        // Fetch the latest version from server and update local cache
        // This is a simplified implementation
        await Task.CompletedTask;
        System.Diagnostics.Debug.WriteLine($"[SyncService] Refreshed {entityType}/{entityId} from server");
    }

    #endregion

    #region Process Queue

    public async Task ProcessSyncQueueAsync()
    {
        var queue = SyncQueueService.Instance;
        var pending = await queue.GetPendingOperationsAsync();

        if (pending.Count == 0)
        {
            System.Diagnostics.Debug.WriteLine("[SyncService] No pending operations in queue");
            return;
        }

        RaiseProgressChanged(SyncState.ProcessingQueue, $"Processing {pending.Count} queued operations...");

        foreach (var op in pending)
        {
            if (_syncCancellation?.Token.IsCancellationRequested == true)
                break;

            var result = await PushOperationToServerAsync(op);

            if (result.Success)
            {
                await queue.MarkOperationCompletedAsync(op.Id);
            }
            else if (!result.IsConflict)
            {
                // Don't increment retry for conflicts
                await queue.IncrementRetryAsync(op.Id, result.Error ?? "Unknown error");
            }
        }

        // Clear completed operations
        await queue.ClearCompletedOperationsAsync();
    }

    #endregion

    #region Sync Token Management

    public async Task<string?> GetSyncTokenAsync(string entityType)
    {
        await Task.CompletedTask; // Make async for potential future DB storage
        return GetSyncTokenInternal(entityType);
    }

    private string? GetSyncTokenInternal(string entityType)
    {
        lock (_tokenLock)
        {
            return _syncTokens.TryGetValue(entityType, out var token) ? token : null;
        }
    }

    private void SetSyncToken(string entityType, string token)
    {
        lock (_tokenLock)
        {
            _syncTokens[entityType] = token;
        }
        System.Diagnostics.Debug.WriteLine($"[SyncService] Updated sync token for {entityType}");
    }

    private void ClearSyncToken(string entityType)
    {
        lock (_tokenLock)
        {
            _syncTokens.Remove(entityType);
        }
    }

    public async Task ResetSyncStateAsync()
    {
        lock (_tokenLock)
        {
            _syncTokens.Clear();
        }

        _lastSyncTime = null;

        System.Diagnostics.Debug.WriteLine("[SyncService] Sync state reset");
        await Task.CompletedTask;
    }

    #endregion

    #region Timer Callback

    private async Task OnSyncTimerTickAsync()
    {
        if (!_isEnabled || _isSyncing)
            return;

        // Check if we have network
        if (!NetworkStatusService.Instance.IsOnline || !NetworkStatusService.Instance.IsApiReachable)
        {
            System.Diagnostics.Debug.WriteLine("[SyncService] Skipping sync - offline");
            return;
        }

        try
        {
            await SyncNowAsync();
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Timer sync failed: {ex.Message}");
        }
    }

    #endregion

    #region Event Helpers

    private void UpdateState(SyncState state)
    {
        _currentState = state;
    }

    private void RaiseProgressChanged(SyncState state, string message, int progress = 0, int total = 0, string? entityType = null)
    {
        UpdateState(state);
        try
        {
            SyncProgressChanged?.Invoke(this, new SyncProgressEventArgs(state, message, progress, total, entityType));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Error raising progress event: {ex.Message}");
        }
    }

    private void RaiseError(string message, Exception? ex = null, string? entityType = null, string? entityId = null, bool isFatal = false)
    {
        try
        {
            SyncError?.Invoke(this, new SyncErrorEventArgs(message, ex, entityType, entityId, isFatal));
        }
        catch (Exception e)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Error raising error event: {e.Message}");
        }
    }

    private void RaiseSyncCompleted(bool success, int pulled, int pushed, int conflicts, TimeSpan duration, string? error = null)
    {
        try
        {
            SyncCompleted?.Invoke(this, new SyncCompletedEventArgs(success, pulled, pushed, conflicts, duration, error));
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[SyncService] Error raising completed event: {ex.Message}");
        }
    }

    #endregion

    #region IDisposable

    public void Dispose()
    {
        Stop();
        _syncCancellation?.Dispose();
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }

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
/// Response from server containing changes
/// </summary>
public class ServerChangesResponse
{
    public List<ServerChange> Items { get; set; } = new();
    public string? NextSyncToken { get; set; }
    public bool HasMore { get; set; }
}

/// <summary>
/// A single change from the server
/// </summary>
public class ServerChange
{
    public string Id { get; set; } = string.Empty;
    public string ChangeType { get; set; } = string.Empty; // created, updated, deleted
    public bool IsDeleted => ChangeType == "deleted";
    public DateTime ModifiedAt { get; set; }
    public JsonElement? Data { get; set; }
}

/// <summary>
/// Result of a sync operation for a single entity type
/// </summary>
public class SyncOperationResult
{
    public int ItemsProcessed { get; set; }
    public int Conflicts { get; set; }
    public List<string> Errors { get; set; } = new();
}

/// <summary>
/// Result of pushing a single operation
/// </summary>
public class PushResult
{
    public bool Success { get; set; }
    public bool IsConflict { get; set; }
    public string? Error { get; set; }
    public string? ServerVersion { get; set; }
}

#endregion
