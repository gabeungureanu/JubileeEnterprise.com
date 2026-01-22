namespace JubileeOutlook.Models.EmailSync;

/// <summary>
/// Represents a synced email account with authentication and sync state
/// </summary>
public class SyncedEmailAccount
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string EmailAddress { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public EmailProviderType ProviderType { get; set; }
    public AuthenticationMethod AuthMethod { get; set; }

    // Connection Status
    public AccountConnectionStatus ConnectionStatus { get; set; } = AccountConnectionStatus.NotConnected;
    public string? LastError { get; set; }
    public DateTime? LastSuccessfulSync { get; set; }
    public DateTime? LastSyncAttempt { get; set; }

    // Sync State
    public string? SyncState { get; set; }  // Provider-specific sync token (e.g., UIDVALIDITY, deltaLink)
    public int TotalMessageCount { get; set; }
    public int UnreadMessageCount { get; set; }

    // Server Settings (for IMAP)
    public string? ImapHost { get; set; }
    public int ImapPort { get; set; } = 993;
    public string? SmtpHost { get; set; }
    public int SmtpPort { get; set; } = 587;

    // Timestamps
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;

    // Settings
    public bool IsEnabled { get; set; } = true;
    public bool IsDefault { get; set; }
    public int SyncIntervalMinutes { get; set; } = 15;
    public int MaxMessagesToSync { get; set; } = 500; // Initial sync limit
}

/// <summary>
/// Account connection status
/// </summary>
public enum AccountConnectionStatus
{
    NotConnected,
    Connecting,
    Connected,
    AuthenticationRequired,
    AuthenticationFailed,
    ConnectionError,
    Syncing,
    SyncError
}

/// <summary>
/// Stored credentials for an email account (encrypted)
/// </summary>
public class EmailAccountCredentials
{
    public Guid AccountId { get; set; }

    // OAuth2 tokens
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? TokenExpiry { get; set; }

    // Basic Auth / App Password
    public string? EncryptedPassword { get; set; }

    // Metadata
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

/// <summary>
/// Synced email folder mapping
/// </summary>
public class SyncedEmailFolder
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid AccountId { get; set; }
    public string RemoteFolderId { get; set; } = string.Empty;  // Server folder ID
    public string LocalFolderId { get; set; } = string.Empty;   // Local folder ID
    public string FolderName { get; set; } = string.Empty;
    public string FolderPath { get; set; } = string.Empty;
    public FolderType FolderType { get; set; }
    public int MessageCount { get; set; }
    public int UnreadCount { get; set; }
    public string? SyncState { get; set; }  // UIDVALIDITY or sync token
    public DateTime? LastSynced { get; set; }
    public bool IsSubscribed { get; set; } = true;
}

/// <summary>
/// Standard folder types for mapping
/// </summary>
public enum FolderType
{
    Inbox,
    Sent,
    Drafts,
    Trash,
    Junk,
    Archive,
    Custom
}

/// <summary>
/// Email sync operation result
/// </summary>
public class EmailSyncResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public int NewMessages { get; set; }
    public int UpdatedMessages { get; set; }
    public int DeletedMessages { get; set; }
    public DateTime SyncTime { get; set; } = DateTime.UtcNow;
    public TimeSpan Duration { get; set; }
}
