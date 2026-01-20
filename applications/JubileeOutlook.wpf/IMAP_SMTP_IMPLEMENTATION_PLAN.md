# IMAP + SMTP Implementation Plan for JubileeOutlook

## Executive Summary

This document outlines the implementation plan for adding real email read (IMAP) and send (SMTP) functionality to JubileeOutlook. The current architecture fetches emails from a database via HTTP API; this plan adds direct email server connectivity.

---

## Phase 1: Foundation & Dependencies

### 1.1 Install Required NuGet Packages

```xml
<!-- Add to JubileeOutlook.csproj -->
<PackageReference Include="MailKit" Version="4.3.0" />
<PackageReference Include="MimeKit" Version="4.3.0" />
```

**MailKit** provides:
- IMAP client for reading emails
- SMTP client for sending emails
- POP3 client (optional, for legacy servers)
- Modern async/await support
- OAuth2 authentication support

### 1.2 New Models Required

#### EmailAccountCredentials.cs
```csharp
public class EmailAccountCredentials
{
    public string Id { get; set; }
    public string UserId { get; set; }
    public string AccountName { get; set; }
    public string EmailAddress { get; set; }

    // IMAP Settings
    public string ImapServer { get; set; }      // e.g., "imap.gmail.com"
    public int ImapPort { get; set; }           // e.g., 993
    public bool ImapUseSsl { get; set; }        // true for SSL/TLS

    // SMTP Settings
    public string SmtpServer { get; set; }      // e.g., "smtp.gmail.com"
    public int SmtpPort { get; set; }           // e.g., 587 (TLS) or 465 (SSL)
    public bool SmtpUseSsl { get; set; }
    public bool SmtpUseStartTls { get; set; }   // true for port 587

    // Authentication
    public AuthenticationType AuthType { get; set; }
    public string? EncryptedPassword { get; set; }  // For basic auth
    public string? OAuth2AccessToken { get; set; }  // For OAuth2
    public string? OAuth2RefreshToken { get; set; }
    public DateTime? OAuth2TokenExpiry { get; set; }

    // Sync Settings
    public int SyncDays { get; set; } = 30;     // How many days back to sync
    public DateTime? LastSyncTime { get; set; }
    public bool IsEnabled { get; set; } = true;
}

public enum AuthenticationType
{
    Basic,          // Username/Password
    OAuth2,         // Gmail, Outlook.com, Yahoo
    AppPassword     // Gmail app-specific passwords
}
```

#### ImapSyncState.cs
```csharp
public class ImapSyncState
{
    public string FolderId { get; set; }
    public string FolderName { get; set; }
    public uint UidValidity { get; set; }       // IMAP UIDVALIDITY
    public uint LastKnownUid { get; set; }      // Last synced UID
    public DateTime LastSyncTime { get; set; }
    public int MessageCount { get; set; }
}
```

---

## Phase 2: Service Architecture

### 2.1 New Service Interfaces

#### IImapService.cs
```csharp
public interface IImapService
{
    // Connection
    Task<bool> ConnectAsync(EmailAccountCredentials credentials);
    Task DisconnectAsync();
    bool IsConnected { get; }

    // Folders
    Task<List<ImapFolder>> GetFoldersAsync();
    Task<ImapFolder?> GetFolderAsync(string folderPath);

    // Messages
    Task<List<EmailMessage>> GetMessagesAsync(string folderPath, int count = 50, int offset = 0);
    Task<EmailMessage?> GetMessageAsync(string folderPath, uint uid);
    Task<List<EmailMessage>> GetNewMessagesAsync(string folderPath, uint sinceUid);
    Task<byte[]?> GetAttachmentAsync(string folderPath, uint messageUid, string attachmentId);

    // Operations
    Task MarkAsReadAsync(string folderPath, uint uid, bool isRead);
    Task MarkAsFlaggedAsync(string folderPath, uint uid, bool isFlagged);
    Task MoveMessageAsync(string folderPath, uint uid, string targetFolderPath);
    Task DeleteMessageAsync(string folderPath, uint uid, bool permanently = false);

    // Sync
    Task<ImapSyncState> GetSyncStateAsync(string folderPath);
    Task<List<uint>> GetDeletedUidsAsync(string folderPath, List<uint> knownUids);

    // Events
    event EventHandler<NewMessageEventArgs>? NewMessageReceived;
    event EventHandler<ConnectionStateEventArgs>? ConnectionStateChanged;
}
```

