using System.Net;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Centralized HTTP client factory for all API requests
/// Handles authentication token attachment, automatic token refresh on 401 responses,
/// and retry policies for transient failures using Polly
/// </summary>
public class HttpClientFactory
{
    private static HttpClientFactory? _instance;
    private static readonly object _lock = new();

    private readonly HttpClient _inspireContinuumClient;
    private readonly HttpClient _inspireCodexClient;
    private readonly HttpClient _authClient;
    private readonly SecureTokenStorage _tokenStorage;
    private readonly ConfigurationService _config;
    private readonly ResiliencePolicyService _resilienceService;

    private bool _isRefreshing = false;
    private readonly SemaphoreSlim _refreshLock = new(1, 1);

    /// <summary>
    /// Event fired when authentication fails and user needs to re-login
    /// </summary>
    public event EventHandler? AuthenticationRequired;

    /// <summary>
    /// Event fired when token is successfully refreshed
    /// </summary>
    public event EventHandler? TokenRefreshed;

    /// <summary>
    /// Event fired when a network error occurs
    /// </summary>
    public event EventHandler<NetworkErrorEventArgs>? NetworkError;

    /// <summary>
    /// Event fired when a retry is being attempted
    /// </summary>
    public event EventHandler<RetryEventArgs>? RetryAttempted;

    /// <summary>
    /// Singleton instance of the HTTP client factory
    /// </summary>
    public static HttpClientFactory Instance
    {
        get
        {
            if (_instance == null)
            {
                lock (_lock)
                {
                    _instance ??= new HttpClientFactory();
                }
            }
            return _instance;
        }
    }

    private HttpClientFactory()
    {
        _config = ConfigurationService.Instance;
        _tokenStorage = new SecureTokenStorage();
        _resilienceService = ResiliencePolicyService.Instance;

        // Subscribe to resilience events
        _resilienceService.RetryAttempted += (s, e) => OnRetryAttempted(e);
        _resilienceService.RetriesExhausted += (s, e) => OnNetworkError(new NetworkErrorEventArgs
        {
            Exception = e.Exception,
            FriendlyMessage = e.FriendlyMessage
        });

        // Create HttpClient instances for each API
        _inspireContinuumClient = CreateHttpClient(
            _config.Api.InspireContinuum.BaseUrl,
            _config.Api.InspireContinuum.Timeout);

        _inspireCodexClient = CreateHttpClient(
            _config.Api.InspireCodex.BaseUrl,
            _config.Api.InspireCodex.Timeout);

        _authClient = CreateHttpClient(
            _config.Api.Auth.BaseUrl,
            _config.Api.Auth.Timeout);

        System.Diagnostics.Debug.WriteLine("HttpClientFactory initialized with resilience policies");
        System.Diagnostics.Debug.WriteLine($"  InspireContinuum: {_config.Api.InspireContinuum.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"  InspireCodex: {_config.Api.InspireCodex.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"  Auth: {_config.Api.Auth.BaseUrl}");
        System.Diagnostics.Debug.WriteLine($"  RetryPolicy: MaxRetries={_config.Api.RetryPolicy.MaxRetries}, InitialDelay={_config.Api.RetryPolicy.InitialDelayMs}ms");
    }

    private static HttpClient CreateHttpClient(string baseUrl, int timeoutSeconds)
    {
        var handler = new HttpClientHandler
        {
            AutomaticDecompression = DecompressionMethods.GZip | DecompressionMethods.Deflate
        };

        var client = new HttpClient(handler)
        {
            Timeout = TimeSpan.FromSeconds(timeoutSeconds)
        };

        // Ensure base URL ends with /
        if (!baseUrl.EndsWith("/"))
            baseUrl += "/";

        client.BaseAddress = new Uri(baseUrl);
        client.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));
        client.DefaultRequestHeaders.Add("User-Agent", "JubileeOutlook/1.5.0");

