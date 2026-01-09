namespace JubileeVibes.Core.Events;

public class AuthStateChangedEventArgs : EventArgs
{
    public bool IsAuthenticated { get; }
    public string? UserId { get; }
    public string? UserName { get; }

    public AuthStateChangedEventArgs(bool isAuthenticated, string? userId = null, string? userName = null)
    {
        IsAuthenticated = isAuthenticated;
        UserId = userId;
        UserName = userName;
    }
}
