using System.Diagnostics;
using System.Net;
using System.Net.Http;
using System.Text.Json;
using System.Text.Json.Serialization;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// API service for user email preferences via Codex API
/// Handles blocked senders and ignored conversations with offline-first support
/// </summary>
public class ApiUserPreferencesService
{
    private static ApiUserPreferencesService? _instance;
    private static readonly object _lock = new();

    private readonly HttpClientFactory _httpClientFactory;
    private readonly JsonSerializerOptions _jsonOptions;

    // Service dependencies for offline-first support
    private NetworkStatusService? _networkStatus;

    /// <summary>
    /// Gets the network status service instance
    /// </summary>
    private NetworkStatusService NetworkStatus => _networkStatus ??= NetworkStatusService.Instance;

    /// <summary>
    /// Returns true if the network is available and API is reachable
    /// </summary>
    public bool IsOnline => NetworkStatus.IsOnline && NetworkStatus.IsApiReachable;

    /// <summary>
    /// Singleton instance of the user preferences service
    /// </summary>
    public static ApiUserPreferencesService Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new ApiUserPreferencesService();
                }
            }
            return _instance;
        }
    }

    public ApiUserPreferencesService()
    {
        _httpClientFactory = HttpClientFactory.Instance;

        _jsonOptions = new JsonSerializerOptions
        {
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
            PropertyNameCaseInsensitive = true,
            DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull,
            Converters = { new JsonStringEnumConverter(JsonNamingPolicy.CamelCase) }
        };

        Debug.WriteLine("[ApiUserPreferencesService] Initialized with HttpClientFactory");
    }

    // ============================================================================
    // BLOCKED SENDERS
    // ============================================================================

    /// <summary>
    /// Get all blocked email senders for the current user
    /// GET /api/user-preferences/{userId}/blocked-senders
    /// </summary>
    public async Task<List<string>> GetBlockedSendersAsync()
    {
        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - cannot fetch blocked senders from API");
            return new List<string>();
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return new List<string>();
            }

            var endpoint = $"user-preferences/{userId}/blocked-senders";
            Debug.WriteLine($"[ApiUserPreferencesService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<ApiDataResponse<List<string>>>(content, _jsonOptions);
                var blockedSenders = result?.Data ?? new List<string>();
                Debug.WriteLine($"[ApiUserPreferencesService] Retrieved {blockedSenders.Count} blocked senders from API");
                return blockedSenders;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to get blocked senders: {response.StatusCode} - {content}");
            return new List<string>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error getting blocked senders: {ex.Message}");
            return new List<string>();
        }
    }

    /// <summary>
    /// Add a blocked email sender for the current user
    /// POST /api/user-preferences/{userId}/blocked-senders
    /// </summary>
    public async Task<bool> AddBlockedSenderAsync(string emailAddress)
    {
        if (string.IsNullOrEmpty(emailAddress))
        {
            Debug.WriteLine("[ApiUserPreferencesService] Cannot add empty email address");
            return false;
        }

        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - queuing blocked sender for later sync");
            // TODO: Queue for later sync when online
            return false;
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return false;
            }

            var endpoint = $"user-preferences/{userId}/blocked-senders";
            var body = new { emailAddress = emailAddress.ToLowerInvariant().Trim() };

            Debug.WriteLine($"[ApiUserPreferencesService] POST {endpoint} - {emailAddress}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireCodex, endpoint, body);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"[ApiUserPreferencesService] Blocked sender added: {emailAddress}");
                return true;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to add blocked sender: {response.StatusCode} - {content}");
            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error adding blocked sender: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Remove a blocked email sender for the current user
    /// DELETE /api/user-preferences/{userId}/blocked-senders/{email}
    /// </summary>
    public async Task<bool> RemoveBlockedSenderAsync(string emailAddress)
    {
        if (string.IsNullOrEmpty(emailAddress))
        {
            Debug.WriteLine("[ApiUserPreferencesService] Cannot remove empty email address");
            return false;
        }

        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - queuing blocked sender removal for later sync");
            // TODO: Queue for later sync when online
            return false;
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return false;
            }

            var encodedEmail = Uri.EscapeDataString(emailAddress.ToLowerInvariant().Trim());
            var endpoint = $"user-preferences/{userId}/blocked-senders/{encodedEmail}";

            Debug.WriteLine($"[ApiUserPreferencesService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"[ApiUserPreferencesService] Blocked sender removed: {emailAddress}");
                return true;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to remove blocked sender: {response.StatusCode} - {content}");
            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error removing blocked sender: {ex.Message}");
            return false;
        }
    }

    // ============================================================================
    // IGNORED CONVERSATIONS
    // ============================================================================

    /// <summary>
    /// Get all ignored conversation IDs for the current user
    /// GET /api/user-preferences/{userId}/ignored-conversations
    /// </summary>
    public async Task<List<string>> GetIgnoredConversationsAsync()
    {
        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - cannot fetch ignored conversations from API");
            return new List<string>();
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return new List<string>();
            }

            var endpoint = $"user-preferences/{userId}/ignored-conversations";
            Debug.WriteLine($"[ApiUserPreferencesService] GET {endpoint}");

            var response = await _httpClientFactory.GetAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<ApiDataResponse<List<string>>>(content, _jsonOptions);
                var ignoredConversations = result?.Data ?? new List<string>();
                Debug.WriteLine($"[ApiUserPreferencesService] Retrieved {ignoredConversations.Count} ignored conversations from API");
                return ignoredConversations;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to get ignored conversations: {response.StatusCode} - {content}");
            return new List<string>();
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error getting ignored conversations: {ex.Message}");
            return new List<string>();
        }
    }

    /// <summary>
    /// Add an ignored conversation for the current user
    /// POST /api/user-preferences/{userId}/ignored-conversations
    /// </summary>
    public async Task<bool> AddIgnoredConversationAsync(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
        {
            Debug.WriteLine("[ApiUserPreferencesService] Cannot add empty conversation ID");
            return false;
        }

        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - queuing ignored conversation for later sync");
            // TODO: Queue for later sync when online
            return false;
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return false;
            }

            var endpoint = $"user-preferences/{userId}/ignored-conversations";
            var body = new { conversationId };

            Debug.WriteLine($"[ApiUserPreferencesService] POST {endpoint} - {conversationId}");

            var response = await _httpClientFactory.PostAsync(ApiEndpoint.InspireCodex, endpoint, body);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"[ApiUserPreferencesService] Ignored conversation added: {conversationId}");
                return true;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to add ignored conversation: {response.StatusCode} - {content}");
            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error adding ignored conversation: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Remove an ignored conversation for the current user
    /// DELETE /api/user-preferences/{userId}/ignored-conversations/{conversationId}
    /// </summary>
    public async Task<bool> RemoveIgnoredConversationAsync(string conversationId)
    {
        if (string.IsNullOrEmpty(conversationId))
        {
            Debug.WriteLine("[ApiUserPreferencesService] Cannot remove empty conversation ID");
            return false;
        }

        if (!IsOnline)
        {
            Debug.WriteLine("[ApiUserPreferencesService] Offline - queuing ignored conversation removal for later sync");
            // TODO: Queue for later sync when online
            return false;
        }

        try
        {
            var userId = ServiceConfiguration.UserId;
            if (string.IsNullOrEmpty(userId))
            {
                Debug.WriteLine("[ApiUserPreferencesService] No user ID available");
                return false;
            }

            var encodedId = Uri.EscapeDataString(conversationId);
            var endpoint = $"user-preferences/{userId}/ignored-conversations/{encodedId}";

            Debug.WriteLine($"[ApiUserPreferencesService] DELETE {endpoint}");

            var response = await _httpClientFactory.DeleteAsync(ApiEndpoint.InspireCodex, endpoint);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"[ApiUserPreferencesService] Ignored conversation removed: {conversationId}");
                return true;
            }

            Debug.WriteLine($"[ApiUserPreferencesService] Failed to remove ignored conversation: {response.StatusCode} - {content}");
            return false;
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[ApiUserPreferencesService] Error removing ignored conversation: {ex.Message}");
            return false;
        }
    }
}

/// <summary>
/// Generic API response wrapper for data responses
/// </summary>
internal class ApiDataResponse<T>
{
    public T? Data { get; set; }
    public string? Error { get; set; }
}
