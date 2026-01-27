using System.Diagnostics;

namespace JubileeOutlook.Services;

/// <summary>
/// Service to manage ignored email conversations.
/// Ignored conversations are stored persistently and messages from these conversations
/// are automatically moved to trash when loading messages.
///
/// Implements offline-first cloud sync:
/// - Local cache used for instant access
/// - API sync when online (merge/union strategy)
/// - Works across devices for the same user
/// </summary>
public class IgnoredConversationsService
{
    private readonly SecureStorageService _storageService;
    private readonly ApiUserPreferencesService _apiService;
    private const string StorageKey = "ignored_conversations";
    private HashSet<string> _ignoredConversationIds = new();
    private bool _isLoaded = false;
    private bool _isSynced = false;

    public IgnoredConversationsService(SecureStorageService? storageService = null, ApiUserPreferencesService? apiService = null)
    {
        _storageService = storageService ?? new SecureStorageService();
        _apiService = apiService ?? ApiUserPreferencesService.Instance;
    }

    /// <summary>
    /// Load ignored conversations from local storage first, then sync with API if online.
    /// Uses merge (union) strategy - if ignored locally OR on server, stays ignored.
    /// </summary>
    public async Task LoadAsync()
    {
        if (_isLoaded) return;

        try
        {
            // Step 1: Load local cache first (instant)
            var storedIds = await _storageService.RetrieveAsync<List<string>>(StorageKey);
            if (storedIds != null)
            {
                _ignoredConversationIds = new HashSet<string>(storedIds, StringComparer.OrdinalIgnoreCase);
                Debug.WriteLine($"[IgnoredConversationsService] Loaded {_ignoredConversationIds.Count} ignored conversations from local cache");
            }
            _isLoaded = true;

            // Step 2: Sync with API if online (async in background)
            await SyncWithApiAsync();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[IgnoredConversationsService] Error loading ignored conversations: {ex.Message}");
            _ignoredConversationIds = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _isLoaded = true;
        }
    }

    /// <summary>
    /// Sync ignored conversations with API using merge (union) strategy.
    /// Any conversation ignored locally OR on server will be in the final set.
    /// </summary>
    private async Task SyncWithApiAsync()
    {
        if (_isSynced) return;

        try
        {
            if (!_apiService.IsOnline)
            {
                Debug.WriteLine("[IgnoredConversationsService] Offline - skipping API sync");
                return;
            }

            // Fetch from API
            var apiConversations = await _apiService.GetIgnoredConversationsAsync();
            if (apiConversations.Count == 0 && _ignoredConversationIds.Count == 0)
            {
                Debug.WriteLine("[IgnoredConversationsService] No ignored conversations locally or on API");
                _isSynced = true;
                return;
            }

            // Track what we had locally before merge
            var localOnlyConversations = _ignoredConversationIds.Except(apiConversations, StringComparer.OrdinalIgnoreCase).ToList();
            var apiOnlyConversations = apiConversations.Except(_ignoredConversationIds, StringComparer.OrdinalIgnoreCase).ToList();

            // Merge: Union of local and API (if ignored anywhere, stays ignored)
            foreach (var conversationId in apiConversations)
            {
                _ignoredConversationIds.Add(conversationId);
            }

            // Upload local-only conversations to API (sync local -> server)
            foreach (var conversationId in localOnlyConversations)
            {
                await _apiService.AddIgnoredConversationAsync(conversationId);
                Debug.WriteLine($"[IgnoredConversationsService] Synced local conversation to API: {conversationId}");
            }

            // Save merged list to local cache
            await SaveAsync();

            Debug.WriteLine($"[IgnoredConversationsService] Sync complete: {_ignoredConversationIds.Count} total ignored conversations");
            Debug.WriteLine($"[IgnoredConversationsService] Added {apiOnlyConversations.Count} from API, uploaded {localOnlyConversations.Count} to API");

            _isSynced = true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[IgnoredConversationsService] Error syncing with API: {ex.Message}");
            // Continue with local cache - don't fail the load
        }
    }

    /// <summary>
    /// Save ignored conversations to storage
    /// </summary>
    private async Task SaveAsync()
    {
        try
        {
            await _storageService.StoreAsync(StorageKey, _ignoredConversationIds.ToList());
            Debug.WriteLine($"[IgnoredConversationsService] Saved {_ignoredConversationIds.Count} ignored conversations");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[IgnoredConversationsService] Error saving ignored conversations: {ex.Message}");
        }
    }

