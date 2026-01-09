using System.Collections.Concurrent;
using System.ComponentModel;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// Chromium-style sync engine that synchronizes bookmarks, history, autofill, and passwords
/// across devices via the InspireCodex API V2 with Codex database backend.
/// Uses collection-based versioning for incremental sync.
/// </summary>
public class SyncEngine : INotifyPropertyChanged, IDisposable
{
    private readonly ProfileAuthService _authService;
    private readonly SecureStorageService _secureStorage;
    private readonly HttpClient _httpClient;
    private readonly ConcurrentDictionary<string, ConcurrentQueue<SyncItem>> _pendingChanges = new();
    private readonly SemaphoreSlim _syncLock = new(1, 1);
    private CancellationTokenSource? _syncCts;
    private Timer? _syncTimer;
    private Timer? _heartbeatTimer;
    private bool _isDisposed;
    private string _syncApiBaseUrl;
    private string _continuumApiBaseUrl = "https://inspirecontinuum.com";
    private LocalSyncMetadata _metadata = new();
    private Dictionary<string, SyncCollection> _collections = new();

    private const int SyncIntervalMs = 30000; // 30 seconds
    private const int HeartbeatIntervalMs = 60000; // 60 seconds
    private const int MaxRetries = 3;
    private static readonly string[] CollectionTypes = { "bookmarks", "history", "passwords", "autofill", "settings", "tabs" };

