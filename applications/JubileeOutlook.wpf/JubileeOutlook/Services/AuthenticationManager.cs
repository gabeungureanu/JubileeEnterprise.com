using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Authentication manager for Jubilee accounts
/// Mirrors the JubileeBrowser implementation for consistent behavior
/// </summary>
public class AuthenticationManager
{
    private const string AuthEndpoint = "https://inspirecodex.com/api/auth/";
    private const int TokenRefreshBufferMinutes = 5;

    private readonly SecureTokenStorage _tokenStorage;
    private readonly HttpClient _httpClient;

    private AuthSession _session = new();
    private System.Timers.Timer? _tokenRefreshTimer;

    public event EventHandler<AuthSession>? SessionChanged;

    public AuthSession Session => _session;

    public AuthenticationManager()
    {
        _tokenStorage = new SecureTokenStorage();
        _httpClient = new HttpClient
        {
            BaseAddress = new Uri(AuthEndpoint),
            Timeout = TimeSpan.FromSeconds(30)
        };
    }

    /// <summary>
    /// Initialize authentication state from stored tokens
    /// </summary>
    public async Task InitializeAsync()
    {
        try
        {
            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens != null)
            {
                // Immediately restore session from cached profile for instant UI update
                if (!string.IsNullOrEmpty(tokens.CachedUserId) && !string.IsNullOrEmpty(tokens.CachedEmail))
                {
                    _session = new AuthSession
                    {
                        State = AuthenticationState.SignedIn,
                        Profile = new JubileeUserProfile
                        {
                            UserId = tokens.CachedUserId,
                            Email = tokens.CachedEmail,
                            DisplayName = tokens.CachedDisplayName ?? tokens.CachedEmail,
                            AvatarUrl = tokens.CachedAvatarUrl,
                            AccountStatus = AccountStatus.Active
                        }
                    };
                    OnSessionChanged();
                    StartTokenRefreshTimer(tokens);
                }

                // Validate/refresh tokens in background
                if (!IsTokenExpired(tokens))
                {
                    _ = Task.Run(async () => await RefreshSessionAsync(tokens));
                }
                else if (!string.IsNullOrEmpty(tokens.RefreshToken))
                {
                    _ = Task.Run(async () => await RefreshTokenAsync(tokens.RefreshToken));
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error initializing auth: {ex.Message}");
            _session = new AuthSession { State = AuthenticationState.SignedOut };
        }
    }

    /// <summary>
    /// Sign in with email and password
    /// </summary>
    public async Task<AuthSession> SignInAsync(string email, string password, bool rememberMe = true)
    {
        try
        {
            _session.State = AuthenticationState.SigningIn;
            OnSessionChanged();

            var deviceInfo = new
            {
                deviceId = GetDeviceId(),
                deviceName = Environment.MachineName,
                deviceType = "desktop",
                platform = "Windows",
                platformVersion = Environment.OSVersion.VersionString,
                appName = "JubileeOutlook",
                appVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0"
            };

            var request = new
            {
                email,
                password,
                rememberMe,
                deviceInfo
            };

            var response = await _httpClient.PostAsync("login",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var errorResponse = JsonSerializer.Deserialize<LoginResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                throw new Exception(errorResponse?.Error ?? $"Authentication failed: {response.StatusCode}");
            }

            var loginResponse = JsonSerializer.Deserialize<LoginResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (loginResponse?.Success == true && loginResponse.Tokens != null)
            {
                var tokens = new TokenSet
                {
                    AccessToken = loginResponse.Tokens.AccessToken,
                    RefreshToken = loginResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(loginResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds(),
                    // Cache user profile for persistent login
                    CachedUserId = loginResponse.User?.Id,
                    CachedEmail = loginResponse.User?.Email,
                    CachedDisplayName = loginResponse.User?.DisplayName ?? loginResponse.User?.Email,
                    CachedAvatarUrl = loginResponse.User?.AvatarUrl
                };
                await _tokenStorage.SaveTokensAsync(tokens);

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

    /// <summary>
    /// Register a new account
    /// </summary>
    public async Task<AuthSession> RegisterAsync(string fullName, string email, string password, bool newsletter = true)
    {
        try
        {
            _session.State = AuthenticationState.SigningIn;
            OnSessionChanged();

            var deviceInfo = new
            {
                deviceId = GetDeviceId(),
                deviceName = Environment.MachineName,
                deviceType = "desktop",
                platform = "Windows",
                platformVersion = Environment.OSVersion.VersionString,
                appName = "JubileeOutlook",
                appVersion = System.Reflection.Assembly.GetExecutingAssembly().GetName().Version?.ToString() ?? "1.0.0"
            };

            var request = new
            {
                fullName,
                email,
                password,
                newsletter,
                deviceInfo
            };

            var response = await _httpClient.PostAsync("register",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            var content = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                var errorResponse = JsonSerializer.Deserialize<RegisterResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });
                throw new Exception(errorResponse?.Error ?? $"Registration failed: {response.StatusCode}");
            }

            var registerResponse = JsonSerializer.Deserialize<RegisterResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (registerResponse?.Success == true && registerResponse.Tokens != null)
            {
                var tokens = new TokenSet
                {
                    AccessToken = registerResponse.Tokens.AccessToken,
                    RefreshToken = registerResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(registerResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds(),
                    // Cache user profile for persistent login
                    CachedUserId = registerResponse.User?.Id,
                    CachedEmail = registerResponse.User?.Email,
                    CachedDisplayName = registerResponse.User?.DisplayName ?? fullName,
                    CachedAvatarUrl = registerResponse.User?.AvatarUrl
                };
                await _tokenStorage.SaveTokensAsync(tokens);

                if (registerResponse.User != null)
                {
                    _session = new AuthSession
                    {
                        State = AuthenticationState.SignedIn,
                        Profile = new JubileeUserProfile
                        {
                            UserId = registerResponse.User.Id,
                            Email = registerResponse.User.Email,
                            DisplayName = registerResponse.User.DisplayName ?? fullName,
                            AccountStatus = AccountStatus.Active,
                            AvatarUrl = registerResponse.User.AvatarUrl
                        }
                    };
                    StartTokenRefreshTimer(tokens);
                    OnSessionChanged();
                }
            }
            else
            {
                throw new Exception(registerResponse?.Error ?? "Registration failed");
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

    /// <summary>
    /// Sign out the current user
    /// </summary>
    public async Task SignOutAsync()
    {
        try
        {
            var tokens = await _tokenStorage.LoadTokensAsync();
            if (tokens != null)
            {
                _httpClient.DefaultRequestHeaders.Authorization =
                    new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

                await _httpClient.PostAsync("logout", null);
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

    /// <summary>
    /// Refresh the access token
    /// </summary>
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

            var request = new { refreshToken };

            var response = await _httpClient.PostAsync("refresh",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            if (!response.IsSuccessStatusCode)
            {
                _session.State = AuthenticationState.TokenExpired;
                OnSessionChanged();
                return false;
            }

            var content = await response.Content.ReadAsStringAsync();
            var refreshResponse = JsonSerializer.Deserialize<LoginResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (refreshResponse?.Success == true && refreshResponse.Tokens != null)
            {
                var newTokens = new TokenSet
                {
                    AccessToken = refreshResponse.Tokens.AccessToken,
                    RefreshToken = refreshResponse.Tokens.RefreshToken,
                    ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(refreshResponse.Tokens.ExpiresIn).ToUnixTimeMilliseconds(),
                    // Cache user profile for persistent login
                    CachedUserId = refreshResponse.User?.Id,
                    CachedEmail = refreshResponse.User?.Email,
                    CachedDisplayName = refreshResponse.User?.DisplayName ?? refreshResponse.User?.Email,
                    CachedAvatarUrl = refreshResponse.User?.AvatarUrl
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

    /// <summary>
    /// Request password reset
    /// </summary>
    public async Task<bool> RequestPasswordResetAsync(string email)
    {
        try
        {
            var request = new { email };
            var response = await _httpClient.PostAsync("forgot-password",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error requesting password reset: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Verify reset code
    /// </summary>
    public async Task<bool> VerifyResetCodeAsync(string email, string code)
    {
        try
        {
            var request = new { email, code };
            var response = await _httpClient.PostAsync("verify-reset-code",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error verifying reset code: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Reset password with code
    /// </summary>
    public async Task<bool> ResetPasswordAsync(string email, string code, string newPassword)
    {
        try
        {
            var request = new { email, code, newPassword };
            var response = await _httpClient.PostAsync("reset-password",
                new StringContent(JsonSerializer.Serialize(request), Encoding.UTF8, "application/json"));

            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Error resetting password: {ex.Message}");
            return false;
        }
    }

    private async Task RefreshSessionAsync(TokenSet tokens)
    {
        try
        {
            _httpClient.DefaultRequestHeaders.Authorization =
                new AuthenticationHeaderValue("Bearer", tokens.AccessToken);

            var response = await _httpClient.GetAsync("me");
            if (response.IsSuccessStatusCode)
            {
                var content = await response.Content.ReadAsStringAsync();
                var meResponse = JsonSerializer.Deserialize<MeResponse>(content, new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

                if (meResponse?.Success == true && meResponse.User != null)
                {
                    // Update cached profile in tokens
                    tokens.CachedUserId = meResponse.User.Id;
                    tokens.CachedEmail = meResponse.User.Email;
                    tokens.CachedDisplayName = meResponse.User.DisplayName ?? meResponse.User.Email;
                    tokens.CachedAvatarUrl = meResponse.User.AvatarUrl;
                    await _tokenStorage.SaveTokensAsync(tokens);

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
            // Don't change session state on network errors if we already have a cached session
            if (_session.State != AuthenticationState.SignedIn)
            {
                _session.State = AuthenticationState.Error;
                _session.LastError = ex.Message;
                OnSessionChanged();
            }
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

    private static string GetDeviceId()
    {
        try
        {
            var deviceIdPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeOutlook",
                "device.id"
            );

            if (File.Exists(deviceIdPath))
            {
                return File.ReadAllText(deviceIdPath);
            }

            var deviceId = Guid.NewGuid().ToString();
            Directory.CreateDirectory(Path.GetDirectoryName(deviceIdPath)!);
            File.WriteAllText(deviceIdPath, deviceId);
            return deviceId;
        }
        catch
        {
            return Environment.MachineName;
        }
    }

    private void OnSessionChanged()
    {
        SessionChanged?.Invoke(this, _session);
    }
}
