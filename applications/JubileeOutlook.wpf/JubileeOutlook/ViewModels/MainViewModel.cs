using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeOutlook.Models;
using JubileeOutlook.Services;
using JubileeOutlook.Services.EmailSync;
using System.Collections.ObjectModel;
using System.Windows.Threading;

namespace JubileeOutlook.ViewModels;

public partial class MainViewModel : ObservableObject
{
    private readonly IMailService _mailService;
    private readonly ICalendarService _calendarService;
    private readonly SyncedEmailDisplayService _syncedEmailService;
    private readonly EmailSyncCoordinator _syncCoordinator;

    [ObservableProperty]
    private ObservableCollection<MailFolder> _folders = new();

    [ObservableProperty]
    private ObservableCollection<EmailMessage> _messages = new();

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

    public MainViewModel(IMailService mailService, ICalendarService calendarService)
    {
        _mailService = mailService;
        _calendarService = calendarService;
        _syncedEmailService = new SyncedEmailDisplayService();
        _syncCoordinator = new EmailSyncCoordinator();

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
            SubFolders = baseFolders
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
            Messages = new ObservableCollection<EmailMessage>(messages);

            // Update folder counts
            if (SelectedFolder != null)
            {
                SelectedFolder.UnreadCount = Messages.Count(m => !m.IsRead);
                SelectedFolder.TotalCount = Messages.Count;
            }

            System.Diagnostics.Debug.WriteLine($"[MainViewModel] Loaded {messages.Count} synced messages for folder {folderId}");
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
                if (SelectedFolder != null)
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

    private async Task LoadMessagesAsync(string folderId)
    {
        var messages = await _mailService.GetMessagesAsync(folderId);
        Messages = new ObservableCollection<EmailMessage>(messages);

        // Update folder counts by counting the actual messages
        if (SelectedFolder != null)
        {
            SelectedFolder.UnreadCount = Messages.Count(m => !m.IsRead);
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
        if (SelectedMessage == null) return;

        var newFlagState = !SelectedMessage.IsFlagged;
        await _mailService.ToggleFlagAsync(SelectedMessage.Id, newFlagState);
        SelectedMessage.IsFlagged = newFlagState;
    }

    [RelayCommand]
    private async Task Search()
    {
        if (string.IsNullOrWhiteSpace(SearchQuery)) return;

        var results = await _mailService.SearchMessagesAsync(SearchQuery);
        Messages = new ObservableCollection<EmailMessage>(results);
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
        if (SelectedMessage == null) return;
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "archive");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task MarkAsUnread()
    {
        if (SelectedMessage == null) return;
        await _mailService.MarkAsReadAsync(SelectedMessage.Id, false);
        SelectedMessage.IsRead = false;
    }

    [RelayCommand]
    private void ApplyCategory()
    {
        // Category application logic
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
        // Toggle offline mode
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
        // Create new folder logic
    }

    [RelayCommand]
    private void RenameFolder()
    {
        // Rename folder logic
    }

    [RelayCommand]
    private void DeleteFolder()
    {
        // Delete folder logic
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
    }

    [RelayCommand]
    private void SortMessages(string criteria)
    {
        // Sort messages by date, sender, subject, etc.
    }

    [RelayCommand]
    private void FilterMessages(string filter)
    {
        // Filter messages (unread, flagged, etc.)
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
        // Mark conversation as ignored
        await _mailService.MarkAsReadAsync(SelectedMessage.Id, true);
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "deleted");
        Messages.Remove(SelectedMessage);
    }

    [RelayCommand]
    private async Task BlockSender()
    {
        if (SelectedMessage == null) return;
        // Block the sender and move all messages to junk
        await _mailService.MoveMessageAsync(SelectedMessage.Id, "junk");
        Messages.Remove(SelectedMessage);
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
    /// Adds a sent message to the Messages collection if user is currently viewing Sent folder
    /// </summary>
    public void AddSentMessageToCollection(EmailMessage message)
    {
        // Check if user is currently viewing Sent folder
        if (SelectedFolder != null &&
            (SelectedFolder.Id.Equals("sent", StringComparison.OrdinalIgnoreCase) ||
             SelectedFolder.Name.Equals("Sent", StringComparison.OrdinalIgnoreCase) ||
             SelectedFolder.Name.Equals("Sent Items", StringComparison.OrdinalIgnoreCase)))
        {
            // Add to the beginning of the collection so it appears at the top
            Dispatcher.CurrentDispatcher.Invoke(() =>
            {
                Messages.Insert(0, message);
            });
        }
    }
}
