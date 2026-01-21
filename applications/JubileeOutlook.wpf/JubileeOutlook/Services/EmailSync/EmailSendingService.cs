using System.Diagnostics;
using System.IO;
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
        List<EmailAttachmentInfo>? attachments = null)
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
                attachments);

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
        List<EmailAttachmentInfo>? attachments)
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
/// Information about an email attachment
/// </summary>
public class EmailAttachmentInfo
{
    public string FileName { get; set; } = string.Empty;
    public string FilePath { get; set; } = string.Empty;
    public string? ContentType { get; set; }
    public long FileSize { get; set; }
}
