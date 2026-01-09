using System.Net.Http;
using System.Net.Http.Headers;
using System.Security.Cryptography;
using System.Text;
using Newtonsoft.Json;
using JubileeBrowser.Models;
using JubileeBrowser.Shared.Models;

namespace JubileeBrowser.Services;

public class AuthenticationManager
{
    private const string AuthEndpoint = "https://inspirecodex.com/api/auth";
    private const int TokenRefreshBufferMinutes = 5;

    private readonly SecureTokenStorage _tokenStorage;
    private readonly HttpClient _httpClient;

    private AuthSession _session = new();
    private System.Timers.Timer? _tokenRefreshTimer;

    public event EventHandler<AuthSession>? SessionChanged;
    public event EventHandler<ParticipationFeature>? SignInRequired;

    public AuthSession Session => _session;

    public AuthenticationManager()
    {
        _tokenStorage = new SecureTokenStorage();
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(AuthEndpoint)
        };
    }

    public async Task InitializeAsync()
    {
        try
        {
            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens != null && !IsTokenExpired(tokens))
            {
                await RefreshSessionAsync(tokens);
            }
            else if (tokens != null && !string.IsNullOrEmpty(tokens.RefreshToken))
            {
                await RefreshTokenAsync(tokens.RefreshToken);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error initializing auth: {ex.Message}");
            _session = new AuthSession { State = AuthenticationState.SignedOut };
        }
    }

    public async Task<AuthSession> SignInAsync(string email, string? password = null)
    {
        try
        {
            _session.State = AuthenticationState.SigningIn;
            OnSessionChanged();

            var request = new
            {
                email,
                password,
                rememberMe = true
            };

            var response = await _httpClient.PostAsync("/login",
                new StringContent(JsonConvert.SerializeObject(request), Encoding.UTF8, "application/json"));

            if (!response.IsSuccessStatusCode)
            {
                var error = await response.Content.ReadAsStringAsync();
                throw new Exception($"Authentication failed: {error}");
            }

            var content = await response.Content.ReadAsStringAsync();
            var loginResponse = JsonConvert.DeserializeObject<LoginResponse>(content);

            if (loginResponse?.Success == true && loginResponse.Tokens != null)
            {
                var tokens = new TokenSet
                {
                    AccessToken = loginResponse.Tokens.AccessToken,
                    RefreshToken = loginResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(loginResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds()
                };
                await _tokenStorage.SaveTokensAsync(tokens);

                // Set profile from login response
                if (loginResponse.User != null)
                {
                    _session = new AuthSession
                    {
                        State = AuthenticationState.SignedIn,
                        Profile = new JubileeUserProfile
                        {
                            UserId = loginResponse.User.Id,
                            Email = loginResponse.User.Email,
                            DisplayName = loginResponse.User.DisplayName ?? loginResponse.User.Email,
                            AccountStatus = AccountStatus.Active,
                            AvatarUrl = loginResponse.User.AvatarUrl
                        }
                    };
                    StartTokenRefreshTimer(tokens);
                    OnSessionChanged();
                }
            }
            else
            {
                throw new Exception(loginResponse?.Error ?? "Login failed");
            }

            return _session;
        }
        catch (Exception ex)
        {
            _session.State = AuthenticationState.Error;
            _session.LastError = ex.Message;
            OnSessionChanged();
            throw;
        }
    }

    public async Task SignOutAsync()
    {
        try
        {
            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens != null)
            {
                // Logout on server
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

                await _httpClient.PostAsync("/logout", null);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error logging out: {ex.Message}");
        }
        finally
        {
            await _tokenStorage.ClearTokensAsync();
            _session = new AuthSession { State = AuthenticationState.SignedOut };
            StopTokenRefreshTimer();
            OnSessionChanged();
        }
    }

    public async Task<bool> RefreshTokenAsync(string? refreshToken = null)
    {
        try
        {
            if (string.IsNullOrEmpty(refreshToken))
            {
                var tokens = await _tokenStorage.LoadTokensAsync();
                refreshToken = tokens?.RefreshToken;
            }

            if (string.IsNullOrEmpty(refreshToken))
            {
                _session.State = AuthenticationState.SignedOut;
                OnSessionChanged();
                return false;
            }

            var request = new
            {
                refreshToken
            };

            var response = await _httpClient.PostAsync("/refresh",
                new StringContent(JsonConvert.SerializeObject(request), Encoding.UTF8, "application/json"));

            if (!response.IsSuccessStatusCode)
            {
                _session.State = AuthenticationState.TokenExpired;
                OnSessionChanged();
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            var refreshResponse = JsonConvert.DeserializeObject<LoginResponse>(content);

            if (refreshResponse?.Success == true && refreshResponse.Tokens != null)
            {
                var newTokens = new TokenSet
                {
                    AccessToken = refreshResponse.Tokens.AccessToken,
                    RefreshToken = refreshResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds()
                };
                await _tokenStorage.SaveTokensAsync(newTokens);

                if (refreshResponse.User != null)
                {
                    _session = new AuthSession
                    {
                        State = AuthenticationState.SignedIn,
                        Profile = new JubileeUserProfile
                        {
                            UserId = refreshResponse.User.Id,
                            Email = refreshResponse.User.Email,
                            DisplayName = refreshResponse.User.DisplayName ?? refreshResponse.User.Email,
                            AccountStatus = AccountStatus.Active,
                            AvatarUrl = refreshResponse.User.AvatarUrl
                        }
                    };
                    StartTokenRefreshTimer(newTokens);
                    OnSessionChanged();
                }
                return true;
            }

            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error refreshing token: {ex.Message}");
            _session.State = AuthenticationState.Error;
            _session.LastError = ex.Message;
            OnSessionChanged();
            return false;
        }
    }

    private async Task RefreshSessionAsync(TokenSet tokens)
    {
        try
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            var response = await _httpClient.GetAsync("/me");
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var meResponse = JsonConvert.DeserializeObject<MeResponse>(content);

                if (meResponse?.Success == true && meResponse.User != null)
                {
                    _session = new AuthSession
                    {
                        State = AuthenticationState.SignedIn,
                        Profile = new JubileeUserProfile
                        {
                            UserId = meResponse.User.Id,
                            Email = meResponse.User.Email,
                            DisplayName = meResponse.User.DisplayName ?? meResponse.User.Email,
                            AccountStatus = AccountStatus.Active,
                            AvatarUrl = meResponse.User.AvatarUrl
                        }
                    };

                    StartTokenRefreshTimer(tokens);
                    OnSessionChanged();
                }
                else
                {
                    _session.State = AuthenticationState.TokenExpired;
                    OnSessionChanged();
                }
            }
            else
            {
                _session.State = AuthenticationState.TokenExpired;
                OnSessionChanged();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error refreshing session: {ex.Message}");
            _session.State = AuthenticationState.Error;
            _session.LastError = ex.Message;
            OnSessionChanged();
        }
    }

    private void StartTokenRefreshTimer(TokenSet tokens)
    {
        StopTokenRefreshTimer();

        var expiresAt = DateTimeOffset.FromUnixTimeMilliseconds(tokens.ExpiresAt);
        var refreshTime = expiresAt.AddMinutes(-TokenRefreshBufferMinutes);
        var delay = refreshTime - DateTimeOffset.UtcNow;

        if (delay.TotalMilliseconds <= 0)
        {
            _ = RefreshTokenAsync(tokens.RefreshToken);
            return;
        }

        _tokenRefreshTimer = new System.Timers.Timer(delay.TotalMilliseconds);
        _tokenRefreshTimer.Elapsed += async (s, e) =>
        {
            _tokenRefreshTimer?.Stop();
            await RefreshTokenAsync(tokens.RefreshToken);
        };
        _tokenRefreshTimer.AutoReset = false;
        _tokenRefreshTimer.Start();
    }

    private void StopTokenRefreshTimer()
    {
        _tokenRefreshTimer?.Stop();
        _tokenRefreshTimer?.Dispose();
        _tokenRefreshTimer = null;
    }

    private static bool IsTokenExpired(TokenSet tokens)
    {
        return DateTimeOffset.FromUnixTimeMilliseconds(tokens.ExpiresAt) <= DateTimeOffset.UtcNow;
    }

    public PermissionCheckResult CheckPermission(ParticipationFeature feature)
    {
        if (!_session.IsAuthenticated)
        {
            return new PermissionCheckResult
            {
                Allowed = false,
                RequiresSignIn = true,
                Reason = "Sign in required"
            };
        }

        if (_session.Profile?.AccountStatus != AccountStatus.Active)
        {
            return new PermissionCheckResult
            {
                Allowed = false,
                RequiresSignIn = false,
                Reason = "Account not active"
            };
        }

        return new PermissionCheckResult { Allowed = true };
    }

    public void RequestSignIn(ParticipationFeature feature)
    {
        SignInRequired?.Invoke(this, feature);
    }

    private void OnSessionChanged()
    {
        SessionChanged?.Invoke(this, _session);
    }
}

