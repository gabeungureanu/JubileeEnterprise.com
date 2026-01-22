using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Http;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.Identity.Client;
using Google.Apis.Auth.OAuth2;
using Google.Apis.Auth.OAuth2.Flows;
using Google.Apis.Util.Store;
using JubileeOutlook.Models.EmailSync;
using System.Text.Json.Serialization;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Unified OAuth2 authentication service supporting Google, Microsoft, and Yahoo
/// </summary>
public class OAuth2AuthenticationService
{
    private readonly SecureStorageService _secureStorage;
    private readonly GoogleOAuth2Service _googleAuth;
    private readonly MicrosoftOAuth2Service _microsoftAuth;
    private readonly YahooOAuth2Service _yahooAuth;

    public OAuth2AuthenticationService(SecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
        _googleAuth = new GoogleOAuth2Service(secureStorage);
        _microsoftAuth = new MicrosoftOAuth2Service(secureStorage);
        _yahooAuth = new YahooOAuth2Service(secureStorage);
    }

    /// <summary>
    /// Authenticate an email account using the appropriate OAuth2 flow
    /// </summary>
    public async Task<OAuth2AuthResult> AuthenticateAsync(string emailAddress, EmailProviderConfig providerConfig)
    {
        Debug.WriteLine($"[OAuth2] Starting authentication for {emailAddress} ({providerConfig.ProviderType})");

        return providerConfig.ProviderType switch
        {
            EmailProviderType.Google => await _googleAuth.AuthenticateAsync(emailAddress),
            EmailProviderType.Microsoft => await _microsoftAuth.AuthenticateAsync(emailAddress),
            EmailProviderType.Yahoo => await _yahooAuth.AuthenticateAsync(emailAddress),
            _ => new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"OAuth2 not supported for provider: {providerConfig.ProviderType}"
            }
        };
    }

    /// <summary>
    /// Refresh an expired access token
    /// </summary>
    public async Task<OAuth2AuthResult> RefreshTokenAsync(Guid accountId, EmailProviderType providerType)
    {
        Debug.WriteLine($"[OAuth2] Refreshing token for account {accountId} ({providerType})");

        return providerType switch
        {
            EmailProviderType.Google => await _googleAuth.RefreshTokenAsync(accountId),
            EmailProviderType.Microsoft => await _microsoftAuth.RefreshTokenAsync(accountId),
            EmailProviderType.Yahoo => await _yahooAuth.RefreshTokenAsync(accountId),
            _ => new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Token refresh not supported for provider: {providerType}"
            }
        };
    }

    /// <summary>
    /// Get stored credentials for an account
    /// </summary>
    public async Task<EmailAccountCredentials?> GetCredentialsAsync(Guid accountId)
    {
        return await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
    }

    /// <summary>
    /// Store credentials for an account
    /// </summary>
    public async Task StoreCredentialsAsync(EmailAccountCredentials credentials)
    {
        credentials.UpdatedAt = DateTime.UtcNow;
        await _secureStorage.StoreAsync($"credentials_{credentials.AccountId}", credentials);
    }

    /// <summary>
    /// Remove stored credentials for an account
    /// </summary>
    public async Task RemoveCredentialsAsync(Guid accountId)
    {
        await _secureStorage.DeleteAsync($"credentials_{accountId}");
    }

    /// <summary>
    /// Check if credentials are valid and not expired
    /// </summary>
    public async Task<bool> AreCredentialsValidAsync(Guid accountId)
    {
        var credentials = await GetCredentialsAsync(accountId);
        if (credentials == null) return false;

        // If using OAuth2, check token expiry
        if (!string.IsNullOrEmpty(credentials.AccessToken))
        {
            if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value > DateTime.UtcNow.AddMinutes(5))
            {
                return true;
            }
            // Token expired but we have refresh token
            return !string.IsNullOrEmpty(credentials.RefreshToken);
        }

        // If using password auth, just check if password exists
        return !string.IsNullOrEmpty(credentials.EncryptedPassword);
    }

    /// <summary>
    /// Register or find user in the Codex database after OAuth authentication
    /// This ensures the user has an entry in the users table for contacts, events, etc.
    /// </summary>
    public async Task<OAuthUserRegistrationResult> RegisterOAuthUserAsync(string email, string? displayName, string provider, string? providerId = null, string? avatarUrl = null)
    {
        try
        {
            Debug.WriteLine($"[OAuth2] Registering OAuth user: {email} ({provider})");

            var httpClientFactory = HttpClientFactory.Instance;
            var payload = new
            {
                email,
                displayName = displayName ?? email.Split('@')[0],
                provider,
                providerId,
                avatarUrl
            };

            var response = await httpClientFactory.PostAsync(ApiEndpoint.Auth, "oauth-register", payload);
            var content = await response.Content.ReadAsStringAsync();

            Debug.WriteLine($"[OAuth2] oauth-register response status: {response.StatusCode}");
            Debug.WriteLine($"[OAuth2] oauth-register response: {content}");

            if (response.IsSuccessStatusCode)
            {
                var result = JsonSerializer.Deserialize<OAuthRegisterResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (result?.Success == true && result.User != null)
                {
                    Debug.WriteLine($"[OAuth2] User registered/found: {result.User.Id} (isNew: {result.IsNewUser})");

                    // Update ServiceConfiguration with the authenticated user
                    ServiceConfiguration.SetAuthenticatedUser(result.User.Id, result.User.Email);

                    return new OAuthUserRegistrationResult
                    {
                        Success = true,
                        UserId = result.User.Id,
                        Email = result.User.Email,
                        DisplayName = result.User.DisplayName,
                        AvatarUrl = result.User.AvatarUrl,
                        IsNewUser = result.IsNewUser,
                        AccessToken = result.Tokens?.AccessToken,
                        RefreshToken = result.Tokens?.RefreshToken
                    };
                }
            }

            Debug.WriteLine($"[OAuth2] OAuth registration failed: {content}");
            return new OAuthUserRegistrationResult
            {
                Success = false,
                ErrorMessage = "Failed to register OAuth user"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[OAuth2] OAuth registration error: {ex.Message}");
            return new OAuthUserRegistrationResult
            {
                Success = false,
                ErrorMessage = ex.Message
            };
        }
    }
}