#### ISmtpService.cs
```csharp
public interface ISmtpService
{
    // Connection
    Task<bool> ConnectAsync(EmailAccountCredentials credentials);
    Task DisconnectAsync();
    bool IsConnected { get; }

    // Sending
    Task<SendResult> SendAsync(EmailMessage message);
    Task<SendResult> SendAsync(EmailMessage message, List<EmailAttachment> attachments);

    // Events
    event EventHandler<SendProgressEventArgs>? SendProgress;
}

public class SendResult
{
    public bool Success { get; set; }
    public string? MessageId { get; set; }      // Server-assigned message ID
    public string? ErrorMessage { get; set; }
    public DateTime SentTime { get; set; }
}
```

### 2.2 Implementation Classes

#### ImapEmailService.cs (Core Implementation)
```csharp
public class ImapEmailService : IImapService, IDisposable
{
    private ImapClient? _client;
    private EmailAccountCredentials? _credentials;
    private readonly ILogger _logger;
    private CancellationTokenSource? _idleCancellation;

    public bool IsConnected => _client?.IsConnected ?? false;

    public async Task<bool> ConnectAsync(EmailAccountCredentials credentials)
    {
        _credentials = credentials;
        _client = new ImapClient();

        try
        {
            // Connect with SSL/TLS
            var options = credentials.ImapUseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;

            await _client.ConnectAsync(
                credentials.ImapServer,
                credentials.ImapPort,
                options);

            // Authenticate
            if (credentials.AuthType == AuthenticationType.OAuth2)
            {
                var oauth2 = new SaslMechanismOAuth2(
                    credentials.EmailAddress,
                    credentials.OAuth2AccessToken);
                await _client.AuthenticateAsync(oauth2);
            }
            else
            {
                await _client.AuthenticateAsync(
                    credentials.EmailAddress,
                    DecryptPassword(credentials.EncryptedPassword));
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "IMAP connection failed");
            return false;
        }
    }

    public async Task<List<EmailMessage>> GetMessagesAsync(
        string folderPath, int count = 50, int offset = 0)
    {
        var folder = await _client!.GetFolderAsync(folderPath);
        await folder.OpenAsync(FolderAccess.ReadOnly);

        var messages = new List<EmailMessage>();
        var uids = await folder.SearchAsync(SearchQuery.All);

        // Get latest messages first (descending order)
        var targetUids = uids
            .OrderByDescending(u => u.Id)
            .Skip(offset)
            .Take(count)
            .ToList();

        foreach (var uid in targetUids)
        {
            var mimeMessage = await folder.GetMessageAsync(uid);
            messages.Add(MapToEmailMessage(mimeMessage, uid, folderPath));
        }

        return messages;
    }

    private EmailMessage MapToEmailMessage(MimeMessage mime, UniqueId uid, string folderPath)
    {
        return new EmailMessage
        {
            Id = $"{folderPath}/{uid.Id}",  // Composite ID
            Subject = mime.Subject ?? "(No Subject)",
            From = mime.From.Mailboxes.FirstOrDefault()?.Name ?? "",
            FromEmail = mime.From.Mailboxes.FirstOrDefault()?.Address ?? "",
            To = mime.To.Mailboxes.Select(m => m.Address).ToList(),
            Cc = mime.Cc.Mailboxes.Select(m => m.Address).ToList(),
            Body = mime.HtmlBody ?? mime.TextBody ?? "",
            IsHtml = mime.HtmlBody != null,
            ReceivedDate = mime.Date.LocalDateTime,
            IsRead = false,  // Will be updated from flags
            IsFlagged = false,
            FolderId = folderPath,
            Attachments = mime.Attachments
                .OfType<MimePart>()
                .Select(a => new EmailAttachment
                {
                    FileName = a.FileName,
                    ContentType = a.ContentType.MimeType,
                    FileSize = 0  // Size calculated on demand
                }).ToList()
        };
    }
}
```

