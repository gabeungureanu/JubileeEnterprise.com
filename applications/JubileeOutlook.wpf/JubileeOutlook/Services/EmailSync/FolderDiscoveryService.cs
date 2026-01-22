using System.Diagnostics;
using MailKit;
using MailKit.Net.Imap;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service for discovering and mapping email folders from remote servers
/// </summary>
public class FolderDiscoveryService
{
    /// <summary>
    /// Discover folders from a connected account
    /// </summary>
    public async Task<FolderDiscoveryResult> DiscoverFoldersAsync(
        SyncedEmailAccount account,
        ConnectionResult connection)
    {
        Debug.WriteLine($"[FolderDiscovery] Discovering folders for {account.EmailAddress}");

        return connection.ConnectionType switch
        {
            ConnectionType.MicrosoftGraph when connection.GraphClient != null =>
                await DiscoverGraphFoldersAsync(account, connection.GraphClient),
            ConnectionType.IMAP when connection.ImapClient != null =>
                await DiscoverImapFoldersAsync(account, connection.ImapClient),
            _ => new FolderDiscoveryResult
            {
                Success = false,
                ErrorMessage = "No valid connection"
            }
        };
    }

    /// <summary>
    /// Discover folders using Microsoft Graph API
    /// </summary>
    private async Task<FolderDiscoveryResult> DiscoverGraphFoldersAsync(
        SyncedEmailAccount account,
        GraphServiceClient graphClient)
    {
        var folders = new List<SyncedEmailFolder>();

        try
        {
            Debug.WriteLine("[FolderDiscovery] Getting folders from Microsoft Graph...");

            // Get all mail folders
            var mailFolders = await graphClient.Me.MailFolders.GetAsync(config =>
            {
                config.QueryParameters.Top = 100;
                config.QueryParameters.Expand = new[] { "childFolders" };
            });

            if (mailFolders?.Value == null)
            {
                return new FolderDiscoveryResult
                {
                    Success = false,
                    ErrorMessage = "No folders returned from Graph API"
                };
            }

            foreach (var folder in mailFolders.Value)
            {
                if (folder.Id == null || folder.DisplayName == null) continue;

                var syncedFolder = MapGraphFolder(account.Id, folder);
                folders.Add(syncedFolder);
                Debug.WriteLine($"[FolderDiscovery] Found folder: {folder.DisplayName} ({syncedFolder.FolderType})");

                // Process child folders
                if (folder.ChildFolders?.Count > 0)
                {
                    foreach (var child in folder.ChildFolders)
                    {
                        if (child.Id == null || child.DisplayName == null) continue;
                        var childFolder = MapGraphFolder(account.Id, child, folder.DisplayName);
                        folders.Add(childFolder);
                    }
                }
            }

            Debug.WriteLine($"[FolderDiscovery] Discovered {folders.Count} folders via Graph API");

            return new FolderDiscoveryResult
            {
                Success = true,
                Folders = folders
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[FolderDiscovery] Graph folder discovery failed: {ex.Message}");
            return new FolderDiscoveryResult
            {
                Success = false,
                ErrorMessage = $"Folder discovery failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Map a Graph API folder to SyncedEmailFolder
    /// </summary>
    private SyncedEmailFolder MapGraphFolder(Guid accountId, Microsoft.Graph.Models.MailFolder folder, string? parentPath = null)
    {
        var folderType = DetermineGraphFolderType(folder.DisplayName ?? "", folder.Id ?? "");
        var path = string.IsNullOrEmpty(parentPath)
            ? folder.DisplayName ?? ""
            : $"{parentPath}/{folder.DisplayName}";

        return new SyncedEmailFolder
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            RemoteFolderId = folder.Id ?? "",
            FolderName = folder.DisplayName ?? "",
            FolderPath = path,
            FolderType = folderType,
            MessageCount = (int)(folder.TotalItemCount ?? 0),
            UnreadCount = (int)(folder.UnreadItemCount ?? 0),
            IsSubscribed = IsImportantFolder(folderType)
        };
    }

    /// <summary>
    /// Determine folder type from Graph folder
    /// </summary>
    private FolderType DetermineGraphFolderType(string displayName, string folderId)
    {
        var lowerName = displayName.ToLower();

        // Microsoft Graph well-known folder IDs
        if (folderId.Equals("inbox", StringComparison.OrdinalIgnoreCase) ||
            lowerName == "inbox")
            return FolderType.Inbox;

        if (folderId.Equals("sentitems", StringComparison.OrdinalIgnoreCase) ||
            lowerName.Contains("sent"))
            return FolderType.Sent;

        if (folderId.Equals("drafts", StringComparison.OrdinalIgnoreCase) ||
            lowerName == "drafts")
            return FolderType.Drafts;

        if (folderId.Equals("deleteditems", StringComparison.OrdinalIgnoreCase) ||
            lowerName.Contains("deleted") || lowerName.Contains("trash"))
            return FolderType.Trash;

        if (folderId.Equals("junkemail", StringComparison.OrdinalIgnoreCase) ||
            lowerName.Contains("junk") || lowerName.Contains("spam"))
            return FolderType.Junk;

        if (folderId.Equals("archive", StringComparison.OrdinalIgnoreCase) ||
            lowerName == "archive")
            return FolderType.Archive;

        return FolderType.Custom;
    }

    /// <summary>
    /// Discover folders using IMAP
    /// </summary>
    private async Task<FolderDiscoveryResult> DiscoverImapFoldersAsync(
        SyncedEmailAccount account,
        ImapClient imapClient)
    {
        var folders = new List<SyncedEmailFolder>();

        try
        {
            Debug.WriteLine("[FolderDiscovery] Getting folders from IMAP...");

            // Get personal namespace
            var personal = imapClient.PersonalNamespaces.FirstOrDefault();
            var rootFolder = personal != null
                ? await imapClient.GetFolderAsync(personal.Path)
                : imapClient.Inbox.ParentFolder;

            // Recursively discover folders
            await DiscoverImapFoldersRecursiveAsync(account.Id, rootFolder, folders, account.ProviderType);

            // Ensure inbox is included
            var inbox = folders.FirstOrDefault(f => f.FolderType == FolderType.Inbox);
            if (inbox == null)
            {
                var inboxFolder = imapClient.Inbox;
                await inboxFolder.OpenAsync(FolderAccess.ReadOnly);
                folders.Insert(0, new SyncedEmailFolder
                {
                    Id = Guid.NewGuid(),
                    AccountId = account.Id,
                    RemoteFolderId = inboxFolder.FullName,
                    FolderName = "Inbox",
                    FolderPath = "Inbox",
                    FolderType = FolderType.Inbox,
                    MessageCount = inboxFolder.Count,
                    UnreadCount = inboxFolder.Unread,
                    SyncState = inboxFolder.UidValidity.ToString(),
                    IsSubscribed = true
                });
                await inboxFolder.CloseAsync();
            }

            Debug.WriteLine($"[FolderDiscovery] Discovered {folders.Count} folders via IMAP");

            return new FolderDiscoveryResult
            {
                Success = true,
                Folders = folders
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[FolderDiscovery] IMAP folder discovery failed: {ex.Message}");
            return new FolderDiscoveryResult
            {
                Success = false,
                ErrorMessage = $"Folder discovery failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Recursively discover IMAP folders
    /// </summary>
    private async Task DiscoverImapFoldersRecursiveAsync(
        Guid accountId,
        IMailFolder parentFolder,
        List<SyncedEmailFolder> folders,
        EmailProviderType providerType,
        int depth = 0)
    {
        if (depth > 10) return; // Prevent infinite recursion

        try
        {
            var subfolders = await parentFolder.GetSubfoldersAsync();

            foreach (var folder in subfolders)
            {
                try
                {
                    // Try to get folder status
                    int messageCount = 0;
                    int unreadCount = 0;
                    uint uidValidity = 0;

                    if (folder.Exists)
                    {
                        try
                        {
                            await folder.OpenAsync(FolderAccess.ReadOnly);
                            messageCount = folder.Count;
                            unreadCount = folder.Unread;
                            uidValidity = folder.UidValidity;
                            await folder.CloseAsync();
                        }
                        catch (Exception ex)
                        {
                            Debug.WriteLine($"[FolderDiscovery] Could not open folder {folder.FullName}: {ex.Message}");
                        }
                    }

                    var folderType = DetermineImapFolderType(folder, providerType);
                    var syncedFolder = new SyncedEmailFolder
                    {
                        Id = Guid.NewGuid(),
                        AccountId = accountId,
                        RemoteFolderId = folder.FullName,
                        FolderName = folder.Name,
                        FolderPath = folder.FullName,
                        FolderType = folderType,
                        MessageCount = messageCount,
                        UnreadCount = unreadCount,
                        SyncState = uidValidity > 0 ? uidValidity.ToString() : null,
                        IsSubscribed = IsImportantFolder(folderType)
                    };

                    folders.Add(syncedFolder);
                    Debug.WriteLine($"[FolderDiscovery] Found IMAP folder: {folder.FullName} ({folderType})");

                    // Recurse into subfolders
                    await DiscoverImapFoldersRecursiveAsync(accountId, folder, folders, providerType, depth + 1);
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[FolderDiscovery] Error processing folder {folder.Name}: {ex.Message}");
                }
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[FolderDiscovery] Error getting subfolders: {ex.Message}");
        }
    }

    /// <summary>
    /// Determine folder type from IMAP folder
    /// </summary>
    private FolderType DetermineImapFolderType(IMailFolder folder, EmailProviderType providerType)
    {
        var fullName = folder.FullName.ToLower();
        var name = folder.Name.ToLower();

        // Check IMAP special-use attributes first
        if (folder.Attributes.HasFlag(FolderAttributes.Inbox) || name == "inbox")
            return FolderType.Inbox;

        if (folder.Attributes.HasFlag(FolderAttributes.Sent) ||
            fullName.Contains("sent") || name.Contains("sent"))
            return FolderType.Sent;

        if (folder.Attributes.HasFlag(FolderAttributes.Drafts) ||
            fullName.Contains("draft") || name.Contains("draft"))
            return FolderType.Drafts;

        if (folder.Attributes.HasFlag(FolderAttributes.Trash) ||
            fullName.Contains("trash") || fullName.Contains("deleted") ||
            name.Contains("trash") || name.Contains("deleted"))
            return FolderType.Trash;

        if (folder.Attributes.HasFlag(FolderAttributes.Junk) ||
            fullName.Contains("junk") || fullName.Contains("spam") ||
            name.Contains("junk") || name.Contains("spam"))
            return FolderType.Junk;

        if (folder.Attributes.HasFlag(FolderAttributes.Archive) ||
            fullName.Contains("archive") || name.Contains("archive"))
            return FolderType.Archive;

        // Provider-specific folder names
        if (providerType == EmailProviderType.Google)
        {
            // Gmail uses [Gmail] prefix
            if (fullName.Contains("[gmail]/sent") || fullName.Contains("[gmail]/sent mail"))
                return FolderType.Sent;
            if (fullName.Contains("[gmail]/drafts"))
                return FolderType.Drafts;
            if (fullName.Contains("[gmail]/trash") || fullName.Contains("[gmail]/bin"))
                return FolderType.Trash;
            if (fullName.Contains("[gmail]/spam"))
                return FolderType.Junk;
            if (fullName.Contains("[gmail]/all mail"))
                return FolderType.Archive;
        }

        return FolderType.Custom;
    }

    /// <summary>
    /// Determine if a folder is important (should be synced by default)
    /// </summary>
    private bool IsImportantFolder(FolderType folderType)
    {
        return folderType switch
        {
            FolderType.Inbox => true,
            FolderType.Sent => true,
            FolderType.Drafts => true,
            FolderType.Trash => true,
            _ => false
        };
    }

    /// <summary>
    /// Create local folder mapping for a discovered folder
    /// </summary>
    public async Task<Guid?> CreateLocalFolderMappingAsync(
        SyncedEmailFolder remoteFolder,
        string localFolderId)
    {
        // This will be implemented when we integrate with the local database
        remoteFolder.LocalFolderId = localFolderId;
        await Task.CompletedTask;
        return remoteFolder.Id;
    }

    /// <summary>
    /// Get folder statistics from a Graph folder
    /// </summary>
    public async Task<FolderStats?> GetGraphFolderStatsAsync(
        GraphServiceClient graphClient,
        string folderId)
    {
        try
        {
            var folder = await graphClient.Me.MailFolders[folderId].GetAsync();
            if (folder == null) return null;

            return new FolderStats
            {
                TotalCount = (int)(folder.TotalItemCount ?? 0),
                UnreadCount = (int)(folder.UnreadItemCount ?? 0),
                FolderName = folder.DisplayName ?? ""
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[FolderDiscovery] Failed to get Graph folder stats: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Get folder statistics from an IMAP folder
    /// </summary>
    public async Task<FolderStats?> GetImapFolderStatsAsync(
        ImapClient imapClient,
        string folderPath)
    {
        try
        {
            var folder = await imapClient.GetFolderAsync(folderPath);
            await folder.OpenAsync(FolderAccess.ReadOnly);

            var stats = new FolderStats
            {
                TotalCount = folder.Count,
                UnreadCount = folder.Unread,
                FolderName = folder.Name,
                UidValidity = folder.UidValidity,
                UidNext = folder.UidNext?.Id ?? 0
            };

            await folder.CloseAsync();
            return stats;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[FolderDiscovery] Failed to get IMAP folder stats: {ex.Message}");
            return null;
        }
    }
}

/// <summary>
/// Result of folder discovery
/// </summary>
public class FolderDiscoveryResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public List<SyncedEmailFolder> Folders { get; set; } = new();
}

/// <summary>
/// Folder statistics
/// </summary>
public class FolderStats
{
    public int TotalCount { get; set; }
    public int UnreadCount { get; set; }
    public string FolderName { get; set; } = string.Empty;
    public uint UidValidity { get; set; }
    public uint UidNext { get; set; }
}
