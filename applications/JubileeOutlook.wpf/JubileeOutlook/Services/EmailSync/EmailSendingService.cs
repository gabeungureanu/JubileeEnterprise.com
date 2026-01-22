using System.Diagnostics;
using System.IO;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Net.Smtp;
using MailKit.Security;
using MimeKit;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service for sending emails via SMTP using synced account credentials
/// Supports OAuth2 and App Password authentication
/// </summary>
public class EmailSendingService
{
    private readonly SecureStorageService _secureStorage;
    private readonly SyncedEmailDisplayService _syncedEmailService;

    public EmailSendingService()
    {
        _secureStorage = new SecureStorageService();
        _syncedEmailService = new SyncedEmailDisplayService();
    }

    /// <summary>
    /// Send an email using the synced account's SMTP settings
    /// </summary>
    public async Task<EmailSendResult> SendEmailAsync(
        string fromEmail,
        List<string> toRecipients,
        List<string> ccRecipients,
        List<string> bccRecipients,
        string subject,
        string body,
        bool isHtml,
        List<EmailAttachmentInfo>? attachments = null,
        List<EmbeddedImageInfo>? embeddedImages = null)
    {
        Debug.WriteLine($"[EmailSendingService] Starting to send email from {fromEmail}");

        try
        {
            // Find the synced account for this email address
            var accounts = await _syncedEmailService.GetSyncedAccountsAsync();
            var account = accounts.FirstOrDefault(a =>
                a.EmailAddress.Equals(fromEmail, StringComparison.OrdinalIgnoreCase));

            if (account == null)
            {
                Debug.WriteLine($"[EmailSendingService] No synced account found for {fromEmail}");
                return new EmailSendResult
                {
                    Success = false,
                    ErrorMessage = $"No configured email account found for {fromEmail}. Please add this account in settings."
                };
            }

            Debug.WriteLine($"[EmailSendingService] Found account: {account.EmailAddress}, Provider: {account.ProviderType}");

            // Get stored credentials
            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{account.Id}");
            if (credentials == null)
            {
                Debug.WriteLine($"[EmailSendingService] No credentials found for account {account.Id}");
                return new EmailSendResult
                {
                    Success = false,
                    ErrorMessage = "Authentication credentials not found. Please re-authenticate the account."
                };
            }

            // Build the email message
            var message = BuildMimeMessage(
                fromEmail,
                account.DisplayName ?? fromEmail,
                toRecipients,
                ccRecipients,
                bccRecipients,
                subject,
                body,
                isHtml,
                attachments,
                embeddedImages);

            // Send via SMTP
            var result = await SendViaSMTPAsync(account, credentials, message);

            return result;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error sending email: {ex.Message}");
            return new EmailSendResult
            {
                Success = false,
                ErrorMessage = $"Failed to send email: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Build a MimeMessage from the email components
    /// </summary>
    private MimeMessage BuildMimeMessage(
        string fromEmail,
        string fromName,
        List<string> toRecipients,
        List<string> ccRecipients,
        List<string> bccRecipients,
        string subject,
        string body,
        bool isHtml,
        List<EmailAttachmentInfo>? attachments,
        List<EmbeddedImageInfo>? embeddedImages)
    {
        var message = new MimeMessage();

        // Set From
        message.From.Add(new MailboxAddress(fromName, fromEmail));

        // Set To recipients
        foreach (var to in toRecipients.Where(e => !string.IsNullOrWhiteSpace(e)))
        {
            message.To.Add(MailboxAddress.Parse(to.Trim()));
        }

        // Set Cc recipients
        foreach (var cc in ccRecipients.Where(e => !string.IsNullOrWhiteSpace(e)))
        {
            message.Cc.Add(MailboxAddress.Parse(cc.Trim()));
        }

        // Set Bcc recipients
        foreach (var bcc in bccRecipients.Where(e => !string.IsNullOrWhiteSpace(e)))
        {
            message.Bcc.Add(MailboxAddress.Parse(bcc.Trim()));
        }

        // Set Subject
        message.Subject = subject ?? "(No Subject)";

        // Build body with optional attachments
        var builder = new BodyBuilder();

        if (isHtml)
        {
            builder.HtmlBody = body;
        }
        else
        {
            builder.TextBody = body;
        }

        // Add embedded images as linked resources (for CID references in HTML)
        if (embeddedImages != null && embeddedImages.Count > 0)
        {
            foreach (var embeddedImage in embeddedImages)
            {
                if (File.Exists(embeddedImage.FilePath))
                {
                    Debug.WriteLine($"[EmailSendingService] Adding embedded image: {embeddedImage.FileName} with CID: {embeddedImage.ContentId}");
                    var image = builder.LinkedResources.Add(embeddedImage.FilePath);
                    image.ContentId = embeddedImage.ContentId;
                    image.ContentDisposition = new MimeKit.ContentDisposition(MimeKit.ContentDisposition.Inline);
                }
                else
                {
                    Debug.WriteLine($"[EmailSendingService] Embedded image file not found: {embeddedImage.FilePath}");
                }
            }
        }

        // Add attachments
        if (attachments != null && attachments.Count > 0)
        {
            foreach (var attachment in attachments)
            {
                if (File.Exists(attachment.FilePath))
                {
                    Debug.WriteLine($"[EmailSendingService] Adding attachment: {attachment.FileName}");
                    builder.Attachments.Add(attachment.FilePath);
                }
                else
                {
                    Debug.WriteLine($"[EmailSendingService] Attachment file not found: {attachment.FilePath}");
                }
            }
        }

        message.Body = builder.ToMessageBody();

        return message;
    }

    /// <summary>
    /// Send the email via SMTP
    /// </summary>
    private async Task<EmailSendResult> SendViaSMTPAsync(
        SyncedEmailAccount account,
        EmailAccountCredentials credentials,
        MimeMessage message)
    {
        Debug.WriteLine($"[EmailSendingService] Connecting to SMTP: {account.SmtpHost}:{account.SmtpPort}");

        using var client = new SmtpClient();

        try
        {
            // Get SMTP settings based on provider
            var (host, port, useSsl) = GetSmtpSettings(account);

            // Connect to SMTP server
            var secureSocketOptions = useSsl ? SecureSocketOptions.StartTls : SecureSocketOptions.Auto;
            await client.ConnectAsync(host, port, secureSocketOptions);

            Debug.WriteLine($"[EmailSendingService] Connected to SMTP server");

            // Authenticate based on method
            if (account.AuthMethod == AuthenticationMethod.OAuth2)
            {
                // OAuth2 authentication
                if (string.IsNullOrEmpty(credentials.AccessToken))
                {
                    return new EmailSendResult
                    {
                        Success = false,
                        ErrorMessage = "OAuth2 access token is missing. Please re-authenticate."
                    };
                }

                // Check if token needs refresh
                if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value <= DateTime.UtcNow)
                {
                    Debug.WriteLine($"[EmailSendingService] Token expired, attempting refresh...");
                    var refreshed = await RefreshOAuth2TokenAsync(account, credentials);
                    if (!refreshed)
                    {
                        return new EmailSendResult
                        {
                            Success = false,
                            ErrorMessage = "OAuth2 token expired and refresh failed. Please re-authenticate."
                        };
                    }
                }

                var oauth2 = new SaslMechanismOAuth2(account.EmailAddress, credentials.AccessToken);
                await client.AuthenticateAsync(oauth2);
            }
            else
            {
                // App Password / Basic authentication
                var password = DecryptPassword(credentials.EncryptedPassword);
                if (string.IsNullOrEmpty(password))
                {
                    return new EmailSendResult
                    {
                        Success = false,
                        ErrorMessage = "Password not found. Please re-enter your app password."
                    };
                }

                await client.AuthenticateAsync(account.EmailAddress, password);
            }

            Debug.WriteLine($"[EmailSendingService] SMTP authentication successful");

            // Send the message
            await client.SendAsync(message);

            Debug.WriteLine($"[EmailSendingService] Email sent successfully!");

            // Disconnect
            await client.DisconnectAsync(true);

            return new EmailSendResult
            {
                Success = true,
                MessageId = message.MessageId
            };
        }
        catch (AuthenticationException ex)
        {
            Debug.WriteLine($"[EmailSendingService] SMTP authentication failed: {ex.Message}");
            return new EmailSendResult
            {
                Success = false,
                ErrorMessage = $"Authentication failed: {ex.Message}. Please check your credentials."
            };
        }
        catch (SmtpCommandException ex)
        {
            Debug.WriteLine($"[EmailSendingService] SMTP command error: {ex.Message}");
            return new EmailSendResult
            {
                Success = false,
                ErrorMessage = $"SMTP error: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] SMTP error: {ex.Message}");
            return new EmailSendResult
            {
                Success = false,
                ErrorMessage = $"Failed to send: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Get SMTP settings based on the email provider
    /// </summary>
    private (string host, int port, bool useSsl) GetSmtpSettings(SyncedEmailAccount account)
    {
        // Use account-specific settings if available
        if (!string.IsNullOrEmpty(account.SmtpHost))
        {
            return (account.SmtpHost, account.SmtpPort, true);
        }

        // Default settings based on provider
        return account.ProviderType switch
        {
            EmailProviderType.Google => ("smtp.gmail.com", 587, true),
            EmailProviderType.Microsoft => ("smtp.office365.com", 587, true),
            EmailProviderType.Yahoo => ("smtp.mail.yahoo.com", 587, true),
            EmailProviderType.Apple => ("smtp.mail.me.com", 587, true),
            EmailProviderType.GenericIMAP => (account.SmtpHost ?? "smtp.gmail.com", account.SmtpPort > 0 ? account.SmtpPort : 587, true),
            _ => ("smtp.gmail.com", 587, true) // Default fallback
        };
    }

    /// <summary>
    /// Decrypt the stored password using SecureStorageService
    /// </summary>
    private string? DecryptPassword(string? encryptedPassword)
    {
        if (string.IsNullOrEmpty(encryptedPassword))
            return null;

        try
        {
            // Use the SecureStorageService to properly decrypt the password
            return _secureStorage.DecryptPassword(encryptedPassword);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Password decryption failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Save a draft email to the IMAP Drafts folder
    /// </summary>
    public async Task<DraftSaveResult> SaveDraftAsync(
        string fromEmail,
        List<string> toRecipients,
        List<string> ccRecipients,
        List<string> bccRecipients,
        string subject,
        string body,
        bool isHtml,
        string? existingDraftId = null,
        List<EmailAttachmentInfo>? attachments = null,
        List<EmbeddedImageInfo>? embeddedImages = null)
    {
        Debug.WriteLine($"[EmailSendingService] Saving draft from {fromEmail}");

        try
        {
            // Find the synced account for this email address
            var accounts = await _syncedEmailService.GetSyncedAccountsAsync();
            var account = accounts.FirstOrDefault(a =>
                a.EmailAddress.Equals(fromEmail, StringComparison.OrdinalIgnoreCase));

            if (account == null)
            {
                Debug.WriteLine($"[EmailSendingService] No synced account found for {fromEmail}");
                return new DraftSaveResult
                {
                    Success = false,
                    ErrorMessage = $"No configured email account found for {fromEmail}."
                };
            }

            // Get stored credentials
            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{account.Id}");
            if (credentials == null)
            {
                return new DraftSaveResult
                {
                    Success = false,
                    ErrorMessage = "Authentication credentials not found."
                };
            }

            // Build the draft message with embedded images
            var message = BuildMimeMessage(
                fromEmail,
                account.DisplayName ?? fromEmail,
                toRecipients,
                ccRecipients,
                bccRecipients,
                subject,
                body,
                isHtml,
                attachments,
                embeddedImages);

            // Mark as draft
            message.Headers.Add("X-Draft", "true");

            // Save to IMAP Drafts folder
            var result = await SaveDraftToImapAsync(account, credentials, message, existingDraftId);

            return result;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error saving draft: {ex.Message}");
            return new DraftSaveResult
            {
                Success = false,
                ErrorMessage = $"Failed to save draft: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Delete a draft from the IMAP Drafts folder
    /// </summary>
    public async Task<bool> DeleteDraftAsync(string fromEmail, string draftId)
    {
        Debug.WriteLine($"[EmailSendingService] Deleting draft {draftId} for {fromEmail}");

        try
        {
            // Find the synced account for this email address
            var accounts = await _syncedEmailService.GetSyncedAccountsAsync();
            var account = accounts.FirstOrDefault(a =>
                a.EmailAddress.Equals(fromEmail, StringComparison.OrdinalIgnoreCase));

            if (account == null)
            {
                Debug.WriteLine($"[EmailSendingService] No synced account found for {fromEmail}");
                return false;
            }

            // Get stored credentials
            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{account.Id}");
            if (credentials == null)
            {
                Debug.WriteLine($"[EmailSendingService] No credentials found for account");
                return false;
            }

            // Delete from IMAP Drafts folder
            return await DeleteDraftFromImapAsync(account, credentials, draftId);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error deleting draft: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Delete a draft from IMAP Drafts folder
    /// </summary>
    private async Task<bool> DeleteDraftFromImapAsync(
        SyncedEmailAccount account,
        EmailAccountCredentials credentials,
        string draftId)
    {
        Debug.WriteLine($"[EmailSendingService] Connecting to IMAP to delete draft: {draftId}");

        using var client = new ImapClient();

        try
        {
            // Get IMAP settings
            var host = account.ImapHost ?? GetDefaultImapHost(account.ProviderType);
            var port = account.ImapPort > 0 ? account.ImapPort : 993;

            // Connect to IMAP server
            await client.ConnectAsync(host, port, SecureSocketOptions.SslOnConnect);

            // Authenticate
            if (account.AuthMethod == AuthenticationMethod.OAuth2)
            {
                if (string.IsNullOrEmpty(credentials.AccessToken))
                    return false;

                if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value <= DateTime.UtcNow)
                {
                    var refreshed = await RefreshOAuth2TokenAsync(account, credentials);
                    if (!refreshed) return false;
                }

                var oauth2 = new SaslMechanismOAuth2(account.EmailAddress, credentials.AccessToken);
                await client.AuthenticateAsync(oauth2);
            }
            else
            {
                var password = DecryptPassword(credentials.EncryptedPassword);
                if (string.IsNullOrEmpty(password)) return false;
                await client.AuthenticateAsync(account.EmailAddress, password);
            }

            // Find the Drafts folder
            var draftsFolder = await FindDraftsFolderAsync(client);
            if (draftsFolder == null)
            {
                Debug.WriteLine($"[EmailSendingService] Drafts folder not found");
                return false;
            }

            await draftsFolder.OpenAsync(FolderAccess.ReadWrite);

            // Delete the draft by UID
            if (uint.TryParse(draftId, out var uid))
            {
                var uniqueId = new UniqueId(uid);
                await draftsFolder.AddFlagsAsync(uniqueId, MessageFlags.Deleted, true);
                await draftsFolder.ExpungeAsync();
                Debug.WriteLine($"[EmailSendingService] Draft {draftId} deleted from server");
            }

            await draftsFolder.CloseAsync();
            await client.DisconnectAsync(true);

            // Also remove from local cache
            await RemoveDraftFromLocalCacheAsync(account.Id, draftId);

            return true;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error deleting draft from IMAP: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Remove a draft from the local cache
    /// </summary>
    private async Task RemoveDraftFromLocalCacheAsync(Guid accountId, string draftId)
    {
        try
        {
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            var draftsFolder = folders?.FirstOrDefault(f => f.FolderType == FolderType.Drafts);

            if (draftsFolder == null) return;

            var draftsKey = $"messages_{accountId}_{draftsFolder.Id}";
            var draftMessages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(draftsKey);

            if (draftMessages != null)
            {
                draftMessages.RemoveAll(m => m.RemoteMessageId == draftId);
                await _secureStorage.StoreAsync(draftsKey, draftMessages);
                Debug.WriteLine($"[EmailSendingService] Draft removed from local cache");
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error removing draft from local cache: {ex.Message}");
        }
    }

    /// <summary>
    /// Save draft to IMAP Drafts folder
    /// </summary>
    private async Task<DraftSaveResult> SaveDraftToImapAsync(
        SyncedEmailAccount account,
        EmailAccountCredentials credentials,
        MimeMessage message,
        string? existingDraftId)
    {
        Debug.WriteLine($"[EmailSendingService] Connecting to IMAP: {account.ImapHost}:{account.ImapPort}");

        using var client = new ImapClient();

        try
        {
            // Get IMAP settings
            var host = account.ImapHost ?? GetDefaultImapHost(account.ProviderType);
            var port = account.ImapPort > 0 ? account.ImapPort : 993;

            // Connect to IMAP server
            await client.ConnectAsync(host, port, SecureSocketOptions.SslOnConnect);
            Debug.WriteLine($"[EmailSendingService] Connected to IMAP server");

            // Authenticate
            if (account.AuthMethod == AuthenticationMethod.OAuth2)
            {
                if (string.IsNullOrEmpty(credentials.AccessToken))
                {
                    return new DraftSaveResult
                    {
                        Success = false,
                        ErrorMessage = "OAuth2 access token is missing."
                    };
                }

                // Check if token needs refresh
                if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value <= DateTime.UtcNow)
                {
                    var refreshed = await RefreshOAuth2TokenAsync(account, credentials);
                    if (!refreshed)
                    {
                        return new DraftSaveResult
                        {
                            Success = false,
                            ErrorMessage = "OAuth2 token expired and refresh failed."
                        };
                    }
                }

                var oauth2 = new SaslMechanismOAuth2(account.EmailAddress, credentials.AccessToken);
                await client.AuthenticateAsync(oauth2);
            }
            else
            {
                var password = DecryptPassword(credentials.EncryptedPassword);
                if (string.IsNullOrEmpty(password))
                {
                    return new DraftSaveResult
                    {
                        Success = false,
                        ErrorMessage = "Password not found."
                    };
                }

                await client.AuthenticateAsync(account.EmailAddress, password);
            }

            Debug.WriteLine($"[EmailSendingService] IMAP authentication successful");

            // Find the Drafts folder
            var draftsFolder = await FindDraftsFolderAsync(client);
            if (draftsFolder == null)
            {
                return new DraftSaveResult
                {
                    Success = false,
                    ErrorMessage = "Could not find Drafts folder on server."
                };
            }

            await draftsFolder.OpenAsync(FolderAccess.ReadWrite);

            // If updating existing draft, delete the old one first
            if (!string.IsNullOrEmpty(existingDraftId) && uint.TryParse(existingDraftId, out var oldUid))
            {
                try
                {
                    var oldUniqueId = new UniqueId(oldUid);
                    await draftsFolder.AddFlagsAsync(oldUniqueId, MessageFlags.Deleted, true);
                    await draftsFolder.ExpungeAsync();
                    Debug.WriteLine($"[EmailSendingService] Deleted old draft: {existingDraftId}");
                }
                catch (Exception ex)
                {
                    Debug.WriteLine($"[EmailSendingService] Could not delete old draft: {ex.Message}");
                    // Continue anyway - we'll just append the new draft
                }
            }

            // Append the new draft with Draft flag
            var uid = await draftsFolder.AppendAsync(message, MessageFlags.Draft | MessageFlags.Seen);

            Debug.WriteLine($"[EmailSendingService] Draft saved with UID: {uid}");

            await draftsFolder.CloseAsync();
            await client.DisconnectAsync(true);

            // Also update local cache
            await UpdateLocalDraftCacheAsync(account.Id, message, uid?.Id.ToString() ?? Guid.NewGuid().ToString());

            return new DraftSaveResult
            {
                Success = true,
                DraftId = uid?.Id.ToString() ?? Guid.NewGuid().ToString(),
                MessageId = message.MessageId
            };
        }
        catch (AuthenticationException ex)
        {
            Debug.WriteLine($"[EmailSendingService] IMAP authentication failed: {ex.Message}");
            return new DraftSaveResult
            {
                Success = false,
                ErrorMessage = $"Authentication failed: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] IMAP error: {ex.Message}");
            return new DraftSaveResult
            {
                Success = false,
                ErrorMessage = $"Failed to save draft: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Find the Drafts folder on the IMAP server
    /// </summary>
    private async Task<IMailFolder?> FindDraftsFolderAsync(ImapClient client)
    {
        // Try to get from personal namespace first
        var personal = client.GetFolder(client.PersonalNamespaces[0]);

        // Look for standard Drafts folder
        foreach (var folder in await personal.GetSubfoldersAsync())
        {
            if (folder.Attributes.HasFlag(FolderAttributes.Drafts))
            {
                return folder;
            }

            var name = folder.Name.ToLowerInvariant();
            if (name == "drafts" || name == "[gmail]/drafts" || name == "draft")
            {
                return folder;
            }
        }

        // Try Gmail-specific path
        try
        {
            return await client.GetFolderAsync("[Gmail]/Drafts");
        }
        catch { }

        // Try standard "Drafts" name
        try
        {
            return await client.GetFolderAsync("Drafts");
        }
        catch { }

        // Try "INBOX.Drafts" for some servers
        try
        {
            return await client.GetFolderAsync("INBOX.Drafts");
        }
        catch { }

        return null;
    }

    /// <summary>
    /// Update local draft cache after saving
    /// </summary>
    private async Task UpdateLocalDraftCacheAsync(Guid accountId, MimeMessage message, string draftId)
    {
        try
        {
            // Get folders to find drafts folder
            var folders = await _secureStorage.RetrieveAsync<List<SyncedEmailFolder>>($"folders_{accountId}");
            var draftsFolder = folders?.FirstOrDefault(f => f.FolderType == FolderType.Drafts);

            if (draftsFolder == null)
            {
                Debug.WriteLine("[EmailSendingService] Drafts folder not found in local cache");
                return;
            }

            // Get existing drafts
            var draftsKey = $"messages_{accountId}_{draftsFolder.Id}";
            var draftMessages = await _secureStorage.RetrieveAsync<List<SyncedMessage>>(draftsKey) ?? new List<SyncedMessage>();

            // Remove any existing draft with the same ID to prevent duplicates
            draftMessages.RemoveAll(m => m.RemoteMessageId == draftId);

            // Create synced message from MimeMessage
            var syncedDraft = new SyncedMessage
            {
                Id = Guid.NewGuid(),
                AccountId = accountId,
                FolderId = draftsFolder.Id,
                RemoteMessageId = draftId,
                Subject = message.Subject ?? "(No Subject)",
                SenderEmail = message.From.Mailboxes.FirstOrDefault()?.Address ?? "",
                SenderName = message.From.Mailboxes.FirstOrDefault()?.Name ?? "",
                ToRecipients = message.To.Mailboxes.Select(m => m.Address).ToList(),
                CcRecipients = message.Cc.Mailboxes.Select(m => m.Address).ToList(),
                ReceivedAt = DateTime.UtcNow,
                SentAt = null,
                IsRead = true,
                IsDraft = true,
                IsFlagged = false,
                HasAttachments = message.Attachments.Any(),
                BodyPreview = GetBodyPreview(message),
                BodyHtml = message.HtmlBody,
                BodyText = message.TextBody,
                SyncedAt = DateTime.UtcNow
            };

            // Add to cache (at the beginning)
            draftMessages.Insert(0, syncedDraft);
            await _secureStorage.StoreAsync(draftsKey, draftMessages);

            Debug.WriteLine($"[EmailSendingService] Draft added to local cache");
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Error updating local draft cache: {ex.Message}");
        }
    }

    /// <summary>
    /// Get a preview of the message body (plain text, HTML stripped)
    /// </summary>
    private string GetBodyPreview(MimeMessage message)
    {
        // Prefer plain text body, then strip HTML from HTML body
        var text = message.TextBody;
        if (string.IsNullOrEmpty(text) && !string.IsNullOrEmpty(message.HtmlBody))
        {
            // Strip HTML tags from HTML body
            text = System.Text.RegularExpressions.Regex.Replace(message.HtmlBody, "<[^>]+>", " ");
            text = System.Net.WebUtility.HtmlDecode(text);
            text = System.Text.RegularExpressions.Regex.Replace(text, @"\s+", " ").Trim();
        }
        text = text ?? "";
        if (text.Length > 200)
        {
            text = text.Substring(0, 200) + "...";
        }
        return text;
    }

    /// <summary>
    /// Get default IMAP host for provider
    /// </summary>
    private string GetDefaultImapHost(EmailProviderType providerType)
    {
        return providerType switch
        {
            EmailProviderType.Google => "imap.gmail.com",
            EmailProviderType.Microsoft => "outlook.office365.com",
            EmailProviderType.Yahoo => "imap.mail.yahoo.com",
            EmailProviderType.Apple => "imap.mail.me.com",
            _ => "imap.gmail.com"
        };
    }

    /// <summary>
    /// Refresh OAuth2 token if expired
    /// </summary>
    private async Task<bool> RefreshOAuth2TokenAsync(SyncedEmailAccount account, EmailAccountCredentials credentials)
    {
        try
        {
            if (string.IsNullOrEmpty(credentials.RefreshToken))
            {
                Debug.WriteLine($"[EmailSendingService] No refresh token available");
                return false;
            }

            // Use the OAuth2 service to refresh the token
            var oauth2Service = new OAuth2AuthenticationService(_secureStorage);

            // Refresh using provider-specific service
            var refreshResult = await oauth2Service.RefreshTokenAsync(account.Id, account.ProviderType);

            if (refreshResult.Success && !string.IsNullOrEmpty(refreshResult.AccessToken))
            {
                // Update credentials with new token
                credentials.AccessToken = refreshResult.AccessToken;
                credentials.TokenExpiry = refreshResult.TokenExpiry;

                if (!string.IsNullOrEmpty(refreshResult.RefreshToken))
                {
                    credentials.RefreshToken = refreshResult.RefreshToken;
                }

                credentials.UpdatedAt = DateTime.UtcNow;

                // Save updated credentials
                await _secureStorage.StoreAsync($"credentials_{account.Id}", credentials);

                Debug.WriteLine($"[EmailSendingService] Token refreshed successfully");
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[EmailSendingService] Token refresh failed: {ex.Message}");
            return false;
        }
    }
}

/// <summary>
/// Result of an email send operation
/// </summary>
public class EmailSendResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? MessageId { get; set; }
}

/// <summary>
/// Result of a draft save operation
/// </summary>
public class DraftSaveResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public string? DraftId { get; set; }
    public string? MessageId { get; set; }
}

/// <summary>
/// Information about an email attachment
/// </summary>
public class EmailAttachmentInfo
{
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long FileSize { get; set; }
}

/// <summary>
/// Information about an embedded image in the email body
/// </summary>
public class EmbeddedImageInfo
{
    public string ContentId { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
}