#### SmtpEmailService.cs
```csharp
public class SmtpEmailService : ISmtpService, IDisposable
{
    private SmtpClient? _client;
    private EmailAccountCredentials? _credentials;

    public async Task<bool> ConnectAsync(EmailAccountCredentials credentials)
    {
        _credentials = credentials;
        _client = new SmtpClient();

        var options = credentials.SmtpUseStartTls
            ? SecureSocketOptions.StartTls
            : (credentials.SmtpUseSsl
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.None);

        await _client.ConnectAsync(
            credentials.SmtpServer,
            credentials.SmtpPort,
            options);

        // Authenticate
        if (credentials.AuthType == AuthenticationType.OAuth2)
        {
            var oauth2 = new SaslMechanismOAuth2(
                credentials.EmailAddress,
                credentials.OAuth2AccessToken);
            await _client.AuthenticateAsync(oauth2);
        }
        else
        {
            await _client.AuthenticateAsync(
                credentials.EmailAddress,
                DecryptPassword(credentials.EncryptedPassword));
        }

        return true;
    }

    public async Task<SendResult> SendAsync(EmailMessage message)
    {
        var mimeMessage = new MimeMessage();

        // Set sender
        mimeMessage.From.Add(new MailboxAddress(
            message.From,
            message.FromEmail ?? _credentials!.EmailAddress));

        // Set recipients
        foreach (var to in message.To)
            mimeMessage.To.Add(MailboxAddress.Parse(to));
        foreach (var cc in message.Cc)
            mimeMessage.Cc.Add(MailboxAddress.Parse(cc));
        foreach (var bcc in message.Bcc)
            mimeMessage.Bcc.Add(MailboxAddress.Parse(bcc));

        mimeMessage.Subject = message.Subject;

        // Build body with attachments
        var builder = new BodyBuilder();
        if (message.IsHtml)
            builder.HtmlBody = message.Body;
        else
            builder.TextBody = message.Body;

        // Add attachments
        foreach (var attachment in message.Attachments)
        {
            if (attachment.Data != null)
                builder.Attachments.Add(attachment.FileName, attachment.Data);
            else if (!string.IsNullOrEmpty(attachment.FilePath))
                builder.Attachments.Add(attachment.FilePath);
        }

        mimeMessage.Body = builder.ToMessageBody();

        try
        {
            var response = await _client!.SendAsync(mimeMessage);
            return new SendResult
            {
                Success = true,
                MessageId = mimeMessage.MessageId,
                SentTime = DateTime.UtcNow
            };
        }
        catch (Exception ex)
        {
            return new SendResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}
```

---

## Phase 3: Account Management UI

### 3.1 New Views Required

#### AccountSettingsWindow.xaml
- List of configured email accounts
- Add/Edit/Remove account buttons
- Test connection button

#### AddEmailAccountWindow.xaml
- Email address input
- Auto-detect server settings (for common providers)
- Manual server configuration option
- IMAP server, port, SSL settings
- SMTP server, port, TLS settings
- Authentication method selection
- Test connection functionality

### 3.2 Common Provider Presets

```csharp
public static class EmailProviderPresets
{
    public static readonly Dictionary<string, EmailAccountCredentials> Providers = new()
    {
        ["gmail.com"] = new EmailAccountCredentials
        {
            ImapServer = "imap.gmail.com",
            ImapPort = 993,
            ImapUseSsl = true,
            SmtpServer = "smtp.gmail.com",
            SmtpPort = 587,
            SmtpUseStartTls = true,
            AuthType = AuthenticationType.OAuth2  // or AppPassword
        },
        ["outlook.com"] = new EmailAccountCredentials
        {
            ImapServer = "outlook.office365.com",
            ImapPort = 993,
            ImapUseSsl = true,
            SmtpServer = "smtp.office365.com",
            SmtpPort = 587,
            SmtpUseStartTls = true,
            AuthType = AuthenticationType.OAuth2
        },
        ["yahoo.com"] = new EmailAccountCredentials
        {
            ImapServer = "imap.mail.yahoo.com",
            ImapPort = 993,
            ImapUseSsl = true,
            SmtpServer = "smtp.mail.yahoo.com",
            SmtpPort = 587,
            SmtpUseStartTls = true,
            AuthType = AuthenticationType.AppPassword
        }
    };

    public static EmailAccountCredentials? GetPreset(string email)
    {
        var domain = email.Split('@').LastOrDefault()?.ToLower();
        return domain != null && Providers.TryGetValue(domain, out var preset)
            ? preset
            : null;
    }
}
```

---

## Phase 4: Background Sync Service

### 4.1 ImapSyncWorker.cs

