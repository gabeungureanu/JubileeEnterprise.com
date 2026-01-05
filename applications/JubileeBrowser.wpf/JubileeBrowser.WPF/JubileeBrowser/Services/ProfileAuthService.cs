using System.ComponentModel;
using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Runtime.CompilerServices;
using System.Text;
using System.Text.Json;
using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// Handles user authentication via Jubilee SSO platform
/// </summary>
public class ProfileAuthService : INotifyPropertyChanged
{
    private readonly SecureStorageService _secureStorage;
    private readonly HttpClient _httpClient;
    private readonly string _profileRegistryPath;

    private UserProfile? _currentProfile;
    private AuthenticationState _authState = AuthenticationState.SignedOut;
    private TokenSet? _currentTokens;
    private ProfileRegistry _profileRegistry = new();

    // SSO Configuration - WorldWideBibleWeb OAuth2 endpoints
    private const string SsoBaseUrl = "https://sso.worldwidebibleweb.org";
    private const string AuthorizeEndpoint = "/oauth2/authorize";
    private const string TokenEndpoint = "/oauth2/token";
    private const string UserInfoEndpoint = "/api/v1/userinfo";
    private const string RevokeEndpoint = "/oauth2/revoke";
    private const string ClientId = "jubilee-browser-desktop";
    private const string RedirectUri = "jubilee://auth/callback";
    private static readonly string[] Scopes = { "openid", "profile", "email", "sync" };

    public event PropertyChangedEventHandler? PropertyChanged;
    public event EventHandler<AuthenticationState>? AuthStateChanged;
    public event EventHandler<UserProfile?>? ProfileChanged;

    public UserProfile? CurrentProfile
    {
        get => _currentProfile;
        private set
        {
            _currentProfile = value;
            OnPropertyChanged();
            ProfileChanged?.Invoke(this, value);
        }
    }

    public AuthenticationState AuthState
    {
        get => _authState;
        private set
        {
            _authState = value;
            OnPropertyChanged();
            OnPropertyChanged(nameof(IsSignedIn));
            OnPropertyChanged(nameof(IsSignedOut));
            AuthStateChanged?.Invoke(this, value);
        }
    }

    public bool IsSignedIn => AuthState == AuthenticationState.SignedIn;
    public bool IsSignedOut => AuthState == AuthenticationState.SignedOut;