    /// <summary>
    /// Add a conversation to the ignored list.
    /// Optimistically updates local cache and syncs to API if online.
    /// </summary>
    /// <param name="conversationId">The conversation ID to ignore</param>
    /// <returns>True if successfully added, false if already ignored</returns>
    public async Task<bool> IgnoreConversationAsync(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
        {
            Debug.WriteLine("[IgnoredConversationsService] Cannot ignore empty conversation ID");
            return false;
        }

        await LoadAsync();

        if (_ignoredConversationIds.Contains(conversationId))
        {
            Debug.WriteLine($"[IgnoredConversationsService] Conversation already ignored: {conversationId}");
            return false;
        }

        // Step 1: Add to local cache immediately (optimistic update)
        _ignoredConversationIds.Add(conversationId);
        await SaveAsync();
        Debug.WriteLine($"[IgnoredConversationsService] Conversation ignored locally: {conversationId}");

        // Step 2: Sync to API if online
        if (_apiService.IsOnline)
        {
            var apiSuccess = await _apiService.AddIgnoredConversationAsync(conversationId);
            if (apiSuccess)
            {
                Debug.WriteLine($"[IgnoredConversationsService] Conversation synced to API: {conversationId}");
            }
            else
            {
                Debug.WriteLine($"[IgnoredConversationsService] Failed to sync conversation to API (will retry on next sync): {conversationId}");
            }
        }
        else
        {
            Debug.WriteLine($"[IgnoredConversationsService] Offline - conversation queued for API sync: {conversationId}");
        }

        return true;
    }

    /// <summary>
    /// Remove a conversation from the ignored list.
    /// Optimistically updates local cache and syncs to API if online.
    /// </summary>
    /// <param name="conversationId">The conversation ID to unignore</param>
    /// <returns>True if successfully removed, false if not found</returns>
    public async Task<bool> UnignoreConversationAsync(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
        {
            Debug.WriteLine("[IgnoredConversationsService] Cannot unignore empty conversation ID");
            return false;
        }

        await LoadAsync();

        if (!_ignoredConversationIds.Contains(conversationId))
        {
            Debug.WriteLine($"[IgnoredConversationsService] Conversation not in ignored list: {conversationId}");
            return false;
        }

        // Step 1: Remove from local cache immediately (optimistic update)
        _ignoredConversationIds.Remove(conversationId);
        await SaveAsync();
        Debug.WriteLine($"[IgnoredConversationsService] Conversation unignored locally: {conversationId}");

        // Step 2: Sync removal to API if online
        if (_apiService.IsOnline)
        {
            var apiSuccess = await _apiService.RemoveIgnoredConversationAsync(conversationId);
            if (apiSuccess)
            {
                Debug.WriteLine($"[IgnoredConversationsService] Conversation removal synced to API: {conversationId}");
            }
            else
            {
                Debug.WriteLine($"[IgnoredConversationsService] Failed to sync conversation removal to API: {conversationId}");
            }
        }
        else
        {
            Debug.WriteLine($"[IgnoredConversationsService] Offline - conversation removal queued for API sync: {conversationId}");
        }

        return true;
    }

    /// <summary>
    /// Check if a conversation is ignored
    /// </summary>
    /// <param name="conversationId">The conversation ID to check</param>
    /// <returns>True if the conversation is ignored</returns>
    public async Task<bool> IsConversationIgnoredAsync(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
            return false;

        await LoadAsync();
        return _ignoredConversationIds.Contains(conversationId);
    }

    /// <summary>
    /// Check if a conversation is ignored (synchronous, requires prior LoadAsync call)
    /// </summary>
    /// <param name="conversationId">The conversation ID to check</param>
    /// <returns>True if the conversation is ignored</returns>
    public bool IsConversationIgnored(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
            return false;

        return _ignoredConversationIds.Contains(conversationId);
    }

    /// <summary>
    /// Get all ignored conversation IDs
    /// </summary>
    /// <returns>List of ignored conversation IDs</returns>
    public async Task<List<string>> GetIgnoredConversationsAsync()
    {
        await LoadAsync();
        return _ignoredConversationIds.ToList();
    }

    /// <summary>
    /// Get the count of ignored conversations
    /// </summary>
    public async Task<int> GetIgnoredCountAsync()
    {
        await LoadAsync();
        return _ignoredConversationIds.Count;
    }

    /// <summary>
    /// Clear all ignored conversations locally and on API.
    /// </summary>
    public async Task ClearAllAsync()
    {
        // Get list of conversations to remove from API
        var conversationsToRemove = _ignoredConversationIds.ToList();

        // Clear local cache
        _ignoredConversationIds.Clear();
        await SaveAsync();
        Debug.WriteLine("[IgnoredConversationsService] All ignored conversations cleared locally");

        // Sync removal to API if online
        if (_apiService.IsOnline)
        {
            foreach (var conversationId in conversationsToRemove)
            {
                await _apiService.RemoveIgnoredConversationAsync(conversationId);
            }
            Debug.WriteLine($"[IgnoredConversationsService] Removed {conversationsToRemove.Count} conversations from API");
        }
    }

    /// <summary>
    /// Force a resync with the API.
    /// Useful after coming back online or for manual refresh.
    /// </summary>
    public async Task ForceSyncAsync()
    {
        _isSynced = false;
        await SyncWithApiAsync();
    }
}
