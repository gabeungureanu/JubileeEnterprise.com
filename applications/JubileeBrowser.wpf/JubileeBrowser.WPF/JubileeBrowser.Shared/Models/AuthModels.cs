namespace JubileeBrowser.Shared.Models;

/// <summary>
/// Login request payload.
/// </summary>
public class LoginRequest
{
    public string UsernameOrEmail { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public string? TwoFactorCode { get; set; }
}

/// <summary>
/// Login response containing tokens and user info.
/// </summary>
public class LoginResponse
{
    public bool Success { get; set; }
    public string? Error { get; set; }
    public UserInfo? User { get; set; }
    public TokenInfo? Tokens { get; set; }

    // Legacy properties for backwards compatibility
    public string? AccessToken => Tokens?.AccessToken;
    public string? RefreshToken => Tokens?.RefreshToken;
    public string? ErrorMessage => Error;
}

/// <summary>
/// Token information from authentication response.
/// </summary>
public class TokenInfo
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public int ExpiresIn { get; set; }
}

/// <summary>
/// Token refresh request.
/// </summary>
public class RefreshTokenRequest
{
    public string RefreshToken { get; set; } = string.Empty;
}

/// <summary>
/// Token refresh response.
/// </summary>
public class RefreshTokenResponse
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? AccessTokenExpiry { get; set; }
    public string? ErrorMessage { get; set; }
}

/// <summary>
/// User information returned after authentication.
/// </summary>
public class UserInfo
{
    public string Id { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string? DisplayName { get; set; }
    public string? AvatarUrl { get; set; }
    public string? Role { get; set; }
    public string? PreferredLanguage { get; set; }

    // Legacy properties for backwards compatibility
    public Guid UserId => Guid.TryParse(Id, out var guid) ? guid : Guid.Empty;
    public string? ProfileImageUrl => AvatarUrl;
}

/// <summary>
/// Role information.
/// </summary>
public class RoleInfo
{
    public Guid RoleId { get; set; }
    public string RoleName { get; set; } = string.Empty;
    public string DisplayName { get; set; } = string.Empty;
}

/// <summary>
/// JWT claims for token generation.
/// </summary>
public class JwtClaims
{
    public Guid UserId { get; set; }
    public string Username { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public List<string> Roles { get; set; } = new();
    public DateTime IssuedAt { get; set; }
    public DateTime ExpiresAt { get; set; }
}

/// <summary>
/// Registration request payload.
/// </summary>
public class RegisterRequest
{
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Password { get; set; } = string.Empty;
    public bool SubscribeNewsletter { get; set; }
}

/// <summary>
/// Registration response.
/// </summary>
public class RegisterResponse
{
    public bool Success { get; set; }
    public string? AccessToken { get; set; }
    public string? RefreshToken { get; set; }
    public DateTime? AccessTokenExpiry { get; set; }
    public UserInfo? User { get; set; }
    public string? ErrorMessage { get; set; }
}
