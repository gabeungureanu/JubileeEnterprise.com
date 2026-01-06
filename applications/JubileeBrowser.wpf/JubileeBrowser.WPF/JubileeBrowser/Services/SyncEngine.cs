using System.Collections.Concurrent;
using System.ComponentModel;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// Synchronizes bookmarks, history, autofill, and passwords across devices
/// </summary>
public class SyncEngine : INotifyPropertyChanged, IDisposable
{
    private readonly ProfileAuthService _authService;
    private readonly SecureStorageService _secureStorage;
    private readonly HttpClient _httpClient;
    private readonly ConcurrentQueue<SyncChange> _pendingChanges = new();
    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private CancellationTokenSource? _syncCts;
    private Timer? _syncTimer;
    private bool _isDisposed;
    private readonly string _syncApiBaseUrl;

    private const int SyncIntervalMs = 30000; // 30 seconds
    private const int MaxRetries = 3;

    private SyncStatus _status = SyncStatus.Idle;
    private DateTime? _lastSyncTime;
    private string? _lastError;
    private SyncPreferences _preferences = new();

    public event PropertyChangedEventHandler? PropertyChanged;
    public event EventHandler<SyncStatus>? StatusChanged;
    public event EventHandler<string>? SyncError;

    public SyncStatus Status
    {
        get => _status;
        private set
        {
            _status = value;
            OnPropertyChanged();
            StatusChanged?.Invoke(this, value);
        }
    }

    public DateTime? LastSyncTime
    {
        get => _lastSyncTime;
        private set { _lastSyncTime = value; OnPropertyChanged(); }
    }

    public string? LastError
    {
        get => _lastError;
        private set { _lastError = value; OnPropertyChanged(); }
    }

    public SyncPreferences Preferences
    {
        get => _preferences;
        set { _preferences = value; OnPropertyChanged(); }
    }

    public bool IsSyncEnabled => _authService.IsSignedIn &&
        (_preferences.SyncBookmarks || _preferences.SyncHistory ||
         _preferences.SyncPasswords || _preferences.SyncAutofill);

    public SyncEngine(ProfileAuthService authService)
    {
        _authService = authService;
        _secureStorage = new SecureStorageService();
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        // Get API base URL from environment (same as MainWindow uses)
        var apiBaseUrl = Environment.GetEnvironmentVariable("API_BASE_URL") ?? "http://localhost:3100";
        _syncApiBaseUrl = $"{apiBaseUrl}/api/sync";

        _authService.AuthStateChanged += OnAuthStateChanged;
    }

    /// <summary>
    /// Initialize the sync engine
    /// </summary>
    public async Task InitializeAsync()
    {
        // Load sync preferences
        var stored = await _secureStorage.RetrieveAsync<SyncPreferences>("sync_preferences");
        if (stored != null)
        {
            _preferences = stored;
        }

        // Load last sync time
        var lastSync = await _secureStorage.RetrieveAsync<long>("last_sync_time");
        if (lastSync > 0)
        {
            _lastSyncTime = DateTimeOffset.FromUnixTimeSeconds(lastSync).DateTime;
        }

        if (_authService.IsSignedIn && IsSyncEnabled)
        {
            StartSyncTimer();
            // Perform initial sync
            _ = SyncNowAsync();
        }
    }

    /// <summary>
    /// Start the periodic sync timer
    /// </summary>
    public void StartSyncTimer()
    {
        _syncCts?.Cancel();
        _syncCts = new CancellationTokenSource();
        _syncTimer?.Dispose();
        _syncTimer = new Timer(async _ => await SyncNowAsync(), null, SyncIntervalMs, SyncIntervalMs);
    }

    /// <summary>
    /// Stop the sync timer
    /// </summary>
    public void StopSyncTimer()
    {
        _syncCts?.Cancel();
        _syncTimer?.Dispose();
        _syncTimer = null;
    }

    /// <summary>
    /// Perform immediate sync
    /// </summary>
    public async Task SyncNowAsync()
    {
        if (!IsSyncEnabled || Status == SyncStatus.Syncing)
            return;

        if (!await _syncLock.WaitAsync(0))
            return; // Already syncing

        try
        {
            Status = SyncStatus.Syncing;
            LastError = null;

            var token = await _authService.GetAccessTokenAsync();
            if (string.IsNullOrEmpty(token))
            {
                Status = SyncStatus.Error;
                LastError = "Authentication required";
                return;
            }

            _httpClient.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", token);

            // Send pending changes
            await SendPendingChangesAsync();

            // Fetch remote changes
            await FetchRemoteChangesAsync();

            LastSyncTime = DateTime.UtcNow;
            await _secureStorage.StoreAsync("last_sync_time", DateTimeOffset.UtcNow.ToUnixTimeSeconds());
            Status = SyncStatus.Idle;
        }
        catch (HttpRequestException ex)
        {
            Status = SyncStatus.Offline;
            LastError = "Network error: " + ex.Message;
            SyncError?.Invoke(this, LastError);
        }
        catch (Exception ex)
        {
            Status = SyncStatus.Error;
            LastError = ex.Message;
            SyncError?.Invoke(this, LastError);
        }
        finally
        {
            _syncLock.Release();
        }
    }

