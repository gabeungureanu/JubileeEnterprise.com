using JubileeVibes.Core.Events;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface IAuthenticationService
{
    AuthSession? CurrentSession { get; }
    bool IsAuthenticated { get; }
    User? CurrentUser { get; }

    event EventHandler<AuthStateChangedEventArgs>? AuthStateChanged;

    Task InitializeAsync();
    Task<AuthResult> SignInAsync(string email, string password);
    Task<AuthResult> SignInWithTokenAsync();
    Task SignOutAsync();
    Task<bool> RefreshTokenAsync();
    Task<string?> GetAccessTokenAsync();
}

public class AuthSession
{
    public string UserId { get; set; } = string.Empty;
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
}

public class AuthResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public AuthSession? Session { get; set; }

    public static AuthResult Succeeded(AuthSession session) => new() { Success = true, Session = session };
    public static AuthResult Failed(string message) => new() { Success = false, ErrorMessage = message };
}
