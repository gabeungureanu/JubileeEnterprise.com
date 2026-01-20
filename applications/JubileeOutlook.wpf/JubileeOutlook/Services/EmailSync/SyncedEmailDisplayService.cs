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
            Preview = syncedMessage.BodyPreview ?? "",
            ReceivedDate = syncedMessage.ReceivedAt,
            SentDate = syncedMessage.SentAt ?? DateTime.MinValue,
            IsRead = syncedMessage.IsRead,
            IsFlagged = syncedMessage.IsFlagged,
            HasAttachments = syncedMessage.HasAttachments,
            FolderId = syncedMessage.FolderId.ToString(),
            // Store the original synced message ID for on-demand body fetching
            SyncedMessageId = syncedMessage.Id,
            RemoteMessageId = syncedMessage.RemoteMessageId,
            AccountId = syncedMessage.AccountId,
            NeedsBodyFetch = false
        };
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
}
