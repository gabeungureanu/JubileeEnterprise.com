using System.Diagnostics;
using System.Net.Http.Headers;
using MailKit;
using MailKit.Net.Imap;
using MailKit.Security;
using Microsoft.Graph;
using Microsoft.Graph.Models;
using Microsoft.Kiota.Abstractions.Authentication;
using JubileeOutlook.Models.EmailSync;

namespace JubileeOutlook.Services.EmailSync;

/// <summary>
/// Service for establishing and managing email server connections
/// Supports IMAP (MailKit) and Microsoft Graph API
/// </summary>
public class EmailConnectionService : IDisposable
{
    private readonly SecureStorageService _secureStorage;
    private readonly MicrosoftOAuth2Service _microsoftAuth;
    private ImapClient? _imapClient;
    private GraphServiceClient? _graphClient;
    private bool _disposed;

    public EmailConnectionService(SecureStorageService secureStorage, MicrosoftOAuth2Service microsoftAuth)
    {
        _secureStorage = secureStorage;
        _microsoftAuth = microsoftAuth;
    }

    /// <summary>
    /// Establish connection based on provider type
    /// </summary>
    public async Task<ConnectionResult> ConnectAsync(SyncedEmailAccount account)
    {
        Debug.WriteLine($"[Connection] Connecting to {account.EmailAddress} ({account.ProviderType})");

        try
        {
            // Microsoft accounts use Graph API
            if (account.ProviderType == EmailProviderType.Microsoft)
            {
                return await ConnectGraphApiAsync(account);
            }

            // All others use IMAP
            return await ConnectImapAsync(account);
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Connection] Error connecting: {ex.Message}");
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Connection failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Connect to Microsoft Graph API
    /// </summary>
    private async Task<ConnectionResult> ConnectGraphApiAsync(SyncedEmailAccount account)
    {
        Debug.WriteLine($"[Connection] Connecting to Microsoft Graph for {account.EmailAddress}");

        var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{account.Id}");
        if (credentials == null)
        {
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = "No credentials found for account"
            };
        }

        // Check if token needs refresh
        if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value <= DateTime.UtcNow.AddMinutes(5))
        {
            Debug.WriteLine("[Connection] Token expired, refreshing...");
            var refreshResult = await _microsoftAuth.RefreshTokenAsync(account.Id);
            if (!refreshResult.Success)
            {
                return new ConnectionResult
                {
                    Success = false,
                    ErrorMessage = "Failed to refresh access token"
                };
            }
            credentials = refreshResult.Credentials;
        }

