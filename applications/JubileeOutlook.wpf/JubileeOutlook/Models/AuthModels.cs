namespace JubileeOutlook.Models;

/// <summary>
/// Represents the authentication state of the user
/// </summary>
public enum AuthenticationState
{
    SignedOut,
    SigningIn,
    SignedIn,
    TokenExpired,
    Error
}

/// <summary>
/// Represents the account status
/// </summary>
public enum AccountStatus
{
    Active,
    Pending,
    Suspended,
    Deactivated
}

/// <summary>
/// User profile information from Jubilee authentication
/// </summary>
public class JubileeUserProfile
{
    public string UserId { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
    public string? AvatarUrl { get; set; }
    public AccountStatus AccountStatus { get; set; } = AccountStatus.Active;
}

/// <summary>
/// Token set containing access and refresh tokens
/// </summary>
public class TokenSet
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public long ExpiresAt { get; set; }

    // Cached user profile for offline login persistence
    public string? CachedUserId { get; set; }
    public string? CachedEmail { get; set; }
    public string? CachedDisplayName { get; set; }
    public string? CachedAvatarUrl { get; set; }
}

/// <summary>
/// Current authentication session
/// </summary>
public class AuthSession
{
    public AuthenticationState State { get; set; } = AuthenticationState.SignedOut;
    public JubileeUserProfile? Profile { get; set; }
    public string? LastError { get; set; }

    public bool IsAuthenticated => State == AuthenticationState.SignedIn && Profile != null;
}

/// <summary>
/// Saved credentials for "Remember me" functionality
/// </summary>
public class SavedSignInCredentials
{
    public string? Email { get; set; }
    public string? EncryptedPassword { get; set; }
    public bool RememberMe { get; set; }
}

/// <summary>
/// Login response from the API
/// </summary>
public class LoginResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public TokenInfo? Tokens { get; set; }
    public UserInfo? User { get; set; }
}

/// <summary>
/// Token information from API response
/// </summary>
public class TokenInfo
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
}

/// <summary>
/// User information from API response
/// </summary>
public class UserInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Role { get; set; }
}

/// <summary>
/// Response from /api/auth/me endpoint
/// </summary>
public class MeResponse
{
    public bool Success { get; set; }
    public UserInfo? User { get; set; }
}

/// <summary>
/// Register request to the API
/// </summary>
public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool Newsletter { get; set; }
}

/// <summary>
/// Register response from the API
/// </summary>
public class RegisterResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public TokenInfo? Tokens { get; set; }
    public UserInfo? User { get; set; }
}

/// <summary>
/// WWBW Email information from API response
/// </summary>
public class WwbwEmailInfo
{
    [System.Text.Json.Serialization.JsonPropertyName("id")]
    public string Id { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("user_id")]
    public string UserId { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("username")]
    public string Username { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("domain")]
    public string Domain { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("email_address")]
    public string EmailAddress { get; set; } = string.Empty;

    [System.Text.Json.Serialization.JsonPropertyName("is_primary")]
    public bool IsPrimary { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("is_active")]
    public bool IsActive { get; set; }
}

/// <summary>
/// Response from /api/wwbw/email endpoint
/// </summary>
public class WwbwEmailResponse
{
    [System.Text.Json.Serialization.JsonPropertyName("success")]
    public bool Success { get; set; }

    [System.Text.Json.Serialization.JsonPropertyName("wwbwEmail")]
    public WwbwEmailInfo? WwbwEmail { get; set; }
}
