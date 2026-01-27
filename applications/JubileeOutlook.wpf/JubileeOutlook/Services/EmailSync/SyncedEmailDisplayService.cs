using System.Diagnostics;
using System.IO;
using MailKit;
using MailKit.Net.Imap;
using JubileeOutlook.Models;
using JubileeOutlook.Models.EmailSync;

// Use aliases to avoid ambiguity between Models and MailKit types
using UIFolderType = JubileeOutlook.Models.FolderType;
using SyncFolderType = JubileeOutlook.Models.EmailSync.FolderType;
using UIMailFolder = JubileeOutlook.Models.MailFolder;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service that bridges synced email data to the main UI view models
/// Converts SyncedEmailAccount/SyncedMessage to MailFolder/EmailMessage for display
/// </summary>
public class SyncedEmailDisplayService
{
    private readonly SecureStorageService _secureStorage;

    public SyncedEmailDisplayService()
    {
        _secureStorage = new SecureStorageService();
    }

    /// <summary>
    /// Determines if a folder type should display unread counts.
    /// All folders except AccountRoot show unread counts when they have unread emails.
    /// </summary>
    private static bool ShouldShowUnreadCount(UIFolderType folderType)
    {
        // Only AccountRoot should not show unread counts
        return folderType != UIFolderType.AccountRoot;
    }

    /// <summary>
    /// Get all synced email accounts
    /// </summary>
    public async Task<List<SyncedEmailAccount>> GetSyncedAccountsAsync()
    {
        var accounts = new List<SyncedEmailAccount>();

        try
        {
            var storagePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeOutlook",
                "SecureStorage"
            );

            if (!Directory.Exists(storagePath))
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Storage path does not exist");
                return accounts;
            }

            var accountFiles = Directory.GetFiles(storagePath, "account_*.dat");
            Debug.WriteLine($"[SyncedEmailDisplayService] Found {accountFiles.Length} account files");

            foreach (var file in accountFiles)
            {
                try
                {
                    var fileName = Path.GetFileNameWithoutExtension(file);
                    var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>(fileName);
                    if (account != null)
                    {
                        accounts.Add(account);
                        Debug.WriteLine($"[SyncedEmailDisplayService] Loaded account: {account.EmailAddress}");
                    }
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[SyncedEmailDisplayService] Failed to load account from {file}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error getting accounts: {ex.Message}");
        }

        return accounts;
    }

    /// <summary>
    /// Get folders for a synced account
    /// </summary>
    public async Task<List<SyncedEmailFolder>> GetFoldersAsync(Guid accountId)
    {
        try
        {
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            return folders ?? new List<SyncedEmailFolder>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error getting folders: {ex.Message}");
            return new List<SyncedEmailFolder>();
        }
    }

    /// <summary>
    /// Get messages for a folder
    /// </summary>
    public async Task<List<SyncedMessage>> GetMessagesAsync(Guid accountId, Guid folderId)
    {
        try
        {
            var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>($"messages_{accountId}_{folderId}");
            return messages ?? new List<SyncedMessage>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error getting messages: {ex.Message}");
            return new List<SyncedMessage>();
        }
    }

    /// <summary>
    /// Convert synced accounts and folders to UI MailFolder structure
    /// </summary>
    public async Task<List<UIMailFolder>> BuildFolderTreeAsync()
    {
        var rootFolders = new List<UIMailFolder>();
        var accounts = await GetSyncedAccountsAsync();

        Debug.WriteLine($"[SyncedEmailDisplayService] Building folder tree for {accounts.Count} accounts");

        foreach (var account in accounts)
        {
            // Create account root folder
            var accountFolder = new UIMailFolder
            {
                Id = account.Id.ToString(),
                Name = account.EmailAddress,
                Type = UIFolderType.AccountRoot,
                IsAccountRoot = true,
                WwbwEmailAddress = account.EmailAddress,
                IsExpanded = true,
                Icon = GetProviderIcon(account.ProviderType),
                SubFolders = new System.Collections.ObjectModel.ObservableCollection<UIMailFolder>()
            };

            // Load folders for this account
            var syncedFolders = await GetFoldersAsync(account.Id);
            Debug.WriteLine($"[SyncedEmailDisplayService] Account {account.EmailAddress} has {syncedFolders.Count} folders");

            foreach (var folder in syncedFolders.Where(f => f.IsSubscribed))
            {
                // Calculate actual unread count from stored messages
                var actualUnreadCount = await CalculateUnreadCountAsync(account.Id, folder.Id);
                var mailFolder = ConvertToMailFolder(folder, actualUnreadCount);
                accountFolder.SubFolders.Add(mailFolder);
            }

            // If no folders, add default structure
            if (accountFolder.SubFolders.Count == 0)
            {
                accountFolder.SubFolders = CreateDefaultFolders();
            }
            else
            {
                // Ensure Archive folder is always present (add after Sent Mail if missing)
                // Pass synced folders so we can use the actual archive folder ID
                await EnsureArchiveFolderExistsAsync(account.Id, accountFolder.SubFolders, syncedFolders);

                // Ensure Junk folder is always present (add before Trash if missing)
                await EnsureJunkFolderExistsAsync(account.Id, accountFolder.SubFolders, syncedFolders);
            }

            rootFolders.Add(accountFolder);
        }

        return rootFolders;
    }

    /// <summary>
    /// Calculate the actual unread count from stored messages for a folder
    /// </summary>
    private async Task<int> CalculateUnreadCountAsync(Guid accountId, Guid folderId)
    {
        try
        {
            var messages = await GetMessagesAsync(accountId, folderId);
            var unreadCount = messages.Count(m => !m.IsRead);
            Debug.WriteLine($"[SyncedEmailDisplayService] Folder {folderId}: {unreadCount} unread out of {messages.Count} messages");
            return unreadCount;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error calculating unread count for folder {folderId}: {ex.Message}");
            return 0;
        }
    }

    /// <summary>
    /// Convert SyncedEmailFolder to MailFolder for UI
    /// </summary>
    /// <param name="syncedFolder">The synced folder from storage</param>
    /// <param name="calculatedUnreadCount">Optional: unread count calculated from actual messages. If null, uses stored count.</param>
    private UIMailFolder ConvertToMailFolder(SyncedEmailFolder syncedFolder, int? calculatedUnreadCount = null)
    {
        var uiFolderType = ConvertFolderType(syncedFolder.FolderType);
        var unreadCount = calculatedUnreadCount ?? syncedFolder.UnreadCount;
        return new UIMailFolder
        {
            Id = syncedFolder.Id.ToString(),
            Name = NormalizeFolderName(syncedFolder.FolderName, syncedFolder.FolderType),
            Type = uiFolderType,
            Icon = GetFolderIcon(syncedFolder.FolderType),
            UnreadCount = ShouldShowUnreadCount(uiFolderType) ? unreadCount : 0,
            TotalCount = syncedFolder.MessageCount,
            IsExpanded = false,
            IsSelected = false,
            SubFolders = new System.Collections.ObjectModel.ObservableCollection<UIMailFolder>()
        };
    }

    /// <summary>
    /// Normalize folder names for proper display (e.g., "INBOX" -> "Inbox")
    /// </summary>
    private string NormalizeFolderName(string folderName, SyncFolderType folderType)
    {
        // Use standard display names for known folder types
        return folderType switch
        {
            SyncFolderType.Inbox => "Inbox",
            SyncFolderType.Sent => "Sent Mail",
            SyncFolderType.Drafts => "Drafts",
            SyncFolderType.Trash => "Trash",
            SyncFolderType.Junk => "Junk",
            SyncFolderType.Archive => "Archive",
            _ => folderName // Keep original name for custom folders
        };
    }