```csharp
public class ImapSyncWorker : BackgroundService
{
    private readonly IImapService _imapService;
    private readonly ILocalCacheService _cacheService;
    private readonly ILogger _logger;
    private readonly TimeSpan _syncInterval = TimeSpan.FromMinutes(5);

    protected override async Task ExecuteAsync(CancellationToken stoppingToken)
    {
        while (!stoppingToken.IsCancellationRequested)
        {
            try
            {
                await SyncAllAccountsAsync(stoppingToken);
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Sync worker error");
            }

            await Task.Delay(_syncInterval, stoppingToken);
        }
    }

    private async Task SyncAllAccountsAsync(CancellationToken ct)
    {
        var accounts = await _credentialService.GetAllAccountsAsync();

        foreach (var account in accounts.Where(a => a.IsEnabled))
        {
            await SyncAccountAsync(account, ct);
        }
    }

    private async Task SyncAccountAsync(EmailAccountCredentials account, CancellationToken ct)
    {
        if (!await _imapService.ConnectAsync(account))
            return;

        try
        {
            var folders = await _imapService.GetFoldersAsync();

            foreach (var folder in folders)
            {
                // Get sync state
                var state = await _cacheService.GetSyncStateAsync(account.Id, folder.FullName);

                // Fetch new messages since last sync
                var newMessages = await _imapService.GetNewMessagesAsync(
                    folder.FullName,
                    state?.LastKnownUid ?? 0);

                // Cache new messages
                await _cacheService.CacheEmailsAsync(newMessages);

                // Update sync state
                if (newMessages.Any())
                {
                    await _cacheService.UpdateSyncStateAsync(new ImapSyncState
                    {
                        FolderId = folder.FullName,
                        LastKnownUid = newMessages.Max(m => GetUidFromId(m.Id)),
                        LastSyncTime = DateTime.UtcNow
                    });
                }

                // Raise event for UI update
                OnNewMessagesReceived(newMessages);
            }
        }
        finally
        {
            await _imapService.DisconnectAsync();
        }
    }
}
```

---

## Phase 5: Integration with Existing Architecture

### 5.1 Modify IMailService

```csharp
public interface IMailService
{
    // Existing methods...

    // New methods for IMAP integration
    Task<List<EmailAccountCredentials>> GetEmailAccountsAsync();
    Task AddEmailAccountAsync(EmailAccountCredentials account);
    Task RemoveEmailAccountAsync(string accountId);
    Task<bool> TestConnectionAsync(EmailAccountCredentials account);

    // Email source selection
    EmailSource CurrentSource { get; set; }
}

public enum EmailSource
{
    Database,       // Current behavior (API/DB)
    Imap,           // Direct IMAP connection
    Hybrid          // Both (sync IMAP to DB)
}
```

### 5.2 Create HybridMailService

```csharp
public class HybridMailService : IMailService
{
    private readonly ApiMailService _apiService;
    private readonly ImapEmailService _imapService;
    private readonly SmtpEmailService _smtpService;
    private readonly ILocalCacheService _cacheService;

    public async Task<List<EmailMessage>> GetMessagesAsync(string folderId)
    {
        switch (CurrentSource)
        {
            case EmailSource.Database:
                return await _apiService.GetMessagesAsync(folderId);

            case EmailSource.Imap:
                return await _imapService.GetMessagesAsync(folderId);

            case EmailSource.Hybrid:
                // Try cache first, then IMAP for new messages
                var cached = await _cacheService.GetCachedEmailsAsync(folderId);
                var fresh = await _imapService.GetNewMessagesAsync(folderId, GetLastUid(cached));
                await _cacheService.CacheEmailsAsync(fresh);
                return cached.Union(fresh).OrderByDescending(m => m.ReceivedDate).ToList();

            default:
                throw new InvalidOperationException();
        }
    }

    public async Task SendMessageAsync(EmailMessage message)
    {
        // Send via SMTP
        var result = await _smtpService.SendAsync(message);

        if (result.Success)
        {
            // Also save to database for history
            message.SentDate = result.SentTime;
            await _apiService.SendMessageAsync(message);
        }
        else
        {
            throw new Exception($"Failed to send: {result.ErrorMessage}");
        }
    }
}
```

---

## Phase 6: Credential Storage

### 6.1 Secure Credential Storage

```csharp
public class EmailCredentialStorageService
{
    private readonly SecureStorageService _secureStorage;
    private const string CredentialsKey = "email_accounts";

    public async Task<List<EmailAccountCredentials>> GetAllAccountsAsync()
    {
        return await _secureStorage.RetrieveAsync<List<EmailAccountCredentials>>(CredentialsKey)
            ?? new List<EmailAccountCredentials>();
    }

    public async Task SaveAccountAsync(EmailAccountCredentials account)
    {
        var accounts = await GetAllAccountsAsync();
        var existing = accounts.FindIndex(a => a.Id == account.Id);

        if (existing >= 0)
            accounts[existing] = account;
        else
            accounts.Add(account);

        await _secureStorage.StoreAsync(CredentialsKey, accounts);
    }

    public async Task RemoveAccountAsync(string accountId)
    {
        var accounts = await GetAllAccountsAsync();
        accounts.RemoveAll(a => a.Id == accountId);
        await _secureStorage.StoreAsync(CredentialsKey, accounts);
    }
}
```

---

## Phase 7: Database Schema Updates

### 7.1 New Tables for Local Cache

