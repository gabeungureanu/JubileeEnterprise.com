using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using JubileeOutlook.Services.EmailSync;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Windows.Data;
using System.Windows.Threading;

namespace JubileeOutlook.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IMailService _mailService;
    private readonly ICalendarService _calendarService;
    private readonly SyncedEmailDisplayService _syncedEmailService;
    private readonly EmailSyncCoordinator _syncCoordinator;
    private readonly IgnoredConversationsService _ignoredConversationsService;
    private readonly BlockedSendersService _blockedSendersService;

    [ObservableProperty]
    private ObservableCollection<MailFolder> _folders = new();

    [ObservableProperty]
    private ObservableCollection<EmailMessage> _messages = new();

    [ObservableProperty]
    private ObservableCollection<ConversationGroup> _conversationGroups = new();

    // Available categories for email organization
    [ObservableProperty]
    private ObservableCollection<string> _availableCategories = new()
    {
        "Personal",
        "Work",
        "Important",
        "Follow Up",
        "Family",
        "Finance",
        "Travel",
        "Shopping"
    };

    // Current filter settings
    [ObservableProperty]
    private string _currentFilter = "All";

    [ObservableProperty]
    private string _currentSortCriteria = "Date";

    [ObservableProperty]
    private bool _sortDescending = true;

    [ObservableProperty]
    private string? _selectedCategory;

    [ObservableProperty]
    private ObservableCollection<CalendarEvent> _events = new();

    [ObservableProperty]
    private MailFolder? _selectedFolder;

    [ObservableProperty]
    private EmailMessage? _selectedMessage;

    [ObservableProperty]
    private EmailMessage? _displayedMessage;

    [ObservableProperty]
    private CalendarEvent? _selectedEvent;

    [ObservableProperty]
    private string _currentView = "Mail";

    [ObservableProperty]
    private string _searchQuery = string.Empty;

    [ObservableProperty]
    private bool _isComposingNewMessage;

    [ObservableProperty]
    private string _wwbwEmailAddress = string.Empty;

    [ObservableProperty]
    private MailFolder? _accountRootFolder;

    [ObservableProperty]
    private bool _hasSyncedAccounts;

    [ObservableProperty]
    private bool _isSyncing;

    [ObservableProperty]
    private string _syncStatusMessage = string.Empty;

    [ObservableProperty]
    private bool _isOfflineMode = false;

    /// <summary>
    /// Event raised when offline mode changes
    /// </summary>
    public event EventHandler<bool>? OfflineModeChanged;

    /// <summary>
    /// Event raised when email body content is updated and UI needs to refresh
    /// </summary>
    public event EventHandler? EmailBodyUpdated;

    /// <summary>
    /// Event raised when Reply button is clicked
    /// </summary>
    public event EventHandler? ReplyRequested;

    /// <summary>
    /// Event raised when Reply All button is clicked
    /// </summary>
    public event EventHandler? ReplyAllRequested;

    /// <summary>
    /// Event raised when Forward button is clicked
    /// </summary>
    public event EventHandler? ForwardRequested;

    /// <summary>
    /// Event raised when New Folder is requested
    /// </summary>
    public event EventHandler? NewFolderRequested;

    /// <summary>
    /// Event raised when Rename Folder is requested
    /// </summary>
    public event EventHandler<MailFolder>? RenameFolderRequested;

    /// <summary>
    /// Event raised when Delete Folder is requested
    /// </summary>
    public event EventHandler<MailFolder>? DeleteFolderRequested;

    public MainViewModel(IMailService mailService, ICalendarService calendarService)
    {
        _mailService = mailService;
        _calendarService = calendarService;
        _syncedEmailService = new SyncedEmailDisplayService();
        _syncCoordinator = new EmailSyncCoordinator();
        _ignoredConversationsService = new IgnoredConversationsService();
        _blockedSendersService = new BlockedSendersService();

        // Note: InitializeData is NOT called here anymore
        // It should be called after network status is confirmed in MainWindow.Loaded event
    }

    /// <summary>
    /// Initializes data by loading folders and messages from the API
    /// Call this after the window is loaded and network status is confirmed
    /// </summary>
    public async Task InitializeDataAsync()
    {
        await InitializeDataCoreAsync();
    }

    /// <summary>
    /// Determines if a folder type should display unread counts.
    /// Only Inbox and Custom folders show unread counts; Sent, Drafts, Deleted, Junk, and Archive do not.
    /// </summary>
    private static bool ShouldShowUnreadCount(FolderType folderType)
    {
        return folderType switch
        {
            FolderType.Inbox => true,
            FolderType.Custom => true,
            FolderType.AccountRoot => false,
            FolderType.Sent => false,
            FolderType.Drafts => false,
            FolderType.Deleted => false,
            FolderType.Junk => false,
            FolderType.Archive => false,
            _ => false
        };
    }

    /// <summary>
    /// Sets the WWBW email address and rebuilds the folder structure
    /// </summary>
    public void SetWwbwEmail(string? wwbwEmail)
    {
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] SetWwbwEmail called with: '{wwbwEmail}'");
        WwbwEmailAddress = wwbwEmail ?? string.Empty;

        // If we already have an AccountRootFolder, just update its Name property
        // This avoids recreating the whole object and ensures binding updates
        if (AccountRootFolder != null)
        {
            var newName = !string.IsNullOrEmpty(WwbwEmailAddress) ? WwbwEmailAddress : "My Account";
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Updating AccountRootFolder.Name to: '{newName}'");
            AccountRootFolder.Name = newName;
            AccountRootFolder.WwbwEmailAddress = WwbwEmailAddress;
        }
        else
        {
            RebuildFolderStructure();
        }
    }

    private void RebuildFolderStructure()
    {
        // Get the base folders from the mail service (synchronous, uses cache)
        var baseFolders = _mailService.GetFolders();
        BuildFolderStructure(baseFolders);
    }

    private async Task RebuildFolderStructureAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] RebuildFolderStructureAsync - Fetching folders from API...");

            // Get the base folders from the mail service asynchronously
            var baseFolders = await _mailService.GetFoldersAsync();

            System.Diagnostics.Debug.WriteLine($"[MainViewModel] RebuildFolderStructureAsync - Got {baseFolders?.Count ?? 0} folders");

            BuildFolderStructure(baseFolders ?? new List<MailFolder>());
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] RebuildFolderStructureAsync ERROR: {ex.Message}");
            BuildFolderStructure(new List<MailFolder>());
        }
    }

    private void BuildFolderStructure(List<MailFolder> baseFolders)
    {
        var folderName = !string.IsNullOrEmpty(WwbwEmailAddress) ? WwbwEmailAddress : "My Account";
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] BuildFolderStructure - {baseFolders.Count} subfolders");

        // Create the account root folder with WWBW email
        var rootFolder = new MailFolder
        {
            Id = "account-root",
            Name = folderName,
            Type = FolderType.AccountRoot,
            IsAccountRoot = true,
            WwbwEmailAddress = WwbwEmailAddress,
            IsExpanded = true,
            Icon = "📧",
            SubFolders = new System.Collections.ObjectModel.ObservableCollection<MailFolder>(baseFolders)
        };

        // Update parent folder references
        foreach (var folder in baseFolders)
        {
            folder.ParentFolderId = rootFolder.Id;
        }

        AccountRootFolder = rootFolder;
        Folders = new ObservableCollection<MailFolder>(new[] { rootFolder });
    }

    private async Task InitializeDataCoreAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] InitializeDataCoreAsync started");

            // First, check for synced email accounts
            var syncedFolders = await _syncedEmailService.BuildFolderTreeAsync();
            HasSyncedAccounts = syncedFolders.Count > 0;

            if (HasSyncedAccounts)
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Found {syncedFolders.Count} synced accounts");

                // Use the first synced account as the root
                var firstAccount = syncedFolders.First();
                AccountRootFolder = firstAccount;
                Folders = new ObservableCollection<MailFolder>(syncedFolders);

                // Select inbox by default
                var inbox = firstAccount.SubFolders.FirstOrDefault(f => f.Type == FolderType.Inbox);
                if (inbox != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Selecting synced inbox: {inbox.Name}");
                    SelectedFolder = inbox;

                    // Check if we have any messages already
                    var existingMessages = await _syncedEmailService.GetDisplayMessagesAsync(inbox.Id);

                    if (existingMessages.Count == 0)
                    {
                        // No messages yet - do a full sync first, then load messages
                        System.Diagnostics.Debug.WriteLine("[MainViewModel] No cached messages, performing initial sync...");
                        await TriggerEmailSyncAsync();
                        // Messages will be loaded by TriggerEmailSyncAsync after sync completes
                    }
                    else
                    {
                        // Load cached messages immediately
                        Messages = new ObservableCollection<EmailMessage>(existingMessages);
                        // Trigger background sync to get updates
                        _ = TriggerEmailSyncAsync();
                    }
                }
                else
                {
                    // No inbox found, just trigger sync in background
                    _ = TriggerEmailSyncAsync();
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("[MainViewModel] No synced accounts, using API folders");

                // Build initial folder structure asynchronously to properly load from API
                await RebuildFolderStructureAsync();

                System.Diagnostics.Debug.WriteLine($"[MainViewModel] InitializeData - Folders loaded: {AccountRootFolder?.SubFolders?.Count ?? 0}");

                // Select inbox by default (look in subfolders of root)
                var inbox = AccountRootFolder?.SubFolders.FirstOrDefault(f => f.Type == FolderType.Inbox);
                if (inbox != null)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] InitializeData - Selecting inbox: {inbox.Id}");
                    SelectedFolder = inbox;
                    await LoadMessagesAsync(inbox.Id);
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine("[MainViewModel] InitializeData - No inbox folder found!");
                }
            }

            // Load today's events
            await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(1));

            System.Diagnostics.Debug.WriteLine("[MainViewModel] InitializeDataCoreAsync completed");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] InitializeDataCoreAsync ERROR: {ex.Message}");
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Stack trace: {ex.StackTrace}");
        }
    }

    /// <summary>
    /// Trigger email sync from the server for all synced accounts
    /// This runs in the background and refreshes the UI when complete
    /// </summary>
    private async Task TriggerEmailSyncAsync()
    {
        if (IsSyncing)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] Sync already in progress, skipping");
            return;
        }

        try
        {
            IsSyncing = true;
            SyncStatusMessage = "Syncing...";
            System.Diagnostics.Debug.WriteLine("[MainViewModel] Starting email sync from server...");

            // Subscribe to sync progress events
            _syncCoordinator.SyncStatusChanged += OnSyncStatusChanged;

            // Sync all enabled accounts
            await _syncCoordinator.SyncAllAccountsAsync();

            System.Diagnostics.Debug.WriteLine("[MainViewModel] Email sync completed, refreshing UI...");

            // Refresh folder tree and messages after sync
            var syncedFolders = await _syncedEmailService.BuildFolderTreeAsync();
            if (syncedFolders.Count > 0)
            {
                var firstAccount = syncedFolders.First();
                AccountRootFolder = firstAccount;
                Folders = new ObservableCollection<MailFolder>(syncedFolders);

                // Reload current folder's messages
                if (SelectedFolder != null)
                {
                    await LoadSyncedMessagesAsync(SelectedFolder.Id);
                }
            }

            SyncStatusMessage = "Up to date";
            System.Diagnostics.Debug.WriteLine("[MainViewModel] UI refreshed after sync");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Email sync error: {ex.Message}");
            SyncStatusMessage = "Sync failed";
        }
        finally
        {
            IsSyncing = false;
            _syncCoordinator.SyncStatusChanged -= OnSyncStatusChanged;

            // Clear status after a delay
            _ = ClearSyncStatusAfterDelay();
        }
    }

    private void OnSyncStatusChanged(object? sender, Services.EmailSync.SyncStatusChangedEventArgs e)
    {
        SyncStatusMessage = e.Message;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Sync status: {e.Status} - {e.Message}");
    }

    private async Task ClearSyncStatusAfterDelay()
    {
        await Task.Delay(3000);
        if (SyncStatusMessage == "Up to date" || SyncStatusMessage == "Sync failed")
        {
            SyncStatusMessage = string.Empty;
        }
    }

    /// <summary>
    /// Manually trigger a sync (can be called from UI button)
    /// </summary>
    public async Task ManualSyncAsync()
    {
        await TriggerEmailSyncAsync();
    }

    /// <summary>
    /// Load messages from synced email storage
    /// </summary>
    private async Task LoadSyncedMessagesAsync(string folderId)
    {
        try
        {
            var messages = await _syncedEmailService.GetDisplayMessagesAsync(folderId);

            // Determine folder type for filtering rules
            var isTrashFolder = SelectedFolder?.Type == FolderType.Deleted;
            var isJunkFolder = SelectedFolder?.Type == FolderType.Junk;
            List<EmailMessage> filteredMessages;

            if (isTrashFolder || isJunkFolder)
            {
                // Don't filter in Trash or Junk - show all messages including ignored/blocked
                filteredMessages = messages;
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] {(isTrashFolder ? "Trash" : "Junk")} folder - showing all messages");
            }
            else
            {
                // Load filter services
                await _ignoredConversationsService.LoadAsync();
                await _blockedSendersService.LoadAsync();

                // Filter out messages from ignored conversations and blocked senders
                filteredMessages = messages
                    .Where(m => (string.IsNullOrEmpty(m.ConversationId) ||
                                !_ignoredConversationsService.IsConversationIgnored(m.ConversationId)) &&
                               (string.IsNullOrEmpty(m.FromEmail) ||
                                !_blockedSendersService.IsSenderBlocked(m.FromEmail)))
                    .ToList();

                var ignoredCount = messages.Count - filteredMessages.Count;
                if (ignoredCount > 0)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Filtered out {ignoredCount} messages (ignored conversations or blocked senders)");
                }
            }

            Messages = new ObservableCollection<EmailMessage>(filteredMessages);

            // Update folder counts (only show unread for certain folder types)
            if (SelectedFolder != null)
            {
                if (ShouldShowUnreadCount(SelectedFolder.Type))
                {
                    SelectedFolder.UnreadCount = Messages.Count(m => !m.IsRead);
                }
                SelectedFolder.TotalCount = Messages.Count;
            }

            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Loaded {filteredMessages.Count} synced messages for folder {folderId}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] LoadSyncedMessagesAsync ERROR: {ex.Message}");
            Messages = new ObservableCollection<EmailMessage>();
        }
    }

    partial void OnSelectedFolderChanged(MailFolder? oldValue, MailFolder? newValue)
    {
        // Clear previous selection
        if (oldValue != null)
        {
            oldValue.IsSelected = false;
        }

        // Set new selection
        if (newValue != null)
        {
            newValue.IsSelected = true;

            // Check if this is a synced folder (GUID-based ID) or API folder
            if (HasSyncedAccounts && Guid.TryParse(newValue.Id, out _))
            {
                _ = LoadSyncedMessagesAsync(newValue.Id);
            }
            else
            {
                _ = LoadMessagesAsync(newValue.Id);
            }
        }
    }

    partial void OnSelectedMessageChanged(EmailMessage? value)
    {
        if (value != null)
        {
            // Mark as read if needed
            if (!value.IsRead)
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Marking email '{value.Subject}' as read");
                _ = _mailService.MarkAsReadAsync(value.Id, true);
                value.IsRead = true;

                // Update unread count for the current folder by counting unread messages
                // Only update for folder types that should show unread counts
                if (SelectedFolder != null && ShouldShowUnreadCount(SelectedFolder.Type))
                {
                    var unreadCount = Messages.Count(m => !m.IsRead);
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Updating unread count to {unreadCount}");
                    SelectedFolder.UnreadCount = unreadCount;
                }
            }

            // Store the message for display in the reading pane
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Setting DisplayedMessage: {value.Subject}, Body length: {value.Body?.Length ?? 0}, Preview length: {value.Preview?.Length ?? 0}, NeedsBodyFetch: {value.NeedsBodyFetch}");
            DisplayedMessage = value;

            // Fetch body on-demand if needed for synced messages
            if (value.NeedsBodyFetch && value.AccountId.HasValue && !string.IsNullOrEmpty(value.RemoteMessageId) && value.SyncedMessageId.HasValue)
            {
                _ = FetchMessageBodyOnDemandAsync(value);
            }
        }
    }

    /// <summary>
    /// Fetch message body on-demand for synced messages
    /// </summary>
    private async Task FetchMessageBodyOnDemandAsync(EmailMessage message)
    {
        try
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Fetching body on-demand for: {message.Subject}");

            // Get folder ID
            Guid folderId = Guid.Empty;
            if (Guid.TryParse(message.FolderId, out var parsedFolderId))
            {
                folderId = parsedFolderId;
            }

            var body = await _syncedEmailService.FetchMessageBodyAsync(
                message.AccountId!.Value,
                message.RemoteMessageId!,
                folderId);

            if (!string.IsNullOrEmpty(body))
            {
                message.Body = body;
                message.IsHtml = body.Contains("<html") || body.Contains("<div") || body.Contains("<p>");
                message.NeedsBodyFetch = false;

                // Update the display if this is still the selected message
                if (DisplayedMessage == message)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Body fetched, updating display. Body length: {body.Length}");
                    // Raise event to tell MainWindow to refresh the email body browser
                    EmailBodyUpdated?.Invoke(this, EventArgs.Empty);
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Body fetch returned empty/null");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Error fetching body on-demand: {ex.Message}");
        }
    }

    public async Task LoadMessagesAsync(string folderId)
    {
        var messages = await _mailService.GetMessagesAsync(folderId);

        // Determine folder type for filtering rules
        var isTrashFolder = SelectedFolder?.Type == FolderType.Deleted;
        var isJunkFolder = SelectedFolder?.Type == FolderType.Junk;
        List<EmailMessage> filteredMessages;

        if (isTrashFolder || isJunkFolder)
        {
            // Don't filter in Trash or Junk - show all messages including ignored/blocked
            filteredMessages = messages;
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] {(isTrashFolder ? "Trash" : "Junk")} folder - showing all messages");
        }
        else
        {
            // Load filter services
            await _ignoredConversationsService.LoadAsync();
            await _blockedSendersService.LoadAsync();

            // Filter out messages from ignored conversations and blocked senders
            filteredMessages = messages
                .Where(m => (string.IsNullOrEmpty(m.ConversationId) ||
                            !_ignoredConversationsService.IsConversationIgnored(m.ConversationId)) &&
                           (string.IsNullOrEmpty(m.FromEmail) ||
                            !_blockedSendersService.IsSenderBlocked(m.FromEmail)))
                .ToList();

            var ignoredCount = messages.Count - filteredMessages.Count;
            if (ignoredCount > 0)
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Filtered out {ignoredCount} messages (ignored conversations or blocked senders)");
            }
        }

        Messages = new ObservableCollection<EmailMessage>(filteredMessages);

        // Update folder counts by counting the actual messages
        // Only update unread count for folder types that should show it
        if (SelectedFolder != null)
        {
            if (ShouldShowUnreadCount(SelectedFolder.Type))
            {
                SelectedFolder.UnreadCount = Messages.Count(m => !m.IsRead);
            }
            SelectedFolder.TotalCount = Messages.Count;
        }
    }

    /// <summary>
    /// Refreshes the message list for the currently selected folder
    /// </summary>
    public async Task RefreshMessagesAsync()
    {
        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }
    }

    private async Task LoadEventsAsync(DateTime startDate, DateTime endDate)
    {
        var events = await _calendarService.GetEventsAsync(startDate, endDate);
        Events = new ObservableCollection<CalendarEvent>(events);
    }

    [RelayCommand]
    private void NewMessage()
    {
        IsComposingNewMessage = true;
    }

    [RelayCommand]
    private void Reply()
    {
        if (DisplayedMessage == null) return;

        // Raise event to show compose panel in reply mode
        ReplyRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void ReplyAll()
    {
        if (DisplayedMessage == null) return;

        // Raise event to show compose panel in reply-all mode
        ReplyAllRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void Forward()
    {
        if (DisplayedMessage == null) return;

        // Raise event to show compose panel in forward mode
        ForwardRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private async Task Delete()
    {
        if (SelectedMessage == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] Delete: No message selected");
            return;
        }

        var messageToDelete = SelectedMessage;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Delete requested for message: {messageToDelete.Subject}");

        // Check if this is a synced message (has AccountId and RemoteMessageId)
        if (messageToDelete.AccountId.HasValue && !string.IsNullOrEmpty(messageToDelete.RemoteMessageId))
        {
            if (Guid.TryParse(messageToDelete.FolderId, out var folderId))
            {
                // OPTIMISTIC UPDATE: Remove from UI immediately for instant feedback
                Messages.Remove(messageToDelete);
                SelectedMessage = Messages.FirstOrDefault();
                System.Diagnostics.Debug.WriteLine("[MainViewModel] Message removed from UI (optimistic update)");

                // Move to trash in background - don't await
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var success = await _syncedEmailService.MoveMessageToTrashAsync(
                            messageToDelete.AccountId.Value,
                            folderId,
                            messageToDelete.RemoteMessageId);

                        if (success)
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Message moved to trash on server successfully");
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Failed to move message to trash on server");
                            // Could add the message back to the UI here if needed
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception in background Delete: {ex.Message}");
                    }
                });
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Failed to parse FolderId: {messageToDelete.FolderId}");
            }
        }
        else
        {
            // Non-synced messages - also do optimistic update
            Messages.Remove(messageToDelete);
            SelectedMessage = Messages.FirstOrDefault();

            // Delete in background
            _ = Task.Run(async () =>
            {
                try
                {
                    await _mailService.DeleteMessageAsync(messageToDelete.Id);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception deleting non-synced message: {ex.Message}");
                }
            });
        }
    }

    [RelayCommand]
    private async Task ToggleFlag()
    {
        if (SelectedMessage == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] ToggleFlag: No message selected");
            return;
        }

        var messageToFlag = SelectedMessage;
        var newFlagState = !messageToFlag.IsFlagged;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] ToggleFlag requested for message: {messageToFlag.Subject}, new state: {newFlagState}");

        // OPTIMISTIC UPDATE: Update UI immediately
        messageToFlag.IsFlagged = newFlagState;

        // Check if this is a synced message (has AccountId and RemoteMessageId)
        if (messageToFlag.AccountId.HasValue && !string.IsNullOrEmpty(messageToFlag.RemoteMessageId))
        {
            if (Guid.TryParse(messageToFlag.FolderId, out var folderId))
            {
                // Toggle flag in background for synced messages
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var success = await _syncedEmailService.ToggleFlagAsync(
                            messageToFlag.AccountId.Value,
                            folderId,
                            messageToFlag.RemoteMessageId,
                            newFlagState);

                        if (success)
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Flag toggled on server successfully");
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Failed to toggle flag on server");
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception in background ToggleFlag: {ex.Message}");
                    }
                });
            }
        }
        else
        {
            // Non-synced messages - use API
            _ = Task.Run(async () =>
            {
                try
                {
                    await _mailService.ToggleFlagAsync(messageToFlag.Id, newFlagState);
                    System.Diagnostics.Debug.WriteLine("[MainViewModel] Non-synced message flag toggled via API");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception toggling flag for non-synced message: {ex.Message}");
                }
            });
        }
    }

    [RelayCommand]
    private async Task Search()
    {
        if (string.IsNullOrWhiteSpace(SearchQuery)) return;

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Searching for: {SearchQuery}");

        var allResults = new List<EmailMessage>();

        // Search synced emails locally first (instant results)
        if (HasSyncedAccounts)
        {
            var syncedResults = await _syncedEmailService.SearchMessagesAsync(SearchQuery);
            allResults.AddRange(syncedResults);
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Found {syncedResults.Count} synced email matches");
        }

        // Also search API messages if available
        try
        {
            var apiResults = await _mailService.SearchMessagesAsync(SearchQuery);
            // Avoid duplicates by checking message IDs
            var existingIds = new HashSet<string>(allResults.Select(m => m.Id));
            var uniqueApiResults = apiResults.Where(m => !existingIds.Contains(m.Id));
            allResults.AddRange(uniqueApiResults);
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Found {apiResults.Count} API message matches");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] API search failed (continuing with local results): {ex.Message}");
        }

        // Filter out messages from ignored conversations and blocked senders
        await _ignoredConversationsService.LoadAsync();
        await _blockedSendersService.LoadAsync();
        var filteredResults = allResults
            .Where(m => (string.IsNullOrEmpty(m.ConversationId) ||
                        !_ignoredConversationsService.IsConversationIgnored(m.ConversationId)) &&
                       (string.IsNullOrEmpty(m.FromEmail) ||
                        !_blockedSendersService.IsSenderBlocked(m.FromEmail)))
            .ToList();

        var filteredCount = allResults.Count - filteredResults.Count;
        if (filteredCount > 0)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Filtered out {filteredCount} messages (ignored conversations or blocked senders) in search");
        }

        // Sort by date descending and update UI
        var sortedResults = filteredResults.OrderByDescending(m => m.ReceivedDate).ToList();
        Messages = new ObservableCollection<EmailMessage>(sortedResults);

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Total search results: {Messages.Count}");
    }

    [RelayCommand]
    private void SwitchToMailView()
    {
        CurrentView = "Mail";
    }

    [RelayCommand]
    private void SwitchToCalendarView()
    {
        CurrentView = "Calendar";
    }

    [RelayCommand]
    private async Task NewEvent()
    {
        var newEvent = new CalendarEvent
        {
            Subject = "New Event",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1)
        };

        await _calendarService.CreateEventAsync(newEvent);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    [RelayCommand]
    private async Task DeleteEvent()
    {
        if (SelectedEvent == null) return;

        await _calendarService.DeleteEventAsync(SelectedEvent.Id);
        Events.Remove(SelectedEvent);
        SelectedEvent = null;
    }

    [RelayCommand]
    public async Task RefreshFolders()
    {
        await RebuildFolderStructureAsync();
    }

    // Home Tab - Move & Organize
    [RelayCommand]
    private async Task MoveToFolder()
    {
        if (SelectedMessage == null) return;
        // Move to Junk folder as example
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task ArchiveMessage()
    {
        if (SelectedMessage == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] ArchiveMessage: No message selected");
            return;
        }

        var messageToArchive = SelectedMessage;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Archive requested for message: {messageToArchive.Subject}");

        // Store the original unread state for folder count updates
        var wasUnread = !messageToArchive.IsRead;

        // Check if this is a synced message (has AccountId and RemoteMessageId)
        if (messageToArchive.AccountId.HasValue && !string.IsNullOrEmpty(messageToArchive.RemoteMessageId))
        {
            if (Guid.TryParse(messageToArchive.FolderId, out var folderId))
            {
                // OPTIMISTIC UPDATE: Remove from UI immediately for instant feedback
                Messages.Remove(messageToArchive);

                // Update source folder counts
                if (SelectedFolder != null)
                {
                    SelectedFolder.TotalCount = Math.Max(0, SelectedFolder.TotalCount - 1);
                    if (wasUnread && ShouldShowUnreadCount(SelectedFolder.Type))
                    {
                        SelectedFolder.UnreadCount = Math.Max(0, SelectedFolder.UnreadCount - 1);
                    }
                }

                // Find and update Archive folder counts (Archive doesn't show unread, so pass 0)
                UpdateArchiveFolderCount(1, 0);

                // Select next message
                SelectedMessage = Messages.FirstOrDefault();
                System.Diagnostics.Debug.WriteLine("[MainViewModel] Message removed from UI (optimistic update for archive)");

                // Move to archive in background - don't await
                _ = Task.Run(async () =>
                {
                    try
                    {
                        var success = await _syncedEmailService.MoveMessageToArchiveAsync(
                            messageToArchive.AccountId.Value,
                            folderId,
                            messageToArchive.RemoteMessageId);

                        if (success)
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Message moved to archive on server successfully");
                        }
                        else
                        {
                            System.Diagnostics.Debug.WriteLine("[MainViewModel] Failed to move message to archive on server");
                        }
                    }
                    catch (Exception ex)
                    {
                        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception in background Archive: {ex.Message}");
                    }
                });
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[MainViewModel] Failed to parse FolderId: {messageToArchive.FolderId}");
            }
        }
        else
        {
            // Non-synced messages - also do optimistic update
            Messages.Remove(messageToArchive);

            // Update source folder counts
            if (SelectedFolder != null)
            {
                SelectedFolder.TotalCount = Math.Max(0, SelectedFolder.TotalCount - 1);
                if (wasUnread && ShouldShowUnreadCount(SelectedFolder.Type))
                {
                    SelectedFolder.UnreadCount = Math.Max(0, SelectedFolder.UnreadCount - 1);
                }
            }

            // Find and update Archive folder counts (Archive doesn't show unread, so pass 0)
            UpdateArchiveFolderCount(1, 0);

            SelectedMessage = Messages.FirstOrDefault();

            // Archive in background via API
            _ = Task.Run(async () =>
            {
                try
                {
                    await _mailService.MoveMessageAsync(messageToArchive.Id, "archive");
                    System.Diagnostics.Debug.WriteLine("[MainViewModel] Non-synced message archived via API");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Exception archiving non-synced message: {ex.Message}");
                }
            });
        }
    }

    /// <summary>
    /// Updates the Archive folder's counts in the folder tree
    /// </summary>
    private void UpdateArchiveFolderCount(int totalDelta, int unreadDelta)
    {
        // Find Archive folder in the folder tree
        var archiveFolder = FindFolderByType(FolderType.Archive);
        if (archiveFolder != null)
        {
            archiveFolder.TotalCount += totalDelta;
            archiveFolder.UnreadCount += unreadDelta;
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Archive folder counts updated: Total={archiveFolder.TotalCount}, Unread={archiveFolder.UnreadCount}");
        }
    }

    /// <summary>
    /// Finds a folder by type in the folder tree (searches all account roots and subfolders)
    /// </summary>
    private MailFolder? FindFolderByType(FolderType folderType)
    {
        foreach (var rootFolder in Folders)
        {
            // Check if root folder matches
            if (rootFolder.Type == folderType)
                return rootFolder;

            // Search subfolders
            var found = FindFolderByTypeRecursive(rootFolder.SubFolders, folderType);
            if (found != null)
                return found;
        }
        return null;
    }

    /// <summary>
    /// Recursively searches for a folder by type
    /// </summary>
    private MailFolder? FindFolderByTypeRecursive(IEnumerable<MailFolder>? folders, FolderType folderType)
    {
        if (folders == null) return null;

        foreach (var folder in folders)
        {
            if (folder.Type == folderType)
                return folder;

            var found = FindFolderByTypeRecursive(folder.SubFolders, folderType);
            if (found != null)
                return found;
        }
        return null;
    }

    [RelayCommand]
    private async Task MarkAsUnread()
    {
        if (SelectedMessage == null) return;
        await _mailService.MarkAsReadAsync(SelectedMessage.Id, false);
        SelectedMessage.IsRead = false;
    }

    /// <summary>
    /// Event raised when category dialog is requested
    /// </summary>
    public event EventHandler<EmailMessage>? ApplyCategoryRequested;

    [RelayCommand]
    private void ApplyCategory()
    {
        if (SelectedMessage == null) return;
        ApplyCategoryRequested?.Invoke(this, SelectedMessage);
    }

    /// <summary>
    /// Applies a category to the selected message
    /// </summary>
    public void SetMessageCategory(EmailMessage message, string category)
    {
        if (message == null) return;

        if (!message.Categories.Contains(category))
        {
            message.Categories.Add(category);
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Added category '{category}' to message '{message.Subject}'");
            NotificationService.Instance.ShowSuccess($"Category '{category}' applied");
        }
    }

    /// <summary>
    /// Removes a category from the selected message
    /// </summary>
    public void RemoveMessageCategory(EmailMessage message, string category)
    {
        if (message == null) return;

        if (message.Categories.Remove(category))
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Removed category '{category}' from message '{message.Subject}'");
            NotificationService.Instance.ShowSuccess($"Category '{category}' removed");
        }
    }

    /// <summary>
    /// Adds a new category to the available categories
    /// </summary>
    [RelayCommand]
    private void AddCategory(string category)
    {
        if (string.IsNullOrWhiteSpace(category)) return;

        if (!AvailableCategories.Contains(category))
        {
            AvailableCategories.Add(category);
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Added new category: {category}");
        }
    }

    [RelayCommand]
    private void CreateRule()
    {
        // Rule creation logic
    }

    [RelayCommand]
    private void QuickStep()
    {
        // Quick steps logic
    }

    // Send/Receive Tab
    [RelayCommand]
    private async Task SendReceiveAll()
    {
        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }
        await RefreshFolders();
    }

    [RelayCommand]
    private async Task UpdateFolder()
    {
        if (SelectedFolder != null)
        {
            await LoadMessagesAsync(SelectedFolder.Id);
        }
    }

    [RelayCommand]
    private void WorkOffline()
    {
        IsOfflineMode = !IsOfflineMode;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Work Offline mode toggled: {IsOfflineMode}");

        // Raise event to notify UI
        OfflineModeChanged?.Invoke(this, IsOfflineMode);

        // Update sync status message
        SyncStatusMessage = IsOfflineMode ? "Working Offline" : "Connected";
    }

    [RelayCommand]
    private void DownloadAddressBook()
    {
        // Download address book logic
    }

    // Folder Tab
    [RelayCommand]
    private void NewFolder()
    {
        System.Diagnostics.Debug.WriteLine("[MainViewModel] New Folder requested");
        NewFolderRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void RenameFolder()
    {
        if (SelectedFolder == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] RenameFolder: No folder selected");
            return;
        }

        // Don't allow renaming system folders
        if (SelectedFolder.Type != FolderType.Custom && SelectedFolder.Type != FolderType.AccountRoot)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Cannot rename system folder: {SelectedFolder.Name}");
            return;
        }

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Rename Folder requested for: {SelectedFolder.Name}");
        RenameFolderRequested?.Invoke(this, SelectedFolder);
    }

    [RelayCommand]
    private void DeleteFolder()
    {
        if (SelectedFolder == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] DeleteFolder: No folder selected");
            return;
        }

        // Don't allow deleting system folders
        if (SelectedFolder.Type != FolderType.Custom)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Cannot delete system folder: {SelectedFolder.Name}");
            return;
        }

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Delete Folder requested for: {SelectedFolder.Name}");
        DeleteFolderRequested?.Invoke(this, SelectedFolder);
    }

    /// <summary>
    /// Creates a new custom folder with the given name
    /// </summary>
    public void CreateFolder(string folderName)
    {
        if (string.IsNullOrWhiteSpace(folderName))
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] CreateFolder: Empty folder name");
            return;
        }

        if (AccountRootFolder?.SubFolders == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] CreateFolder: No account root folder");
            return;
        }

        // Check if folder already exists
        if (AccountRootFolder.SubFolders.Any(f => f.Name.Equals(folderName, StringComparison.OrdinalIgnoreCase)))
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] CreateFolder: Folder '{folderName}' already exists");
            return;
        }

        var newFolder = new MailFolder
        {
            Id = Guid.NewGuid().ToString(),
            Name = folderName,
            Type = FolderType.Custom,
            Icon = "\ue2c7", // folder icon
            UnreadCount = 0,
            TotalCount = 0
        };

        AccountRootFolder.SubFolders.Add(newFolder);
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Created new folder: {folderName}");
    }

    /// <summary>
    /// Renames a folder
    /// </summary>
    public void RenameFolderTo(MailFolder folder, string newName)
    {
        if (folder == null || string.IsNullOrWhiteSpace(newName))
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] RenameFolderTo: Invalid parameters");
            return;
        }

        var oldName = folder.Name;
        folder.Name = newName;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Renamed folder from '{oldName}' to '{newName}'");
    }

    /// <summary>
    /// Deletes a folder
    /// </summary>
    public void RemoveFolder(MailFolder folder)
    {
        if (folder == null || AccountRootFolder?.SubFolders == null)
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] RemoveFolder: Invalid parameters");
            return;
        }

        AccountRootFolder.SubFolders.Remove(folder);

        // Select Inbox after deletion
        SelectedFolder = AccountRootFolder.SubFolders.FirstOrDefault(f => f.Type == FolderType.Inbox);
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Removed folder: {folder.Name}");
    }

    [RelayCommand]
    private void CleanUpFolder()
    {
        // Clean up folder logic
    }

    [RelayCommand]
    private void RecoverDeletedItems()
    {
        // Recover deleted items logic
    }

    // View Tab - Layout
    [ObservableProperty]
    private string _readingPanePosition = "Right";

    [ObservableProperty]
    private bool _showFolderPane = true;

    [ObservableProperty]
    private bool _showConversationView = false;

    [RelayCommand]
    private void ChangeReadingPanePosition(string position)
    {
        ReadingPanePosition = position;
    }

    [RelayCommand]
    private void ToggleFolderPane()
    {
        ShowFolderPane = !ShowFolderPane;
    }

    [RelayCommand]
    private void ToggleConversationView()
    {
        ShowConversationView = !ShowConversationView;
        if (ShowConversationView)
        {
            BuildConversationGroups();
        }
    }

    /// <summary>
    /// Builds conversation groups from the current messages
    /// </summary>
    private void BuildConversationGroups()
    {
        ConversationGroups.Clear();

        // Group messages by ConversationId
        var groupedMessages = Messages
            .Where(m => !string.IsNullOrEmpty(m.ConversationId))
            .GroupBy(m => m.ConversationId)
            .OrderByDescending(g => g.Max(m => m.ReceivedDate));

        foreach (var group in groupedMessages)
        {
            var conversationGroup = ConversationGroup.FromMessages(group.Key, group);
            ConversationGroups.Add(conversationGroup);
        }

        // Add messages without a ConversationId as single-message groups
        var singleMessages = Messages.Where(m => string.IsNullOrEmpty(m.ConversationId));
        foreach (var message in singleMessages.OrderByDescending(m => m.ReceivedDate))
        {
            var singleGroup = new ConversationGroup
            {
                ConversationId = message.Id,
                Subject = message.Subject,
                Participants = new List<string> { message.From },
                Messages = new ObservableCollection<EmailMessage> { message }
            };
            ConversationGroups.Add(singleGroup);
        }

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Built {ConversationGroups.Count} conversation groups");
    }

    [RelayCommand]
    private void SortMessages(string criteria)
    {
        CurrentSortCriteria = criteria;
        ApplySorting();
    }

    private void ApplySorting()
    {
        var sortedMessages = CurrentSortCriteria switch
        {
            "Date" => SortDescending
                ? Messages.OrderByDescending(m => m.ReceivedDate)
                : Messages.OrderBy(m => m.ReceivedDate),
            "From" => SortDescending
                ? Messages.OrderByDescending(m => m.From)
                : Messages.OrderBy(m => m.From),
            "Subject" => SortDescending
                ? Messages.OrderByDescending(m => m.Subject)
                : Messages.OrderBy(m => m.Subject),
            "Size" => SortDescending
                ? Messages.OrderByDescending(m => m.Body?.Length ?? 0)
                : Messages.OrderBy(m => m.Body?.Length ?? 0),
            _ => Messages.OrderByDescending(m => m.ReceivedDate)
        };

        var messageList = sortedMessages.ToList();
        Messages.Clear();
        foreach (var message in messageList)
        {
            Messages.Add(message);
        }

        if (ShowConversationView)
        {
            BuildConversationGroups();
        }

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Sorted messages by {CurrentSortCriteria} (descending: {SortDescending})");
    }

    [RelayCommand]
    private void ToggleSortDirection()
    {
        SortDescending = !SortDescending;
        ApplySorting();
    }

    [RelayCommand]
    private void FilterMessages(string filter)
    {
        CurrentFilter = filter;
        ApplyMessageFilter();
    }

    private void ApplyMessageFilter()
    {
        // Refresh message list based on filter
        // This is called after messages are loaded to apply additional filtering
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Applying filter: {CurrentFilter}");
    }

    /// <summary>
    /// Filters messages by category
    /// </summary>
    [RelayCommand]
    private void FilterByCategory(string? category)
    {
        SelectedCategory = category;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Filtering by category: {category ?? "All"}");
    }

    [RelayCommand]
    private void SaveCurrentView()
    {
        // Save current view layout
    }

    // Message Compose - Format & Insert
    [RelayCommand]
    private void InsertAttachment()
    {
        // Insert attachment logic
    }

    [RelayCommand]
    private void InsertSignature()
    {
        // Insert signature logic
    }

    [RelayCommand]
    private void SetImportance(string level)
    {
        // Set message importance (High/Normal/Low)
    }

    [RelayCommand]
    private void SetFollowUp()
    {
        // Set follow-up reminder
    }

    [RelayCommand]
    private void ScheduleDelivery()
    {
        // Schedule delayed delivery
    }

    [RelayCommand]
    private void RequestReceipt()
    {
        // Request read/delivery receipt
    }

    // Calendar Commands
    [RelayCommand]
    private async Task NewAppointment()
    {
        var appointment = new CalendarEvent
        {
            Subject = "New Appointment",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1)
        };
        await _calendarService.CreateEventAsync(appointment);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    [RelayCommand]
    private async Task NewMeeting()
    {
        var meeting = new CalendarEvent
        {
            Subject = "New Meeting",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1),
            Attendees = new List<string>()
        };
        await _calendarService.CreateEventAsync(meeting);
        await LoadEventsAsync(DateTime.Today, DateTime.Today.AddDays(7));
    }

    // Additional Home Tab Commands
    [RelayCommand]
    private async Task IgnoreMessage()
    {
        if (SelectedMessage == null) return;

        var messageToIgnore = SelectedMessage;
        System.Diagnostics.Debug.WriteLine($"[MainViewModel] IgnoreMessage: Subject='{messageToIgnore.Subject}', ConversationId='{messageToIgnore.ConversationId}'");

        // Store the conversation ID to ignore future messages in this thread
        if (!string.IsNullOrEmpty(messageToIgnore.ConversationId))
        {
            await _ignoredConversationsService.IgnoreConversationAsync(messageToIgnore.ConversationId);
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Conversation '{messageToIgnore.ConversationId}' added to ignore list");
        }

        // Find and remove all messages from the same conversation in the current view
        var conversationMessages = Messages
            .Where(m => !string.IsNullOrEmpty(m.ConversationId) &&
                        m.ConversationId.Equals(messageToIgnore.ConversationId, StringComparison.OrdinalIgnoreCase))
            .ToList();

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Found {conversationMessages.Count} messages in this conversation");

        // Remove all conversation messages from UI
        foreach (var message in conversationMessages)
        {
            Messages.Remove(message);

            // Move each message to deleted folder in background
            _ = Task.Run(async () =>
            {
                try
                {
                    // Check if synced message
                    if (message.AccountId.HasValue && !string.IsNullOrEmpty(message.RemoteMessageId))
                    {
                        if (Guid.TryParse(message.FolderId, out var folderId))
                        {
                            await _syncedEmailService.MoveMessageToTrashAsync(
                                message.AccountId.Value,
                                folderId,
                                message.RemoteMessageId);
                        }
                    }
                    else
                    {
                        await _mailService.MarkAsReadAsync(message.Id, true);
                        await _mailService.MoveMessageAsync(message.Id, "deleted");
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Error moving ignored message: {ex.Message}");
                }
            });
        }

        // If no conversation ID, just delete the single message
        if (string.IsNullOrEmpty(messageToIgnore.ConversationId) && !conversationMessages.Contains(messageToIgnore))
        {
            Messages.Remove(messageToIgnore);
            _ = Task.Run(async () =>
            {
                try
                {
                    await _mailService.MarkAsReadAsync(messageToIgnore.Id, true);
                    await _mailService.MoveMessageAsync(messageToIgnore.Id, "deleted");
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Error moving ignored message: {ex.Message}");
                }
            });
        }

        // Update folder counts
        if (SelectedFolder != null && conversationMessages.Count > 0)
        {
            SelectedFolder.TotalCount = Math.Max(0, SelectedFolder.TotalCount - conversationMessages.Count);
            if (ShouldShowUnreadCount(SelectedFolder.Type))
            {
                var unreadCount = conversationMessages.Count(m => !m.IsRead);
                SelectedFolder.UnreadCount = Math.Max(0, SelectedFolder.UnreadCount - unreadCount);
            }
        }

        // Select next message
        SelectedMessage = Messages.FirstOrDefault();

        System.Diagnostics.Debug.WriteLine("[MainViewModel] Conversation ignored successfully");
    }

    /// <summary>
    /// Stop ignoring a conversation - messages will appear again in the folder list
    /// </summary>
    [RelayCommand]
    private async Task UnignoreConversation()
    {
        if (SelectedMessage == null) return;

        if (string.IsNullOrEmpty(SelectedMessage.ConversationId))
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] Cannot unignore: Message has no ConversationId");
            return;
        }

        var conversationId = SelectedMessage.ConversationId;
        var wasIgnored = await _ignoredConversationsService.UnignoreConversationAsync(conversationId);

        if (wasIgnored)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Conversation '{conversationId}' removed from ignore list");

            // Reload the current folder to show any previously hidden messages
            if (SelectedFolder != null)
            {
                if (HasSyncedAccounts && Guid.TryParse(SelectedFolder.Id, out _))
                {
                    await LoadSyncedMessagesAsync(SelectedFolder.Id);
                }
                else
                {
                    await LoadMessagesAsync(SelectedFolder.Id);
                }
            }
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Conversation '{conversationId}' was not in ignore list");
        }
    }

    [RelayCommand]
    private async Task BlockSender()
    {
        if (SelectedMessage == null) return;

        var senderEmail = SelectedMessage.FromEmail;
        if (string.IsNullOrEmpty(senderEmail))
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] BlockSender: No sender email found");
            return;
        }

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] BlockSender: Blocking sender '{senderEmail}'");

        // Add sender to blocked list persistently
        await _blockedSendersService.BlockSenderAsync(senderEmail);

        // Find ALL messages from this sender in the current view
        var senderMessages = Messages
            .Where(m => !string.IsNullOrEmpty(m.FromEmail) &&
                        m.FromEmail.Equals(senderEmail, StringComparison.OrdinalIgnoreCase))
            .ToList();

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Found {senderMessages.Count} messages from blocked sender");

        // Remove all messages from UI and move to Junk
        foreach (var message in senderMessages)
        {
            Messages.Remove(message);

            // Move each message to Junk folder in background
            _ = Task.Run(async () =>
            {
                try
                {
                    // Check if synced message
                    if (message.AccountId.HasValue && !string.IsNullOrEmpty(message.RemoteMessageId))
                    {
                        if (Guid.TryParse(message.FolderId, out var folderId))
                        {
                            await _syncedEmailService.MoveMessageToJunkAsync(
                                message.AccountId.Value,
                                folderId,
                                message.RemoteMessageId);
                        }
                    }
                    else
                    {
                        await _mailService.MoveMessageAsync(message.Id, "junk");
                    }
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[MainViewModel] Error moving blocked message to junk: {ex.Message}");
                }
            });
        }

        // Update folder counts
        if (SelectedFolder != null && senderMessages.Count > 0)
        {
            SelectedFolder.TotalCount = Math.Max(0, SelectedFolder.TotalCount - senderMessages.Count);
            if (ShouldShowUnreadCount(SelectedFolder.Type))
            {
                var unreadCount = senderMessages.Count(m => !m.IsRead);
                SelectedFolder.UnreadCount = Math.Max(0, SelectedFolder.UnreadCount - unreadCount);
            }
        }

        // Select next message
        SelectedMessage = Messages.FirstOrDefault();

        System.Diagnostics.Debug.WriteLine($"[MainViewModel] Sender '{senderEmail}' blocked successfully");
    }

    /// <summary>
    /// Unblock a sender - future messages will appear in folders again
    /// </summary>
    [RelayCommand]
    private async Task UnblockSender()
    {
        if (SelectedMessage == null) return;

        var senderEmail = SelectedMessage.FromEmail;
        if (string.IsNullOrEmpty(senderEmail))
        {
            System.Diagnostics.Debug.WriteLine("[MainViewModel] UnblockSender: No sender email found");
            return;
        }

        var wasBlocked = await _blockedSendersService.UnblockSenderAsync(senderEmail);

        if (wasBlocked)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Sender '{senderEmail}' unblocked");

            // Reload the current folder to show any previously hidden messages
            if (SelectedFolder != null)
            {
                if (HasSyncedAccounts && Guid.TryParse(SelectedFolder.Id, out _))
                {
                    await LoadSyncedMessagesAsync(SelectedFolder.Id);
                }
                else
                {
                    await LoadMessagesAsync(SelectedFolder.Id);
                }
            }
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Sender '{senderEmail}' was not in blocked list");
        }
    }

    [RelayCommand]
    private async Task ReportMessage()
    {
        if (SelectedMessage == null) return;
        // Report message as spam/phishing
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task CreateMeeting()
    {
        // Create meeting from selected message
        var meeting = new CalendarEvent
        {
            Subject = SelectedMessage?.Subject ?? "New Meeting",
            StartTime = DateTime.Now,
            EndTime = DateTime.Now.AddHours(1),
            Attendees = SelectedMessage?.To ?? new List<string>()
        };
        await _calendarService.CreateEventAsync(meeting);
        SwitchToCalendarView();
    }

    [RelayCommand]
    private void MarkDone()
    {
        if (SelectedMessage == null) return;
        // Mark as done and archive
        _ = ArchiveMessage();
    }

    [RelayCommand]
    private async Task ReplyAndDelete()
    {
        if (DisplayedMessage == null) return;
        // Open reply compose panel - delete handled separately by user
        Reply();
        await Delete();
    }

    [RelayCommand]
    private void ForwardToManager()
    {
        if (DisplayedMessage == null) return;
        // Open forward compose panel
        Forward();
    }

    [RelayCommand]
    private void CreateQuickStep()
    {
        // Open quick step creation dialog
    }

    [RelayCommand]
    private async Task ToggleRead()
    {
        if (SelectedMessage == null) return;
        if (SelectedMessage.IsRead)
        {
            await _mailService.MarkAsReadAsync(SelectedMessage.Id, false);
            SelectedMessage.IsRead = false;
        }
        else
        {
            await _mailService.MarkAsReadAsync(SelectedMessage.Id, true);
            SelectedMessage.IsRead = true;
        }
    }

    [RelayCommand]
    private void PrintMessage()
    {
        if (SelectedMessage == null) return;
        // Print selected message
    }

    [RelayCommand]
    private void Discover()
    {
        // Open Discover/Add-ins panel
    }

    [RelayCommand]
    private void ShareCalendar()
    {
        // Share calendar logic
    }

    [RelayCommand]
    private void SetRecurrence()
    {
        // Set event recurrence
    }

    [RelayCommand]
    private void ChangeTimeZone()
    {
        // Change timezone logic
    }

    [RelayCommand]
    private void PinMessage()
    {
        if (SelectedMessage == null) return;
        // Pin message to top logic
    }

    [RelayCommand]
    private void SnoozeMessage()
    {
        if (SelectedMessage == null) return;
        // Snooze message logic
    }

    [RelayCommand]
    private void MoreApps()
    {
        // Open more apps panel
    }

    /// <summary>
    /// Adds a sent message to the Messages collection if user is currently viewing Sent folder.
    /// Also triggers a refresh to ensure the message is properly loaded from the API.
    /// </summary>
    public void AddSentMessageToCollection(EmailMessage message)
    {
        // Check if user is currently viewing Sent folder (by type, name, or ID)
        var isViewingSentFolder = SelectedFolder != null &&
            (SelectedFolder.Type == FolderType.Sent ||
             SelectedFolder.Id.Equals("sent", StringComparison.OrdinalIgnoreCase) ||
             SelectedFolder.Name.Equals("Sent", StringComparison.OrdinalIgnoreCase) ||
             SelectedFolder.Name.Equals("Sent Items", StringComparison.OrdinalIgnoreCase));

        if (isViewingSentFolder)
        {
            // Add to the beginning of the collection so it appears at the top immediately
            Dispatcher.CurrentDispatcher.Invoke(() =>
            {
                Messages.Insert(0, message);
            });

            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Added sent message to collection: {message.Subject}");
        }
        else
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Not viewing Sent folder, message will appear when folder is selected");
        }
    }

    /// <summary>
    /// Forces a refresh of the current folder's messages from the API
    /// </summary>
    public async Task ForceRefreshCurrentFolderAsync()
    {
        if (SelectedFolder != null)
        {
            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Force refreshing folder: {SelectedFolder.Name}");

            // Check if this is a synced folder (GUID-based ID) or API folder
            if (HasSyncedAccounts && Guid.TryParse(SelectedFolder.Id, out _))
            {
                await LoadSyncedMessagesAsync(SelectedFolder.Id);
            }
            else
            {
                await LoadMessagesAsync(SelectedFolder.Id);
            }
        }
    }
}