/// <summary>
/// Result of OAuth user registration in the Codex database
/// </summary>
public class OAuthUserRegistrationResult
{
    public bool Success { get; set; }
    public string? UserId { get; set; }
    public string? Email { get; set; }
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public bool IsNewUser { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// Response from the oauth-register API endpoint
/// </summary>
internal class OAuthRegisterResponse
{
    [JsonPropertyName("success")]
    public bool Success { get; set; }

    [JsonPropertyName("isNewUser")]
    public bool IsNewUser { get; set; }

    [JsonPropertyName("user")]
    public OAuthRegisterUser? User { get; set; }

    [JsonPropertyName("tokens")]
    public OAuthRegisterTokens? Tokens { get; set; }

    [JsonPropertyName("error")]
    public string? Error { get; set; }
}

internal class OAuthRegisterUser
{
    [JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [JsonPropertyName("displayName")]
    public string? DisplayName { get; set; }

    [JsonPropertyName("role")]
    public string? Role { get; set; }

    [JsonPropertyName("avatarUrl")]
    public string? AvatarUrl { get; set; }
}

internal class OAuthRegisterTokens
{
    [JsonPropertyName("accessToken")]
    public string AccessToken { get; set; } = string.Empty;

    [JsonPropertyName("refreshToken")]
    public string RefreshToken { get; set; } = string.Empty;

    [JsonPropertyName("expiresIn")]
    public int ExpiresIn { get; set; }
}

/// <summary>
/// OAuth2 authentication result
/// </summary>
public class OAuth2AuthResult
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? TokenExpiry { get; set; }
    public string? UserEmail { get; set; }
    public string? UserName { get; set; }
    public string? ErrorMessage { get; set; }
    public EmailAccountCredentials? Credentials { get; set; }
}

/// <summary>
/// Google OAuth2 authentication service using Google APIs
/// </summary>
public class GoogleOAuth2Service
{
    // Configuration is loaded from appsettings.json via ConfigurationService
    private static Models.GoogleOAuth2Config Config => ConfigurationService.Instance.OAuth2.Google;

    private static string ClientId => Config.ClientId;
    private static string ClientSecret => Config.ClientSecret;
    private static string RedirectUri => Config.RedirectUri;

    /// <summary>
    /// Check if OAuth credentials are properly configured (not placeholders)
    /// </summary>
    public static bool IsConfigured => Config.IsConfigured;

    private static readonly string[] Scopes = new[]
    {
        "https://mail.google.com/",
        "https://www.googleapis.com/auth/gmail.modify",
        "https://www.googleapis.com/auth/gmail.send",
        "https://www.googleapis.com/auth/userinfo.email",
        "https://www.googleapis.com/auth/userinfo.profile",
        "openid"
    };

    private readonly SecureStorageService _secureStorage;
    private readonly string _tokenStorePath;

    public GoogleOAuth2Service(SecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
        _tokenStorePath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeOutlook",
            "GoogleTokens"
        );
        Directory.CreateDirectory(_tokenStorePath);
    }

    /// <summary>
    /// Authenticate with Google using OAuth2 browser flow
    /// </summary>
    public async Task<OAuth2AuthResult> AuthenticateAsync(string emailAddress)
    {
        // Check if OAuth credentials are configured
        if (!IsConfigured)
        {
            Debug.WriteLine("[GoogleOAuth2] OAuth credentials not configured, falling back to App Password");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = "OAUTH_NOT_CONFIGURED"
            };
        }

        try
        {
            Debug.WriteLine($"[GoogleOAuth2] Starting authentication for {emailAddress}");

            // Create authorization code flow
            var clientSecrets = new ClientSecrets
            {
                ClientId = ClientId,
                ClientSecret = ClientSecret
            };

            var flow = new GoogleAuthorizationCodeFlow(new GoogleAuthorizationCodeFlow.Initializer
            {
                ClientSecrets = clientSecrets,
                Scopes = Scopes,
                DataStore = new FileDataStore(_tokenStorePath, true)
            });

            // Use local server callback for desktop app
            var codeReceiver = new LocalServerCodeReceiver(RedirectUri);

            var credential = await new AuthorizationCodeInstalledApp(flow, codeReceiver)
                .AuthorizeAsync(emailAddress, CancellationToken.None);

            if (credential?.Token == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Failed to obtain authorization token"
                };
            }

            var token = credential.Token;
            Debug.WriteLine($"[GoogleOAuth2] Successfully obtained token for {emailAddress}");

            // Get user info
            var userInfo = await GetGoogleUserInfoAsync(token.AccessToken);

            var credentials = new EmailAccountCredentials
            {
                AccountId = Guid.NewGuid(),
                AccessToken = token.AccessToken,
                RefreshToken = token.RefreshToken,
                TokenExpiry = token.IssuedUtc.AddSeconds(token.ExpiresInSeconds ?? 3600),
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Store credentials securely
            await _secureStorage.StoreAsync($"credentials_{credentials.AccountId}", credentials);

            // Register user in Codex database for contacts/events support
            try
            {
                var oauthService = new OAuth2AuthenticationService(_secureStorage);
                var registrationResult = await oauthService.RegisterOAuthUserAsync(
                    email: userInfo?.Email ?? emailAddress,
                    displayName: userInfo?.Name,
                    provider: "google",
                    providerId: userInfo?.Id,
                    avatarUrl: userInfo?.Picture
                );

                if (registrationResult.Success)
                {
                    Debug.WriteLine($"[GoogleOAuth2] User registered in Codex: {registrationResult.UserId}");
                }
                else
                {
                    Debug.WriteLine($"[GoogleOAuth2] Codex registration failed (non-blocking): {registrationResult.ErrorMessage}");
                }
            }
            catch (Exception regEx)
            {
                // Don't fail OAuth if Codex registration fails - it's not critical for email access
                Debug.WriteLine($"[GoogleOAuth2] Codex registration error (non-blocking): {regEx.Message}");
            }

            return new OAuth2AuthResult
            {
                Success = true,
                AccessToken = token.AccessToken,
                RefreshToken = token.RefreshToken,
                TokenExpiry = credentials.TokenExpiry,
                UserEmail = userInfo?.Email ?? emailAddress,
                UserName = userInfo?.Name,
                Credentials = credentials
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GoogleOAuth2] Authentication failed: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Google authentication failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Refresh an expired Google access token
    /// </summary>
    public async Task<OAuth2AuthResult> RefreshTokenAsync(Guid accountId)
    {
        try
        {
            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
            if (credentials?.RefreshToken == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "No refresh token available"
                };
            }

            using var client = new HttpClient();
            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "client_id", ClientId },
                { "client_secret", ClientSecret },
                { "refresh_token", credentials.RefreshToken },
                { "grant_type", "refresh_token" }
            });

