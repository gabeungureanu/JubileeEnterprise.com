using System.Diagnostics;
using MailKit;
using MailKit.Net.Imap;
using MimeKit;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using JubileeOutlook.Models.EmailSync;

// Alias to disambiguate from Microsoft.Graph.Models.SearchQuery
using ImapSearchQuery = MailKit.Search.SearchQuery;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service for synchronizing emails from remote servers to local storage
/// Supports both initial full sync and incremental delta sync
/// </summary>
public class EmailSyncService
{
    private readonly SecureStorageService _secureStorage;
    private readonly EmailConnectionService _connectionService;
    private readonly FolderDiscoveryService _folderDiscovery;

    /// <summary>
    /// Event raised during sync progress
    /// </summary>
    public event EventHandler<SyncProgressEventArgs>? SyncProgress;

    public EmailSyncService(
        SecureStorageService secureStorage,
        EmailConnectionService connectionService,
        FolderDiscoveryService folderDiscovery)
    {
        _secureStorage = secureStorage;
        _connectionService = connectionService;
        _folderDiscovery = folderDiscovery;
    }

    /// <summary>
    /// Perform initial full sync for a folder
    /// </summary>
    public async Task<EmailSyncResult> InitialSyncFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        ConnectionResult connection,
        int maxMessages = 500,
        CancellationToken cancellationToken = default)
    {
        Debug.WriteLine($"[EmailSync] Starting initial sync for {folder.FolderName} (max {maxMessages} messages)");
        var stopwatch = Stopwatch.StartNew();

        try
        {
            return connection.ConnectionType switch
            {
                ConnectionType.MicrosoftGraph when connection.GraphClient != null =>
                    await InitialSyncGraphFolderAsync(account, folder, connection.GraphClient, maxMessages, cancellationToken),
                ConnectionType.IMAP when connection.ImapClient != null =>
                    await InitialSyncImapFolderAsync(account, folder, connection.ImapClient, maxMessages, cancellationToken),
                _ => new EmailSyncResult
                {
                    Success = false,
                    ErrorMessage = "No valid connection for sync"
                }
            };
        }
        finally
        {
            stopwatch.Stop();
            Debug.WriteLine($"[EmailSync] Initial sync completed in {stopwatch.ElapsedMilliseconds}ms");
        }
    }

    /// <summary>
    /// Perform incremental sync for a folder (only new/changed messages)
    /// </summary>
    public async Task<EmailSyncResult> IncrementalSyncFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        ConnectionResult connection,
        CancellationToken cancellationToken = default)
    {
        Debug.WriteLine($"[EmailSync] Starting incremental sync for {folder.FolderName}");
        var stopwatch = Stopwatch.StartNew();

        try
        {
            return connection.ConnectionType switch
            {
                ConnectionType.MicrosoftGraph when connection.GraphClient != null =>
                    await IncrementalSyncGraphFolderAsync(account, folder, connection.GraphClient, cancellationToken),
                ConnectionType.IMAP when connection.ImapClient != null =>
                    await IncrementalSyncImapFolderAsync(account, folder, connection.ImapClient, cancellationToken),
                _ => new EmailSyncResult
                {
                    Success = false,
                    ErrorMessage = "No valid connection for sync"
                }
            };
        }
        finally
        {
            stopwatch.Stop();
            Debug.WriteLine($"[EmailSync] Incremental sync completed in {stopwatch.ElapsedMilliseconds}ms");
        }
    }

    #region Microsoft Graph Sync

    /// <summary>
    /// Initial sync using Microsoft Graph API
    /// </summary>
    private async Task<EmailSyncResult> InitialSyncGraphFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        GraphServiceClient graphClient,
        int maxMessages,
        CancellationToken cancellationToken)
    {
        var result = new EmailSyncResult { SyncTime = DateTime.UtcNow };
        var messages = new List<SyncedMessage>();

        try
        {
            RaiseProgress($"Syncing {folder.FolderName}...", 0, folder.MessageCount);

            // Get messages from Graph API with pagination
            var pageSize = Math.Min(50, maxMessages);
            var request = graphClient.Me.MailFolders[folder.RemoteFolderId].Messages;

            var graphMessages = await request.GetAsync(config =>
            {
                config.QueryParameters.Top = pageSize;
                config.QueryParameters.Select = new[]
                {
                    "id", "subject", "from", "toRecipients", "ccRecipients",
                    "receivedDateTime", "sentDateTime", "isRead", "isDraft",
                    "importance", "hasAttachments", "bodyPreview", "body", "flag"
                };
                config.QueryParameters.Orderby = new[] { "receivedDateTime desc" };
            }, cancellationToken);

            int processed = 0;
            string? deltaLink = null;

            while (graphMessages?.Value != null && processed < maxMessages)
            {
                foreach (var msg in graphMessages.Value)
                {
                    if (cancellationToken.IsCancellationRequested) break;
                    if (processed >= maxMessages) break;

                    var syncedMessage = MapGraphMessage(msg, account.Id, folder.Id);
                    messages.Add(syncedMessage);
                    processed++;
                    result.NewMessages++;

                    if (processed % 10 == 0)
                    {
                        RaiseProgress($"Syncing {folder.FolderName}...", processed, folder.MessageCount);
                    }
                }

                // Get next page if available and we need more messages
                if (graphMessages.OdataNextLink != null && processed < maxMessages)
                {
                    // Use the next link to get more messages
                    graphMessages = await graphClient.Me.MailFolders[folder.RemoteFolderId].Messages
                        .GetAsync(config =>
                        {
                            config.QueryParameters.Top = pageSize;
                            config.QueryParameters.Skip = processed;
                            config.QueryParameters.Select = new[]
                            {
                                "id", "subject", "from", "toRecipients", "ccRecipients",
                                "receivedDateTime", "sentDateTime", "isRead", "isDraft",
                                "importance", "hasAttachments", "bodyPreview", "body", "flag"
                            };
                            config.QueryParameters.Orderby = new[] { "receivedDateTime desc" };
                        }, cancellationToken);
                }
                else
                {
                    break;
                }
            }

            // Get delta link for future incremental syncs
            var deltaRequest = graphClient.Me.MailFolders[folder.RemoteFolderId].Messages.Delta;
            var deltaResponse = await deltaRequest.GetAsDeltaGetResponseAsync(cancellationToken: cancellationToken);
            deltaLink = deltaResponse?.OdataDeltaLink;

            // Store delta link for incremental sync
            if (!string.IsNullOrEmpty(deltaLink))
            {
                folder.SyncState = deltaLink;
                await _secureStorage.StoreAsync($"folder_sync_{folder.Id}", folder);
            }

            // Store messages locally (placeholder - will integrate with local DB)
            await StoreSyncedMessagesAsync(account.Id, folder.Id, messages);

            result.Success = true;
            RaiseProgress($"Synced {processed} messages from {folder.FolderName}", processed, processed);

            Debug.WriteLine($"[EmailSync] Graph sync completed: {result.NewMessages} new messages");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSync] Graph sync error: {ex.Message}");
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Incremental sync using Microsoft Graph delta API
    /// </summary>
    private async Task<EmailSyncResult> IncrementalSyncGraphFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        GraphServiceClient graphClient,
        CancellationToken cancellationToken)
    {
        var result = new EmailSyncResult { SyncTime = DateTime.UtcNow };

        try
        {
            // Load stored delta link
            var storedFolder = await _secureStorage.RetrieveAsync<SyncedEmailFolder>($"folder_sync_{folder.Id}");
            var deltaLink = storedFolder?.SyncState ?? folder.SyncState;

            if (string.IsNullOrEmpty(deltaLink))
            {
                Debug.WriteLine("[EmailSync] No delta link found, performing initial sync");
                return await InitialSyncGraphFolderAsync(account, folder, graphClient, 100, cancellationToken);
            }

            RaiseProgress($"Checking for changes in {folder.FolderName}...", 0, 0);

            // Use delta link to get changes
            var deltaRequest = graphClient.Me.MailFolders[folder.RemoteFolderId].Messages.Delta;
            var deltaResponse = await deltaRequest.GetAsDeltaGetResponseAsync(cancellationToken: cancellationToken);

            var messages = new List<SyncedMessage>();

            while (deltaResponse?.Value != null)
            {
                foreach (var msg in deltaResponse.Value)
                {
                    if (cancellationToken.IsCancellationRequested) break;

                    // Check if this is a deletion
                    if (msg.AdditionalData?.ContainsKey("@removed") == true)
                    {
                        // Handle deletion
                        await DeleteSyncedMessageAsync(account.Id, msg.Id ?? "");
                        result.DeletedMessages++;
                    }
                    else
                    {
                        // New or updated message
                        var syncedMessage = MapGraphMessage(msg, account.Id, folder.Id);

                        // Check if exists (update) or new
                        var exists = await MessageExistsAsync(account.Id, msg.Id ?? "");
                        if (exists)
                        {
                            await UpdateSyncedMessageAsync(syncedMessage);
                            result.UpdatedMessages++;
                        }
                        else
                        {
                            messages.Add(syncedMessage);
                            result.NewMessages++;
                        }
                    }
                }

                // Get next page of changes
                if (deltaResponse.OdataNextLink != null)
                {
                    deltaResponse = await graphClient.Me.MailFolders[folder.RemoteFolderId].Messages.Delta
                        .GetAsDeltaGetResponseAsync(cancellationToken: cancellationToken);
                }
                else
                {
                    break;
                }
            }

            // Store new messages
            if (messages.Count > 0)
            {
                await StoreSyncedMessagesAsync(account.Id, folder.Id, messages);
            }

            // Update delta link
            var newDeltaLink = deltaResponse?.OdataDeltaLink;
            if (!string.IsNullOrEmpty(newDeltaLink))
            {
                folder.SyncState = newDeltaLink;
                folder.LastSynced = DateTime.UtcNow;
                await _secureStorage.StoreAsync($"folder_sync_{folder.Id}", folder);
            }

            result.Success = true;
            Debug.WriteLine($"[EmailSync] Delta sync: {result.NewMessages} new, {result.UpdatedMessages} updated, {result.DeletedMessages} deleted");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSync] Delta sync error: {ex.Message}");
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Map Graph Message to SyncedMessage
    /// </summary>
    private SyncedMessage MapGraphMessage(Message msg, Guid accountId, Guid folderId)
    {
        // Extract body content based on content type
        string? bodyHtml = null;
        string? bodyText = null;
        if (msg.Body != null)
        {
            if (msg.Body.ContentType == BodyType.Html)
            {
                bodyHtml = msg.Body.Content;
            }
            else
            {
                bodyText = msg.Body.Content;
            }
        }

        return new SyncedMessage
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FolderId = folderId,
            RemoteMessageId = msg.Id ?? "",
            Subject = msg.Subject ?? "(No Subject)",
            SenderEmail = msg.From?.EmailAddress?.Address ?? "",
            SenderName = msg.From?.EmailAddress?.Name ?? msg.From?.EmailAddress?.Address ?? "",
            ToRecipients = msg.ToRecipients?.Select(r => r.EmailAddress?.Address ?? "").ToList() ?? new List<string>(),
            CcRecipients = msg.CcRecipients?.Select(r => r.EmailAddress?.Address ?? "").ToList() ?? new List<string>(),
            ReceivedAt = msg.ReceivedDateTime?.DateTime ?? DateTime.UtcNow,
            SentAt = msg.SentDateTime?.DateTime,
            IsRead = msg.IsRead ?? false,
            IsDraft = msg.IsDraft ?? false,
            IsFlagged = msg.Flag?.FlagStatus == FollowupFlagStatus.Flagged,
            Importance = MapImportance(msg.Importance),
            HasAttachments = msg.HasAttachments ?? false,
            BodyPreview = msg.BodyPreview ?? "",
            BodyHtml = bodyHtml,
            BodyText = bodyText,
            SyncedAt = DateTime.UtcNow
        };
    }

    #endregion

    #region IMAP Sync

    /// <summary>
    /// Initial sync using IMAP
    /// </summary>
    private async Task<EmailSyncResult> InitialSyncImapFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        ImapClient imapClient,
        int maxMessages,
        CancellationToken cancellationToken)
    {
        var result = new EmailSyncResult { SyncTime = DateTime.UtcNow };
        var messages = new List<SyncedMessage>();

        try
        {
            RaiseProgress($"Syncing {folder.FolderName}...", 0, folder.MessageCount);

            // Get the folder
            var imapFolder = await imapClient.GetFolderAsync(folder.RemoteFolderId, cancellationToken);
            await imapFolder.OpenAsync(FolderAccess.ReadOnly, cancellationToken);

            // Store UIDVALIDITY for incremental sync
            folder.SyncState = imapFolder.UidValidity.ToString();

            // Get message UIDs (newest first)
            var uids = await imapFolder.SearchAsync(ImapSearchQuery.All, cancellationToken);
            var sortedUids = uids.OrderByDescending(u => u.Id).Take(maxMessages).ToList();

            Debug.WriteLine($"[EmailSync] Found {uids.Count} messages, syncing {sortedUids.Count}");

            int processed = 0;
            const int batchSize = 25;

            // Fetch messages in batches
            for (int i = 0; i < sortedUids.Count; i += batchSize)
            {
                if (cancellationToken.IsCancellationRequested) break;

                var batch = sortedUids.Skip(i).Take(batchSize).ToList();
                var uidSet = new UniqueIdSet(batch);

                // Fetch message summaries (headers and flags)
                var summaries = await imapFolder.FetchAsync(
                    uidSet,
                    MessageSummaryItems.UniqueId |
                    MessageSummaryItems.Envelope |
                    MessageSummaryItems.Flags |
                    MessageSummaryItems.Size |
                    MessageSummaryItems.PreviewText |
                    MessageSummaryItems.BodyStructure,
                    cancellationToken);

                foreach (var summary in summaries)
                {
                    var syncedMessage = MapImapMessage(summary, account.Id, folder.Id);

                    // Fetch full message body for proper HTML display
                    try
                    {
                        var mimeMessage = await imapFolder.GetMessageAsync(summary.UniqueId, cancellationToken);
                        if (mimeMessage.HtmlBody != null)
                        {
                            syncedMessage.BodyHtml = mimeMessage.HtmlBody;
                        }
                        if (mimeMessage.TextBody != null)
                        {
                            syncedMessage.BodyText = mimeMessage.TextBody;
                        }
                    }
                    catch (Exception ex)
                    {
                        Debug.WriteLine($"[EmailSync] Failed to fetch body for message {summary.UniqueId}: {ex.Message}");
                    }

                    messages.Add(syncedMessage);
                    processed++;
                    result.NewMessages++;
                }

                RaiseProgress($"Syncing {folder.FolderName}...", processed, sortedUids.Count);
            }

            await imapFolder.CloseAsync();

            // Store highest UID for incremental sync
            if (sortedUids.Any())
            {
                folder.SyncState = $"{imapFolder.UidValidity}:{sortedUids.Max(u => u.Id)}";
            }

            await _secureStorage.StoreAsync($"folder_sync_{folder.Id}", folder);

            // Store messages locally
            await StoreSyncedMessagesAsync(account.Id, folder.Id, messages);

            result.Success = true;
            RaiseProgress($"Synced {processed} messages from {folder.FolderName}", processed, processed);

            Debug.WriteLine($"[EmailSync] IMAP sync completed: {result.NewMessages} messages");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSync] IMAP sync error: {ex.Message}");
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Incremental sync using IMAP UID
    /// </summary>
    private async Task<EmailSyncResult> IncrementalSyncImapFolderAsync(
        SyncedEmailAccount account,
        SyncedEmailFolder folder,
        ImapClient imapClient,
        CancellationToken cancellationToken)
    {
        var result = new EmailSyncResult { SyncTime = DateTime.UtcNow };

        try
        {
            // Load stored sync state
            var storedFolder = await _secureStorage.RetrieveAsync<SyncedEmailFolder>($"folder_sync_{folder.Id}");
            var syncState = storedFolder?.SyncState ?? folder.SyncState;

            if (string.IsNullOrEmpty(syncState))
            {
                Debug.WriteLine("[EmailSync] No sync state found, performing initial sync");
                return await InitialSyncImapFolderAsync(account, folder, imapClient, 100, cancellationToken);
            }

            // Parse sync state (format: "UIDVALIDITY:LASTUID")
            var parts = syncState.Split(':');
            if (parts.Length != 2 ||
                !uint.TryParse(parts[0], out var storedUidValidity) ||
                !uint.TryParse(parts[1], out var lastUid))
            {
                return await InitialSyncImapFolderAsync(account, folder, imapClient, 100, cancellationToken);
            }

            var imapFolder = await imapClient.GetFolderAsync(folder.RemoteFolderId, cancellationToken);
            await imapFolder.OpenAsync(FolderAccess.ReadOnly, cancellationToken);

            // Check if UIDVALIDITY changed (folder was recreated - need full sync)
            if (imapFolder.UidValidity != storedUidValidity)
            {
                Debug.WriteLine("[EmailSync] UIDVALIDITY changed, performing full sync");
                await imapFolder.CloseAsync();
                return await InitialSyncImapFolderAsync(account, folder, imapClient, 500, cancellationToken);
            }

            RaiseProgress($"Checking for new messages in {folder.FolderName}...", 0, 0);

            // Search for messages with UID > lastUid
            var newUids = await imapFolder.SearchAsync(
                ImapSearchQuery.Uids(new UniqueIdRange(new UniqueId(lastUid + 1), UniqueId.MaxValue)),
                cancellationToken);

            var messages = new List<SyncedMessage>();

            if (newUids.Count > 0)
            {
                Debug.WriteLine($"[EmailSync] Found {newUids.Count} new messages");

                var summaries = await imapFolder.FetchAsync(
                    newUids,
                    MessageSummaryItems.UniqueId |
                    MessageSummaryItems.Envelope |
                    MessageSummaryItems.Flags |
                    MessageSummaryItems.Size |
                    MessageSummaryItems.PreviewText,
                    cancellationToken);

                foreach (var summary in summaries)
                {
                    var syncedMessage = MapImapMessage(summary, account.Id, folder.Id);
                    messages.Add(syncedMessage);
                    result.NewMessages++;
                }

                // Store new messages
                await StoreSyncedMessagesAsync(account.Id, folder.Id, messages);

                // Update sync state with new highest UID
                folder.SyncState = $"{imapFolder.UidValidity}:{newUids.Max(u => u.Id)}";
            }

            // Check for flag changes on recent messages (last 50)
            var recentUids = await imapFolder.SearchAsync(ImapSearchQuery.All, cancellationToken);
            var checkUids = recentUids.OrderByDescending(u => u.Id).Take(50).ToList();

            if (checkUids.Any())
            {
                var flagSummaries = await imapFolder.FetchAsync(
                    checkUids,
                    MessageSummaryItems.UniqueId | MessageSummaryItems.Flags,
                    cancellationToken);

                foreach (var summary in flagSummaries)
                {
                    // Check if flags changed (would need to compare with stored flags)
                    // This is a simplified version - in production, compare with local storage
                }
            }

            await imapFolder.CloseAsync();

            folder.LastSynced = DateTime.UtcNow;
            await _secureStorage.StoreAsync($"folder_sync_{folder.Id}", folder);

            result.Success = true;
            Debug.WriteLine($"[EmailSync] Incremental sync: {result.NewMessages} new messages");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSync] Incremental sync error: {ex.Message}");
            result.Success = false;
            result.ErrorMessage = ex.Message;
        }

        return result;
    }

    /// <summary>
    /// Map IMAP message summary to SyncedMessage
    /// </summary>
    private SyncedMessage MapImapMessage(IMessageSummary summary, Guid accountId, Guid folderId)
    {
        var envelope = summary.Envelope;
        var flags = summary.Flags ?? MessageFlags.None;

        return new SyncedMessage
        {
            Id = Guid.NewGuid(),
            AccountId = accountId,
            FolderId = folderId,
            RemoteMessageId = summary.UniqueId.ToString(),
            Subject = envelope?.Subject ?? "(No Subject)",
            SenderEmail = envelope?.From?.Mailboxes.FirstOrDefault()?.Address ?? "",
            SenderName = envelope?.From?.Mailboxes.FirstOrDefault()?.Name ??
                        envelope?.From?.Mailboxes.FirstOrDefault()?.Address ?? "",
            ToRecipients = envelope?.To?.Mailboxes.Select(m => m.Address).ToList() ?? new List<string>(),
            CcRecipients = envelope?.Cc?.Mailboxes.Select(m => m.Address).ToList() ?? new List<string>(),
            ReceivedAt = envelope?.Date?.DateTime ?? DateTime.UtcNow,
            SentAt = envelope?.Date?.DateTime,
            IsRead = flags.HasFlag(MessageFlags.Seen),
            IsDraft = flags.HasFlag(MessageFlags.Draft),
            IsFlagged = flags.HasFlag(MessageFlags.Flagged),
            Importance = flags.HasFlag(MessageFlags.Flagged) ? MessageImportance.High : MessageImportance.Normal,
            HasAttachments = summary.Attachments?.Any() ?? false,
            BodyPreview = summary.PreviewText ?? "",
            MessageSize = (int)summary.Size,
            SyncedAt = DateTime.UtcNow
        };
    }

    #endregion

    #region Message Body Fetch

    /// <summary>
    /// Fetch the full body of a message on demand
    /// </summary>
    public async Task<(string? bodyHtml, string? bodyText)> FetchMessageBodyAsync(
        SyncedEmailAccount account,
        SyncedMessage message,
        ConnectionResult connection,
        CancellationToken cancellationToken = default)
    {
        Debug.WriteLine($"[EmailSync] Fetching body for message: {message.Subject}");

        try
        {
            return connection.ConnectionType switch
            {
                ConnectionType.MicrosoftGraph when connection.GraphClient != null =>
                    await FetchGraphMessageBodyAsync(message.RemoteMessageId, connection.GraphClient, cancellationToken),
                ConnectionType.IMAP when connection.ImapClient != null =>
                    await FetchImapMessageBodyAsync(account, message, connection.ImapClient, cancellationToken),
                _ => (null, null)
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSync] Error fetching message body: {ex.Message}");
            return (null, null);
        }
    }

    /// <summary>
    /// Fetch message body using Microsoft Graph
    /// </summary>
    private async Task<(string? bodyHtml, string? bodyText)> FetchGraphMessageBodyAsync(
        string messageId,
        GraphServiceClient graphClient,
        CancellationToken cancellationToken)
    {
        var message = await graphClient.Me.Messages[messageId].GetAsync(config =>
        {
            config.QueryParameters.Select = new[] { "body" };
        }, cancellationToken);

        if (message?.Body != null)
        {
            if (message.Body.ContentType == BodyType.Html)
            {
                return (message.Body.Content, null);
            }
            else
            {
                return (null, message.Body.Content);
            }
        }

        return (null, null);
    }

    /// <summary>
    /// Fetch message body using IMAP
    /// </summary>
    private async Task<(string? bodyHtml, string? bodyText)> FetchImapMessageBodyAsync(
        SyncedEmailAccount account,
        SyncedMessage message,
        ImapClient imapClient,
        CancellationToken cancellationToken)
    {
        // Find the folder this message belongs to
        var folder = await _secureStorage.RetrieveAsync<SyncedEmailFolder>($"folder_sync_{message.FolderId}");
        if (folder == null)
        {
            Debug.WriteLine("[EmailSync] Folder not found for message");
            return (null, null);
        }

        var imapFolder = await imapClient.GetFolderAsync(folder.RemoteFolderId, cancellationToken);
        await imapFolder.OpenAsync(FolderAccess.ReadOnly, cancellationToken);

        try
        {
            // Parse the UID from the remote message ID
            if (!uint.TryParse(message.RemoteMessageId, out var uidValue))
            {
                Debug.WriteLine($"[EmailSync] Invalid message UID: {message.RemoteMessageId}");
                return (null, null);
            }

            var uid = new UniqueId(uidValue);

            // Fetch the full message
            var mimeMessage = await imapFolder.GetMessageAsync(uid, cancellationToken);

            string? bodyHtml = null;
            string? bodyText = null;

            if (mimeMessage.HtmlBody != null)
            {
                bodyHtml = mimeMessage.HtmlBody;
            }

            if (mimeMessage.TextBody != null)
            {
                bodyText = mimeMessage.TextBody;
            }

            Debug.WriteLine($"[EmailSync] Fetched body: HTML={bodyHtml?.Length ?? 0} chars, Text={bodyText?.Length ?? 0} chars");

            return (bodyHtml, bodyText);
        }
        finally
        {
            await imapFolder.CloseAsync();
        }
    }

    #endregion

    #region Helper Methods

    /// <summary>
    /// Map Graph importance to local enum
    /// </summary>
    private MessageImportance MapImportance(Importance? importance)
    {
        return importance switch
        {
            Importance.High => MessageImportance.High,
            Importance.Low => MessageImportance.Low,
            _ => MessageImportance.Normal
        };
    }

    /// <summary>
    /// Store synced messages locally (placeholder for database integration)
    /// </summary>
    private async Task StoreSyncedMessagesAsync(Guid accountId, Guid folderId, List<SyncedMessage> messages)
    {
        // This will be replaced with actual database storage
        // For now, store in secure storage as JSON
        var key = $"messages_{accountId}_{folderId}";
        var existing = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(key) ?? new List<SyncedMessage>();
        existing.AddRange(messages);

        // Keep only the most recent 1000 messages per folder in local cache
        var toStore = existing.OrderByDescending(m => m.ReceivedAt).Take(1000).ToList();
        await _secureStorage.StoreAsync(key, toStore);

        Debug.WriteLine($"[EmailSync] Stored {messages.Count} messages locally (total: {toStore.Count})");
    }

    /// <summary>
    /// Check if a message exists locally
    /// </summary>
    private async Task<bool> MessageExistsAsync(Guid accountId, string remoteMessageId)
    {
        // Placeholder - will be replaced with database query
        return await Task.FromResult(false);
    }

    /// <summary>
    /// Update an existing synced message
    /// </summary>
    private async Task UpdateSyncedMessageAsync(SyncedMessage message)
    {
        // Placeholder - will be replaced with database update
        await Task.CompletedTask;
    }

    /// <summary>
    /// Delete a synced message
    /// </summary>
    private async Task DeleteSyncedMessageAsync(Guid accountId, string remoteMessageId)
    {
        // Placeholder - will be replaced with database delete
        await Task.CompletedTask;
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
}