    /// <summary>
    /// Convert SyncedMessage to EmailMessage for UI
    /// </summary>
    public EmailMessage ConvertToEmailMessage(SyncedMessage syncedMessage)
    {
        // Prefer HTML body for proper formatting, then text body, then preview as fallback
        var body = syncedMessage.BodyHtml ?? syncedMessage.BodyText ?? syncedMessage.BodyPreview ?? "";
        var isHtml = !string.IsNullOrEmpty(syncedMessage.BodyHtml);

        // Debug: Log body info
        Debug.WriteLine($"[SyncedEmailDisplayService] Converting message '{syncedMessage.Subject}': BodyHtml={syncedMessage.BodyHtml?.Length ?? 0} chars, BodyText={syncedMessage.BodyText?.Length ?? 0} chars, BodyPreview={syncedMessage.BodyPreview?.Length ?? 0} chars, Final body={body.Length} chars");

        // Mark as needing body fetch if body is empty but preview exists
        var needsBodyFetch = string.IsNullOrEmpty(body) ||
                            (string.IsNullOrEmpty(syncedMessage.BodyHtml) &&
                             string.IsNullOrEmpty(syncedMessage.BodyText) &&
                             !string.IsNullOrEmpty(syncedMessage.BodyPreview));

        // Convert synced attachments to UI model
        var attachments = syncedMessage.Attachments?.Select(a => new EmailAttachment
        {
            Id = a.Id,
            FileName = a.FileName,
            ContentType = a.ContentType,
            FileSize = a.FileSize
        }).ToList() ?? new List<EmailAttachment>();

        // Create a clean preview by stripping HTML tags if present
        var preview = syncedMessage.BodyPreview ?? "";
        if (preview.Contains("<") && preview.Contains(">"))
        {
            preview = System.Text.RegularExpressions.Regex.Replace(preview, "<[^>]+>", " ");
            preview = System.Net.WebUtility.HtmlDecode(preview);
            preview = System.Text.RegularExpressions.Regex.Replace(preview, @"\s+", " ").Trim();
        }

        return new EmailMessage
        {
            Id = syncedMessage.Id.ToString(),
            Subject = syncedMessage.Subject ?? "(No Subject)",
            From = syncedMessage.SenderName ?? syncedMessage.SenderEmail ?? "Unknown",
            FromEmail = syncedMessage.SenderEmail ?? "",
            To = syncedMessage.ToRecipients ?? new List<string>(),
            Cc = syncedMessage.CcRecipients ?? new List<string>(),
            Body = body,
            IsHtml = isHtml,
            Preview = preview,
            ReceivedDate = syncedMessage.ReceivedAt,
            SentDate = syncedMessage.SentAt ?? DateTime.MinValue,
            IsRead = syncedMessage.IsRead,
            IsFlagged = syncedMessage.IsFlagged,
            HasAttachments = syncedMessage.HasAttachments || attachments.Count > 0,
            Attachments = attachments,
            FolderId = syncedMessage.FolderId.ToString(),
            // Store the original synced message ID for on-demand body fetching
            SyncedMessageId = syncedMessage.Id,
            RemoteMessageId = syncedMessage.RemoteMessageId,
            AccountId = syncedMessage.AccountId,
            NeedsBodyFetch = needsBodyFetch
        };
    }

    /// <summary>
    /// Fetch the full body of a message on-demand from the server
    /// </summary>
    public async Task<string?> FetchMessageBodyAsync(Guid accountId, string remoteMessageId, Guid folderId)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Fetching body for message {remoteMessageId}");