            var response = await client.PostAsync("https://oauth2.googleapis.com/token", content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                Debug.WriteLine($"[GoogleOAuth2] Token refresh failed: {responseBody}");
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = $"Token refresh failed: {response.StatusCode}"
                };
            }

            var tokenResponse = JsonSerializer.Deserialize<GoogleTokenResponse>(responseBody);
            if (tokenResponse == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Invalid token response"
                };
            }

            // Update stored credentials
            credentials.AccessToken = tokenResponse.AccessToken;
            credentials.TokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
            credentials.UpdatedAt = DateTime.UtcNow;

            await _secureStorage.StoreAsync($"credentials_{accountId}", credentials);

            return new OAuth2AuthResult
            {
                Success = true,
                AccessToken = tokenResponse.AccessToken,
                RefreshToken = credentials.RefreshToken,
                TokenExpiry = credentials.TokenExpiry,
                Credentials = credentials
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GoogleOAuth2] Token refresh error: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Token refresh error: {ex.Message}"
            };
        }
    }

    private async Task<GoogleUserInfo?> GetGoogleUserInfoAsync(string accessToken)
    {
        try
        {
            using var client = new HttpClient();
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Bearer", accessToken);

            var response = await client.GetAsync("https://www.googleapis.com/oauth2/v2/userinfo");
            if (response.IsSuccessStatusCode)
            {
                var json = await response.Content.ReadAsStringAsync();
                return JsonSerializer.Deserialize<GoogleUserInfo>(json, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });
            }
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[GoogleOAuth2] Failed to get user info: {ex.Message}");
        }
        return null;
    }
}

