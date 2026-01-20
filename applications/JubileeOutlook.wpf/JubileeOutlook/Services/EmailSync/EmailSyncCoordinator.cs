using System.Diagnostics;
using System.Timers;
using JubileeOutlook.Models.EmailSync;
using Timer = System.Timers.Timer;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Coordinates email synchronization across all accounts
/// Manages the sync workflow from authentication to incremental updates
/// </summary>
public class EmailSyncCoordinator : IDisposable
{
    private readonly SecureStorageService _secureStorage;
    private readonly EmailAuthenticationManager _authManager;
    private readonly EmailProviderDetectionService _providerDetection;
    private readonly FolderDiscoveryService _folderDiscovery;
    private readonly Dictionary<Guid, EmailConnectionService> _connections;
    private readonly Dictionary<Guid, Timer> _syncTimers;
    private readonly object _syncLock = new();
    private bool _disposed;

    /// <summary>
    /// Event raised when sync status changes
    /// </summary>
    public event EventHandler<SyncStatusChangedEventArgs>? SyncStatusChanged;

    /// <summary>
    /// Event raised during sync progress
    /// </summary>
    public event EventHandler<SyncProgressEventArgs>? SyncProgress;

    /// <summary>
    /// Event raised when password is required for authentication
    /// </summary>
    public event EventHandler<PasswordRequiredEventArgs>? PasswordRequired;

    public EmailSyncCoordinator()
    {
        _secureStorage = new SecureStorageService();
        _authManager = new EmailAuthenticationManager();
        _providerDetection = new EmailProviderDetectionService();
        _folderDiscovery = new FolderDiscoveryService();
        _connections = new Dictionary<Guid, EmailConnectionService>();
        _syncTimers = new Dictionary<Guid, Timer>();

        // Wire up auth manager events
        _authManager.PasswordRequired += (s, e) => PasswordRequired?.Invoke(this, e);
        _authManager.AuthenticationProgress += (s, e) => RaiseProgress(e.Message, e.PercentComplete, 100);
    }