            // Get the account info
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Account not found for body fetch");
                return null;
            }

            // Get folder info
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Folder not found for body fetch");
                return null;
            }

            // Create connection service to fetch the body
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed for body fetch: {connectionResult.ErrorMessage}");
                return null;
            }

            string? body = null;

            if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
            {
                // Fetch from Graph API
                var message = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .GetAsync(config =>
                    {
                        config.QueryParameters.Select = new[] { "body" };
                    });

                if (message?.Body != null)
                {
                    body = message.Body.Content;

                    // Update stored message with body
                    await UpdateStoredMessageBodyAsync(accountId, folderId, remoteMessageId, body,
                        message.Body.ContentType == Microsoft.Graph.Models.BodyType.Html);
                }
            }
            else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
            {
                // Fetch from IMAP
                var imapFolder = await connectionResult.ImapClient.GetFolderAsync(folder.RemoteFolderId);
                await imapFolder.OpenAsync(MailKit.FolderAccess.ReadOnly);

                // Search for the message by ID
                var uids = await imapFolder.SearchAsync(MailKit.Search.SearchQuery.HeaderContains("Message-Id", remoteMessageId));
                if (uids.Count > 0)
                {
                    var mimeMessage = await imapFolder.GetMessageAsync(uids[0]);
                    body = mimeMessage.HtmlBody ?? mimeMessage.TextBody;

                    // Update stored message with body
                    await UpdateStoredMessageBodyAsync(accountId, folderId, remoteMessageId, body,
                        !string.IsNullOrEmpty(mimeMessage.HtmlBody));
                }

                await imapFolder.CloseAsync();
            }

            return body;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error fetching message body: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Update stored message with fetched body
    /// </summary>
    private async Task UpdateStoredMessageBodyAsync(Guid accountId, Guid folderId, string remoteMessageId, string? body, bool isHtml)
    {
        try
        {
            var messages = await GetMessagesAsync(accountId, folderId);
            var message = messages.FirstOrDefault(m => m.RemoteMessageId == remoteMessageId);
            if (message != null)
            {
                if (isHtml)
                {
                    message.BodyHtml = body;
                }
                else
                {
                    message.BodyText = body;
                }

                await _secureStorage.StoreAsync($"messages_{accountId}_{folderId}", messages);
                Debug.WriteLine($"[SyncedEmailDisplayService] Updated stored message body ({body?.Length ?? 0} chars)");
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error updating stored message body: {ex.Message}");
        }
    }

    /// <summary>
    /// Update the read state of a synced message in local storage.
    /// This ensures the read state persists when messages are reloaded.
    /// </summary>
    /// <param name="messageId">The synced message ID (GUID)</param>
    /// <param name="folderId">The folder ID (GUID)</param>
    /// <param name="isRead">The new read state</param>
    /// <returns>True if the update was successful</returns>
    public async Task<bool> UpdateMessageReadStateAsync(Guid messageId, Guid folderId, bool isRead)
    {
        try
        {
            // Find which account this folder belongs to
            var accounts = await GetSyncedAccountsAsync();
            foreach (var account in accounts)
            {
                var folders = await GetFoldersAsync(account.Id);
                var folder = folders.FirstOrDefault(f => f.Id == folderId);
                if (folder != null)
                {
                    var messages = await GetMessagesAsync(account.Id, folderId);
                    var message = messages.FirstOrDefault(m => m.Id == messageId);
                    if (message != null)
                    {
                        message.IsRead = isRead;
                        await _secureStorage.StoreAsync($"messages_{account.Id}_{folderId}", messages);
                        Debug.WriteLine($"[SyncedEmailDisplayService] Updated message {messageId} IsRead to {isRead}");
                        return true;
                    }
                }
            }
            Debug.WriteLine($"[SyncedEmailDisplayService] Message {messageId} not found in folder {folderId}");
            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error updating message read state: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Update the read state of a synced message by its string IDs.
    /// Convenience method that parses the GUID strings.
    /// </summary>
    public async Task<bool> UpdateMessageReadStateAsync(string? syncedMessageId, string? folderId, bool isRead)
    {
        if (string.IsNullOrEmpty(syncedMessageId) || string.IsNullOrEmpty(folderId))
        {
            return false;
        }

        if (Guid.TryParse(syncedMessageId, out var messageGuid) && Guid.TryParse(folderId, out var folderGuid))
        {
            return await UpdateMessageReadStateAsync(messageGuid, folderGuid, isRead);
        }

        return false;
    }

    /// <summary>
    /// Get messages for display in a folder
    /// </summary>
    public async Task<List<EmailMessage>> GetDisplayMessagesAsync(string folderId)
    {
        var messages = new List<EmailMessage>();

        try
        {
            // Parse the folder ID to get account and folder GUIDs
            if (Guid.TryParse(folderId, out var folderGuid))
            {
                // Find which account this folder belongs to
                var accounts = await GetSyncedAccountsAsync();
                foreach (var account in accounts)
                {
                    var folders = await GetFoldersAsync(account.Id);
                    var folder = folders.FirstOrDefault(f => f.Id == folderGuid);
                    if (folder != null)
                    {
                        var syncedMessages = await GetMessagesAsync(account.Id, folderGuid);
                        messages = syncedMessages.Select(ConvertToEmailMessage).ToList();
                        Debug.WriteLine($"[SyncedEmailDisplayService] Loaded {messages.Count} messages for folder {folder.FolderName}");
                        break;
                    }
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error getting display messages: {ex.Message}");
        }

        return messages;
    }

    /// <summary>
    /// Convert EmailSync FolderType to UI FolderType
    /// </summary>
    private UIFolderType ConvertFolderType(SyncFolderType syncedType)
    {
        return syncedType switch
        {
            SyncFolderType.Inbox => UIFolderType.Inbox,
            SyncFolderType.Sent => UIFolderType.Sent,
            SyncFolderType.Drafts => UIFolderType.Drafts,
            SyncFolderType.Trash => UIFolderType.Deleted,
            SyncFolderType.Junk => UIFolderType.Junk,
            SyncFolderType.Archive => UIFolderType.Archive,
            _ => UIFolderType.Custom
        };
    }

    /// <summary>
    /// Get icon for folder type (using Material Symbols font)
    /// </summary>
    private string GetFolderIcon(SyncFolderType folderType)
    {
        return folderType switch
        {
            SyncFolderType.Inbox => "\uE156",    // inbox icon
            SyncFolderType.Sent => "\uE163",     // send icon
            SyncFolderType.Drafts => "\uE151",   // drafts icon
            SyncFolderType.Trash => "\uE872",    // delete icon
            SyncFolderType.Junk => "\uE14C",     // report/spam icon
            SyncFolderType.Archive => "\uE149",  // archive icon
            _ => "\uE2C7"                        // folder icon
        };
    }

    /// <summary>
    /// Get icon for email provider (using Material Symbols font)
    /// </summary>
    private string GetProviderIcon(EmailProviderType providerType)
    {
        return providerType switch
        {
            EmailProviderType.Google => "\uE7FD",     // account_circle icon
            EmailProviderType.Microsoft => "\uE7FD",  // account_circle icon
            EmailProviderType.Yahoo => "\uE7FD",      // account_circle icon
            EmailProviderType.Apple => "\uE7FD",      // account_circle icon
            _ => "\uE7FD"                             // account_circle icon
        };
    }

    /// <summary>
    /// Create default folder structure when no folders found
    /// </summary>
    private System.Collections.ObjectModel.ObservableCollection<UIMailFolder> CreateDefaultFolders()
    {
        return new System.Collections.ObjectModel.ObservableCollection<UIMailFolder>
        {
            new UIMailFolder { Id = "inbox", Name = "Inbox", Type = UIFolderType.Inbox, Icon = "\uE156" },
            new UIMailFolder { Id = "drafts", Name = "Drafts", Type = UIFolderType.Drafts, Icon = "\uE151" },
            new UIMailFolder { Id = "sent", Name = "Sent Mail", Type = UIFolderType.Sent, Icon = "\uE163" },
            new UIMailFolder { Id = "archive", Name = "Archive", Type = UIFolderType.Archive, Icon = "\uE149" },
            new UIMailFolder { Id = "junk", Name = "Junk", Type = UIFolderType.Junk, Icon = "\uE14D" },
            new UIMailFolder { Id = "trash", Name = "Trash", Type = UIFolderType.Deleted, Icon = "\uE872" }
        };
    }

    /// <summary>
    /// Ensures Archive folder exists in the folder list, adding it if missing.
    /// Archive is inserted after Sent Mail folder for proper ordering.
    /// Uses the actual synced archive folder ID if available for proper message loading.
    /// </summary>
    private async Task EnsureArchiveFolderExistsAsync(Guid accountId, System.Collections.ObjectModel.ObservableCollection<UIMailFolder> folders, List<SyncedEmailFolder> syncedFolders)
    {
        // Check if Archive folder already exists in UI folders
        var archiveExists = folders.Any(f => f.Type == UIFolderType.Archive);
        if (archiveExists)
        {
            Debug.WriteLine("[SyncedEmailDisplayService] Archive folder already exists");
            return;
        }

        // Find Sent Mail folder index to insert Archive after it
        var foldersList = folders.ToList();
        var sentIndex = foldersList.FindIndex(f => f.Type == UIFolderType.Sent);
        var insertIndex = sentIndex >= 0 ? sentIndex + 1 : folders.Count;

        // Find Trash folder index - Archive should be before Trash
        var trashIndex = foldersList.FindIndex(f => f.Type == UIFolderType.Deleted);
        if (trashIndex >= 0 && insertIndex > trashIndex)
        {
            insertIndex = trashIndex;
        }

        // Try to find the actual synced archive folder to use its ID
        // This ensures messages load correctly when clicking the Archive folder
        var syncedArchiveFolder = syncedFolders.FirstOrDefault(f => f.FolderType == SyncFolderType.Archive);
        if (syncedArchiveFolder == null)
        {
            // Fallback: look for folder named "Archive" or "All Mail" (Gmail's archive)
            syncedArchiveFolder = syncedFolders.FirstOrDefault(f =>
                f.FolderName.Equals("Archive", StringComparison.OrdinalIgnoreCase) ||
                f.FolderName.Equals("All Mail", StringComparison.OrdinalIgnoreCase) ||
                f.FolderName.Equals("[Gmail]/All Mail", StringComparison.OrdinalIgnoreCase));
        }

        // Use synced folder ID if found, otherwise generate a new GUID for local-only archive
        var archiveFolderId = syncedArchiveFolder?.Id.ToString() ?? Guid.NewGuid().ToString();
        var totalCount = syncedArchiveFolder?.MessageCount ?? 0;

        // Calculate actual unread count from messages if we have a synced folder
        var unreadCount = 0;
        if (syncedArchiveFolder != null)
        {
            unreadCount = await CalculateUnreadCountAsync(accountId, syncedArchiveFolder.Id);
        }

        Debug.WriteLine($"[SyncedEmailDisplayService] Archive folder ID: {archiveFolderId} (synced: {syncedArchiveFolder != null})");

        // Create and insert Archive folder
        UIMailFolder archiveFolder = new UIMailFolder
        {
            Id = archiveFolderId,
            Name = "Archive",
            Type = UIFolderType.Archive,
            Icon = "\uE149",
            UnreadCount = unreadCount,
            TotalCount = totalCount,
            IsExpanded = false,
            IsSelected = false,
            SubFolders = new System.Collections.ObjectModel.ObservableCollection<UIMailFolder>()
        };

        folders.Insert(insertIndex, archiveFolder);
        Debug.WriteLine($"[SyncedEmailDisplayService] Archive folder added at index {insertIndex}");
    }

    /// <summary>
    /// Ensures Junk folder exists in the folder list, adding it if missing.
    /// Junk is inserted before Trash folder for proper ordering.
    /// Uses the actual synced junk folder ID if available for proper message loading.
    /// </summary>
    private async Task EnsureJunkFolderExistsAsync(Guid accountId, System.Collections.ObjectModel.ObservableCollection<UIMailFolder> folders, List<SyncedEmailFolder> syncedFolders)
    {
        // Check if Junk folder already exists in UI folders
        var junkExists = folders.Any(f => f.Type == UIFolderType.Junk);
        if (junkExists)
        {
            Debug.WriteLine("[SyncedEmailDisplayService] Junk folder already exists");
            return;
        }

        // Find Trash folder index - Junk should be before Trash
        var foldersList = folders.ToList();
        var trashIndex = foldersList.FindIndex(f => f.Type == UIFolderType.Deleted);
        var insertIndex = trashIndex >= 0 ? trashIndex : folders.Count;

        // Try to find the actual synced junk folder to use its ID
        var syncedJunkFolder = syncedFolders.FirstOrDefault(f => f.FolderType == SyncFolderType.Junk);
        if (syncedJunkFolder == null)
        {
            // Fallback: look for folder named "Junk", "Spam", or Gmail's spam folder
            syncedJunkFolder = syncedFolders.FirstOrDefault(f =>
                f.FolderName.Equals("Junk", StringComparison.OrdinalIgnoreCase) ||
                f.FolderName.Equals("Spam", StringComparison.OrdinalIgnoreCase) ||
                f.FolderName.Equals("Junk E-mail", StringComparison.OrdinalIgnoreCase) ||
                f.FolderName.Equals("[Gmail]/Spam", StringComparison.OrdinalIgnoreCase));
        }

        // Use synced folder ID if found, otherwise generate a new GUID for local-only junk
        var junkFolderId = syncedJunkFolder?.Id.ToString() ?? Guid.NewGuid().ToString();
        var totalCount = syncedJunkFolder?.MessageCount ?? 0;

        // Calculate actual unread count from messages if we have a synced folder
        var unreadCount = 0;
        if (syncedJunkFolder != null)
        {
            unreadCount = await CalculateUnreadCountAsync(accountId, syncedJunkFolder.Id);
        }

        Debug.WriteLine($"[SyncedEmailDisplayService] Junk folder ID: {junkFolderId} (synced: {syncedJunkFolder != null})");

        // Create and insert Junk folder
        UIMailFolder junkFolder = new UIMailFolder
        {
            Id = junkFolderId,
            Name = "Junk",
            Type = UIFolderType.Junk,
            Icon = "\uE14D",
            UnreadCount = unreadCount,
            TotalCount = totalCount,
            IsExpanded = false,
            IsSelected = false,
            SubFolders = new System.Collections.ObjectModel.ObservableCollection<UIMailFolder>()
        };

        folders.Insert(insertIndex, junkFolder);
        Debug.WriteLine($"[SyncedEmailDisplayService] Junk folder added at index {insertIndex}");
    }

    /// <summary>
    /// Move a message to the Trash folder
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The source folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> MoveMessageToTrashAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Moving message to trash: accountId={accountId}, folderId={folderId}, remoteMessageId={remoteMessageId}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Get folders to find trash folder
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            var trashFolder = folders?.FirstOrDefault(f => f.FolderType == SyncFolderType.Trash);
            if (trashFolder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Trash folder not found in local cache");
                return false;
            }

            // Get the message from local storage
            var messagesKey = $"messages_{accountId}_{folderId}";
            var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(messagesKey);
            var message = messages?.FirstOrDefault(m => m.RemoteMessageId == remoteMessageId);

            if (message == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Message not found in local storage");
                return false;
            }

            // OPTIMISTIC LOCAL UPDATE: Update local cache FIRST for instant feedback
            // 1. Remove from source folder cache
            messages!.RemoveAll(m => m.RemoteMessageId == remoteMessageId);
            await _secureStorage.StoreAsync(messagesKey, messages);

            // 2. Add to trash folder cache
            var trashKey = $"messages_{accountId}_{trashFolder.Id}";
            var trashMessages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(trashKey) ?? new List<SyncedMessage>();
            message.FolderId = trashFolder.Id;
            trashMessages.Insert(0, message);
            await _secureStorage.StoreAsync(trashKey, trashMessages);
            Debug.WriteLine("[SyncedEmailDisplayService] Local cache updated (optimistic)");

            // Now do the server-side move in background
            try
            {
                var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
                var connectionResult = await connectionService.ConnectAsync(account);

                if (!connectionResult.Success)
                {
                    Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                    // Local cache already updated, server sync will fix on next sync
                    return true;
                }

                // Move on server
                if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
                {
                    var moveRequest = new Microsoft.Graph.Me.Messages.Item.Move.MovePostRequestBody
                    {
                        DestinationId = trashFolder.RemoteFolderId
                    };
                    await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                        .Move.PostAsync(moveRequest);
                    Debug.WriteLine("[SyncedEmailDisplayService] Message moved on server via Graph API");
                }
                else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
                {
                    var sourceFolder = folders?.FirstOrDefault(f => f.Id == folderId);
                    if (sourceFolder != null && uint.TryParse(remoteMessageId, out var uid))
                    {
                        var imapSourceFolder = await connectionResult.ImapClient.GetFolderAsync(sourceFolder.RemoteFolderId);
                        var imapTrashFolder = await connectionResult.ImapClient.GetFolderAsync(trashFolder.RemoteFolderId);
                        await imapSourceFolder.OpenAsync(MailKit.FolderAccess.ReadWrite);
                        await imapSourceFolder.MoveToAsync(new MailKit.UniqueId(uid), imapTrashFolder);
                        await imapSourceFolder.CloseAsync();
                        Debug.WriteLine("[SyncedEmailDisplayService] Message moved on server via IMAP");
                    }
                }
            }
            catch (Exception serverEx)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Server move failed (local cache already updated): {serverEx.Message}");
                // Local cache is already updated, so return true - next sync will reconcile
            }

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error moving message to trash: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Move a message to the Junk/Spam folder
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The source folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> MoveMessageToJunkAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Moving message to junk: accountId={accountId}, folderId={folderId}, remoteMessageId={remoteMessageId}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Get folders to find junk folder
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            var junkFolder = folders?.FirstOrDefault(f => f.FolderType == SyncFolderType.Junk);

            // If no junk folder found by type, try to find by name
            if (junkFolder == null)
            {
                junkFolder = folders?.FirstOrDefault(f =>
                    f.FolderName.Equals("Junk", StringComparison.OrdinalIgnoreCase) ||
                    f.FolderName.Equals("Spam", StringComparison.OrdinalIgnoreCase) ||
                    f.FolderName.Equals("Junk E-mail", StringComparison.OrdinalIgnoreCase) ||
                    f.FolderName.Equals("[Gmail]/Spam", StringComparison.OrdinalIgnoreCase));
            }

            // FALLBACK: If no Junk folder exists, use Trash folder instead
            var usingTrashFallback = false;
            if (junkFolder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Junk folder not found, falling back to Trash folder");
                junkFolder = folders?.FirstOrDefault(f => f.FolderType == SyncFolderType.Trash);

                // If no trash folder by type, try by name
                if (junkFolder == null)
                {
                    junkFolder = folders?.FirstOrDefault(f =>
                        f.FolderName.Equals("Trash", StringComparison.OrdinalIgnoreCase) ||
                        f.FolderName.Equals("Deleted Items", StringComparison.OrdinalIgnoreCase) ||
                        f.FolderName.Equals("[Gmail]/Trash", StringComparison.OrdinalIgnoreCase));
                }

                if (junkFolder == null)
                {
                    Debug.WriteLine("[SyncedEmailDisplayService] Neither Junk nor Trash folder found");
                    return false;
                }
                usingTrashFallback = true;
            }

            // Get the message from local storage
            var messagesKey = $"messages_{accountId}_{folderId}";
            var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(messagesKey);
            var message = messages?.FirstOrDefault(m => m.RemoteMessageId == remoteMessageId);

            if (message == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Message not found in local storage");
                return false;
            }

            // OPTIMISTIC LOCAL UPDATE: Update local cache FIRST for instant feedback
            // 1. Remove from source folder cache
            messages!.RemoveAll(m => m.RemoteMessageId == remoteMessageId);
            await _secureStorage.StoreAsync(messagesKey, messages);

            // 2. Add to destination folder cache (junk or trash fallback)
            var destKey = $"messages_{accountId}_{junkFolder.Id}";
            var destMessages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(destKey) ?? new List<SyncedMessage>();
            message.FolderId = junkFolder.Id;
            destMessages.Insert(0, message);
            await _secureStorage.StoreAsync(destKey, destMessages);
            Debug.WriteLine($"[SyncedEmailDisplayService] Local cache updated for {(usingTrashFallback ? "trash (junk fallback)" : "junk")} (optimistic)");

            // Now do the server-side move in background
            try
            {
                var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
                var connectionResult = await connectionService.ConnectAsync(account);

                if (!connectionResult.Success)
                {
                    Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                    // Local cache already updated, server sync will fix on next sync
                    return true;
                }

                // Move on server
                if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
                {
                    var moveRequest = new Microsoft.Graph.Me.Messages.Item.Move.MovePostRequestBody
                    {
                        DestinationId = junkFolder.RemoteFolderId
                    };
                    await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                        .Move.PostAsync(moveRequest);
                    Debug.WriteLine($"[SyncedEmailDisplayService] Message moved to {(usingTrashFallback ? "trash (junk fallback)" : "junk")} on server via Graph API");
                }
                else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
                {
                    var sourceFolder = folders?.FirstOrDefault(f => f.Id == folderId);
                    if (sourceFolder != null && uint.TryParse(remoteMessageId, out var uid))
                    {
                        var imapSourceFolder = await connectionResult.ImapClient.GetFolderAsync(sourceFolder.RemoteFolderId);
                        var imapDestFolder = await connectionResult.ImapClient.GetFolderAsync(junkFolder.RemoteFolderId);
                        await imapSourceFolder.OpenAsync(MailKit.FolderAccess.ReadWrite);
                        await imapSourceFolder.MoveToAsync(new MailKit.UniqueId(uid), imapDestFolder);
                        await imapSourceFolder.CloseAsync();
                        Debug.WriteLine($"[SyncedEmailDisplayService] Message moved to {(usingTrashFallback ? "trash (junk fallback)" : "junk")} on server via IMAP");
                    }
                }
            }
            catch (Exception serverEx)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Server move to {(usingTrashFallback ? "trash" : "junk")} failed (local cache already updated): {serverEx.Message}");
                // Local cache is already updated, so return true - next sync will reconcile
            }

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error moving message to junk: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Move a message to the Archive folder
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The source folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> MoveMessageToArchiveAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Moving message to archive: accountId={accountId}, folderId={folderId}, remoteMessageId={remoteMessageId}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Get folders to find archive folder
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            var archiveFolder = folders?.FirstOrDefault(f => f.FolderType == SyncFolderType.Archive);

            // If no archive folder exists, try to create one or use a fallback
            if (archiveFolder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Archive folder not found, attempting to find or create one");
                // Look for folder named "Archive" regardless of type
                archiveFolder = folders?.FirstOrDefault(f =>
                    f.FolderName.Equals("Archive", StringComparison.OrdinalIgnoreCase) ||
                    f.FolderName.Equals("All Mail", StringComparison.OrdinalIgnoreCase));

                if (archiveFolder == null)
                {
                    Debug.WriteLine("[SyncedEmailDisplayService] No Archive folder available");
                    return false;
                }
            }

            // Get the message from local storage
            var messagesKey = $"messages_{accountId}_{folderId}";
            var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(messagesKey);
            var message = messages?.FirstOrDefault(m => m.RemoteMessageId == remoteMessageId);

            if (message == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Message not found in local storage");
                return false;
            }

            // OPTIMISTIC LOCAL UPDATE: Update local cache FIRST for instant feedback
            // 1. Remove from source folder cache
            messages!.RemoveAll(m => m.RemoteMessageId == remoteMessageId);
            await _secureStorage.StoreAsync(messagesKey, messages);

            // 2. Add to archive folder cache
            var archiveKey = $"messages_{accountId}_{archiveFolder.Id}";
            var archiveMessages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(archiveKey) ?? new List<SyncedMessage>();
            message.FolderId = archiveFolder.Id;
            archiveMessages.Insert(0, message);
            await _secureStorage.StoreAsync(archiveKey, archiveMessages);
            Debug.WriteLine("[SyncedEmailDisplayService] Local cache updated for archive (optimistic)");

            // Now do the server-side move in background
            try
            {
                var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
                var connectionResult = await connectionService.ConnectAsync(account);

                if (!connectionResult.Success)
                {
                    Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                    // Local cache already updated, server sync will fix on next sync
                    return true;
                }

                // Move on server
                if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
                {
                    var moveRequest = new Microsoft.Graph.Me.Messages.Item.Move.MovePostRequestBody
                    {
                        DestinationId = archiveFolder.RemoteFolderId
                    };
                    await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                        .Move.PostAsync(moveRequest);
                    Debug.WriteLine("[SyncedEmailDisplayService] Message moved to archive on server via Graph API");
                }
                else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
                {
                    var sourceFolder = folders?.FirstOrDefault(f => f.Id == folderId);
                    if (sourceFolder != null && uint.TryParse(remoteMessageId, out var uid))
                    {
                        var imapSourceFolder = await connectionResult.ImapClient.GetFolderAsync(sourceFolder.RemoteFolderId);
                        var imapArchiveFolder = await connectionResult.ImapClient.GetFolderAsync(archiveFolder.RemoteFolderId);
                        await imapSourceFolder.OpenAsync(MailKit.FolderAccess.ReadWrite);
                        await imapSourceFolder.MoveToAsync(new MailKit.UniqueId(uid), imapArchiveFolder);
                        await imapSourceFolder.CloseAsync();
                        Debug.WriteLine("[SyncedEmailDisplayService] Message moved to archive on server via IMAP");
                    }
                }
            }
            catch (Exception serverEx)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Server move to archive failed (local cache already updated): {serverEx.Message}");
                // Local cache is already updated, so return true - next sync will reconcile
            }

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error moving message to archive: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Toggle the flag status of a message
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <param name="isFlagged">The new flag state</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> ToggleFlagAsync(Guid accountId, Guid folderId, string remoteMessageId, bool isFlagged)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Toggling flag: accountId={accountId}, folderId={folderId}, remoteMessageId={remoteMessageId}, isFlagged={isFlagged}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Update local cache first (optimistic update)
            var messagesKey = $"messages_{accountId}_{folderId}";
            var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(messagesKey);
            var message = messages?.FirstOrDefault(m => m.RemoteMessageId == remoteMessageId);

            if (message != null)
            {
                message.IsFlagged = isFlagged;
                await _secureStorage.StoreAsync(messagesKey, messages);
                Debug.WriteLine("[SyncedEmailDisplayService] Local cache updated for flag toggle");
            }

            // Sync to server
            try
            {
                var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
                var connectionResult = await connectionService.ConnectAsync(account);

                if (!connectionResult.Success)
                {
                    Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                    return true; // Local cache updated, server sync will reconcile later
                }

                if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
                {
                    // Update flag via Microsoft Graph API
                    var flagStatus = isFlagged
                        ? new Microsoft.Graph.Models.FollowupFlag { FlagStatus = Microsoft.Graph.Models.FollowupFlagStatus.Flagged }
                        : new Microsoft.Graph.Models.FollowupFlag { FlagStatus = Microsoft.Graph.Models.FollowupFlagStatus.NotFlagged };

                    var messageUpdate = new Microsoft.Graph.Models.Message
                    {
                        Flag = flagStatus
                    };

                    await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                        .PatchAsync(messageUpdate);
                    Debug.WriteLine("[SyncedEmailDisplayService] Flag toggled on server via Graph API");
                }
                else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
                {
                    // Get folders to find the source folder
                    var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
                    var sourceFolder = folders?.FirstOrDefault(f => f.Id == folderId);

                    if (sourceFolder != null && uint.TryParse(remoteMessageId, out var uid))
                    {
                        var imapFolder = await connectionResult.ImapClient.GetFolderAsync(sourceFolder.RemoteFolderId);
                        await imapFolder.OpenAsync(FolderAccess.ReadWrite);

                        var uniqueId = new UniqueId(uid);
                        if (isFlagged)
                        {
                            await imapFolder.AddFlagsAsync(uniqueId, MessageFlags.Flagged, true);
                        }
                        else
                        {
                            await imapFolder.RemoveFlagsAsync(uniqueId, MessageFlags.Flagged, true);
                        }

                        await imapFolder.CloseAsync();
                        Debug.WriteLine("[SyncedEmailDisplayService] Flag toggled on server via IMAP");
                    }
                }
            }
            catch (Exception serverEx)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Server flag toggle failed (local cache already updated): {serverEx.Message}");
                // Local cache is already updated, so return true - next sync will reconcile
            }

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error toggling flag: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Search through all locally cached synced messages across all accounts and folders
    /// </summary>
    /// <param name="query">The search query string</param>
    /// <returns>List of matching EmailMessage objects</returns>
    public async Task<List<EmailMessage>> SearchMessagesAsync(string query)
    {
        var results = new List<EmailMessage>();

        try
        {
            if (string.IsNullOrWhiteSpace(query))
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Search: Empty query");
                return results;
            }

            var searchTerms = query.ToLowerInvariant().Split(new[] { ' ' }, StringSplitOptions.RemoveEmptyEntries);
            Debug.WriteLine($"[SyncedEmailDisplayService] Searching for: {query} ({searchTerms.Length} terms)");

            // Get all synced accounts
            var accounts = await GetSyncedAccountsAsync();

            foreach (var account in accounts)
            {
                // Get folders for this account
                var folders = await GetFoldersAsync(account.Id);

                foreach (var folder in folders)
                {
                    // Get messages for this folder from local cache
                    var messagesKey = $"messages_{account.Id}_{folder.Id}";
                    var messages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(messagesKey);

                    if (messages == null || messages.Count == 0)
                        continue;

                    // Search through messages
                    foreach (var message in messages)
                    {
                        if (MatchesSearch(message, searchTerms))
                        {
                            results.Add(ConvertToEmailMessage(message));
                        }
                    }
                }
            }

            Debug.WriteLine($"[SyncedEmailDisplayService] Search found {results.Count} matching messages");

            // Sort by received date descending (most recent first)
            results = results.OrderByDescending(m => m.ReceivedDate).ToList();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error searching messages: {ex.Message}");
        }

        return results;
    }

    /// <summary>
    /// Check if a message matches all search terms
    /// </summary>
    private bool MatchesSearch(SyncedMessage message, string[] searchTerms)
    {
        // Build searchable text from message fields
        var searchableText = string.Join(" ",
            message.Subject ?? "",
            message.SenderName ?? "",
            message.SenderEmail ?? "",
            message.BodyPreview ?? "",
            message.BodyText ?? "",
            string.Join(" ", message.ToRecipients ?? new List<string>()),
            string.Join(" ", message.CcRecipients ?? new List<string>())
        ).ToLowerInvariant();

        // All search terms must match
        return searchTerms.All(term => searchableText.Contains(term));
    }

    /// <summary>
    /// Fetch all draft content (body, inline images, attachments) in a single connection to reduce latency
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>Draft content including body, inline images, and attachments</returns>
    public async Task<DraftContentResult> FetchDraftContentAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        var result = new DraftContentResult();

        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Fetching all draft content for message {remoteMessageId}");

            // Get the account info
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Account not found for draft content fetch");
                return result;
            }

            // Get folder info
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Folder not found for draft content fetch");
                return result;
            }

            // Create connection service - only ONE connection for everything
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed for draft content fetch: {connectionResult.ErrorMessage}");
                return result;
            }

            // Create temp folders
            var baseTempPath = Path.Combine(Path.GetTempPath(), "JubileeOutlook");
            var imagesTempPath = Path.Combine(baseTempPath, "DraftImages", remoteMessageId);
            var attachmentsTempPath = Path.Combine(baseTempPath, "DraftAttachments", remoteMessageId);
            Directory.CreateDirectory(imagesTempPath);
            Directory.CreateDirectory(attachmentsTempPath);

            if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
            {
                // Fetch message with body from Graph API
                var message = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .GetAsync(config =>
                    {
                        config.QueryParameters.Select = new[] { "body", "hasAttachments" };
                    });

                if (message?.Body != null)
                {
                    result.Body = message.Body.Content;
                    result.IsHtml = message.Body.ContentType == Microsoft.Graph.Models.BodyType.Html;
                }

                // Fetch all attachments in one call
                var attachments = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .Attachments
                    .GetAsync();

                if (attachments?.Value != null)
                {
                    foreach (var attachment in attachments.Value)
                    {
                        if (attachment is Microsoft.Graph.Models.FileAttachment fileAttachment)
                        {
                            var fileName = fileAttachment.Name ?? "attachment";

                            if (fileAttachment.IsInline == true && !string.IsNullOrEmpty(fileAttachment.ContentId))
                            {
                                // Inline image
                                var filePath = Path.Combine(imagesTempPath, fileName);
                                await File.WriteAllBytesAsync(filePath, fileAttachment.ContentBytes ?? Array.Empty<byte>());
                                result.InlineImages[fileAttachment.ContentId] = filePath;
                                Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded inline image: {fileAttachment.ContentId}");
                            }
                            else
                            {
                                // Regular attachment
                                var filePath = Path.Combine(attachmentsTempPath, fileName);
                                await File.WriteAllBytesAsync(filePath, fileAttachment.ContentBytes ?? Array.Empty<byte>());
                                result.Attachments.Add((fileAttachment.Id ?? "", fileName, filePath, fileAttachment.Size ?? 0));
                                Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded attachment: {fileName}");
                            }
                        }
                    }
                }
            }
            else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
            {
                // Fetch from IMAP
                var imapFolder = await connectionResult.ImapClient.GetFolderAsync(folder.RemoteFolderId);
                await imapFolder.OpenAsync(MailKit.FolderAccess.ReadOnly);

                MimeKit.MimeMessage? mimeMessage = null;

                // Try to get by UID first (for drafts, remoteMessageId is the UID)
                if (uint.TryParse(remoteMessageId, out var uid))
                {
                    var uniqueId = new MailKit.UniqueId(uid);
                    mimeMessage = await imapFolder.GetMessageAsync(uniqueId);
                }
                else
                {
                    // Search for the message by Message-Id header
                    var uids = await imapFolder.SearchAsync(MailKit.Search.SearchQuery.HeaderContains("Message-Id", remoteMessageId));
                    if (uids.Count > 0)
                    {
                        mimeMessage = await imapFolder.GetMessageAsync(uids[0]);
                    }
                }

                if (mimeMessage != null)
                {
                    // Get body
                    result.Body = mimeMessage.HtmlBody ?? mimeMessage.TextBody;
                    result.IsHtml = !string.IsNullOrEmpty(mimeMessage.HtmlBody);

                    // Process all body parts for inline images
                    foreach (var part in mimeMessage.BodyParts)
                    {
                        if (part is MimeKit.MimePart mimePart &&
                            !string.IsNullOrEmpty(mimePart.ContentId) &&
                            mimePart.ContentType.MediaType == "image")
                        {
                            var contentId = mimePart.ContentId.Trim('<', '>');
                            var fileName = mimePart.FileName ?? $"{contentId}.{mimePart.ContentType.MediaSubtype}";
                            var filePath = Path.Combine(imagesTempPath, fileName);

                            using var fileStream = File.Create(filePath);
                            await mimePart.Content.DecodeToAsync(fileStream);

                            result.InlineImages[contentId] = filePath;
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded inline image: {contentId}");
                        }
                    }

                    // Process attachments
                    foreach (var part in mimeMessage.Attachments)
                    {
                        if (part is MimeKit.MimePart mimePart)
                        {
                            // Skip inline images (already handled)
                            if (!string.IsNullOrEmpty(mimePart.ContentId) && mimePart.ContentType.MediaType == "image")
                                continue;

                            var fileName = mimePart.FileName ?? "attachment";
                            var filePath = Path.Combine(attachmentsTempPath, fileName);

                            using var fileStream = File.Create(filePath);
                            await mimePart.Content.DecodeToAsync(fileStream);

                            var fileSize = new FileInfo(filePath).Length;
                            result.Attachments.Add((mimePart.ContentId ?? fileName, fileName, filePath, fileSize));
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded attachment: {fileName}");
                        }
                    }
                }

                await imapFolder.CloseAsync();
            }

            Debug.WriteLine($"[SyncedEmailDisplayService] Draft content fetched: body={result.Body?.Length ?? 0} chars, images={result.InlineImages.Count}, attachments={result.Attachments.Count}");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error fetching draft content: {ex.Message}");
        }

        return result;
    }

    /// <summary>
    /// Download all inline/embedded images from an email and return their CID-to-path mappings
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>Dictionary mapping Content-ID to local file path</returns>
    public async Task<Dictionary<string, string>> DownloadInlineImagesAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        var cidToPath = new Dictionary<string, string>();

        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Downloading inline images for message {remoteMessageId}");

            // Get the account info
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Account not found for inline image download");
                return cidToPath;
            }

            // Get folder info
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Folder not found for inline image download");
                return cidToPath;
            }

            // Create connection service
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed for inline image download: {connectionResult.ErrorMessage}");
                return cidToPath;
            }

            // Create temp folder for draft images
            var tempPath = Path.Combine(
                Path.GetTempPath(),
                "JubileeOutlook",
                "DraftImages",
                remoteMessageId
            );
            Directory.CreateDirectory(tempPath);

            if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
            {
                // Fetch inline attachments from Graph API
                var attachments = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .Attachments
                    .GetAsync(config =>
                    {
                        config.QueryParameters.Filter = "isInline eq true";
                    });

                if (attachments?.Value != null)
                {
                    foreach (var attachment in attachments.Value)
                    {
                        if (attachment is Microsoft.Graph.Models.FileAttachment fileAttachment &&
                            !string.IsNullOrEmpty(fileAttachment.ContentId))
                        {
                            var filePath = Path.Combine(tempPath, fileAttachment.Name ?? $"{fileAttachment.ContentId}.dat");
                            await File.WriteAllBytesAsync(filePath, fileAttachment.ContentBytes ?? Array.Empty<byte>());
                            cidToPath[fileAttachment.ContentId] = filePath;
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded inline image: {fileAttachment.ContentId} -> {filePath}");
                        }
                    }
                }
            }
            else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
            {
                // Fetch inline attachments from IMAP
                var imapFolder = await connectionResult.ImapClient.GetFolderAsync(folder.RemoteFolderId);
                await imapFolder.OpenAsync(MailKit.FolderAccess.ReadOnly);

                if (uint.TryParse(remoteMessageId, out var uid))
                {
                    var uniqueId = new MailKit.UniqueId(uid);
                    var mimeMessage = await imapFolder.GetMessageAsync(uniqueId);

                    // Find all inline attachments (images with Content-ID)
                    foreach (var part in mimeMessage.BodyParts)
                    {
                        if (part is MimeKit.MimePart mimePart &&
                            !string.IsNullOrEmpty(mimePart.ContentId) &&
                            mimePart.ContentType.MediaType == "image")
                        {
                            var contentId = mimePart.ContentId.Trim('<', '>');
                            var fileName = mimePart.FileName ?? $"{contentId}.{mimePart.ContentType.MediaSubtype}";
                            var filePath = Path.Combine(tempPath, fileName);

                            using var fileStream = File.Create(filePath);
                            await mimePart.Content.DecodeToAsync(fileStream);

                            cidToPath[contentId] = filePath;
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded inline image: {contentId} -> {filePath}");
                        }
                    }
                }

                await imapFolder.CloseAsync();
            }

            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded {cidToPath.Count} inline images");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error downloading inline images: {ex.Message}");
        }

        return cidToPath;
    }

    /// <summary>
    /// Download all non-inline attachments from an email for draft editing
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <returns>List of attachment info with local file paths</returns>
    public async Task<List<(string Id, string FileName, string FilePath, long FileSize)>> DownloadDraftAttachmentsAsync(Guid accountId, Guid folderId, string remoteMessageId)
    {
        var attachments = new List<(string Id, string FileName, string FilePath, long FileSize)>();

        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Downloading attachments for draft {remoteMessageId}");

            // Get the account info
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Account not found for attachment download");
                return attachments;
            }

            // Get folder info
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Folder not found for attachment download");
                return attachments;
            }

            // Create connection service
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed for attachment download: {connectionResult.ErrorMessage}");
                return attachments;
            }

            // Create temp folder for draft attachments
            var tempPath = Path.Combine(
                Path.GetTempPath(),
                "JubileeOutlook",
                "DraftAttachments",
                remoteMessageId
            );
            Directory.CreateDirectory(tempPath);

            if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
            {
                // Fetch non-inline attachments from Graph API
                var graphAttachments = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .Attachments
                    .GetAsync(config =>
                    {
                        config.QueryParameters.Filter = "isInline eq false";
                    });

                if (graphAttachments?.Value != null)
                {
                    foreach (var attachment in graphAttachments.Value)
                    {
                        if (attachment is Microsoft.Graph.Models.FileAttachment fileAttachment)
                        {
                            var filePath = Path.Combine(tempPath, fileAttachment.Name ?? "attachment");
                            await File.WriteAllBytesAsync(filePath, fileAttachment.ContentBytes ?? Array.Empty<byte>());
                            attachments.Add((fileAttachment.Id ?? "", fileAttachment.Name ?? "attachment", filePath, fileAttachment.Size ?? 0));
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded attachment: {fileAttachment.Name} -> {filePath}");
                        }
                    }
                }
            }
            else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
            {
                // Fetch non-inline attachments from IMAP
                var imapFolder = await connectionResult.ImapClient.GetFolderAsync(folder.RemoteFolderId);
                await imapFolder.OpenAsync(MailKit.FolderAccess.ReadOnly);

                if (uint.TryParse(remoteMessageId, out var uid))
                {
                    var uniqueId = new MailKit.UniqueId(uid);
                    var mimeMessage = await imapFolder.GetMessageAsync(uniqueId);

                    // Find all non-inline attachments
                    foreach (var part in mimeMessage.Attachments)
                    {
                        if (part is MimeKit.MimePart mimePart && !mimePart.IsAttachment == false)
                        {
                            // Skip inline images (they have ContentId and are handled separately)
                            if (!string.IsNullOrEmpty(mimePart.ContentId) && mimePart.ContentType.MediaType == "image")
                                continue;

                            var fileName = mimePart.FileName ?? "attachment";
                            var filePath = Path.Combine(tempPath, fileName);

                            using var fileStream = File.Create(filePath);
                            await mimePart.Content.DecodeToAsync(fileStream);

                            var fileSize = new FileInfo(filePath).Length;
                            attachments.Add((mimePart.ContentId ?? fileName, fileName, filePath, fileSize));
                            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded attachment: {fileName} -> {filePath}");
                        }
                    }
                }

                await imapFolder.CloseAsync();
            }

            Debug.WriteLine($"[SyncedEmailDisplayService] Downloaded {attachments.Count} attachments");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error downloading attachments: {ex.Message}");
        }

        return attachments;
    }

    /// <summary>
    /// Download an attachment from the email server
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="remoteMessageId">The remote message ID</param>
    /// <param name="attachmentId">The attachment ID</param>
    /// <param name="fileName">The file name for saving</param>
    /// <returns>The path to the downloaded file, or null if failed</returns>
    public async Task<string?> DownloadAttachmentAsync(Guid accountId, string remoteMessageId, string attachmentId, string fileName)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Downloading attachment {fileName} (ID: {attachmentId})");

            // Get the account info
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine("[SyncedEmailDisplayService] Account not found for attachment download");
                return null;
            }

            // Create connection service
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed for attachment download: {connectionResult.ErrorMessage}");
                return null;
            }

            byte[]? attachmentData = null;

            if (connectionResult.ConnectionType == ConnectionType.MicrosoftGraph && connectionResult.GraphClient != null)
            {
                // Fetch attachment from Graph API
                var attachment = await connectionResult.GraphClient.Me.Messages[remoteMessageId]
                    .Attachments[attachmentId]
                    .GetAsync();

                if (attachment is Microsoft.Graph.Models.FileAttachment fileAttachment)
                {
                    attachmentData = fileAttachment.ContentBytes;
                }
            }
            else if (connectionResult.ConnectionType == ConnectionType.IMAP && connectionResult.ImapClient != null)
            {
                // Fetch attachment from IMAP
                // Find the folder containing this message
                var folders = await GetFoldersAsync(accountId);
                foreach (var folder in folders)
                {
                    try
                    {
                        var imapFolder = await connectionResult.ImapClient.GetFolderAsync(folder.RemoteFolderId);
                        await imapFolder.OpenAsync(MailKit.FolderAccess.ReadOnly);

                        // Try to parse the remoteMessageId as UID
                        if (uint.TryParse(remoteMessageId, out var uid))
                        {
                            var uniqueId = new MailKit.UniqueId(uid);
                            var mimeMessage = await imapFolder.GetMessageAsync(uniqueId);

                            // Find the attachment by ID or filename
                            foreach (var part in mimeMessage.Attachments)
                            {
                                if (part is MimeKit.MimePart mimePart)
                                {
                                    var partId = mimePart.ContentId ?? mimePart.FileName;
                                    if (partId == attachmentId || mimePart.FileName == fileName)
                                    {
                                        using var memoryStream = new MemoryStream();
                                        await mimePart.Content.DecodeToAsync(memoryStream);
                                        attachmentData = memoryStream.ToArray();
                                        break;
                                    }
                                }
                            }
                        }

                        await imapFolder.CloseAsync();

                        if (attachmentData != null)
                            break;
                    }
                    catch
                    {
                        // Try next folder
                    }
                }
            }

            if (attachmentData != null)
            {
                // Save to Downloads folder
                var downloadsPath = Path.Combine(
                    Environment.GetFolderPath(Environment.SpecialFolder.UserProfile),
                    "Downloads"
                );

                // Ensure unique filename
                var savePath = Path.Combine(downloadsPath, fileName);
                var counter = 1;
                var fileNameWithoutExt = Path.GetFileNameWithoutExtension(fileName);
                var extension = Path.GetExtension(fileName);

                while (File.Exists(savePath))
                {
                    savePath = Path.Combine(downloadsPath, $"{fileNameWithoutExt} ({counter}){extension}");
                    counter++;
                }

                await File.WriteAllBytesAsync(savePath, attachmentData);
                Debug.WriteLine($"[SyncedEmailDisplayService] Attachment saved to: {savePath}");
                return savePath;
            }

            Debug.WriteLine("[SyncedEmailDisplayService] Attachment data not found");
            return null;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error downloading attachment: {ex.Message}");
            return null;
        }
    }

    #region Folder Operations

    /// <summary>
    /// Create a new folder on the email server
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderName">The name for the new folder</param>
    /// <returns>The created folder if successful, null otherwise</returns>
    public async Task<SyncedEmailFolder?> CreateFolderAsync(Guid accountId, string folderName)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Creating folder: accountId={accountId}, folderName={folderName}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return null;
            }

            // Connect to the server
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                return null;
            }

            // Create the folder via EmailSyncService
            var syncService = new EmailSyncService(_secureStorage, connectionService, new FolderDiscoveryService());
            var newFolder = await syncService.CreateFolderAsync(account, folderName, connectionResult);

            return newFolder;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error creating folder: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Rename a folder on the email server
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID to rename</param>
    /// <param name="newName">The new name for the folder</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> RenameFolderAsync(Guid accountId, Guid folderId, string newName)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Renaming folder: accountId={accountId}, folderId={folderId}, newName={newName}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Get the folder
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Folder not found: {folderId}");
                return false;
            }

            // Connect to the server
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                return false;
            }

            // Rename the folder via EmailSyncService
            var syncService = new EmailSyncService(_secureStorage, connectionService, new FolderDiscoveryService());
            return await syncService.RenameFolderAsync(account, folder, newName, connectionResult);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error renaming folder: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Delete a folder from the email server
    /// </summary>
    /// <param name="accountId">The account ID</param>
    /// <param name="folderId">The folder ID to delete</param>
    /// <returns>True if successful, false otherwise</returns>
    public async Task<bool> DeleteFolderAsync(Guid accountId, Guid folderId)
    {
        try
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Deleting folder: accountId={accountId}, folderId={folderId}");

            // Get the account
            var account = await _secureStorage.RetrieveAsync<SyncedEmailAccount>($"account_{accountId}");
            if (account == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Account not found for key: account_{accountId}");
                return false;
            }

            // Get the folder
            var folders = await GetFoldersAsync(accountId);
            var folder = folders.FirstOrDefault(f => f.Id == folderId);
            if (folder == null)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Folder not found: {folderId}");
                return false;
            }

            // Connect to the server
            var connectionService = new EmailConnectionService(_secureStorage, new MicrosoftOAuth2Service(_secureStorage));
            var connectionResult = await connectionService.ConnectAsync(account);

            if (!connectionResult.Success)
            {
                Debug.WriteLine($"[SyncedEmailDisplayService] Connection failed: {connectionResult.ErrorMessage}");
                return false;
            }

            // Delete the folder via EmailSyncService
            var syncService = new EmailSyncService(_secureStorage, connectionService, new FolderDiscoveryService());
            return await syncService.DeleteFolderAsync(account, folder, connectionResult);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[SyncedEmailDisplayService] Error deleting folder: {ex.Message}");
            return false;
        }
    }

    #endregion
}

/// <summary>
/// Result of fetching draft content (body, inline images, attachments) in a single connection
/// </summary>
public class DraftContentResult
{
    public string? Body { get; set; }
    public bool IsHtml { get; set; }
    public Dictionary<string, string> InlineImages { get; set; } = new();
    public List<(string Id, string FileName, string FilePath, long FileSize)> Attachments { get; set; } = new();
}