/// <summary>
/// Microsoft OAuth2 authentication service using MSAL
/// </summary>
public class MicrosoftOAuth2Service
{
    // Configuration is loaded from appsettings.json via ConfigurationService
    private static Models.MicrosoftOAuth2Config Config => ConfigurationService.Instance.OAuth2.Microsoft;

    private static string ClientId => Config.ClientId;
    private static string TenantId => Config.TenantId;
    private static string RedirectUri => Config.RedirectUri;

    /// <summary>
    /// Check if OAuth credentials are properly configured (not placeholders)
    /// </summary>
    public static bool IsConfigured => Config.IsConfigured;

    private static readonly string[] Scopes = new[]
    {
        "https://graph.microsoft.com/Mail.Read",
        "https://graph.microsoft.com/Mail.ReadWrite",
        "https://graph.microsoft.com/Mail.Send",
        "https://graph.microsoft.com/User.Read",
        "offline_access",
        "openid",
        "profile",
        "email"
    };

    private readonly SecureStorageService _secureStorage;
    private IPublicClientApplication? _msalClient;

    public MicrosoftOAuth2Service(SecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
        InitializeMsalClient();
    }

    private void InitializeMsalClient()
    {
        try
        {
            var tokenCachePath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
                "JubileeOutlook",
                "msal_cache.dat"
            );

            _msalClient = PublicClientApplicationBuilder
                .Create(ClientId)
                .WithAuthority(AzureCloudInstance.AzurePublic, TenantId)
                .WithRedirectUri(RedirectUri)
                .Build();

            // Enable token caching
            TokenCacheHelper.EnableSerialization(_msalClient.UserTokenCache, tokenCachePath);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[MicrosoftOAuth2] Failed to initialize MSAL client: {ex.Message}");
        }
    }

    /// <summary>
    /// Authenticate with Microsoft using OAuth2 browser flow
    /// </summary>
    public async Task<OAuth2AuthResult> AuthenticateAsync(string emailAddress)
    {
        // Check if OAuth credentials are configured
        if (!IsConfigured)
        {
            Debug.WriteLine("[MicrosoftOAuth2] OAuth credentials not configured, falling back to App Password");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = "OAUTH_NOT_CONFIGURED"
            };
        }

        try
        {
            if (_msalClient == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Microsoft authentication client not initialized"
                };
            }

            Debug.WriteLine($"[MicrosoftOAuth2] Starting authentication for {emailAddress}");

            AuthenticationResult? authResult = null;

            // Try to acquire token silently first (from cache)
            var accounts = await _msalClient.GetAccountsAsync();
            var account = accounts.FirstOrDefault(a =>
                a.Username?.Equals(emailAddress, StringComparison.OrdinalIgnoreCase) == true);

            if (account != null)
            {
                try
                {
                    authResult = await _msalClient.AcquireTokenSilent(Scopes, account).ExecuteAsync();
                    Debug.WriteLine($"[MicrosoftOAuth2] Acquired token silently for {emailAddress}");
                }
                catch (MsalUiRequiredException)
                {
                    Debug.WriteLine($"[MicrosoftOAuth2] Silent auth failed, launching interactive flow");
                }
            }

            // If silent auth failed, use interactive flow
            if (authResult == null)
            {
                authResult = await _msalClient.AcquireTokenInteractive(Scopes)
                    .WithLoginHint(emailAddress)
                    .WithPrompt(Prompt.SelectAccount)
                    .ExecuteAsync();
            }

            if (authResult == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Failed to obtain authorization token"
                };
            }

            Debug.WriteLine($"[MicrosoftOAuth2] Successfully obtained token for {authResult.Account?.Username}");

            var credentials = new EmailAccountCredentials
            {
                AccountId = Guid.NewGuid(),
                AccessToken = authResult.AccessToken,
                RefreshToken = null, // MSAL handles refresh internally
                TokenExpiry = authResult.ExpiresOn.DateTime,
                CreatedAt = DateTime.UtcNow,
                UpdatedAt = DateTime.UtcNow
            };

            // Store credentials securely
            await _secureStorage.StoreAsync($"credentials_{credentials.AccountId}", credentials);

            // Register user in Codex database for contacts/events support
            try
            {
                var oauthService = new OAuth2AuthenticationService(_secureStorage);
                var registrationResult = await oauthService.RegisterOAuthUserAsync(
                    email: authResult.Account?.Username ?? emailAddress,
                    displayName: authResult.Account?.Username?.Split('@')[0],
                    provider: "microsoft",
                    providerId: authResult.Account?.HomeAccountId?.Identifier,
                    avatarUrl: null // Microsoft doesn't return avatar in MSAL directly
                );

                if (registrationResult.Success)
                {
                    Debug.WriteLine($"[MicrosoftOAuth2] User registered in Codex: {registrationResult.UserId}");
                }
                else
                {
                    Debug.WriteLine($"[MicrosoftOAuth2] Codex registration failed (non-blocking): {registrationResult.ErrorMessage}");
                }
            }
            catch (Exception regEx)
            {
                // Don't fail OAuth if Codex registration fails - it's not critical for email access
                Debug.WriteLine($"[MicrosoftOAuth2] Codex registration error (non-blocking): {regEx.Message}");
            }

            return new OAuth2AuthResult
            {
                Success = true,
                AccessToken = authResult.AccessToken,
                TokenExpiry = authResult.ExpiresOn.DateTime,
                UserEmail = authResult.Account?.Username ?? emailAddress,
                UserName = authResult.Account?.Username,
                Credentials = credentials
            };
        }
        catch (MsalException ex)
        {
            Debug.WriteLine($"[MicrosoftOAuth2] MSAL error: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Microsoft authentication failed: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[MicrosoftOAuth2] Authentication failed: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Microsoft authentication failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Refresh Microsoft access token using MSAL cache
    /// </summary>
    public async Task<OAuth2AuthResult> RefreshTokenAsync(Guid accountId)
    {
        try
        {
            if (_msalClient == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Microsoft authentication client not initialized"
                };
            }

            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
            if (credentials == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "No credentials found for account"
                };
            }

            var accounts = await _msalClient.GetAccountsAsync();
            var account = accounts.FirstOrDefault();

            if (account == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "No cached account found. Re-authentication required."
                };
            }

            var authResult = await _msalClient.AcquireTokenSilent(Scopes, account).ExecuteAsync();

            // Update stored credentials
            credentials.AccessToken = authResult.AccessToken;
            credentials.TokenExpiry = authResult.ExpiresOn.DateTime;
            credentials.UpdatedAt = DateTime.UtcNow;

            await _secureStorage.StoreAsync($"credentials_{accountId}", credentials);

            return new OAuth2AuthResult
            {
                Success = true,
                AccessToken = authResult.AccessToken,
                TokenExpiry = authResult.ExpiresOn.DateTime,
                UserEmail = authResult.Account?.Username,
                Credentials = credentials
            };
        }
        catch (MsalUiRequiredException)
        {
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = "Re-authentication required"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[MicrosoftOAuth2] Token refresh error: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Token refresh error: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Get a valid access token for Microsoft Graph API
    /// </summary>
    public async Task<string?> GetGraphAccessTokenAsync(Guid accountId)
    {
        var result = await RefreshTokenAsync(accountId);
        return result.Success ? result.AccessToken : null;
    }
}

