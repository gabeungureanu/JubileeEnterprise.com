using System.ComponentModel;
using System.Runtime.CompilerServices;

namespace JubileeBrowser.Models;

/// <summary>
/// Extended user profile with sync and device information
/// </summary>
public class UserProfile : INotifyPropertyChanged
{
    private string _userId = string.Empty;
    private string _email = string.Empty;
    private string _displayName = string.Empty;
    private string? _avatarUrl;
    private AccountStatus _accountStatus = AccountStatus.Active;
    private DateTime _createdAt;
    private DateTime _lastLoginAt;
    private bool _isSyncEnabled = true;
    private DateTime? _lastSyncTime;
    private SyncStatus _syncStatus = SyncStatus.Idle;

    public string UserId
    {
        get => _userId;
        set { _userId = value; OnPropertyChanged(); }
    }

    public string Email
    {
        get => _email;
        set { _email = value; OnPropertyChanged(); }
    }

    public string DisplayName
    {
        get => _displayName;
        set { _displayName = value; OnPropertyChanged(); }
    }

    public string? AvatarUrl
    {
        get => _avatarUrl;
        set { _avatarUrl = value; OnPropertyChanged(); }
    }

    public AccountStatus AccountStatus
    {
        get => _accountStatus;
        set { _accountStatus = value; OnPropertyChanged(); }
    }

    public DateTime CreatedAt
    {
        get => _createdAt;
        set { _createdAt = value; OnPropertyChanged(); }
    }

    public DateTime LastLoginAt
    {
        get => _lastLoginAt;
        set { _lastLoginAt = value; OnPropertyChanged(); }
    }

    public bool IsSyncEnabled
    {
        get => _isSyncEnabled;
        set { _isSyncEnabled = value; OnPropertyChanged(); }
    }

    public DateTime? LastSyncTime
    {
        get => _lastSyncTime;
        set { _lastSyncTime = value; OnPropertyChanged(); OnPropertyChanged(nameof(LastSyncDisplay)); }
    }

    public SyncStatus SyncStatus
    {
        get => _syncStatus;
        set { _syncStatus = value; OnPropertyChanged(); OnPropertyChanged(nameof(SyncStatusDisplay)); }
    }

    public string LastSyncDisplay => LastSyncTime.HasValue
        ? $"Last synced: {GetRelativeTime(LastSyncTime.Value)}"
        : "Never synced";

    public string SyncStatusDisplay => SyncStatus switch
    {
        SyncStatus.Syncing => "Syncing...",
        SyncStatus.Idle => IsSyncEnabled ? "Syncing is on" : "Syncing is off",
        SyncStatus.Error => "Sync error",
        SyncStatus.Paused => "Sync paused",
        SyncStatus.Offline => "Offline",
        _ => "Unknown"
    };