        if (string.IsNullOrEmpty(credentials?.AccessToken))
        {
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = "No valid access token"
            };
        }

        // Create Graph client with access token using BaseBearerTokenAuthenticationProvider
        var authProvider = new BaseBearerTokenAuthenticationProvider(
            new SimpleTokenProvider(credentials.AccessToken));
        var httpClient = GraphClientFactory.Create(authProvider);
        _graphClient = new GraphServiceClient(httpClient);

        // Validate connection by getting user profile
        try
        {
            var user = await _graphClient.Me.GetAsync();
            Debug.WriteLine($"[Connection] Graph connected as {user?.DisplayName ?? user?.UserPrincipalName}");

            return new ConnectionResult
            {
                Success = true,
                ConnectionType = ConnectionType.MicrosoftGraph,
                GraphClient = _graphClient,
                UserDisplayName = user?.DisplayName,
                UserEmail = user?.Mail ?? user?.UserPrincipalName
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Connection] Graph validation failed: {ex.Message}");
            _graphClient = null;
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Failed to validate Graph connection: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Connect to IMAP server
    /// </summary>
    private async Task<ConnectionResult> ConnectImapAsync(SyncedEmailAccount account)
    {
        Debug.WriteLine($"[Connection] Connecting to IMAP {account.ImapHost}:{account.ImapPort}");

        var credentials = await _secureStorage.RetrieveAsync<EmailAccountCredentials>($"credentials_{account.Id}");
        if (credentials == null)
        {
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = "No credentials found for account"
            };
        }

        _imapClient = new ImapClient();

        try
        {
            // Determine SSL mode
            var sslMode = account.ImapPort == 993
                ? SecureSocketOptions.SslOnConnect
                : SecureSocketOptions.StartTls;

            await _imapClient.ConnectAsync(account.ImapHost, account.ImapPort, sslMode);
            Debug.WriteLine("[Connection] IMAP connected, authenticating...");

            // Authenticate based on method
            if (account.AuthMethod == Models.EmailSync.AuthenticationMethod.OAuth2)
            {
                // Check if token needs refresh
                if (credentials.TokenExpiry.HasValue && credentials.TokenExpiry.Value <= DateTime.UtcNow.AddMinutes(5))
                {
                    Debug.WriteLine("[Connection] OAuth token expired, refreshing...");
                    var oauth2Service = new OAuth2AuthenticationService(_secureStorage);
                    var refreshResult = await oauth2Service.RefreshTokenAsync(account.Id, account.ProviderType);
                    if (!refreshResult.Success)
                    {
                        return new ConnectionResult
                        {
                            Success = false,
                            ErrorMessage = "Failed to refresh OAuth token"
                        };
                    }
                    credentials = refreshResult.Credentials;
                }

                // Use XOAUTH2 mechanism
                var oauth2 = new SaslMechanismOAuth2(account.EmailAddress, credentials!.AccessToken);
                await _imapClient.AuthenticateAsync(oauth2);
            }
            else
            {
                // Password/App Password authentication
                var password = _secureStorage.DecryptPassword(credentials.EncryptedPassword ?? "");
                await _imapClient.AuthenticateAsync(account.EmailAddress, password);
            }

            Debug.WriteLine($"[Connection] IMAP authenticated, capabilities: {_imapClient.Capabilities}");

            return new ConnectionResult
            {
                Success = true,
                ConnectionType = ConnectionType.IMAP,
                ImapClient = _imapClient,
                Capabilities = _imapClient.Capabilities.ToString()
            };
        }
        catch (AuthenticationException ex)
        {
            Debug.WriteLine($"[Connection] IMAP auth failed: {ex.Message}");
            await DisconnectImapAsync();
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Authentication failed: {ex.Message}"
            };
        }
        catch (Exception ex)
        {
            Debug.WriteLine($"[Connection] IMAP connection failed: {ex.Message}");
            await DisconnectImapAsync();
            return new ConnectionResult
            {
                Success = false,
                ErrorMessage = $"Connection failed: {ex.Message}"
            };
        }
    }

    /// <summary>
    /// Disconnect from IMAP server
    /// </summary>
    public async Task DisconnectImapAsync()
    {
        if (_imapClient?.IsConnected == true)
        {
            try
            {
                await _imapClient.DisconnectAsync(true);
            }
            catch (Exception ex)
            {
                Debug.WriteLine($"[Connection] Disconnect error: {ex.Message}");
            }
        }
        _imapClient?.Dispose();
        _imapClient = null;
    }

    /// <summary>
    /// Disconnect from Graph API (clear client)
    /// </summary>
    public void DisconnectGraph()
    {
        _graphClient = null;
    }

    /// <summary>
    /// Check if currently connected
    /// </summary>
    public bool IsConnected => (_imapClient?.IsConnected == true) || (_graphClient != null);

    /// <summary>
    /// Get the current IMAP client
    /// </summary>
    public ImapClient? ImapClient => _imapClient;

    /// <summary>
    /// Get the current Graph client
    /// </summary>
    public GraphServiceClient? GraphClient => _graphClient;

    /// <summary>
    /// Validate the connection is still alive
    /// </summary>
    public async Task<bool> ValidateConnectionAsync()
    {
        if (_imapClient?.IsConnected == true)
        {
            try
            {
                await _imapClient.NoOpAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        if (_graphClient != null)
        {
            try
            {
                await _graphClient.Me.GetAsync();
                return true;
            }
            catch
            {
                return false;
            }
        }

        return false;
    }

    public void Dispose()
    {
        Dispose(true);
        GC.SuppressFinalize(this);
    }

    protected virtual void Dispose(bool disposing)
    {
        if (!_disposed)
        {
            if (disposing)
            {
                _imapClient?.Dispose();
            }
            _disposed = true;
        }
    }
}

/// <summary>
/// Connection result
/// </summary>
public class ConnectionResult
{
    public bool Success { get; set; }
    public string? ErrorMessage { get; set; }
    public ConnectionType ConnectionType { get; set; }
    public ImapClient? ImapClient { get; set; }
    public GraphServiceClient? GraphClient { get; set; }
    public string? Capabilities { get; set; }
    public string? UserDisplayName { get; set; }
    public string? UserEmail { get; set; }
}

/// <summary>
/// Type of connection established
/// </summary>
public enum ConnectionType
{
    None,
    IMAP,
    MicrosoftGraph
}

/// <summary>
/// Simple token provider for Microsoft Graph authentication
/// </summary>
internal class SimpleTokenProvider : IAccessTokenProvider
{
    private readonly string _accessToken;

    public SimpleTokenProvider(string accessToken)
    {
        _accessToken = accessToken;
    }

    public AllowedHostsValidator AllowedHostsValidator => new();

    public Task<string> GetAuthorizationTokenAsync(
        Uri uri,
        Dictionary<string, object>? additionalAuthenticationContext = null,
        CancellationToken cancellationToken = default)
    {
        return Task.FromResult(_accessToken);
    }
}