/// <summary>
/// Yahoo OAuth2 authentication service
/// </summary>
public class YahooOAuth2Service
{
    // Configuration is loaded from appsettings.json via ConfigurationService
    private static Models.YahooOAuth2Config Config => ConfigurationService.Instance.OAuth2.Yahoo;

    private static string ClientId => Config.ClientId;
    private static string ClientSecret => Config.ClientSecret;
    private static string RedirectUri => Config.RedirectUri;
    private const string AuthorizeUrl = "https://api.login.yahoo.com/oauth2/request_auth";
    private const string TokenUrl = "https://api.login.yahoo.com/oauth2/get_token";

    /// <summary>
    /// Check if OAuth credentials are properly configured (not placeholders)
    /// </summary>
    public static bool IsConfigured => Config.IsConfigured;

    private static readonly string[] Scopes = new[] { "mail-w" };

    private readonly SecureStorageService _secureStorage;

    public YahooOAuth2Service(SecureStorageService secureStorage)
    {
        _secureStorage = secureStorage;
    }

    /// <summary>
    /// Authenticate with Yahoo using OAuth2 browser flow
    /// </summary>
    public async Task<OAuth2AuthResult> AuthenticateAsync(string emailAddress)
    {
        // Check if OAuth credentials are configured
        if (!IsConfigured)
        {
            Debug.WriteLine("[YahooOAuth2] OAuth credentials not configured, falling back to App Password");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = "OAUTH_NOT_CONFIGURED"
            };
        }