    /// <summary>
    /// Queue a change for syncing
    /// </summary>
    public void QueueChange(string entityType, string entityId, SyncChangeType changeType, object? data = null)
    {
        if (!IsSyncEnabled) return;

        // Check if this entity type should be synced
        var shouldSync = entityType switch
        {
            "bookmark" => _preferences.SyncBookmarks,
            "history" => _preferences.SyncHistory,
            "password" => _preferences.SyncPasswords,
            "autofill" => _preferences.SyncAutofill,
            "extension" => _preferences.SyncExtensions,
            "theme" => _preferences.SyncThemes,
            "settings" => _preferences.SyncSettings,
            _ => false
        };

        if (!shouldSync) return;

        var change = new SyncChange
        {
            EntityType = entityType,
            EntityId = entityId,
            ChangeType = changeType,
            Data = data != null ? JsonSerializer.Serialize(data) : null,
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds()
        };

        _pendingChanges.Enqueue(change);
    }

    /// <summary>
    /// Update sync preferences
    /// </summary>
    public async Task UpdatePreferencesAsync(SyncPreferences preferences)
    {
        _preferences = preferences;
        await _secureStorage.StoreAsync("sync_preferences", preferences);
        OnPropertyChanged(nameof(IsSyncEnabled));

        if (IsSyncEnabled && _authService.IsSignedIn)
        {
            StartSyncTimer();
        }
        else
        {
            StopSyncTimer();
        }
    }

    /// <summary>
    /// Pause syncing
    /// </summary>
    public void PauseSync()
    {
        StopSyncTimer();
        Status = SyncStatus.Paused;
    }

    /// <summary>
    /// Resume syncing
    /// </summary>
    public void ResumeSync()
    {
        if (_authService.IsSignedIn && IsSyncEnabled)
        {
            StartSyncTimer();
            Status = SyncStatus.Idle;
            _ = SyncNowAsync();
        }
    }

    private async Task SendPendingChangesAsync()
    {
        var changes = new List<SyncChange>();
        while (_pendingChanges.TryDequeue(out var change))
        {
            changes.Add(change);
        }

        if (changes.Count == 0) return;

        var payload = new SyncPayload
        {
            DeviceId = GetDeviceId(),
            Timestamp = DateTimeOffset.UtcNow.ToUnixTimeMilliseconds(),
            Changes = changes
        };

        var json = JsonSerializer.Serialize(payload);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        for (int retry = 0; retry < MaxRetries; retry++)
        {
            try
            {
                var response = await _httpClient.PostAsync($"{_syncApiBaseUrl}/push", content);
                if (response.IsSuccessStatusCode)
                    return;

                if ((int)response.StatusCode >= 400 && (int)response.StatusCode < 500)
                    break; // Don't retry client errors
            }
            catch when (retry < MaxRetries - 1)
            {
                await Task.Delay(1000 * (retry + 1));
            }
        }

        // Re-queue failed changes
        foreach (var change in changes)
        {
            _pendingChanges.Enqueue(change);
        }
    }

    private async Task FetchRemoteChangesAsync()
    {
        var lastSync = LastSyncTime.HasValue
            ? new DateTimeOffset(LastSyncTime.Value).ToUnixTimeMilliseconds()
            : 0;

        var response = await _httpClient.GetAsync(
            $"{_syncApiBaseUrl}/pull?since={lastSync}&device_id={GetDeviceId()}");

        if (!response.IsSuccessStatusCode) return;

        var json = await response.Content.ReadAsStringAsync();
        var changes = JsonSerializer.Deserialize<List<SyncChange>>(json);

        if (changes == null || changes.Count == 0) return;

        // Apply changes locally
        foreach (var change in changes)
        {
            await ApplyRemoteChangeAsync(change);
        }
    }

    private async Task ApplyRemoteChangeAsync(SyncChange change)
    {
        // This would integrate with local data stores
        // For now, emit an event that can be handled by the appropriate manager
        await Task.CompletedTask;
        System.Diagnostics.Debug.WriteLine($"Applying remote change: {change.EntityType}/{change.EntityId} - {change.ChangeType}");
    }

    private string GetDeviceId()
    {
        var deviceId = _secureStorage.RetrieveAsync<string>("device_id").Result;
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = Guid.NewGuid().ToString();
            _secureStorage.StoreAsync("device_id", deviceId).Wait();
        }
        return deviceId;
    }

    private void OnAuthStateChanged(object? sender, AuthenticationState state)
    {
        if (state == AuthenticationState.SignedIn && IsSyncEnabled)
        {
            StartSyncTimer();
            _ = SyncNowAsync();
        }
        else
        {
            StopSyncTimer();
            Status = SyncStatus.Idle;
        }
    }

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    public void Dispose()
    {
        if (_isDisposed) return;
        _isDisposed = true;
        _syncCts?.Cancel();
        _syncTimer?.Dispose();
        _syncLock.Dispose();
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }
}