        return client;
    }

    #region Public API Methods

    /// <summary>
    /// Gets the InspireContinuum API client
    /// </summary>
    public HttpClient InspireContinuum => _inspireContinuumClient;

    /// <summary>
    /// Gets the InspireCodex API client
    /// </summary>
    public HttpClient InspireCodex => _inspireCodexClient;

    /// <summary>
    /// Gets the Auth API client (no auto-auth header for login/register)
    /// </summary>
    public HttpClient Auth => _authClient;

    /// <summary>
    /// Sends a GET request with automatic authentication
    /// </summary>
    public Task<HttpResponseMessage> GetAsync(ApiEndpoint endpoint, string requestUri)
    {
        return SendWithAuthAsync(endpoint, HttpMethod.Get, requestUri, null);
    }

    /// <summary>
    /// Sends a POST request with automatic authentication
    /// </summary>
    public Task<HttpResponseMessage> PostAsync(ApiEndpoint endpoint, string requestUri, object? content = null, bool isFormData = false)
    {
        if (isFormData && content is HttpContent httpContent)
        {
            return SendFormDataWithAuthAsync(endpoint, requestUri, httpContent);
        }
        return SendWithAuthAsync(endpoint, HttpMethod.Post, requestUri, content);
    }

    /// <summary>
    /// Sends a PUT request with automatic authentication
    /// </summary>
    public Task<HttpResponseMessage> PutAsync(ApiEndpoint endpoint, string requestUri, object? content = null)
    {
        return SendWithAuthAsync(endpoint, HttpMethod.Put, requestUri, content);
    }

    /// <summary>
    /// Sends a DELETE request with automatic authentication
    /// </summary>
    public Task<HttpResponseMessage> DeleteAsync(ApiEndpoint endpoint, string requestUri)
    {
        return SendWithAuthAsync(endpoint, HttpMethod.Delete, requestUri, null);
    }

    /// <summary>
    /// Sends a PATCH request with automatic authentication
    /// </summary>
    public Task<HttpResponseMessage> PatchAsync(ApiEndpoint endpoint, string requestUri, object? content = null)
    {
        return SendWithAuthAsync(endpoint, HttpMethod.Patch, requestUri, content);
    }

    /// <summary>
    /// Sends an authenticated request and deserializes the response
    /// </summary>
    public async Task<ApiResponse<T>> SendAsync<T>(ApiEndpoint endpoint, HttpMethod method, string requestUri, object? content = null)
    {
        try
        {
            var response = await SendWithAuthAsync(endpoint, method, requestUri, content);
            var responseContent = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var data = JsonSerializer.Deserialize<T>(responseContent, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                return new ApiResponse<T>
                {
                    Success = true,
                    Data = data,
                    StatusCode = response.StatusCode
                };
            }

            return new ApiResponse<T>
            {
                Success = false,
                Error = responseContent,
                StatusCode = response.StatusCode
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"API request failed: {ex.Message}");
            return new ApiResponse<T>
            {
                Success = false,
                Error = ex.Message,
                StatusCode = HttpStatusCode.InternalServerError
            };
        }
    }

    #endregion

    #region Authentication Handling

    /// <summary>
    /// Sends an HTTP request with automatic Bearer token attachment, 401 handling, and retry policies
    /// </summary>
    private async Task<HttpResponseMessage> SendWithAuthAsync(
        ApiEndpoint endpoint,
        HttpMethod method,
        string requestUri,
        object? content)
    {
        var client = GetClient(endpoint);

        try
        {
            // Execute with retry policy for transient failures
            var response = await _resilienceService.ExecuteHttpAsync(async (ct) =>
            {
                var request = CreateRequest(method, requestUri, content);

                // Attach Bearer token if available
                await AttachAuthHeaderAsync(request);

                return await client.SendAsync(request, ct);
            });

            // Handle 401 Unauthorized - try to refresh token (outside retry loop)
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                System.Diagnostics.Debug.WriteLine($"Received 401 for {requestUri}, attempting token refresh...");

                var refreshed = await TryRefreshTokenAsync();
                if (refreshed)
                {
                    // Retry the request with new token (with retry policy)
                    response = await _resilienceService.ExecuteHttpAsync(async (ct) =>
                    {
                        var request = CreateRequest(method, requestUri, content);
                        await AttachAuthHeaderAsync(request);
                        return await client.SendAsync(request, ct);
                    });

                    if (response.StatusCode != HttpStatusCode.Unauthorized)
                    {
                        System.Diagnostics.Debug.WriteLine("Request succeeded after token refresh");
                        return response;
                    }
                }

                // Token refresh failed or still getting 401 - user needs to re-login
                System.Diagnostics.Debug.WriteLine("Token refresh failed, authentication required");
                OnAuthenticationRequired();
            }

            return response;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Request failed after retries: {ex.Message}");

            // Create a failed response for the caller
            var failedResponse = new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            {
                ReasonPhrase = ResiliencePolicyService.GetFriendlyErrorMessage(ex)
            };

            OnNetworkError(new NetworkErrorEventArgs
            {
                Exception = ex,
                FriendlyMessage = ResiliencePolicyService.GetFriendlyErrorMessage(ex),
                RequestUri = requestUri
            });

            return failedResponse;
        }
    }

    /// <summary>
    /// Sends form data (multipart) with automatic Bearer token attachment and retry policies
    /// </summary>
    private async Task<HttpResponseMessage> SendFormDataWithAuthAsync(
        ApiEndpoint endpoint,
        string requestUri,
        HttpContent content)
    {
        var client = GetClient(endpoint);

        try
        {
            // Execute with retry policy for transient failures
            var response = await _resilienceService.ExecuteHttpAsync(async (ct) =>
            {
                var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
                {
                    Content = content
                };

                // Attach Bearer token if available
                await AttachAuthHeaderAsync(request);

                return await client.SendAsync(request, ct);
            });

            // Handle 401 Unauthorized
            if (response.StatusCode == HttpStatusCode.Unauthorized)
            {
                System.Diagnostics.Debug.WriteLine($"Received 401 for form data upload to {requestUri}, attempting token refresh...");

                var refreshed = await TryRefreshTokenAsync();
                if (refreshed)
                {
                    // Retry with new token
                    response = await _resilienceService.ExecuteHttpAsync(async (ct) =>
                    {
                        var request = new HttpRequestMessage(HttpMethod.Post, requestUri)
                        {
                            Content = content
                        };
                        await AttachAuthHeaderAsync(request);
                        return await client.SendAsync(request, ct);
                    });

                    if (response.StatusCode != HttpStatusCode.Unauthorized)
                    {
                        System.Diagnostics.Debug.WriteLine("Form data upload succeeded after token refresh");
                        return response;
                    }
                }

                System.Diagnostics.Debug.WriteLine("Token refresh failed, authentication required");
                OnAuthenticationRequired();
            }

            return response;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Form data upload failed after retries: {ex.Message}");

            var failedResponse = new HttpResponseMessage(HttpStatusCode.ServiceUnavailable)
            {
                ReasonPhrase = ResiliencePolicyService.GetFriendlyErrorMessage(ex)
            };

            OnNetworkError(new NetworkErrorEventArgs
            {
                Exception = ex,
                FriendlyMessage = ResiliencePolicyService.GetFriendlyErrorMessage(ex),
                RequestUri = requestUri
            });

            return failedResponse;
        }
    }

    /// <summary>
    /// Attaches the Bearer token and X-User-Id header to the request if available
    /// Falls back to ServiceConfiguration.UserId for development when no auth tokens exist
    /// </summary>
    private async Task AttachAuthHeaderAsync(HttpRequestMessage request)
    {
        try
        {
            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens != null && !string.IsNullOrEmpty(tokens.AccessToken))
            {
                request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

                // Also attach X-User-Id header for InspireContinuum API compatibility
                if (!string.IsNullOrEmpty(tokens.CachedUserId))
                {
                    request.Headers.Add("X-User-Id", tokens.CachedUserId);
                    System.Diagnostics.Debug.WriteLine($"[HttpClientFactory] Added X-User-Id header: {tokens.CachedUserId}");
                }
            }
            else
            {
                // Fallback to ServiceConfiguration.UserId for development/testing
                var userId = ServiceConfiguration.UserId;
                if (!string.IsNullOrEmpty(userId))
                {
                    request.Headers.Add("X-User-Id", userId);
                    System.Diagnostics.Debug.WriteLine($"[HttpClientFactory] Added X-User-Id header from ServiceConfiguration: {userId}");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error attaching auth header: {ex.Message}");
        }
    }

    /// <summary>
    /// Attempts to refresh the access token
    /// </summary>
    private async Task<bool> TryRefreshTokenAsync()
    {
        // Prevent multiple simultaneous refresh attempts
        await _refreshLock.WaitAsync();
        try
        {
            if (_isRefreshing)
            {
                return false;
            }

            _isRefreshing = true;

            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens == null || string.IsNullOrEmpty(tokens.RefreshToken))
            {
                System.Diagnostics.Debug.WriteLine("No refresh token available");
                return false;
            }

            System.Diagnostics.Debug.WriteLine("Attempting to refresh access token...");

            var refreshRequest = new { refreshToken = tokens.RefreshToken };
            var content = new StringContent(
                JsonSerializer.Serialize(refreshRequest),
                Encoding.UTF8,
                "application/json");

            var response = await _authClient.PostAsync("refresh", content);

            if (!response.IsSuccessStatusCode)
            {
                System.Diagnostics.Debug.WriteLine($"Token refresh failed: {response.StatusCode}");
                return false;
            }

            var responseContent = await response.Content.ReadAsStringAsync();
            var refreshResponse = JsonSerializer.Deserialize<RefreshTokenResponse>(responseContent, new JsonSerializerOptions
            {
                PropertyNameCaseInsensitive = true
            });

            if (refreshResponse?.Success == true && refreshResponse.Tokens != null)
            {
                var newTokens = new TokenSet
                {
                    AccessToken = refreshResponse.Tokens.AccessToken,
                    RefreshToken = refreshResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds(),
                    CachedUserId = tokens.CachedUserId,
                    CachedEmail = tokens.CachedEmail,
                    CachedDisplayName = tokens.CachedDisplayName,
                    CachedAvatarUrl = tokens.CachedAvatarUrl
                };

                await _tokenStorage.SaveTokensAsync(newTokens);
                System.Diagnostics.Debug.WriteLine("Token refreshed successfully");

                OnTokenRefreshed();
                return true;
            }

            System.Diagnostics.Debug.WriteLine("Token refresh response was unsuccessful");
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Token refresh error: {ex.Message}");
            return false;
        }
        finally
        {
            _isRefreshing = false;
            _refreshLock.Release();
        }
    }

    /// <summary>
    /// Clears authentication tokens (called on logout)
    /// </summary>
    public async Task ClearAuthenticationAsync()
    {
        await _tokenStorage.ClearTokensAsync();
        System.Diagnostics.Debug.WriteLine("Authentication cleared");
    }

    /// <summary>
    /// Checks if user is currently authenticated
    /// </summary>
    public async Task<bool> IsAuthenticatedAsync()
    {
        var tokens = await _tokenStorage.LoadTokensAsync();
        if (tokens == null || string.IsNullOrEmpty(tokens.AccessToken))
            return false;

        // Check if token is expired
        var expiresAt = DateTimeOffset.FromUnixTimeMilliseconds(tokens.ExpiresAt);
        return expiresAt > DateTimeOffset.UtcNow;
    }

    /// <summary>
    /// Gets the current access token (for external use if needed)
    /// </summary>
    public async Task<string?> GetAccessTokenAsync()
    {
        var tokens = await _tokenStorage.LoadTokensAsync();
        return tokens?.AccessToken;
    }

    #endregion

    #region Helper Methods

    private HttpClient GetClient(ApiEndpoint endpoint)
    {
        return endpoint switch
        {
            ApiEndpoint.InspireContinuum => _inspireContinuumClient,
            ApiEndpoint.InspireCodex => _inspireCodexClient,
            ApiEndpoint.Auth => _authClient,
            _ => throw new ArgumentException($"Unknown API endpoint: {endpoint}")
        };
    }

    private static readonly JsonSerializerOptions _jsonSerializerOptions = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        DefaultIgnoreCondition = System.Text.Json.Serialization.JsonIgnoreCondition.WhenWritingNull
    };

    private static HttpRequestMessage CreateRequest(HttpMethod method, string requestUri, object? content)
    {
        var request = new HttpRequestMessage(method, requestUri);

        if (content != null)
        {
            var json = JsonSerializer.Serialize(content, _jsonSerializerOptions);
            request.Content = new StringContent(json, Encoding.UTF8, "application/json");
        }

        return request;
    }

    private void OnAuthenticationRequired()
    {
        AuthenticationRequired?.Invoke(this, EventArgs.Empty);
    }

    private void OnTokenRefreshed()
    {
        TokenRefreshed?.Invoke(this, EventArgs.Empty);
    }

    private void OnNetworkError(NetworkErrorEventArgs args)
    {
        NetworkError?.Invoke(this, args);
    }

    private void OnRetryAttempted(RetryEventArgs args)
    {
        RetryAttempted?.Invoke(this, args);
    }

    #endregion

    #region Static Helper Methods

    /// <summary>
    /// Resets the singleton instance (useful for testing or re-initialization)
    /// </summary>
    public static void Reset()
    {
        lock (_lock)
        {
            _instance?.Dispose();
            _instance = null;
        }
    }

    private void Dispose()
    {
        _inspireContinuumClient?.Dispose();
        _inspireCodexClient?.Dispose();
        _authClient?.Dispose();
        _refreshLock?.Dispose();
    }

    #endregion
}

/// <summary>
/// API endpoint enumeration
/// </summary>
public enum ApiEndpoint
{
    InspireContinuum,
    InspireCodex,
    Auth
}

/// <summary>
/// Generic API response wrapper
/// </summary>
public class ApiResponse<T>
{
    public bool Success { get; set; }
    public T? Data { get; set; }
    public string? Error { get; set; }
    public HttpStatusCode StatusCode { get; set; }
}

/// <summary>
/// Refresh token response model
/// </summary>
internal class RefreshTokenResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public TokensResponse? Tokens { get; set; }
}

/// <summary>
/// Tokens response model
/// </summary>
internal class TokensResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
}

/// <summary>
/// Event arguments for network errors
/// </summary>
public class NetworkErrorEventArgs : EventArgs
{
    public Exception? Exception { get; set; }
    public string FriendlyMessage { get; set; } = string.Empty;
    public string? RequestUri { get; set; }
    public HttpStatusCode? StatusCode { get; set; }
}