        try
        {
            Debug.WriteLine($"[YahooOAuth2] Starting authentication for {emailAddress}");

            // Generate PKCE code verifier and challenge
            var codeVerifier = GenerateCodeVerifier();
            var codeChallenge = GenerateCodeChallenge(codeVerifier);
            var state = Guid.NewGuid().ToString("N");

            // Build authorization URL
            var authUrl = $"{AuthorizeUrl}?" +
                          $"client_id={Uri.EscapeDataString(ClientId)}&" +
                          $"redirect_uri={Uri.EscapeDataString(RedirectUri)}&" +
                          $"response_type=code&" +
                          $"scope={Uri.EscapeDataString(string.Join(" ", Scopes))}&" +
                          $"state={state}&" +
                          $"code_challenge={codeChallenge}&" +
                          $"code_challenge_method=S256";

            // Start local callback server
            var callbackTask = WaitForOAuthCallbackAsync(8892, state);

            // Open browser for authentication
            Process.Start(new ProcessStartInfo
            {
                FileName = authUrl,
                UseShellExecute = true
            });

            // Wait for callback
            var authCode = await callbackTask;
            if (string.IsNullOrEmpty(authCode))
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Authorization cancelled or failed"
                };
            }

            // Exchange code for tokens
            return await ExchangeCodeForTokensAsync(authCode, codeVerifier, emailAddress);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[YahooOAuth2] Authentication failed: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Yahoo authentication failed: {ex.Message}"
            };
        }
    }

    private async Task<OAuth2AuthResult> ExchangeCodeForTokensAsync(string authCode, string codeVerifier, string emailAddress)
    {
        using var client = new HttpClient();
        var authString = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));
        client.DefaultRequestHeaders.Authorization =
            new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", authString);

        var content = new FormUrlEncodedContent(new Dictionary<string, string>
        {
            { "grant_type", "authorization_code" },
            { "code", authCode },
            { "redirect_uri", RedirectUri },
            { "code_verifier", codeVerifier }
        });

        var response = await client.PostAsync(TokenUrl, content);
        var responseBody = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            Debug.WriteLine($"[YahooOAuth2] Token exchange failed: {responseBody}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Token exchange failed: {response.StatusCode}"
            };
        }

        var tokenResponse = JsonSerializer.Deserialize<YahooTokenResponse>(responseBody);
        if (tokenResponse == null)
        {
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = "Invalid token response"
            };
        }

        var credentials = new EmailAccountCredentials
        {
            AccountId = Guid.NewGuid(),
            AccessToken = tokenResponse.AccessToken,
            RefreshToken = tokenResponse.RefreshToken,
            TokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn),
            CreatedAt = DateTime.UtcNow,
            UpdatedAt = DateTime.UtcNow
        };

        await _secureStorage.StoreAsync($"credentials_{credentials.AccountId}", credentials);

        // Register user in Codex database for contacts/events support
        try
        {
            var oauthService = new OAuth2AuthenticationService(_secureStorage);
            var registrationResult = await oauthService.RegisterOAuthUserAsync(
                email: emailAddress,
                displayName: emailAddress.Split('@')[0],
                provider: "yahoo",
                providerId: null,
                avatarUrl: null
            );

            if (registrationResult.Success)
            {
                Debug.WriteLine($"[YahooOAuth2] User registered in Codex: {registrationResult.UserId}");
            }
            else
            {
                Debug.WriteLine($"[YahooOAuth2] Codex registration failed (non-blocking): {registrationResult.ErrorMessage}");
            }
        }
        catch (Exception regEx)
        {
            // Don't fail OAuth if Codex registration fails - it's not critical for email access
            Debug.WriteLine($"[YahooOAuth2] Codex registration error (non-blocking): {regEx.Message}");
        }

        return new OAuth2AuthResult
        {
            Success = true,
            AccessToken = tokenResponse.AccessToken,
            RefreshToken = tokenResponse.RefreshToken,
            TokenExpiry = credentials.TokenExpiry,
            UserEmail = emailAddress,
            Credentials = credentials
        };
    }

    /// <summary>
    /// Refresh an expired Yahoo access token
    /// </summary>
    public async Task<OAuth2AuthResult> RefreshTokenAsync(Guid accountId)
    {
        try
        {
            var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{accountId}");
            if (credentials?.RefreshToken == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "No refresh token available"
                };
            }

            using var client = new HttpClient();
            var authString = Convert.ToBase64String(Encoding.UTF8.GetBytes($"{ClientId}:{ClientSecret}"));
            client.DefaultRequestHeaders.Authorization =
                new System.Net.Http.Headers.AuthenticationHeaderValue("Basic", authString);

            var content = new FormUrlEncodedContent(new Dictionary<string, string>
            {
                { "grant_type", "refresh_token" },
                { "refresh_token", credentials.RefreshToken }
            });

            var response = await client.PostAsync(TokenUrl, content);
            var responseBody = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = $"Token refresh failed: {response.StatusCode}"
                };
            }

            var tokenResponse = JsonSerializer.Deserialize<YahooTokenResponse>(responseBody);
            if (tokenResponse == null)
            {
                return new OAuth2AuthResult
                {
                    Success = false,
                    ErrorMessage = "Invalid token response"
                };
            }

            credentials.AccessToken = tokenResponse.AccessToken;
            credentials.RefreshToken = tokenResponse.RefreshToken ?? credentials.RefreshToken;
            credentials.TokenExpiry = DateTime.UtcNow.AddSeconds(tokenResponse.ExpiresIn);
            credentials.UpdatedAt = DateTime.UtcNow;

            await _secureStorage.StoreAsync($"credentials_{accountId}", credentials);

            return new OAuth2AuthResult
            {
                Success = true,
                AccessToken = tokenResponse.AccessToken,
                RefreshToken = credentials.RefreshToken,
                TokenExpiry = credentials.TokenExpiry,
                Credentials = credentials
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[YahooOAuth2] Token refresh error: {ex.Message}");
            return new OAuth2AuthResult
            {
                Success = false,
                ErrorMessage = $"Token refresh error: {ex.Message}"
            };
        }
    }

    private async Task<string?> WaitForOAuthCallbackAsync(int port, string expectedState)
    {
        using var listener = new HttpListener();
        listener.Prefixes.Add($"http://localhost:{port}/");
        listener.Start();

        try
        {
            var context = await listener.GetContextAsync();
            var query = context.Request.QueryString;

            var code = query["code"];
            var state = query["state"];
            var error = query["error"];

            // Send response to browser
            var response = context.Response;
            var responseHtml = error != null
                ? "<html><body><h2>Authentication Failed</h2><p>You can close this window.</p></body></html>"
                : "<html><body><h2>Authentication Successful</h2><p>You can close this window and return to JubileeOutlook.</p></body></html>";

            var buffer = Encoding.UTF8.GetBytes(responseHtml);
            response.ContentLength64 = buffer.Length;
            await response.OutputStream.WriteAsync(buffer);
            response.OutputStream.Close();

            if (error != null)
            {
                Debug.WriteLine($"[YahooOAuth2] Auth error: {error}");
                return null;
            }

            if (state != expectedState)
            {
                Debug.WriteLine("[YahooOAuth2] State mismatch - possible CSRF attack");
                return null;
            }

            return code;
        }
        finally
        {
            listener.Stop();
        }
    }

    private static string GenerateCodeVerifier()
    {
        var bytes = new byte[32];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(bytes);
        return Base64UrlEncode(bytes);
    }

    private static string GenerateCodeChallenge(string codeVerifier)
    {
        using var sha256 = SHA256.Create();
        var challengeBytes = sha256.ComputeHash(Encoding.ASCII.GetBytes(codeVerifier));
        return Base64UrlEncode(challengeBytes);
    }

    private static string Base64UrlEncode(byte[] bytes)
    {
        return Convert.ToBase64String(bytes)
            .Replace('+', '-')
            .Replace('/', '_')
            .TrimEnd('=');
    }
}

