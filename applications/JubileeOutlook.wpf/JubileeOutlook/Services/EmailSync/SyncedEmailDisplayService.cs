using System.Diagnostics;
using System.IO;
using JubileeOutlook.Models;
using JubileeOutlook.Models.EmailSync;

// Use aliases to avoid ambiguity between Models.FolderType and Models.EmailSync.FolderType
using UIFolderType = JubileeOutlook.Models.FolderType;
using SyncFolderType = JubileeOutlook.Models.EmailSync.FolderType;

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
    public async Task<List<MailFolder>> BuildFolderTreeAsync()
    {
        var rootFolders = new List<MailFolder>();
        var accounts = await GetSyncedAccountsAsync();

        Debug.WriteLine($"[SyncedEmailDisplayService] Building folder tree for {accounts.Count} accounts");

        foreach (var account in accounts)
        {
            // Create account root folder
            var accountFolder = new MailFolder
            {
                Id = account.Id.ToString(),
                Name = account.EmailAddress,
                Type = UIFolderType.AccountRoot,
                IsAccountRoot = true,
                WwbwEmailAddress = account.EmailAddress,
                IsExpanded = true,
                Icon = GetProviderIcon(account.ProviderType),
                SubFolders = new List<MailFolder>()
            };

            // Load folders for this account
            var syncedFolders = await GetFoldersAsync(account.Id);
            Debug.WriteLine($"[SyncedEmailDisplayService] Account {account.EmailAddress} has {syncedFolders.Count} folders");

            foreach (var folder in syncedFolders.Where(f => f.IsSubscribed))
            {
                var mailFolder = ConvertToMailFolder(folder);
                accountFolder.SubFolders.Add(mailFolder);
            }

            // If no folders, add default structure
            if (accountFolder.SubFolders.Count == 0)
            {
                accountFolder.SubFolders = CreateDefaultFolders();
            }

            rootFolders.Add(accountFolder);
        }

        return rootFolders;
    }

    /// <summary>
    /// Convert SyncedEmailFolder to MailFolder for UI
    /// </summary>
    private MailFolder ConvertToMailFolder(SyncedEmailFolder syncedFolder)
    {
        return new MailFolder
        {
            Id = syncedFolder.Id.ToString(),
            Name = syncedFolder.FolderName,
            Type = ConvertFolderType(syncedFolder.FolderType),
            Icon = GetFolderIcon(syncedFolder.FolderType),
            UnreadCount = syncedFolder.UnreadCount,
            TotalCount = syncedFolder.MessageCount,
            IsExpanded = false,
            IsSelected = false,
            SubFolders = new List<MailFolder>()
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
    private List<MailFolder> CreateDefaultFolders()
    {
        return new List<MailFolder>
        {
            new MailFolder { Id = "inbox", Name = "Inbox", Type = UIFolderType.Inbox, Icon = "\uE156" },
            new MailFolder { Id = "sent", Name = "Sent", Type = UIFolderType.Sent, Icon = "\uE163" },
            new MailFolder { Id = "drafts", Name = "Drafts", Type = UIFolderType.Drafts, Icon = "\uE151" },
            new MailFolder { Id = "trash", Name = "Trash", Type = UIFolderType.Deleted, Icon = "\uE872" },
            new MailFolder { Id = "spam", Name = "Spam", Type = UIFolderType.Junk, Icon = "\uE14C" }
        };
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