```sql
-- Email account credentials (encrypted storage)
CREATE TABLE email_accounts (
    id UUID PRIMARY KEY,
    user_id UUID NOT NULL,
    account_name VARCHAR(255) NOT NULL,
    email_address VARCHAR(255) NOT NULL,
    imap_server VARCHAR(255),
    imap_port INTEGER,
    imap_use_ssl BOOLEAN DEFAULT TRUE,
    smtp_server VARCHAR(255),
    smtp_port INTEGER,
    smtp_use_ssl BOOLEAN DEFAULT FALSE,
    smtp_use_starttls BOOLEAN DEFAULT TRUE,
    auth_type VARCHAR(50) DEFAULT 'Basic',
    sync_days INTEGER DEFAULT 30,
    last_sync_time TIMESTAMP,
    is_enabled BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- IMAP sync state tracking
CREATE TABLE imap_sync_state (
    id UUID PRIMARY KEY,
    account_id UUID REFERENCES email_accounts(id),
    folder_path VARCHAR(500) NOT NULL,
    uid_validity BIGINT,
    last_known_uid BIGINT,
    message_count INTEGER,
    last_sync_time TIMESTAMP,
    UNIQUE(account_id, folder_path)
);

-- Index for faster lookups
CREATE INDEX idx_email_accounts_user ON email_accounts(user_id);
CREATE INDEX idx_sync_state_account ON imap_sync_state(account_id);
```

---

## Implementation Timeline

### Week 1: Foundation
- [ ] Install MailKit/MimeKit packages
- [ ] Create new model classes
- [ ] Create service interfaces
- [ ] Basic ImapEmailService implementation
- [ ] Basic SmtpEmailService implementation

### Week 2: Account Management
- [ ] Credential storage service
- [ ] Account settings UI (Add/Edit/Remove)
- [ ] Connection testing functionality
- [ ] Common provider presets

### Week 3: Sync & Integration
- [ ] Background sync worker
- [ ] HybridMailService implementation
- [ ] LocalCache integration
- [ ] Message mapping and caching

### Week 4: Testing & Polish
- [ ] Test with Gmail (App Password)
- [ ] Test with Outlook.com
- [ ] Test with custom IMAP servers
- [ ] Error handling and edge cases
- [ ] UI polish and notifications

---

## Security Considerations

1. **Password Storage**: Always encrypt passwords using DPAPI or similar
2. **OAuth2 Tokens**: Store securely, implement token refresh
3. **Connection Security**: Always verify SSL certificates
4. **App Passwords**: Recommend for Gmail instead of OAuth2 complexity
5. **Credential Isolation**: Keep email credentials separate from app auth

---

## Testing Checklist

- [ ] Connect to Gmail via IMAP
- [ ] Connect to Outlook.com via IMAP
- [ ] Connect to custom IMAP server
- [ ] Fetch folder list
- [ ] Fetch messages from Inbox
- [ ] Fetch messages from other folders
- [ ] Download attachments
- [ ] Mark message as read/unread
- [ ] Flag/unflag message
- [ ] Move message between folders
- [ ] Delete message
- [ ] Send email via SMTP
- [ ] Send email with attachments
- [ ] Handle connection errors gracefully
- [ ] Offline mode (queue operations)
- [ ] Background sync reliability

---

## Files to Create/Modify

### New Files:
```
Services/
├── IImapService.cs
├── ISmtpService.cs
├── ImapEmailService.cs
├── SmtpEmailService.cs
├── HybridMailService.cs
├── ImapSyncWorker.cs
└── EmailCredentialStorageService.cs

Models/
├── EmailAccountCredentials.cs
├── ImapSyncState.cs
├── SendResult.cs
└── EmailProviderPresets.cs

Views/
├── AccountSettingsWindow.xaml
├── AccountSettingsWindow.xaml.cs
├── AddEmailAccountWindow.xaml
└── AddEmailAccountWindow.xaml.cs

ViewModels/
├── AccountSettingsViewModel.cs
└── AddEmailAccountViewModel.cs
```

### Modified Files:
```
Services/IMailService.cs          - Add new methods
Models/MailAccount.cs             - Add IMAP/SMTP settings
JubileeOutlook.csproj            - Add MailKit package
appsettings.json                  - Add email provider configs
```

---

## Questions Before Implementation

1. **Primary Use Case**: Which email providers do you primarily want to support?
2. **OAuth2 Complexity**: Do you want OAuth2 for Gmail/Outlook, or prefer App Passwords?
3. **Sync Strategy**: Full sync or partial (last N days)?
4. **Multi-Account**: Support multiple email accounts per user?
5. **Push Notifications**: IMAP IDLE for real-time new mail, or just polling?

Ready to start implementation when you are, Daddy!