/// <summary>
/// Helper for MSAL token cache serialization
/// </summary>
internal static class TokenCacheHelper
{
    private static readonly object FileLock = new();

    public static void EnableSerialization(ITokenCache tokenCache, string cacheFilePath)
    {
        tokenCache.SetBeforeAccess(args =>
        {
            lock (FileLock)
            {
                if (File.Exists(cacheFilePath))
                {
                    args.TokenCache.DeserializeMsalV3(File.ReadAllBytes(cacheFilePath));
                }
            }
        });

        tokenCache.SetAfterAccess(args =>
        {
            if (args.HasStateChanged)
            {
                lock (FileLock)
                {
                    var directory = Path.GetDirectoryName(cacheFilePath);
                    if (!string.IsNullOrEmpty(directory))
                    {
                        Directory.CreateDirectory(directory);
                    }
                    File.WriteAllBytes(cacheFilePath, args.TokenCache.SerializeMsalV3());
                }
            }
        });
    }
}

// JSON response models
internal class GoogleTokenResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("token_type")]
    public string TokenType { get; set; } = string.Empty;
}

internal class GoogleUserInfo
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("email")]
    public string Email { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("name")]
    public string Name { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("picture")]
    public string? Picture { get; set; }
}

internal class YahooTokenResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("access_token")]
    public string AccessToken { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("refresh_token")]
    public string? RefreshToken { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("expires_in")]
    public int ExpiresIn { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("token_type")]
    public string TokenType { get; set; } = string.Empty;
}