    /// <summary>
    /// Add and sync a new email account
    /// </summary>
    public async Task<AddAccountResult> AddAccountAsync(string emailAddress)
    {
        Debug.WriteLine($"[SyncCoordinator] Adding account: {emailAddress}");
        RaiseStatusChanged(Guid.Empty, SyncStatus.Connecting, "Starting account setup...");

        try
        {
            // Step 1: Authenticate
            var authResult = await _authManager.AuthenticateAccountAsync(emailAddress);
            if (!authResult.Success || authResult.Account == null)
            {
                return new AddAccountResult
                {
                    Success = false,
                    ErrorMessage = authResult.ErrorMessage ?? "Authentication failed"
                };
            }

            var account = authResult.Account;
            Debug.WriteLine($"[SyncCoordinator] Account authenticated: {account.Id}");

            // Step 2: Connect
            RaiseStatusChanged(account.Id, SyncStatus.Connecting, "Connecting to mail server...");
            var connectionService = CreateConnectionService(account.Id);
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                return new AddAccountResult
                {
                    Success = false,
                    ErrorMessage = connectionResult.ErrorMessage ?? "Connection failed"
                };
            }

            // Step 3: Discover folders
            RaiseStatusChanged(account.Id, SyncStatus.Syncing, "Discovering folders...");
            var foldersResult = await _folderDiscovery.DiscoverFoldersAsync(account, connectionResult);

            if (!foldersResult.Success)
            {
                return new AddAccountResult
                {
                    Success = false,
                    ErrorMessage = foldersResult.ErrorMessage ?? "Folder discovery failed"
                };
            }

            // Store folder mappings
            foreach (var folder in foldersResult.Folders)
            {
                await _secureStorage.StoreAsync($"folder_{account.Id}_{folder.Id}", folder);
            }

            // Store folder list
            await _secureStorage.StoreAsync($"folders_{account.Id}", foldersResult.Folders);

            // Step 4: Initial sync of important folders
            RaiseStatusChanged(account.Id, SyncStatus.Syncing, "Syncing emails...");
            var importantFolders = foldersResult.Folders
                .Where(f => f.IsSubscribed)
                .OrderBy(f => f.FolderType == FolderType.Inbox ? 0 : 1)
                .ToList();

            var syncService = new EmailSyncService(_secureStorage, connectionService, _folderDiscovery);
            syncService.SyncProgress += (s, e) => SyncProgress?.Invoke(this, e);

            foreach (var folder in importantFolders)
            {
                RaiseProgress($"Syncing {folder.FolderName}...", 0, 100);
                var syncResult = await syncService.InitialSyncFolderAsync(
                    account, folder, connectionResult, account.MaxMessagesToSync);

                if (!syncResult.Success)
                {
                    Debug.WriteLine($"[SyncCoordinator] Folder sync failed: {folder.FolderName} - {syncResult.ErrorMessage}");
                }
            }

            // Update account status
            account.ConnectionStatus = AccountConnectionStatus.Connected;
            account.LastSuccessfulSync = DateTime.UtcNow;
            await _secureStorage.StoreAsync($"account_{account.Id}", account);

            // Start background sync timer
            StartSyncTimer(account);

            RaiseStatusChanged(account.Id, SyncStatus.Idle, "Sync complete");

            return new AddAccountResult
            {
                Success = true,
                Account = account,
                Folders = foldersResult.Folders
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncCoordinator] Add account error: {ex.Message}");
            return new AddAccountResult
            {
                Success = false,
                ErrorMessage = $"Failed to add account: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Add account with provided password (for non-OAuth providers)
    /// </summary>
    public async Task<AddAccountResult> AddAccountWithPasswordAsync(
        string emailAddress,
        string password)
    {
        Debug.WriteLine($"[SyncCoordinator] Adding account with password: {emailAddress}");

        try
        {
            // Detect provider
            var detection = await _providerDetection.DetectProviderAsync(emailAddress);
            if (!detection.Success || detection.ProviderConfig == null)
            {
                return new AddAccountResult
                {
                    Success = false,
                    ErrorMessage = detection.ErrorMessage ?? "Could not detect email provider"
                };
            }

            // Authenticate with password
            var authResult = await _authManager.AuthenticateWithPasswordAsync(
                emailAddress, password, detection.ProviderConfig);

            if (!authResult.Success || authResult.Account == null)
            {
                return new AddAccountResult
                {
                    Success = false,
                    ErrorMessage = authResult.ErrorMessage ?? "Authentication failed"
                };
            }

            // Continue with the standard flow from connection onwards
            var account = authResult.Account;
            return await CompleteAccountSetupAsync(account);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncCoordinator] Add account error: {ex.Message}");
            return new AddAccountResult
            {
                Success = false,
                ErrorMessage = $"Failed to add account: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Complete account setup after authentication
    /// </summary>
    private async Task<AddAccountResult> CompleteAccountSetupAsync(SyncedEmailAccount account)
    {
        // Connect
        RaiseStatusChanged(account.Id, SyncStatus.Connecting, "Connecting to mail server...");
        var connectionService = CreateConnectionService(account.Id);
        var connectionResult = await connectionService.ConnectAsync(account);

        if (!connectionResult.Success)
        {
            return new AddAccountResult
            {
                Success = false,
                ErrorMessage = connectionResult.ErrorMessage ?? "Connection failed"
            };
        }

        // Discover folders
        RaiseStatusChanged(account.Id, SyncStatus.Syncing, "Discovering folders...");
        var foldersResult = await _folderDiscovery.DiscoverFoldersAsync(account, connectionResult);

        if (!foldersResult.Success)
        {
            return new AddAccountResult
            {
                Success = false,
                ErrorMessage = foldersResult.ErrorMessage ?? "Folder discovery failed"
            };
        }

        // Store folders
        await _secureStorage.StoreAsync($"folders_{account.Id}", foldersResult.Folders);

        // Initial sync
        RaiseStatusChanged(account.Id, SyncStatus.Syncing, "Syncing emails...");
        var syncService = new EmailSyncService(_secureStorage, connectionService, _folderDiscovery);
        syncService.SyncProgress += (s, e) => SyncProgress?.Invoke(this, e);

        var importantFolders = foldersResult.Folders.Where(f => f.IsSubscribed).ToList();
        foreach (var folder in importantFolders)
        {
            await syncService.InitialSyncFolderAsync(account, folder, connectionResult, account.MaxMessagesToSync);
        }

        // Update account
        account.ConnectionStatus = AccountConnectionStatus.Connected;
        account.LastSuccessfulSync = DateTime.UtcNow;
        await _secureStorage.StoreAsync($"account_{account.Id}", account);

        // Start background sync
        StartSyncTimer(account);
        RaiseStatusChanged(account.Id, SyncStatus.Idle, "Sync complete");

        return new AddAccountResult
        {
            Success = true,
            Account = account,
            Folders = foldersResult.Folders
        };
    }

    /// <summary>
    /// Manually trigger sync for an account
    /// </summary>
    public async Task<EmailSyncResult> SyncAccountAsync(Guid accountId, CancellationToken cancellationToken = default)
    {
        Debug.WriteLine($"[SyncCoordinator] Manual sync requested for account {accountId}");

        lock (_syncLock)
        {
            // Prevent concurrent syncs for same account
        }

        try
        {
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                return new EmailSyncResult
                {
                    Success = false,
                    ErrorMessage = "Account not found"
                };
            }

            RaiseStatusChanged(accountId, SyncStatus.Syncing, "Syncing...");

            // Get or create connection
            var connectionService = GetOrCreateConnection(accountId);
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                account.ConnectionStatus = AccountConnectionStatus.ConnectionError;
                account.LastError = connectionResult.ErrorMessage;
                await _secureStorage.StoreAsync($"account_{accountId}", account);

                RaiseStatusChanged(accountId, SyncStatus.Error, connectionResult.ErrorMessage ?? "Connection failed");
                return new EmailSyncResult
                {
                    Success = false,
                    ErrorMessage = connectionResult.ErrorMessage
                };
            }

            // Get folders
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            if (folders == null || !folders.Any())
            {
                var discovery = await _folderDiscovery.DiscoverFoldersAsync(account, connectionResult);
                folders = discovery.Folders;
                await _secureStorage.StoreAsync($"folders_{accountId}", folders);
            }

            // Incremental sync each folder
            var syncService = new EmailSyncService(_secureStorage, connectionService, _folderDiscovery);
            syncService.SyncProgress += (s, e) => SyncProgress?.Invoke(this, e);

            var totalResult = new EmailSyncResult { SyncTime = DateTime.UtcNow };

            foreach (var folder in folders.Where(f => f.IsSubscribed))
            {
                if (cancellationToken.IsCancellationRequested) break;

                var result = await syncService.IncrementalSyncFolderAsync(
                    account, folder, connectionResult, cancellationToken);

                totalResult.NewMessages += result.NewMessages;
                totalResult.UpdatedMessages += result.UpdatedMessages;
                totalResult.DeletedMessages += result.DeletedMessages;
            }

            // Update account
            account.LastSuccessfulSync = DateTime.UtcNow;
            account.ConnectionStatus = AccountConnectionStatus.Connected;
            account.LastError = null;
            await _secureStorage.StoreAsync($"account_{accountId}", account);

            totalResult.Success = true;
            RaiseStatusChanged(accountId, SyncStatus.Idle, $"Synced: {totalResult.NewMessages} new");

            return totalResult;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncCoordinator] Sync error: {ex.Message}");
            RaiseStatusChanged(accountId, SyncStatus.Error, ex.Message);

            return new EmailSyncResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }

    /// <summary>
    /// Sync all accounts
    /// </summary>
    public async Task SyncAllAccountsAsync(CancellationToken cancellationToken = default)
    {
        var accounts = await _authManager.GetStoredAccountsAsync();

        foreach (var account in accounts.Where(a => a.IsEnabled))
        {
            if (cancellationToken.IsCancellationRequested) break;

            await SyncAccountAsync(account.Id, cancellationToken);
        }
    }

    /// <summary>
    /// Remove an account
    /// </summary>
    public async Task RemoveAccountAsync(Guid accountId)
    {
        Debug.WriteLine($"[SyncCoordinator] Removing account {accountId}");

        // Stop sync timer
        StopSyncTimer(accountId);

        // Disconnect
        if (_connections.TryGetValue(accountId, out var connection))
        {
            await connection.DisconnectImapAsync();
            connection.Dispose();
            _connections.Remove(accountId);
        }

        // Remove stored data
        await _authManager.RemoveAccountAsync(accountId);

        // Remove folders and messages
        var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
        if (folders != null)
        {
            foreach (var folder in folders)
            {
                await _secureStorage.DeleteAsync($"folder_{accountId}_{folder.Id}");
                await _secureStorage.DeleteAsync($"folder_sync_{folder.Id}");
                await _secureStorage.DeleteAsync($"messages_{accountId}_{folder.Id}");
            }
        }
        await _secureStorage.DeleteAsync($"folders_{accountId}");
    }

    /// <summary>
    /// Get all synced accounts
    /// </summary>
    public async Task<List<SyncedEmailAccount>> GetAccountsAsync()
    {
        return await _authManager.GetStoredAccountsAsync();
    }

    /// <summary>
    /// Get folders for an account
    /// </summary>
    public async Task<List<SyncedEmailFolder>> GetFoldersAsync(Guid accountId)
    {
        return await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}")
            ?? new List<SyncedEmailFolder>();
    }

    /// <summary>
    /// Get synced messages for a folder
    /// </summary>
    public async Task<List<SyncedMessage>> GetMessagesAsync(Guid accountId, Guid folderId)
    {
        return await _secureStorage.RetrieveAsync<List<SyncedMessage>>($"messages_{accountId}_{folderId}")
            ?? new List<SyncedMessage>();
    }

    #region Background Sync

    private void StartSyncTimer(SyncedEmailAccount account)
    {
        StopSyncTimer(account.Id);

        var timer = new Timer(account.SyncIntervalMinutes * 60 * 1000);
        timer.Elapsed += async (s, e) => await OnSyncTimerElapsed(account.Id);
        timer.AutoReset = true;
        timer.Start();

        _syncTimers[account.Id] = timer;
        Debug.WriteLine($"[SyncCoordinator] Started sync timer for {account.EmailAddress} ({account.SyncIntervalMinutes} min)");
    }

    private void StopSyncTimer(Guid accountId)
    {
        if (_syncTimers.TryGetValue(accountId, out var timer))
        {
            timer.Stop();
            timer.Dispose();
            _syncTimers.Remove(accountId);
        }
    }

    private async Task OnSyncTimerElapsed(Guid accountId)
    {
        Debug.WriteLine($"[SyncCoordinator] Background sync triggered for {accountId}");
        await SyncAccountAsync(accountId);
    }

    #endregion

    #region Connection Management

    private EmailConnectionService CreateConnectionService(Guid accountId)
    {
        var microsoftAuth = new MicrosoftOAuth2Service(_secureStorage);
        var connection = new EmailConnectionService(_secureStorage, microsoftAuth);
        _connections[accountId] = connection;
        return connection;
    }

    private EmailConnectionService GetOrCreateConnection(Guid accountId)
    {
        if (_connections.TryGetValue(accountId, out var existing))
        {
            return existing;
        }
        return CreateConnectionService(accountId);
    }

    #endregion

    #region Events

    private void RaiseStatusChanged(Guid accountId, SyncStatus status, string message)
    {
        SyncStatusChanged?.Invoke(this, new SyncStatusChangedEventArgs
        {
            AccountId = accountId,
            Status = status,
            Message = message
        });
    }

    private void RaiseProgress(string message, int current, int total)
    {
        SyncProgress?.Invoke(this, new SyncProgressEventArgs
        {
            Message = message,
            CurrentItem = current,
            TotalItems = total,
            PercentComplete = total > 0 ? (int)(current * 100.0 / total) : 0
        });
    }

    #endregion

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                foreach (var timer in _syncTimers.Values)
                {
                    timer.Stop();
                    timer.Dispose();
                }
                _syncTimers.Clear();

                foreach (var connection in _connections.Values)
                {
                    connection.Dispose();
                }
                _connections.Clear();
            }
            _disposed = true;
        }
    }
}

/// <summary>
/// Result of adding an account
/// </summary>
public class AddAccountResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public SyncedEmailAccount? Account { get; set; }
    public List<SyncedEmailFolder> Folders { get; set; } = new();
}

/// <summary>
/// Sync status
/// </summary>
public enum SyncStatus
{
    Idle,
    Connecting,
    Syncing,
    Error
}

/// <summary>
/// Sync status changed event args
/// </summary>
public class SyncStatusChangedEventArgs : EventArgs
{
    public Guid AccountId { get; set; }
    public SyncStatus Status { get; set; }
    public string Message { get; set; } = string.Empty;
}