    private SyncStatus _status = SyncStatus.Idle;
    private DateTime? _lastSyncTime;
    private string? _lastError;
    private SyncPreferences _preferences = new();
    private bool _isRegistered;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true
    };

    public event PropertyChangedEventHandler? PropertyChanged;
    public event EventHandler<SyncStatus>? StatusChanged;
    public event EventHandler<string>? SyncError;
    public event EventHandler<SyncItem>? ItemReceived;

    public SyncStatus Status
    {
        get => _status;
        private set
        {
            if (_status != value)
            {
                _status = value;
                OnPropertyChanged();
                StatusChanged?.Invoke(this, value);
            }
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

    public string DeviceId => _metadata?.DeviceId ?? string.Empty;

    public SyncPreferences Preferences
    {
        get => _preferences;
        set { _preferences = value; OnPropertyChanged(); }
    }

    public bool IsSyncEnabled => _authService.IsSignedIn;
    public bool IsRegistered => _isRegistered;
    public IReadOnlyDictionary<string, SyncCollection> Collections => _collections;

    public SyncEngine(ProfileAuthService authService)
    {
        _authService = authService;
        _secureStorage = new SecureStorageService();

        // Create HttpClient with proper handler
        var handler = new HttpClientHandler
        {
            AllowAutoRedirect = true,
            UseCookies = false
        };
        _httpClient = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(30)
        };

        // Set default headers
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "JubileeBrowser/8.0 (Windows; .NET)");
        _httpClient.DefaultRequestHeaders.Add("Accept", "application/json");

        // Default URL - will be updated during initialization
        _syncApiBaseUrl = "https://inspirecodex.com/api/sync/v2";

        _authService.AuthStateChanged += OnAuthStateChanged;
    }

    /// <summary>
    /// Initialize the sync engine - must be called after EnvLoader.Load()
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            Log("=== SyncEngine InitializeAsync STARTING ===");

            // Get API base URL from environment using EnvLoader (same as MainWindow)
            EnvLoader.Load();
            var apiBaseUrl = EnvLoader.GetVariable("API_BASE_URL", "https://inspirecodex.com");
            _syncApiBaseUrl = $"{apiBaseUrl}/api/sync/v2";
            Log($"API URL set to: {_syncApiBaseUrl}");

            // Load local metadata
            var storedMetadata = await _secureStorage.RetrieveAsync<LocalSyncMetadata>("sync_metadata_v2");
            if (storedMetadata != null)
            {
                _metadata = storedMetadata;
                Log($"Loaded existing metadata, deviceId: {_metadata.DeviceId}");
            }
            else
            {
                _metadata = new LocalSyncMetadata
                {
                    DeviceId = await GetOrCreateDeviceIdAsync()
                };
                Log($"Created new metadata, deviceId: {_metadata.DeviceId}");
            }

            // Load sync preferences
            var storedPrefs = await _secureStorage.RetrieveAsync<SyncPreferences>("sync_preferences");
            _preferences = storedPrefs ?? new SyncPreferences();
            Log("Preferences loaded");

            // Load last sync time
            _lastSyncTime = _metadata.LastSyncAt;
            Log($"Last sync time: {_lastSyncTime?.ToString() ?? "never"}");

            Log($"IsSignedIn: {_authService.IsSignedIn}, AuthState: {_authService.AuthState}");

            if (_authService.IsSignedIn)
            {
                Log("User is signed in - starting sync initialization...");

                // Check if we can get a token
                var token = await _authService.GetAccessTokenAsync();
                Log($"Token retrieved: {(string.IsNullOrEmpty(token) ? "NULL/EMPTY" : $"length={token.Length}")}");

                if (!string.IsNullOrEmpty(token))
                {
                    // Register device and initialize collections
                    await RegisterDeviceAsync();

                    // Fetch sync preferences from server and merge with local
                    await FetchServerPreferencesAsync(token);

                    StartSyncTimer();
                    // Heartbeat timer started separately for session tracking
                    _ = Task.Run(() => StartHeartbeatTimer());
                    // Perform initial sync
                    await TriggerSyncAsync();
                }
                else
                {
                    Log("ERROR: Token is null/empty even though user is signed in!");
                    Status = SyncStatus.Error;
                    LastError = "Authentication token unavailable";
                }
            }
            else
            {
                Log("User is NOT signed in - sync will start when user signs in");
            }

            Log("=== SyncEngine InitializeAsync COMPLETED ===");
        }
        catch (Exception ex)
        {
            Log($"=== SyncEngine InitializeAsync FAILED: {ex.Message} ===");
            Log($"Stack trace: {ex.StackTrace}");
            Status = SyncStatus.Error;
            LastError = $"Sync initialization failed: {ex.Message}";
        }
    }

    /// <summary>
    /// Register this device with the sync server
    /// </summary>
    private async Task RegisterDeviceAsync()
    {
        try
        {
            Log("Registering device...");

            var token = await _authService.GetAccessTokenAsync();
            if (string.IsNullOrEmpty(token))
            {
                Log("No token available for device registration");
                return;
            }

            var payload = new
            {
                deviceId = _metadata.DeviceId,
                deviceName = Environment.MachineName,
                deviceType = "desktop",
                platform = "Windows",
                platformVersion = Environment.OSVersion.VersionString,
                appName = "JubileeBrowser",
                appVersion = "8.0"
            };

            var response = await SendRequestAsync<DeviceRegistrationResponse>(
                HttpMethod.Post,
                "devices/register",
                token,
                payload);

            if (response?.Success == true)
            {
                _isRegistered = true;

                // Store collections
                if (response.Collections != null)
                {
                    _collections = response.Collections.ToDictionary(c => c.Type, c => c);

                    // Initialize local progress for each collection
                    foreach (var coll in response.Collections)
                    {
                        if (!_metadata.CollectionProgress.ContainsKey(coll.Type))
                        {
                            _metadata.CollectionProgress[coll.Type] = new LocalSyncProgress
                            {
                                CollectionType = coll.Type,
                                LastAcknowledgedVersion = 0,
                                LocalVersion = 0
                            };
                        }
                    }

                    await SaveMetadataAsync();
                }

                Log($"Device registered: {response.Device?.DeviceName}");
            }
            else
            {
                Log($"Device registration failed: {response?.Error}");
            }
        }
        catch (Exception ex)
        {
            Log($"Device registration error: {ex.Message}");
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
        _syncTimer = new Timer(async _ => await TriggerSyncAsync(), null, SyncIntervalMs, SyncIntervalMs);
        Log("Sync timer started");
    }

    /// <summary>
    /// Stop the sync timer
    /// </summary>
    public void StopSyncTimer()
    {
        _syncCts?.Cancel();
        _syncTimer?.Dispose();
        _syncTimer = null;
        Log("Sync timer stopped");
    }

    /// <summary>
    /// Trigger a sync operation
    /// </summary>
    public async Task TriggerSyncAsync()
    {
        await SyncNowAsync();
    }

    /// <summary>
    /// Perform immediate sync for all collections
    /// </summary>
    public async Task SyncNowAsync()
    {
        Log($"SyncNowAsync called - IsSignedIn: {_authService.IsSignedIn}, Status: {Status}");

        if (!_authService.IsSignedIn)
        {
            Log("Not signed in - skipping sync");
            Status = SyncStatus.Idle;
            LastError = null;
            return;
        }

        if (Status == SyncStatus.Syncing)
        {
            Log("Already syncing - skipping");
            return;
        }

        if (!await _syncLock.WaitAsync(100))
        {
            Log("Could not acquire lock - skipping");
            return;
        }

        try
        {
            Status = SyncStatus.Syncing;
            LastError = null;

            var token = await _authService.GetAccessTokenAsync();
            if (string.IsNullOrEmpty(token))
            {
                Status = SyncStatus.Error;
                LastError = "Authentication required";
                Log("No token - sync failed");
                return;
            }

            // Register device if not already registered
            if (!_isRegistered)
            {
                await RegisterDeviceAsync();
            }

            // Sync each enabled collection
            foreach (var collectionType in CollectionTypes)
            {
                if (!IsCollectionEnabled(collectionType)) continue;

                await SyncCollectionAsync(collectionType, token);
            }

            // Update last sync time
            LastSyncTime = DateTime.UtcNow;
            _metadata.LastSyncAt = LastSyncTime;
            await SaveMetadataAsync();

            Status = SyncStatus.Idle;
            LastError = null;
            Log("Sync completed successfully!");
        }
        catch (HttpRequestException ex)
        {
            Status = SyncStatus.Offline;
            LastError = $"Network error: {ex.Message}";
            Log($"Network error: {ex.Message}");
            SyncError?.Invoke(this, LastError);
        }
        catch (Exception ex)
        {
            Status = SyncStatus.Error;
            LastError = ex.Message;
            Log($"Error: {ex.Message}");
            SyncError?.Invoke(this, LastError);
        }
        finally
        {
            _syncLock.Release();
        }
    }

    /// <summary>
    /// Sync a specific collection
    /// </summary>
    private async Task SyncCollectionAsync(string collectionType, string token)
    {
        try
        {
            Log($"Syncing collection: {collectionType}");

            // 1. Push any pending local changes
            await PushPendingChangesAsync(collectionType, token);

            // 2. Pull remote updates
            await PullUpdatesAsync(collectionType, token);
        }
        catch (Exception ex)
        {
            Log($"Error syncing {collectionType}: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Push pending local changes for a collection
    /// </summary>
    private async Task PushPendingChangesAsync(string collectionType, string token)
    {
        if (!_pendingChanges.TryGetValue(collectionType, out var queue) || queue.IsEmpty)
        {
            Log($"No pending changes for {collectionType}");
            return;
        }

        var items = new List<SyncItem>();
        while (queue.TryDequeue(out var item))
        {
            items.Add(item);
        }

        if (items.Count == 0) return;

        Log($"Pushing {items.Count} changes to {collectionType}");

        // Get base version for conflict detection
        var progress = _metadata.CollectionProgress.GetValueOrDefault(collectionType);
        var baseVersion = progress?.LastAcknowledgedVersion ?? 0;

        var payload = new
        {
            deviceId = _metadata.DeviceId,
            items = items.Select(i => new
            {
                clientId = i.ClientId,
                payload = i.Payload,
                isDeleted = i.IsDeleted,
                isEncrypted = i.IsEncrypted
            }).ToList(),
            baseVersion
        };

        var response = await SendRequestAsync<CommitResponse>(
            HttpMethod.Post,
            $"collections/{collectionType}/commit",
            token,
            payload);

        if (response?.Success == true)
        {
            Log($"Committed {response.CommittedItems?.Count ?? 0} items to {collectionType}, new version: {response.NewVersion}");

            // Update local progress
            if (progress != null)
            {
                progress.LocalVersion = response.NewVersion;
            }
        }
        else if (response?.Error == "Conflict detected")
        {
            Log($"Conflict detected in {collectionType} - handling...");
            // Re-queue items and pull latest first
            foreach (var item in items)
            {
                QueueChange(collectionType, item);
            }
            // Pull will be done in next step
        }
        else
        {
            Log($"Commit failed for {collectionType}: {response?.Error}");
            // Re-queue for retry
            foreach (var item in items)
            {
                QueueChange(collectionType, item);
            }
        }
    }

    /// <summary>
    /// Pull remote updates for a collection
    /// </summary>
    private async Task PullUpdatesAsync(string collectionType, string token)
    {
        var progress = _metadata.CollectionProgress.GetValueOrDefault(collectionType);
        var sinceVersion = progress?.LastAcknowledgedVersion ?? 0;

        Log($"Pulling updates for {collectionType} since version {sinceVersion}");

        var response = await SendRequestAsync<UpdatesResponse>(
            HttpMethod.Get,
            $"collections/{collectionType}/updates?sinceVersion={sinceVersion}&limit=100",
            token,
            null);

        if (response?.Success != true)
        {
            Log($"Pull failed for {collectionType}: {response?.Error}");
            return;
        }

        if (response.Items == null || response.Items.Count == 0)
        {
            Log($"No updates for {collectionType}");
            return;
        }

        Log($"Received {response.Items.Count} items for {collectionType}");

        // Process received items
        foreach (var item in response.Items)
        {
            // Notify listeners about received item
            ItemReceived?.Invoke(this, item);

            // TODO: Apply item to local store based on collection type
            Log($"  - {item.ClientId} v{item.ServerVersion} (deleted={item.IsDeleted})");
        }

        // Acknowledge the sync
        var ackPayload = new
        {
            deviceId = _metadata.DeviceId,
            acknowledgedVersion = response.CurrentVersion
        };

        var ackResponse = await SendRequestAsync<AcknowledgeResponse>(
            HttpMethod.Post,
            $"collections/{collectionType}/acknowledge",
            token,
            ackPayload);

        if (ackResponse?.Success == true)
        {
            // Update local progress
            if (progress != null)
            {
                progress.LastAcknowledgedVersion = response.CurrentVersion;
                progress.LastSyncAt = DateTime.UtcNow;
            }
            else
            {
                _metadata.CollectionProgress[collectionType] = new LocalSyncProgress
                {
                    CollectionType = collectionType,
                    LastAcknowledgedVersion = response.CurrentVersion,
                    LastSyncAt = DateTime.UtcNow
                };
            }

            await SaveMetadataAsync();
            Log($"Acknowledged {collectionType} up to version {response.CurrentVersion}");
        }

        // If there are more updates, continue pulling
        if (response.HasMore)
        {
            await PullUpdatesAsync(collectionType, token);
        }
    }

    /// <summary>
    /// Queue a change for a specific collection
    /// </summary>
    public void QueueChange(string collectionType, SyncItem item)
    {
        if (!_authService.IsSignedIn) return;

        var queue = _pendingChanges.GetOrAdd(collectionType, _ => new ConcurrentQueue<SyncItem>());
        queue.Enqueue(item);
        Log($"Queued change: {collectionType}/{item.ClientId}");
    }

    /// <summary>
    /// Queue a change by entity type and ID (convenience method)
    /// </summary>
    public void QueueChange(string collectionType, string clientId, object? payload, bool isDeleted = false)
    {
        QueueChange(collectionType, new SyncItem
        {
            ClientId = clientId,
            Payload = payload,
            IsDeleted = isDeleted,
            ModifiedAt = DateTime.UtcNow
        });
    }

    /// <summary>
    /// Send an HTTP request to the sync API
    /// </summary>
    private async Task<T?> SendRequestAsync<T>(HttpMethod method, string endpoint, string token, object? payload) where T : class
    {
        // Add token as query parameter (workaround for proxy/CDN environments that strip Authorization headers)
        var separator = endpoint.Contains('?') ? '&' : '?';
        var url = $"{_syncApiBaseUrl}/{endpoint}{separator}access_token={Uri.EscapeDataString(token)}";
        Log($"Request: {method} {url.Substring(0, Math.Min(150, url.Length))}...");

        using var request = new HttpRequestMessage(method, url);

        // Also set Authorization header (for direct connections)
        request.Headers.Add("Authorization", $"Bearer {token}");

        if (payload != null && (method == HttpMethod.Post || method == HttpMethod.Put))
        {
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
            Log($"Payload: {json.Substring(0, Math.Min(200, json.Length))}...");
        }

        for (int retry = 0; retry < MaxRetries; retry++)
        {
            try
            {
                var response = await _httpClient.SendAsync(request.Clone());
                var responseJson = await response.Content.ReadAsStringAsync();

                Log($"Response ({response.StatusCode}): {responseJson.Substring(0, Math.Min(300, responseJson.Length))}");

                if (response.IsSuccessStatusCode)
                {
                    return JsonSerializer.Deserialize<T>(responseJson, JsonOptions);
                }

                // Handle specific error codes
                if ((int)response.StatusCode == 401)
                {
                    throw new UnauthorizedAccessException("Authentication required");
                }

                if ((int)response.StatusCode == 409)
                {
                    // Conflict - return the response for handling
                    return JsonSerializer.Deserialize<T>(responseJson, JsonOptions);
                }

                if ((int)response.StatusCode >= 500 && retry < MaxRetries - 1)
                {
                    Log($"Server error, retry {retry + 1}...");
                    await Task.Delay(1000 * (retry + 1));
                    continue;
                }

                // Try to parse error response
                try
                {
                    return JsonSerializer.Deserialize<T>(responseJson, JsonOptions);
                }
                catch
                {
                    throw new Exception($"HTTP {(int)response.StatusCode}: {responseJson}");
                }
            }
            catch (HttpRequestException ex) when (retry < MaxRetries - 1)
            {
                Log($"Request failed, retry {retry + 1}: {ex.Message}");
                await Task.Delay(1000 * (retry + 1));
            }
        }

        return null;
    }

    /// <summary>
    /// Check if a collection is enabled for sync
    /// </summary>
    private bool IsCollectionEnabled(string collectionType)
    {
        return collectionType switch
        {
            "bookmarks" => _preferences.SyncBookmarks,
            "history" => _preferences.SyncHistory,
            "passwords" => _preferences.SyncPasswords,
            "autofill" => _preferences.SyncAutofill,
            "settings" => _preferences.SyncSettings,
            "tabs" => true, // Always sync tabs if available
            _ => true
        };
    }

    /// <summary>
    /// Save metadata to secure storage
    /// </summary>
    private async Task SaveMetadataAsync()
    {
        await _secureStorage.StoreAsync("sync_metadata_v2", _metadata);
    }

    /// <summary>
    /// Get or create device ID
    /// </summary>
    private async Task<string> GetOrCreateDeviceIdAsync()
    {
        var deviceId = await _secureStorage.RetrieveAsync<string>("device_id");
        if (string.IsNullOrEmpty(deviceId))
        {
            deviceId = Guid.NewGuid().ToString();
            await _secureStorage.StoreAsync("device_id", deviceId);
        }
        return deviceId;
    }

    /// <summary>
    /// Update sync preferences locally and on the server
    /// </summary>
    public async Task UpdatePreferencesAsync(SyncPreferences preferences)
    {
        _preferences = preferences;
        await _secureStorage.StoreAsync("sync_preferences", preferences);
        OnPropertyChanged(nameof(IsSyncEnabled));

        // Persist to server
        try
        {
            var token = await _authService.GetAccessTokenAsync();
            if (!string.IsNullOrEmpty(token))
            {
                var payload = new
                {
                    syncBookmarks = preferences.SyncBookmarks,
                    syncHistory = preferences.SyncHistory,
                    syncPasswords = preferences.SyncPasswords,
                    syncAutofill = preferences.SyncAutofill,
                    syncExtensions = preferences.SyncExtensions,
                    syncThemes = preferences.SyncThemes,
                    syncSettings = preferences.SyncSettings
                };
                var response = await SendRequestAsync<ApiSuccessResponse>(HttpMethod.Put, "api/sync/preferences", token, payload);
                if (response?.Success == true)
                {
                    Log("Sync preferences saved to server");
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Failed to save sync preferences to server: {ex.Message}");
        }
    }

    /// <summary>
    /// Fetch sync preferences from the server
    /// </summary>
    private async Task FetchServerPreferencesAsync(string token)
    {
        try
        {
            // Use the base API URL without /v2
            var apiBaseUrl = _syncApiBaseUrl.Replace("/api/sync/v2", "");
            using var client = new System.Net.Http.HttpClient();
            client.DefaultRequestHeaders.Authorization = new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", token);
            var response = await client.GetAsync($"{apiBaseUrl}/api/sync/preferences");

            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                var result = System.Text.Json.JsonSerializer.Deserialize<SyncPreferencesApiResponse>(json, new System.Text.Json.JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (result?.Success == true && result.Preferences != null)
                {
                    _preferences.SyncBookmarks = result.Preferences.SyncBookmarks;
                    _preferences.SyncHistory = result.Preferences.SyncHistory;
                    _preferences.SyncPasswords = result.Preferences.SyncPasswords;
                    _preferences.SyncAutofill = result.Preferences.SyncAutofill;
                    _preferences.SyncExtensions = result.Preferences.SyncExtensions;
                    _preferences.SyncThemes = result.Preferences.SyncThemes;
                    _preferences.SyncSettings = result.Preferences.SyncSettings;

                    await _secureStorage.StoreAsync("sync_preferences", _preferences);
                    OnPropertyChanged(nameof(IsSyncEnabled));
                    Log("Server sync preferences loaded and applied");
                }
            }
        }
        catch (Exception ex)
        {
            Log($"Failed to fetch server preferences: {ex.Message}");
            // Continue with local preferences
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
        if (_authService.IsSignedIn)
        {
            StartSyncTimer();
            Status = SyncStatus.Idle;
            _ = SyncNowAsync();
        }
    }

    /// <summary>
    /// Get sync progress for all collections
    /// </summary>
    public async Task<List<CollectionProgress>?> GetProgressAsync()
    {
        var token = await _authService.GetAccessTokenAsync();
        if (string.IsNullOrEmpty(token)) return null;

        var response = await SendRequestAsync<ProgressResponse>(
            HttpMethod.Get,
            $"devices/{_metadata.DeviceId}/progress",
            token,
            null);

        return response?.Progress;
    }

    private void OnAuthStateChanged(object? sender, AuthenticationState state)
    {
        Log($"Auth state changed: {state}");

        if (state == AuthenticationState.SignedIn)
        {
            Log("User signed in - starting sync");
            _isRegistered = false; // Re-register on new sign in
            StartSyncTimer();
            StartHeartbeatTimer();
            _ = SyncNowAsync();
        }
        else
        {
            Log("User not signed in - stopping sync");
            StopSyncTimer();
            StopHeartbeatTimer();
            _ = EndSessionAsync();
            Status = SyncStatus.Idle;
            LastError = null;
            _isRegistered = false;
        }
    }

    /// <summary>
    /// Start the heartbeat timer for InspireContinuum session tracking
    /// </summary>
    public void StartHeartbeatTimer()
    {
        _heartbeatTimer?.Dispose();
        _heartbeatTimer = new Timer(async _ => await SendHeartbeatAsync(), null, 0, HeartbeatIntervalMs);
        Log("Heartbeat timer started");
    }

    /// <summary>
    /// Stop the heartbeat timer
    /// </summary>
    public void StopHeartbeatTimer()
    {
        _heartbeatTimer?.Dispose();
        _heartbeatTimer = null;
        Log("Heartbeat timer stopped");
    }

    /// <summary>
    /// Send a heartbeat to InspireContinuum to track active browser session
    /// </summary>
    private async Task SendHeartbeatAsync()
    {
        if (!_authService.IsSignedIn)
        {
            Log("Heartbeat skipped - not signed in");
            return;
        }

        try
        {
            var currentProfile = _authService.CurrentProfile;
            if (currentProfile == null)
            {
                Log("Heartbeat skipped - no current profile");
                return;
            }

            var payload = new
            {
                user_id = currentProfile.UserId,
                browser_id = _metadata.DeviceId,
                client_type = "jubilee_browser",
                session_id = Guid.NewGuid().ToString(),
                device_info = new
                {
                    device_name = Environment.MachineName,
                    platform = "Windows",
                    platform_version = Environment.OSVersion.VersionString,
                    app_name = "JubileeBrowser",
                    app_version = "8.0"
                }
            };

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{_continuumApiBaseUrl}/api/v1/admin/heartbeat", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Log($"Heartbeat sent successfully: {responseBody}");
            }
            else
            {
                Log($"Heartbeat failed ({response.StatusCode}): {responseBody}");
            }
        }
        catch (Exception ex)
        {
            Log($"Heartbeat error: {ex.Message}");
        }
    }

    /// <summary>
    /// End the browser session on InspireContinuum (on sign out)
    /// </summary>
    private async Task EndSessionAsync()
    {
        try
        {
            var currentProfile = _authService.CurrentProfile;
            if (currentProfile == null)
            {
                return;
            }

            var payload = new
            {
                user_id = currentProfile.UserId,
                browser_id = _metadata.DeviceId
            };

            using var client = new HttpClient();
            client.Timeout = TimeSpan.FromSeconds(10);
            var json = JsonSerializer.Serialize(payload, JsonOptions);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await client.PostAsync($"{_continuumApiBaseUrl}/api/v1/admin/session/end", content);

            if (response.IsSuccessStatusCode)
            {
                Log("Session ended on InspireContinuum");
            }
        }
        catch (Exception ex)
        {
            Log($"End session error: {ex.Message}");
        }
    }

    private static void Log(string message)
    {
        System.Diagnostics.Debug.WriteLine($"[SyncEngine] {message}");
    }

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    public void Dispose()
    {
        if (_isDisposed) return;
        _isDisposed = true;
        _syncCts?.Cancel();
        _syncTimer?.Dispose();
        _heartbeatTimer?.Dispose();
        _syncLock.Dispose();
        _httpClient.Dispose();
        GC.SuppressFinalize(this);
    }
}

/// <summary>
/// Extension method to clone HttpRequestMessage
/// </summary>
internal static class HttpRequestMessageExtensions
{
    public static HttpRequestMessage Clone(this HttpRequestMessage request)
    {
        var clone = new HttpRequestMessage(request.Method, request.RequestUri)
        {
            Content = request.Content,
            Version = request.Version
        };

        foreach (var header in request.Headers)
        {
            clone.Headers.TryAddWithoutValidation(header.Key, header.Value);
        }

        foreach (var option in request.Options)
        {
            clone.Options.TryAdd(option.Key, option.Value);
        }

        return clone;
    }
}
