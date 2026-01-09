using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using Newtonsoft.Json;
using JubileeVibes.Core.Events;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Services;

public class AuthenticationService : IAuthenticationService
{
    private const string SsoBaseUrl = "https://sso.worldwidebibleweb.org";
    private const string SessionKey = "auth_session";
    private const string UserKey = "current_user";

    private readonly ISecureStorageService _secureStorage;
    private readonly HttpClient _httpClient;

    private User? _currentUser;
    private AuthSession? _currentSession;

    public AuthSession? CurrentSession => _currentSession;
    public User? CurrentUser => _currentUser;
    public bool IsAuthenticated => _currentUser != null && _currentSession != null && !_currentSession.IsExpired;

    public event EventHandler<AuthStateChangedEventArgs>? AuthStateChanged;

    public AuthenticationService(ISecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(SsoBaseUrl),
            Timeout = TimeSpan.FromSeconds(30)
        };
    }

    public async Task InitializeAsync()
    {
        try
        {
            var sessionJson = await _secureStorage.GetAsync(SessionKey);
            var userJson = await _secureStorage.GetAsync(UserKey);

            if (!string.IsNullOrEmpty(sessionJson) && !string.IsNullOrEmpty(userJson))
            {
                _currentSession = JsonConvert.DeserializeObject<AuthSession>(sessionJson);
                _currentUser = JsonConvert.DeserializeObject<User>(userJson);

                if (_currentSession != null && _currentSession.IsExpired)
                {
                    var refreshed = await RefreshTokenAsync();
                    if (!refreshed)
                    {
                        await SignOutAsync();
                        return;
                    }
                }

                if (_currentUser != null)
                {
                    AuthStateChanged?.Invoke(this, new AuthStateChangedEventArgs(true, _currentUser.Id, _currentUser.DisplayName));
                }
            }
        }
        catch
        {
            // Failed to restore session
        }
    }

    public async Task<AuthResult> SignInAsync(string email, string password)
    {
        try
        {
            var request = new
            {
                email,
                password,
                client_id = "jubileevibes-desktop"
            };

            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/api/auth/login", content);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                var authResponse = JsonConvert.DeserializeObject<AuthResponse>(responseJson);

                if (authResponse != null)
                {
                    _currentSession = new AuthSession
                    {
                        UserId = authResponse.User?.Id ?? string.Empty,
                        AccessToken = authResponse.AccessToken,
                        RefreshToken = authResponse.RefreshToken ?? string.Empty,
                        ExpiresAt = DateTime.UtcNow.AddSeconds(authResponse.ExpiresIn)
                    };
                    _currentUser = authResponse.User;

                    await _secureStorage.SetAsync(SessionKey, JsonConvert.SerializeObject(_currentSession));
                    if (_currentUser != null)
                    {
                        await _secureStorage.SetAsync(UserKey, JsonConvert.SerializeObject(_currentUser));
                    }

                    AuthStateChanged?.Invoke(this, new AuthStateChangedEventArgs(true, _currentUser?.Id, _currentUser?.DisplayName));

                    return AuthResult.Succeeded(_currentSession);
                }
            }

            var errorContent = await response.Content.ReadAsStringAsync();
            return AuthResult.Failed(ParseErrorMessage(errorContent) ?? "Authentication failed");
        }
        catch (HttpRequestException)
        {
            return AuthResult.Failed("Unable to connect to authentication server. Please check your internet connection.");
        }
        catch (TaskCanceledException)
        {
            return AuthResult.Failed("Connection timed out. Please try again.");
        }
        catch (Exception ex)
        {
            return AuthResult.Failed($"An unexpected error occurred: {ex.Message}");
        }
    }

    public async Task<AuthResult> SignInWithTokenAsync()
    {
        if (_currentSession == null || string.IsNullOrEmpty(_currentSession.RefreshToken))
        {
            return AuthResult.Failed("No stored session found");
        }

        var refreshed = await RefreshTokenAsync();
        if (refreshed && _currentSession != null)
        {
            return AuthResult.Succeeded(_currentSession);
        }

        return AuthResult.Failed("Failed to restore session");
    }

    public async Task SignOutAsync()
    {
        try
        {
            if (_currentSession != null && !string.IsNullOrEmpty(_currentSession.AccessToken))
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", _currentSession.AccessToken);
                await _httpClient.PostAsync("/api/auth/logout", null);
            }
        }
        catch
        {
            // Ignore server errors during logout
        }
        finally
        {
            _currentSession = null;
            _currentUser = null;

            await _secureStorage.RemoveAsync(SessionKey);
            await _secureStorage.RemoveAsync(UserKey);

            AuthStateChanged?.Invoke(this, new AuthStateChangedEventArgs(false, null, null));
        }
    }

    public async Task<bool> RefreshTokenAsync()
    {
        if (_currentSession == null || string.IsNullOrEmpty(_currentSession.RefreshToken))
            return false;

        try
        {
            var request = new
            {
                refresh_token = _currentSession.RefreshToken,
                client_id = "jubileevibes-desktop"
            };

            var json = JsonConvert.SerializeObject(request);
            var content = new StringContent(json, Encoding.UTF8, "application/json");

            var response = await _httpClient.PostAsync("/api/auth/refresh", content);

            if (response.IsSuccessStatusCode)
            {
                var responseJson = await response.Content.ReadAsStringAsync();
                var authResponse = JsonConvert.DeserializeObject<AuthResponse>(responseJson);

                if (authResponse != null)
                {
                    _currentSession = new AuthSession
                    {
                        UserId = _currentSession.UserId,
                        AccessToken = authResponse.AccessToken,
                        RefreshToken = authResponse.RefreshToken ?? _currentSession.RefreshToken,
                        ExpiresAt = DateTime.UtcNow.AddSeconds(authResponse.ExpiresIn)
                    };

                    await _secureStorage.SetAsync(SessionKey, JsonConvert.SerializeObject(_currentSession));
                    return true;
                }
            }
        }
        catch
        {
            // Token refresh failed
        }

        return false;
    }

    public async Task<string?> GetAccessTokenAsync()
    {
        if (_currentSession == null)
            return null;

        if (_currentSession.IsExpired)
        {
            var refreshed = await RefreshTokenAsync();
            if (!refreshed)
                return null;
        }

        return _currentSession?.AccessToken;
    }

    private string? ParseErrorMessage(string errorContent)
    {
        try
        {
            var error = JsonConvert.DeserializeObject<ErrorResponse>(errorContent);
            return error?.Message ?? error?.Error;
        }
        catch
        {
            return null;
        }
    }

    private class AuthResponse
    {
        [JsonProperty("access_token")]
        public string AccessToken { get; set; } = string.Empty;

        [JsonProperty("refresh_token")]
        public string? RefreshToken { get; set; }

        [JsonProperty("expires_in")]
        public int ExpiresIn { get; set; } = 3600;

        [JsonProperty("user")]
        public User? User { get; set; }
    }

    private class ErrorResponse
    {
        [JsonProperty("message")]
        public string? Message { get; set; }

        [JsonProperty("error")]
        public string? Error { get; set; }
    }
}
