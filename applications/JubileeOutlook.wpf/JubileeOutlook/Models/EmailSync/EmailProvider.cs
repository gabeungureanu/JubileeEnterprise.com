namespace JubileeOutlook.Models.EmailSync;

/// <summary>
/// Represents the type of email provider detected from an email address
/// </summary>
public enum EmailProviderType
{
    Unknown,
    Google,         // Gmail, Google Workspace
    Microsoft,      // Outlook.com, Hotmail, Live, Office 365
    Yahoo,          // Yahoo Mail
    Apple,          // iCloud, me.com, mac.com
    GenericIMAP     // Any other IMAP provider
}

/// <summary>
/// Authentication method supported by the provider
/// </summary>
public enum AuthenticationMethod
{
    OAuth2,
    BasicAuth,      // Username/Password (IMAP)
    AppPassword     // For providers that require app-specific passwords
}

/// <summary>
/// Email provider configuration with server settings
/// </summary>
public class EmailProviderConfig
{
    public EmailProviderType ProviderType { get; set; }
    public string DisplayName { get; set; } = string.Empty;
    public AuthenticationMethod PrimaryAuthMethod { get; set; }
    public AuthenticationMethod? FallbackAuthMethod { get; set; }

    // IMAP Settings
    public string ImapHost { get; set; } = string.Empty;
    public int ImapPort { get; set; } = 993;
    public bool ImapUseSsl { get; set; } = true;

    // SMTP Settings
    public string SmtpHost { get; set; } = string.Empty;
    public int SmtpPort { get; set; } = 587;
    public bool SmtpUseSsl { get; set; } = true;

    // OAuth2 Settings (if applicable)
    public string? OAuth2AuthorizeUrl { get; set; }
    public string? OAuth2TokenUrl { get; set; }
    public string[]? OAuth2Scopes { get; set; }

    // Microsoft Graph specific
    public bool UseGraphApi { get; set; }

    // Provider-specific notes
    public string? Notes { get; set; }
}

/// <summary>
/// Well-known email provider configurations
/// </summary>
public static class EmailProviders
{
    public static readonly EmailProviderConfig Google = new()
    {
        ProviderType = EmailProviderType.Google,
        DisplayName = "Gmail",
        PrimaryAuthMethod = AuthenticationMethod.OAuth2,
        FallbackAuthMethod = AuthenticationMethod.AppPassword,
        ImapHost = "imap.gmail.com",
        ImapPort = 993,
        ImapUseSsl = true,
        SmtpHost = "smtp.gmail.com",
        SmtpPort = 587,
        SmtpUseSsl = true,
        OAuth2AuthorizeUrl = "https://accounts.google.com/o/oauth2/v2/auth",
        OAuth2TokenUrl = "https://oauth2.googleapis.com/token",
        OAuth2Scopes = new[]
        {
            "https://mail.google.com/",
            "https://www.googleapis.com/auth/gmail.modify",
            "https://www.googleapis.com/auth/gmail.send",
            "openid",
            "email",
            "profile"
        },
        UseGraphApi = false,
        Notes = "Requires OAuth2 or App Password. Basic auth disabled since May 2022."
    };

    public static readonly EmailProviderConfig Microsoft = new()
    {
        ProviderType = EmailProviderType.Microsoft,
        DisplayName = "Microsoft 365 / Outlook",
        PrimaryAuthMethod = AuthenticationMethod.OAuth2,
        FallbackAuthMethod = null,
        ImapHost = "outlook.office365.com",
        ImapPort = 993,
        ImapUseSsl = true,
        SmtpHost = "smtp.office365.com",
        SmtpPort = 587,
        SmtpUseSsl = true,
        OAuth2AuthorizeUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
        OAuth2TokenUrl = "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        OAuth2Scopes = new[]
        {
            "https://graph.microsoft.com/Mail.Read",
            "https://graph.microsoft.com/Mail.ReadWrite",
            "https://graph.microsoft.com/Mail.Send",
            "https://graph.microsoft.com/User.Read",
            "offline_access",
            "openid",
            "profile",
            "email"
        },
        UseGraphApi = true,
        Notes = "Uses Microsoft Graph API for best experience. IMAP available as fallback."
    };

    public static readonly EmailProviderConfig Yahoo = new()
    {
        ProviderType = EmailProviderType.Yahoo,
        DisplayName = "Yahoo Mail",
        PrimaryAuthMethod = AuthenticationMethod.OAuth2,
        FallbackAuthMethod = AuthenticationMethod.AppPassword,
        ImapHost = "imap.mail.yahoo.com",
        ImapPort = 993,
        ImapUseSsl = true,
        SmtpHost = "smtp.mail.yahoo.com",
        SmtpPort = 587,
        SmtpUseSsl = true,
        OAuth2AuthorizeUrl = "https://api.login.yahoo.com/oauth2/request_auth",
        OAuth2TokenUrl = "https://api.login.yahoo.com/oauth2/get_token",
        OAuth2Scopes = new[] { "mail-w" },
        UseGraphApi = false,
        Notes = "Supports OAuth2 and App Passwords."
    };

    public static readonly EmailProviderConfig Apple = new()
    {
        ProviderType = EmailProviderType.Apple,
        DisplayName = "iCloud Mail",
        PrimaryAuthMethod = AuthenticationMethod.AppPassword,
        FallbackAuthMethod = null,
        ImapHost = "imap.mail.me.com",
        ImapPort = 993,
        ImapUseSsl = true,
        SmtpHost = "smtp.mail.me.com",
        SmtpPort = 587,
        SmtpUseSsl = true,
        UseGraphApi = false,
        Notes = "Requires App-Specific Password from appleid.apple.com"
    };

    public static EmailProviderConfig CreateGenericIMAP(string imapHost, int imapPort, string smtpHost, int smtpPort)
    {
        return new EmailProviderConfig
        {
            ProviderType = EmailProviderType.GenericIMAP,
            DisplayName = "IMAP/SMTP",
            PrimaryAuthMethod = AuthenticationMethod.BasicAuth,
            FallbackAuthMethod = null,
            ImapHost = imapHost,
            ImapPort = imapPort,
            ImapUseSsl = imapPort == 993,
            SmtpHost = smtpHost,
            SmtpPort = smtpPort,
            SmtpUseSsl = smtpPort == 465 || smtpPort == 587,
            UseGraphApi = false,
            Notes = "Generic IMAP configuration."
        };
    }
}