/// <summary>
/// Synced email message model
/// </summary>
public class SyncedMessage
{
    public Guid Id { get; set; }
    public Guid AccountId { get; set; }
    public Guid FolderId { get; set; }
    public string RemoteMessageId { get; set; } = string.Empty;
    public string Subject { get; set; } = string.Empty;
    public string SenderEmail { get; set; } = string.Empty;
    public string SenderName { get; set; } = string.Empty;
    public List<string> ToRecipients { get; set; } = new();
    public List<string> CcRecipients { get; set; } = new();
    public DateTime ReceivedAt { get; set; }
    public DateTime? SentAt { get; set; }
    public bool IsRead { get; set; }
    public bool IsDraft { get; set; }
    public bool IsFlagged { get; set; }
    public MessageImportance Importance { get; set; }
    public bool HasAttachments { get; set; }
    public string BodyPreview { get; set; } = string.Empty;
    public string? BodyHtml { get; set; }
    public string? BodyText { get; set; }
    public int MessageSize { get; set; }
    public DateTime SyncedAt { get; set; }
}

/// <summary>
/// Message importance level
/// </summary>
public enum MessageImportance
{
    Low,
    Normal,
    High
}

/// <summary>
/// Sync progress event arguments
/// </summary>
public class SyncProgressEventArgs : EventArgs
{
    public string Message { get; set; } = string.Empty;
    public int CurrentItem { get; set; }
    public int TotalItems { get; set; }
    public int PercentComplete { get; set; }
}