    private static string GetRelativeTime(DateTime time)
    {
        var diff = DateTime.UtcNow - time;
        if (diff.TotalMinutes < 1) return "just now";
        if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes}m ago";
        if (diff.TotalHours < 24) return $"{(int)diff.TotalHours}h ago";
        return $"{(int)diff.TotalDays}d ago";
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

public enum SyncStatus
{
    Idle,
    Syncing,
    Error,
    Paused,
    Offline
}

/// <summary>
/// Sync preferences for different data types
/// </summary>
public class SyncPreferences
{
    public bool SyncBookmarks { get; set; } = true;
    public bool SyncHistory { get; set; } = true;
    public bool SyncPasswords { get; set; } = true;
    public bool SyncAutofill { get; set; } = true;
    public bool SyncExtensions { get; set; } = false;
    public bool SyncThemes { get; set; } = true;
    public bool SyncSettings { get; set; } = true;
    public bool RequirePassphraseForPasswords { get; set; } = false;
    public string? EncryptedPassphraseHash { get; set; }
}

/// <summary>
/// Device information for sync
/// </summary>
public class SyncDevice
{
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public string DeviceType { get; set; } = "Desktop"; // Desktop, Mobile, Tablet
    public string OperatingSystem { get; set; } = string.Empty;
    public DateTime LastSeenAt { get; set; }
    public bool IsCurrentDevice { get; set; }
}

/// <summary>
/// Autofill entry for forms
/// </summary>
public class AutofillEntry
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Label { get; set; } = string.Empty;
    public AutofillEntryType Type { get; set; }
    public string? FullName { get; set; }
    public string? Email { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? City { get; set; }
    public string? State { get; set; }
    public string? ZipCode { get; set; }
    public string? Country { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
}

public enum AutofillEntryType
{
    Address,
    Contact,
    PaymentMethod
}

/// <summary>
/// Saved password/credential entry
/// </summary>
public class SavedCredential
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string Website { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string EncryptedPassword { get; set; } = string.Empty; // DPAPI encrypted
    public string? Notes { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime ModifiedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastUsedAt { get; set; }
}

/// <summary>
/// Sync data payload for server communication
/// </summary>
public class SyncPayload
{
    public string DeviceId { get; set; } = string.Empty;
    public long Timestamp { get; set; }
    public List<SyncChange> Changes { get; set; } = new();
}

public class SyncChange
{
    public string EntityType { get; set; } = string.Empty; // bookmark, history, password, autofill
    public string EntityId { get; set; } = string.Empty;
    public SyncChangeType ChangeType { get; set; }
    public string? Data { get; set; } // JSON serialized entity
    public long Timestamp { get; set; }
}

public enum SyncChangeType
{
    Create,
    Update,
    Delete
}

/// <summary>
/// Response from sync pull API
/// </summary>
public class SyncPullResponse
{
    public bool Success { get; set; }
    public List<SyncChange>? Changes { get; set; }
    public long ServerTimestamp { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Response from sync push API
/// </summary>
public class SyncPushResponse
{
    public bool Success { get; set; }
    public int Processed { get; set; }
    public int Failed { get; set; }
    public long ServerTimestamp { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Local profile registry for persisting profile data
/// </summary>
public class ProfileRegistry
{
    public List<StoredProfile> Profiles { get; set; } = new();
    public string? ActiveProfileId { get; set; }
}

public class StoredProfile
{
    public string UserId { get; set; } = string.Empty;
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public string? EncryptedTokens { get; set; } // DPAPI encrypted TokenSet JSON
    public SyncPreferences SyncPreferences { get; set; } = new();
    public DateTime LastLoginAt { get; set; }
    public DateTime LastLogin { get; set; } // Alias for LastLoginAt
    public bool RememberMe { get; set; } = true;
    public bool IsDemo { get; set; } = false; // True for demo/offline accounts
}

// =============================================================================
// CHROMIUM-STYLE SYNC V2 MODELS
// =============================================================================

/// <summary>
/// Sync collection with version tracking
/// </summary>
public class SyncCollection
{
    public string Id { get; set; } = string.Empty;
    public string Type { get; set; } = string.Empty;
    public long CurrentVersion { get; set; }
    public bool Enabled { get; set; } = true;
    public string? EncryptionKeyId { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Individual sync item with versioning
/// </summary>
public class SyncItem
{
    public string? ItemId { get; set; }
    public string ClientId { get; set; } = string.Empty;
    public long ServerVersion { get; set; }
    public object? Payload { get; set; }
    public bool IsEncrypted { get; set; }
    public bool IsDeleted { get; set; }
    public DateTime? ModifiedAt { get; set; }
}

/// <summary>
/// Per-collection sync progress (stored locally)
/// </summary>
public class LocalSyncProgress
{
    public string CollectionType { get; set; } = string.Empty;
    public long LastAcknowledgedVersion { get; set; }
    public long LocalVersion { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

/// <summary>
/// Local sync metadata store
/// </summary>
public class LocalSyncMetadata
{
    public string DeviceId { get; set; } = string.Empty;
    public Dictionary<string, LocalSyncProgress> CollectionProgress { get; set; } = new();
    public Dictionary<string, SyncItem> PendingChanges { get; set; } = new();
    public DateTime? LastSyncAt { get; set; }
}

// V2 API Response Models
public class DeviceRegistrationResponse
{
    public bool Success { get; set; }
    public DeviceInfo? Device { get; set; }
    public List<SyncCollection>? Collections { get; set; }
    public string? Error { get; set; }
}

public class DeviceInfo
{
    public string Id { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string DeviceName { get; set; } = string.Empty;
    public DateTime RegisteredAt { get; set; }
}

public class CollectionsResponse
{
    public bool Success { get; set; }
    public List<SyncCollection>? Collections { get; set; }
    public long ServerTime { get; set; }
    public string? Error { get; set; }
}

public class CommitResponse
{
    public bool Success { get; set; }
    public string CollectionType { get; set; } = string.Empty;
    public long NewVersion { get; set; }
    public List<CommittedItem>? CommittedItems { get; set; }
    public long ServerTime { get; set; }
    public string? Error { get; set; }
    // Conflict info
    public long? CurrentVersion { get; set; }
    public long? BaseVersion { get; set; }
    public List<SyncItem>? ConflictingItems { get; set; }
}

public class CommittedItem
{
    public string ClientId { get; set; } = string.Empty;
    public long ServerVersion { get; set; }
    public string? ItemId { get; set; }
}

public class UpdatesResponse
{
    public bool Success { get; set; }
    public string CollectionType { get; set; } = string.Empty;
    public long CurrentVersion { get; set; }
    public long SinceVersion { get; set; }
    public List<SyncItem>? Items { get; set; }
    public bool HasMore { get; set; }
    public long ServerTime { get; set; }
    public string? Error { get; set; }
}

public class AcknowledgeResponse
{
    public bool Success { get; set; }
    public string CollectionType { get; set; } = string.Empty;
    public long AcknowledgedVersion { get; set; }
    public long ServerTime { get; set; }
    public string? Error { get; set; }
}

public class ProgressResponse
{
    public bool Success { get; set; }
    public string DeviceId { get; set; } = string.Empty;
    public List<CollectionProgress>? Progress { get; set; }
    public long ServerTime { get; set; }
    public string? Error { get; set; }
}

public class CollectionProgress
{
    public string CollectionType { get; set; } = string.Empty;
    public long CurrentVersion { get; set; }
    public long LastAcknowledgedVersion { get; set; }
    public int PendingUpdates { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

// =============================================================================
// ACCOUNT MANAGEMENT MODELS
// =============================================================================

// Note: AccountStatus enum is defined in AuthModels.cs

/// <summary>
/// Full account details response from API
/// </summary>
public class AccountDetailsResponse
{
    public bool Success { get; set; }
    public AccountInfo? Account { get; set; }
    public List<ConnectedDevice>? Devices { get; set; }
    public SyncPreferencesResponse? SyncPreferences { get; set; }
    public List<SyncCollectionStatus>? SyncCollections { get; set; }
    public string? Error { get; set; }
}

public class AccountInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Role { get; set; }
    public string? PreferredLanguage { get; set; }
    public DateTime? CreatedAt { get; set; }
    public DateTime? LastLoginAt { get; set; }
}

public class ConnectedDevice
{
    public string Id { get; set; } = string.Empty;
    public string DeviceId { get; set; } = string.Empty;
    public string? DeviceName { get; set; }
    public string DeviceType { get; set; } = string.Empty;
    public string? Platform { get; set; }
    public string? PlatformVersion { get; set; }
    public string? Browser { get; set; }
    public string? BrowserVersion { get; set; }
    public string? AppName { get; set; }
    public string? AppVersion { get; set; }
    public bool IsTrusted { get; set; }
    public bool IsCurrent { get; set; }
    public DateTime? FirstSeenAt { get; set; }
    public DateTime? LastSeenAt { get; set; }
    public int LoginCount { get; set; }
    public string? LastIpAddress { get; set; }

    public string DisplayName => DeviceName ?? $"{Platform ?? "Unknown"} {DeviceType}";
    public string LastSeenDisplay => LastSeenAt.HasValue ? GetRelativeTime(LastSeenAt.Value) : "Never";

    private static string GetRelativeTime(DateTime time)
    {
        var diff = DateTime.UtcNow - time;
        if (diff.TotalMinutes < 1) return "just now";
        if (diff.TotalMinutes < 60) return $"{(int)diff.TotalMinutes}m ago";
        if (diff.TotalHours < 24) return $"{(int)diff.TotalHours}h ago";
        if (diff.TotalDays < 7) return $"{(int)diff.TotalDays}d ago";
        return time.ToLocalTime().ToString("MMM d, yyyy");
    }
}

public class SyncPreferencesResponse
{
    public bool SyncBookmarks { get; set; }
    public bool SyncHistory { get; set; }
    public bool SyncPasswords { get; set; }
    public bool SyncAutofill { get; set; }
    public bool SyncExtensions { get; set; }
    public bool SyncThemes { get; set; }
    public bool SyncSettings { get; set; }
    public DateTime? LastSyncAt { get; set; }
}

public class SyncCollectionStatus
{
    public string CollectionType { get; set; } = string.Empty;
    public long ServerVersion { get; set; }
    public DateTime? UpdatedAt { get; set; }
}

/// <summary>
/// Generic API success/error response
/// </summary>
public class ApiSuccessResponse
{
    public bool Success { get; set; }
    public string? Message { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Devices list response
/// </summary>
public class DevicesListResponse
{
    public bool Success { get; set; }
    public List<ConnectedDevice>? Devices { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Sync preferences API response
/// </summary>
public class SyncPreferencesApiResponse
{
    public bool Success { get; set; }
    public SyncPreferencesResponse? Preferences { get; set; }
    public string? Error { get; set; }
}
