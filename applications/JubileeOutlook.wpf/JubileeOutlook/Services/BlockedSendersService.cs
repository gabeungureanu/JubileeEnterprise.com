using System.Diagnostics;

namespace JubileeOutlook.Services;

/// <summary>
/// Service to manage blocked email senders.
/// Blocked senders are stored persistently and messages from these senders
/// are automatically filtered out from all folders except Junk.
///
/// Implements offline-first cloud sync:
/// - Local cache used for instant access
/// - API sync when online (merge/union strategy)
/// - Works across devices for the same user
/// </summary>
public class BlockedSendersService
{
    private readonly SecureStorageService _storageService;
    private readonly ApiUserPreferencesService _apiService;
    private const string StorageKey = "blocked_senders";
    private HashSet<string> _blockedSenderEmails = new(StringComparer.OrdinalIgnoreCase);
    private bool _isLoaded = false;
    private bool _isSynced = false;

    public BlockedSendersService(SecureStorageService? storageService = null, ApiUserPreferencesService? apiService = null)
    {
        _storageService = storageService ?? new SecureStorageService();
        _apiService = apiService ?? ApiUserPreferencesService.Instance;
    }

    /// <summary>
    /// Load blocked senders from local storage first, then sync with API if online.
    /// Uses merge (union) strategy - if blocked locally OR on server, stays blocked.
    /// </summary>
    public async Task LoadAsync()
    {
        if (_isLoaded) return;

        try
        {
            // Step 1: Load local cache first (instant)
            var storedEmails = await _storageService.RetrieveAsync<List<string>>(StorageKey);
            if (storedEmails != null)
            {
                _blockedSenderEmails = new HashSet<string>(storedEmails, StringComparer.OrdinalIgnoreCase);
                Debug.WriteLine($"[BlockedSendersService] Loaded {_blockedSenderEmails.Count} blocked senders from local cache");
            }
            _isLoaded = true;

            // Step 2: Sync with API if online (async in background)
            await SyncWithApiAsync();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BlockedSendersService] Error loading blocked senders: {ex.Message}");
            _blockedSenderEmails = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            _isLoaded = true;
        }
    }

    /// <summary>
    /// Sync blocked senders with API using merge (union) strategy.
    /// Any sender blocked locally OR on server will be in the final set.
    /// </summary>
    private async Task SyncWithApiAsync()
    {
        if (_isSynced) return;

        try
        {
            if (!_apiService.IsOnline)
            {
                Debug.WriteLine("[BlockedSendersService] Offline - skipping API sync");
                return;
            }

            // Fetch from API
            var apiSenders = await _apiService.GetBlockedSendersAsync();
            if (apiSenders.Count == 0 && _blockedSenderEmails.Count == 0)
            {
                Debug.WriteLine("[BlockedSendersService] No blocked senders locally or on API");
                _isSynced = true;
                return;
            }

            // Track what we had locally before merge
            var localOnlySenders = _blockedSenderEmails.Except(apiSenders, StringComparer.OrdinalIgnoreCase).ToList();
            var apiOnlySenders = apiSenders.Except(_blockedSenderEmails, StringComparer.OrdinalIgnoreCase).ToList();

            // Merge: Union of local and API (if blocked anywhere, stays blocked)
            foreach (var sender in apiSenders)
            {
                _blockedSenderEmails.Add(sender);
            }

            // Upload local-only senders to API (sync local -> server)
            foreach (var sender in localOnlySenders)
            {
                await _apiService.AddBlockedSenderAsync(sender);
                Debug.WriteLine($"[BlockedSendersService] Synced local sender to API: {sender}");
            }

            // Save merged list to local cache
            await SaveAsync();

            Debug.WriteLine($"[BlockedSendersService] Sync complete: {_blockedSenderEmails.Count} total blocked senders");
            Debug.WriteLine($"[BlockedSendersService] Added {apiOnlySenders.Count} from API, uploaded {localOnlySenders.Count} to API");

            _isSynced = true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BlockedSendersService] Error syncing with API: {ex.Message}");
            // Continue with local cache - don't fail the load
        }
    }

    /// <summary>
    /// Save blocked senders to storage
    /// </summary>
    private async Task SaveAsync()
    {
        try
        {
            await _storageService.StoreAsync(StorageKey, _blockedSenderEmails.ToList());
            Debug.WriteLine($"[BlockedSendersService] Saved {_blockedSenderEmails.Count} blocked senders");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[BlockedSendersService] Error saving blocked senders: {ex.Message}");
        }
    }

    /// <summary>
    /// Block a sender by email address.
    /// Optimistically updates local cache and syncs to API if online.
    /// </summary>
    /// <param name="senderEmail">The email address to block</param>
    /// <returns>True if successfully added, false if already blocked</returns>
    public async Task<bool> BlockSenderAsync(string senderEmail)
    {
        if (string.IsNullOrEmpty(senderEmail))
        {
            Debug.WriteLine("[BlockedSendersService] Cannot block empty email address");
            return false;
        }

        // Normalize email address
        senderEmail = NormalizeEmail(senderEmail);

        await LoadAsync();

        if (_blockedSenderEmails.Contains(senderEmail))
        {
            Debug.WriteLine($"[BlockedSendersService] Sender already blocked: {senderEmail}");
            return false;
        }

        // Step 1: Add to local cache immediately (optimistic update)
        _blockedSenderEmails.Add(senderEmail);
        await SaveAsync();
        Debug.WriteLine($"[BlockedSendersService] Sender blocked locally: {senderEmail}");

        // Step 2: Sync to API if online
        if (_apiService.IsOnline)
        {
            var apiSuccess = await _apiService.AddBlockedSenderAsync(senderEmail);
            if (apiSuccess)
            {
                Debug.WriteLine($"[BlockedSendersService] Sender synced to API: {senderEmail}");
            }
            else
            {
                Debug.WriteLine($"[BlockedSendersService] Failed to sync sender to API (will retry on next sync): {senderEmail}");
            }
        }
        else
        {
            Debug.WriteLine($"[BlockedSendersService] Offline - sender queued for API sync: {senderEmail}");
        }

        return true;
    }

    /// <summary>
    /// Unblock a sender by email address.
    /// Optimistically updates local cache and syncs to API if online.
    /// </summary>
    /// <param name="senderEmail">The email address to unblock</param>
    /// <returns>True if successfully removed, false if not found</returns>
    public async Task<bool> UnblockSenderAsync(string senderEmail)
    {
        if (string.IsNullOrEmpty(senderEmail))
        {
            Debug.WriteLine("[BlockedSendersService] Cannot unblock empty email address");
            return false;
        }

        senderEmail = NormalizeEmail(senderEmail);

        await LoadAsync();

        if (!_blockedSenderEmails.Contains(senderEmail))
        {
            Debug.WriteLine($"[BlockedSendersService] Sender not in blocked list: {senderEmail}");
            return false;
        }

        // Step 1: Remove from local cache immediately (optimistic update)
        _blockedSenderEmails.Remove(senderEmail);
        await SaveAsync();
        Debug.WriteLine($"[BlockedSendersService] Sender unblocked locally: {senderEmail}");

        // Step 2: Sync removal to API if online
        if (_apiService.IsOnline)
        {
            var apiSuccess = await _apiService.RemoveBlockedSenderAsync(senderEmail);
            if (apiSuccess)
            {
                Debug.WriteLine($"[BlockedSendersService] Sender removal synced to API: {senderEmail}");
            }
            else
            {
                Debug.WriteLine($"[BlockedSendersService] Failed to sync sender removal to API: {senderEmail}");
            }
        }
        else
        {
            Debug.WriteLine($"[BlockedSendersService] Offline - sender removal queued for API sync: {senderEmail}");
        }

        return true;
    }

    /// <summary>
    /// Check if a sender is blocked
    /// </summary>
    /// <param name="senderEmail">The email address to check</param>
    /// <returns>True if the sender is blocked</returns>
    public async Task<bool> IsSenderBlockedAsync(string senderEmail)
    {
        if (string.IsNullOrEmpty(senderEmail))
            return false;

        await LoadAsync();
        return _blockedSenderEmails.Contains(NormalizeEmail(senderEmail));
    }

    /// <summary>
    /// Check if a sender is blocked (synchronous, requires prior LoadAsync call)
    /// </summary>
    /// <param name="senderEmail">The email address to check</param>
    /// <returns>True if the sender is blocked</returns>
    public bool IsSenderBlocked(string senderEmail)
    {
        if (string.IsNullOrEmpty(senderEmail))
            return false;

        return _blockedSenderEmails.Contains(NormalizeEmail(senderEmail));
    }

    /// <summary>
    /// Get all blocked sender email addresses
    /// </summary>
    /// <returns>List of blocked email addresses</returns>
    public async Task<List<string>> GetBlockedSendersAsync()
    {
        await LoadAsync();
        return _blockedSenderEmails.ToList();
    }

    /// <summary>
    /// Get the count of blocked senders
    /// </summary>
    public async Task<int> GetBlockedCountAsync()
    {
        await LoadAsync();
        return _blockedSenderEmails.Count;
    }

    /// <summary>
    /// Clear all blocked senders locally and on API.
    /// </summary>
    public async Task ClearAllAsync()
    {
        // Get list of senders to remove from API
        var sendersToRemove = _blockedSenderEmails.ToList();

        // Clear local cache
        _blockedSenderEmails.Clear();
        await SaveAsync();
        Debug.WriteLine("[BlockedSendersService] All blocked senders cleared locally");

        // Sync removal to API if online
        if (_apiService.IsOnline)
        {
            foreach (var sender in sendersToRemove)
            {
                await _apiService.RemoveBlockedSenderAsync(sender);
            }
            Debug.WriteLine($"[BlockedSendersService] Removed {sendersToRemove.Count} senders from API");
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

    /// <summary>
    /// Normalize email address for consistent comparison
    /// </summary>
    private string NormalizeEmail(string email)
    {
        // Trim whitespace and convert to lowercase
        email = email.Trim().ToLowerInvariant();

        // Extract email from format like "Name <email@example.com>"
        if (email.Contains('<') && email.Contains('>'))
        {
            var startIndex = email.IndexOf('<') + 1;
            var endIndex = email.IndexOf('>');
            if (startIndex > 0 && endIndex > startIndex)
            {
                email = email.Substring(startIndex, endIndex - startIndex).Trim();
            }
        }

        return email;
    }
}