public class SecureTokenStorage
{
    private readonly string _tokenPath;

    public SecureTokenStorage()
    {
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser"
        );
        Directory.CreateDirectory(appDataPath);
        _tokenPath = Path.Combine(appDataPath, "tokens.dat");
    }

    public async Task<TokenSet?> LoadTokensAsync()
    {
        try
        {
            if (!File.Exists(_tokenPath))
                return null;

            var encryptedData = await File.ReadAllBytesAsync(_tokenPath);
            var decryptedData = ProtectedData.Unprotect(
                encryptedData,
                null,
                DataProtectionScope.CurrentUser);

            var json = Encoding.UTF8.GetString(decryptedData);
            return JsonConvert.DeserializeObject<TokenSet>(json);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error loading tokens: {ex.Message}");
            return null;
        }
    }

    public async Task SaveTokensAsync(TokenSet tokens)
    {
        try
        {
            var json = JsonConvert.SerializeObject(tokens);
            var data = Encoding.UTF8.GetBytes(json);
            var encryptedData = ProtectedData.Protect(
                data,
                null,
                DataProtectionScope.CurrentUser);

            await File.WriteAllBytesAsync(_tokenPath, encryptedData);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error saving tokens: {ex.Message}");
        }
    }

    public Task ClearTokensAsync()
    {
        try
        {
            if (File.Exists(_tokenPath))
            {
                File.Delete(_tokenPath);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error clearing tokens: {ex.Message}");
        }
        return Task.CompletedTask;
    }
}