    public ProfileAuthService()
    {
        _secureStorage = new SecureStorageService();
        _httpClient = new HttpClient { Timeout = TimeSpan.FromSeconds(30) };

        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser"
        );
        Directory.CreateDirectory(appDataPath);
        _profileRegistryPath = Path.Combine(appDataPath, "profiles.json");
    }

    /// <summary>
    /// Initialize and attempt to restore existing session
    /// </summary>
    public async Task InitializeAsync()
    {
        await LoadProfileRegistryAsync().ConfigureAwait(false);

        if (!string.IsNullOrEmpty(_profileRegistry.ActiveProfileId))
        {
            var storedProfile = _profileRegistry.Profiles
                .FirstOrDefault(p => p.UserId == _profileRegistry.ActiveProfileId);

            if (storedProfile != null && !string.IsNullOrEmpty(storedProfile.EncryptedTokens))
            {
                try
                {
                    var tokensJson = _secureStorage.Decrypt(storedProfile.EncryptedTokens);
                    _currentTokens = JsonSerializer.Deserialize<TokenSet>(tokensJson);

                    if (_currentTokens != null && IsTokenValid(_currentTokens))
                    {
                        // Token is still valid, restore session
                        CurrentProfile = CreateUserProfile(storedProfile);
                        AuthState = AuthenticationState.SignedIn;
                        return;
                    }
                    else if (_currentTokens != null && !string.IsNullOrEmpty(_currentTokens.RefreshToken))
                    {
                        // Try to refresh the token
                        if (await RefreshTokenAsync().ConfigureAwait(false))
                        {
                            CurrentProfile = CreateUserProfile(storedProfile);
                            AuthState = AuthenticationState.SignedIn;
                            return;
                        }
                    }
                }
                catch
                {
                    // Token restoration failed
                }
            }
        }

        AuthState = AuthenticationState.SignedOut;
    }

    /// <summary>
    /// Get the OAuth2 authorization URL for SSO login
    /// </summary>
    public async Task<string> GetAuthorizationUrlAsync(string? state = null)
    {
        state ??= Guid.NewGuid().ToString("N");
        var scope = string.Join(" ", Scopes);
        var codeChallenge = GenerateCodeChallenge(out var codeVerifier);

        // Store code verifier for later use
        await _secureStorage.StoreAsync("auth_code_verifier", codeVerifier);

        return $"{SsoBaseUrl}{AuthorizeEndpoint}" +
               $"?client_id={Uri.EscapeDataString(ClientId)}" +
               $"&redirect_uri={Uri.EscapeDataString(RedirectUri)}" +
               $"&response_type=code" +
               $"&scope={Uri.EscapeDataString(scope)}" +
               $"&state={Uri.EscapeDataString(state)}" +
               $"&code_challenge={Uri.EscapeDataString(codeChallenge)}" +
               $"&code_challenge_method=S256";
    }

    /// <summary>
    /// Handle the OAuth2 callback with authorization code
    /// </summary>
    public async Task<bool> HandleAuthCallbackAsync(string code, string? state = null)
    {
        AuthState = AuthenticationState.SigningIn;

        try
        {
            var codeVerifier = await _secureStorage.RetrieveAsync<string>("auth_code_verifier");
            _secureStorage.Remove("auth_code_verifier");

            // Exchange code for tokens
            var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "authorization_code",
                ["client_id"] = ClientId,
                ["code"] = code,
                ["redirect_uri"] = RedirectUri,
                ["code_verifier"] = codeVerifier ?? string.Empty
            });

            var response = await _httpClient.PostAsync($"{SsoBaseUrl}{TokenEndpoint}", tokenRequest);
            if (!response.IsSuccessStatusCode)
            {
                AuthState = AuthenticationState.Error;
                return false;
            }

            var tokenJson = await response.Content.ReadAsStringAsync();
            var tokenResponse = JsonSerializer.Deserialize<TokenResponse>(tokenJson);

            if (tokenResponse == null)
            {
                AuthState = AuthenticationState.Error;
                return false;
            }

            _currentTokens = new TokenSet
            {
                AccessToken = tokenResponse.AccessToken ?? string.Empty,
                RefreshToken = tokenResponse.RefreshToken ?? string.Empty,
                IdToken = tokenResponse.IdToken,
                TokenType = tokenResponse.TokenType ?? "Bearer",
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresIn).ToUnixTimeSeconds(),
                Scope = tokenResponse.Scope?.Split(' ').ToList() ?? new()
            };

            // Fetch user info
            await FetchAndUpdateProfileAsync();

            AuthState = AuthenticationState.SignedIn;
            return true;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Auth callback error: {ex.Message}");
            AuthState = AuthenticationState.Error;
            return false;
        }
    }

    /// <summary>
    /// Fetch user profile from SSO server
    /// </summary>
    private async Task FetchAndUpdateProfileAsync()
    {
        if (_currentTokens == null) return;

        _httpClient.DefaultRequestHeaders.Authorization =
            new AuthenticationHeaderValue("Bearer", _currentTokens.AccessToken);

        var response = await _httpClient.GetAsync($"{SsoBaseUrl}{UserInfoEndpoint}");
        if (!response.IsSuccessStatusCode) return;

        var userInfoJson = await response.Content.ReadAsStringAsync();
        var userInfo = JsonSerializer.Deserialize<UserInfoResponse>(userInfoJson);

        if (userInfo == null) return;

        CurrentProfile = new UserProfile
        {
            UserId = userInfo.Sub ?? string.Empty,
            Email = userInfo.Email ?? string.Empty,
            DisplayName = userInfo.Name ?? userInfo.Email ?? "User",
            AvatarUrl = userInfo.Picture,
            AccountStatus = AccountStatus.Active,
            LastLoginAt = DateTime.UtcNow,
            IsSyncEnabled = true,
            SyncStatus = SyncStatus.Idle
        };

        // Save to profile registry
        await SaveCurrentProfileAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Refresh the access token using the refresh token
    /// </summary>
    public async Task<bool> RefreshTokenAsync()
    {
        if (_currentTokens == null || string.IsNullOrEmpty(_currentTokens.RefreshToken))
            return false;

        try
        {
            var tokenRequest = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                ["grant_type"] = "refresh_token",
                ["client_id"] = ClientId,
                ["refresh_token"] = _currentTokens.RefreshToken
            });

            var response = await _httpClient.PostAsync($"{SsoBaseUrl}{TokenEndpoint}", tokenRequest).ConfigureAwait(false);
            if (!response.IsSuccessStatusCode)
            {
                AuthState = AuthenticationState.TokenExpired;
                return false;
            }

            var tokenJson = await response.Content.ReadAsStringAsync().ConfigureAwait(false);
            var tokenResponse = JsonSerializer.Deserialize<TokenResponse>(tokenJson);

            if (tokenResponse == null) return false;

            _currentTokens = new TokenSet
            {
                AccessToken = tokenResponse.AccessToken ?? string.Empty,
                RefreshToken = tokenResponse.RefreshToken ?? _currentTokens.RefreshToken,
                IdToken = tokenResponse.IdToken ?? _currentTokens.IdToken,
                TokenType = tokenResponse.TokenType ?? "Bearer",
                ExpiresAt = DateTimeOffset.UtcNow.AddSeconds(tokenResponse.ExpiresIn).ToUnixTimeSeconds(),
                Scope = _currentTokens.Scope
            };

            await SaveCurrentProfileAsync().ConfigureAwait(false);
            return true;
        }
        catch
        {
            return false;
        }
    }

    /// <summary>
    /// Sign in with demo mode (no server required) - async version
    /// </summary>
    public async Task SignInDemoModeAsync(string displayName, string email)
    {
        SignInDemoModeCore(displayName, email);
        await SaveProfileRegistryAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Sign in with demo mode (no server required) - synchronous version for UI thread
    /// </summary>
    public void SignInDemoMode(string displayName, string email)
    {
        SignInDemoModeCore(displayName, email);
        SaveProfileRegistrySync();
    }

    private void SignInDemoModeCore(string displayName, string email)
    {
        // Create a demo profile
        var demoUserId = $"demo-{Guid.NewGuid():N}";

        var demoProfile = new StoredProfile
        {
            UserId = demoUserId,
            Username = email.Split('@')[0],
            Email = email,
            DisplayName = displayName,
            LastLoginAt = DateTime.UtcNow,
            IsDemo = true
        };

        // Add to profile registry
        _profileRegistry.Profiles.Add(demoProfile);
        _profileRegistry.ActiveProfileId = demoUserId;

        // Set current profile
        CurrentProfile = new UserProfile
        {
            UserId = demoUserId,
            Email = email,
            DisplayName = displayName,
            AvatarUrl = null,
            LastLoginAt = DateTime.UtcNow,
            AccountStatus = AccountStatus.Active
        };

        // Create demo tokens (for local use only) - ExpiresAt is Unix timestamp (long)
        _currentTokens = new TokenSet
        {
            AccessToken = $"demo-token-{Guid.NewGuid():N}",
            RefreshToken = $"demo-refresh-{Guid.NewGuid():N}",
            ExpiresAt = DateTimeOffset.UtcNow.AddDays(365).ToUnixTimeSeconds()
        };

        AuthState = AuthenticationState.SignedIn;
    }

    /// <summary>
    /// Sign in with tokens from API login/register response (async version)
    /// </summary>
    public async Task SignInWithApiResponseAsync(string userId, string email, string displayName, string accessToken, string refreshToken, DateTime accessTokenExpiry)
    {
        SignInWithApiResponseCore(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);
        await SaveCurrentProfileAsync().ConfigureAwait(false);
    }

    /// <summary>
    /// Sign in with tokens from API login/register response (synchronous version for UI thread)
    /// </summary>
    public void SignInWithApiResponse(string userId, string email, string displayName, string accessToken, string refreshToken, DateTime accessTokenExpiry)
    {
        SignInWithApiResponseCore(userId, email, displayName, accessToken, refreshToken, accessTokenExpiry);
        SaveCurrentProfileSync();
    }

    private void SignInWithApiResponseCore(string userId, string email, string displayName, string accessToken, string refreshToken, DateTime accessTokenExpiry)
    {
        // Create profile
        var storedProfile = new StoredProfile
        {
            UserId = userId,
            Username = email.Split('@')[0],
            Email = email,
            DisplayName = displayName,
            LastLoginAt = DateTime.UtcNow,
            IsDemo = false
        };

        // Add or update in profile registry
        var existing = _profileRegistry.Profiles.FirstOrDefault(p => p.UserId == userId);
        if (existing != null)
        {
            existing.Email = email;
            existing.DisplayName = displayName;
            existing.LastLoginAt = DateTime.UtcNow;
        }
        else
        {
            _profileRegistry.Profiles.Add(storedProfile);
        }
        _profileRegistry.ActiveProfileId = userId;

        // Set current profile
        CurrentProfile = new UserProfile
        {
            UserId = userId,
            Email = email,
            DisplayName = displayName,
            AvatarUrl = null,
            LastLoginAt = DateTime.UtcNow,
            AccountStatus = AccountStatus.Active
        };

        // Store tokens
        _currentTokens = new TokenSet
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken,
            ExpiresAt = new DateTimeOffset(accessTokenExpiry).ToUnixTimeSeconds()
        };

        AuthState = AuthenticationState.SignedIn;
    }

    /// <summary>
    /// Sign out and revoke tokens
    /// </summary>
    public async Task SignOutAsync()
    {
        if (_currentTokens != null)
        {
            try
            {
                // Revoke token on server
                var revokeRequest = new FormUrlEncodedContent(new Dictionary<string, string>
                {
                    ["token"] = _currentTokens.AccessToken,
                    ["client_id"] = ClientId
                });
                await _httpClient.PostAsync($"{SsoBaseUrl}{RevokeEndpoint}", revokeRequest);
            }
            catch { }
        }

        // Clear local state
        _currentTokens = null;
        CurrentProfile = null;
        _profileRegistry.ActiveProfileId = null;
        await SaveProfileRegistryAsync().ConfigureAwait(false);
        AuthState = AuthenticationState.SignedOut;
    }

    /// <summary>
    /// Get current access token (refreshing if needed)
    /// </summary>
    public async Task<string?> GetAccessTokenAsync()
    {
        if (_currentTokens == null) return null;

        if (!IsTokenValid(_currentTokens))
        {
            if (!await RefreshTokenAsync())
                return null;
        }

        return _currentTokens?.AccessToken;
    }

    /// <summary>
    /// Switch to a different stored profile
    /// </summary>
    public async Task<bool> SwitchProfileAsync(string userId)
    {
        var storedProfile = _profileRegistry.Profiles.FirstOrDefault(p => p.UserId == userId);
        if (storedProfile == null) return false;

        if (!string.IsNullOrEmpty(storedProfile.EncryptedTokens))
        {
            try
            {
                var tokensJson = _secureStorage.Decrypt(storedProfile.EncryptedTokens);
                _currentTokens = JsonSerializer.Deserialize<TokenSet>(tokensJson);

                if (_currentTokens != null && (IsTokenValid(_currentTokens) || await RefreshTokenAsync().ConfigureAwait(false)))
                {
                    _profileRegistry.ActiveProfileId = userId;
                    CurrentProfile = CreateUserProfile(storedProfile);
                    AuthState = AuthenticationState.SignedIn;
                    await SaveProfileRegistryAsync().ConfigureAwait(false);
                    return true;
                }
            }
            catch { }
        }

        return false;
    }

    /// <summary>
    /// Get all stored profiles
    /// </summary>
    public List<StoredProfile> GetStoredProfiles() => _profileRegistry.Profiles;

    /// <summary>
    /// Remove a stored profile
    /// </summary>
    public async Task RemoveProfileAsync(string userId)
    {
        var profile = _profileRegistry.Profiles.FirstOrDefault(p => p.UserId == userId);
        if (profile != null)
        {
            _profileRegistry.Profiles.Remove(profile);
            if (_profileRegistry.ActiveProfileId == userId)
            {
                _profileRegistry.ActiveProfileId = null;
                CurrentProfile = null;
                _currentTokens = null;
                AuthState = AuthenticationState.SignedOut;
            }
            await SaveProfileRegistryAsync().ConfigureAwait(false);
        }
    }

    private async Task SaveCurrentProfileAsync()
    {
        if (CurrentProfile == null || _currentTokens == null) return;

        var tokensJson = JsonSerializer.Serialize(_currentTokens);
        var encryptedTokens = _secureStorage.Encrypt(tokensJson);

        var existing = _profileRegistry.Profiles.FirstOrDefault(p => p.UserId == CurrentProfile.UserId);
        if (existing != null)
        {
            existing.Email = CurrentProfile.Email;
            existing.DisplayName = CurrentProfile.DisplayName;
            existing.AvatarUrl = CurrentProfile.AvatarUrl;
            existing.EncryptedTokens = encryptedTokens;
            existing.LastLoginAt = DateTime.UtcNow;
        }
        else
        {
            _profileRegistry.Profiles.Add(new StoredProfile
            {
                UserId = CurrentProfile.UserId,
                Email = CurrentProfile.Email,
                DisplayName = CurrentProfile.DisplayName,
                AvatarUrl = CurrentProfile.AvatarUrl,
                EncryptedTokens = encryptedTokens,
                LastLoginAt = DateTime.UtcNow,
                SyncPreferences = new SyncPreferences()
            });
        }

        _profileRegistry.ActiveProfileId = CurrentProfile.UserId;
        await SaveProfileRegistryAsync().ConfigureAwait(false);
    }

    private async Task LoadProfileRegistryAsync()
    {
        try
        {
            if (File.Exists(_profileRegistryPath))
            {
                var json = await File.ReadAllTextAsync(_profileRegistryPath).ConfigureAwait(false);
                _profileRegistry = JsonSerializer.Deserialize<ProfileRegistry>(json) ?? new();
            }
        }
        catch
        {
            _profileRegistry = new ProfileRegistry();
        }
    }

    private async Task SaveProfileRegistryAsync()
    {
        var json = JsonSerializer.Serialize(_profileRegistry, new JsonSerializerOptions { WriteIndented = true });
        await File.WriteAllTextAsync(_profileRegistryPath, json).ConfigureAwait(false);
    }

    private void SaveProfileRegistrySync()
    {
        var json = JsonSerializer.Serialize(_profileRegistry, new JsonSerializerOptions { WriteIndented = true });
        File.WriteAllText(_profileRegistryPath, json);
    }

    private void SaveCurrentProfileSync()
    {
        if (CurrentProfile == null || _currentTokens == null) return;

        var tokensJson = JsonSerializer.Serialize(_currentTokens);
        var encryptedTokens = _secureStorage.Encrypt(tokensJson);

        var existing = _profileRegistry.Profiles.FirstOrDefault(p => p.UserId == CurrentProfile.UserId);
        if (existing != null)
        {
            existing.Email = CurrentProfile.Email;
            existing.DisplayName = CurrentProfile.DisplayName;
            existing.AvatarUrl = CurrentProfile.AvatarUrl;
            existing.EncryptedTokens = encryptedTokens;
            existing.LastLoginAt = DateTime.UtcNow;
        }
        else
        {
            _profileRegistry.Profiles.Add(new StoredProfile
            {
                UserId = CurrentProfile.UserId,
                Email = CurrentProfile.Email,
                DisplayName = CurrentProfile.DisplayName,
                AvatarUrl = CurrentProfile.AvatarUrl,
                EncryptedTokens = encryptedTokens,
                LastLoginAt = DateTime.UtcNow,
                SyncPreferences = new SyncPreferences()
            });
        }

        _profileRegistry.ActiveProfileId = CurrentProfile.UserId;
        SaveProfileRegistrySync();
    }

    private static bool IsTokenValid(TokenSet tokens)
    {
        return tokens.ExpiresAt > DateTimeOffset.UtcNow.AddMinutes(5).ToUnixTimeSeconds();
    }

    private static UserProfile CreateUserProfile(StoredProfile stored)
    {
        return new UserProfile
        {
            UserId = stored.UserId,
            Email = stored.Email,
            DisplayName = stored.DisplayName,
            AvatarUrl = stored.AvatarUrl,
            LastLoginAt = stored.LastLoginAt,
            IsSyncEnabled = stored.SyncPreferences.SyncBookmarks ||
                           stored.SyncPreferences.SyncHistory ||
                           stored.SyncPreferences.SyncPasswords,
            SyncStatus = SyncStatus.Idle
        };
    }

    private static string GenerateCodeChallenge(out string codeVerifier)
    {
        using var rng = System.Security.Cryptography.RandomNumberGenerator.Create();
        var bytes = new byte[32];
        rng.GetBytes(bytes);
        codeVerifier = Convert.ToBase64String(bytes)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');

        using var sha256 = System.Security.Cryptography.SHA256.Create();
        var hash = sha256.ComputeHash(Encoding.ASCII.GetBytes(codeVerifier));
        return Convert.ToBase64String(hash)
            .TrimEnd('=')
            .Replace('+', '-')
            .Replace('/', '_');
    }

    protected void OnPropertyChanged([CallerMemberName] string? name = null)
        => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));

    // Response DTOs
    private class TokenResponse
    {
        public string? AccessToken { get; set; }
        public string? RefreshToken { get; set; }
        public string? IdToken { get; set; }
        public string? TokenType { get; set; }
        public int ExpiresIn { get; set; }
        public string? Scope { get; set; }
    }

    private class UserInfoResponse
    {
        public string? Sub { get; set; }
        public string? Email { get; set; }
        public string? Name { get; set; }
        public string? Picture { get; set; }
        public bool? EmailVerified { get; set; }
    }
}
