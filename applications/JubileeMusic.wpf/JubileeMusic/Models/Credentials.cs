using Newtonsoft.Json;

namespace JubileeMusic.Models;

public class SunoCredentials
{
    [JsonProperty("email")]
    public string? Email { get; set; }

    [JsonProperty("password")]
    public string? Password { get; set; }

    [JsonProperty("authMethod")]
    public AuthMethod AuthMethod { get; set; } = AuthMethod.Interactive;

    [JsonProperty("rememberMe")]
    public bool RememberMe { get; set; } = true;

    [JsonProperty("configFilePath")]
    public string? ConfigFilePath { get; set; }

    public bool IsValid => AuthMethod == AuthMethod.Interactive ||
                          (!string.IsNullOrWhiteSpace(Email) && !string.IsNullOrWhiteSpace(Password));
}

public enum AuthMethod
{
    Interactive,    // User logs in via embedded browser
    Automatic,      // App uses stored credentials
    ConfigFile      // App reads from credentials file
}

public class CredentialConfig
{
    [JsonProperty("suno")]
    public SunoCredentialConfig? Suno { get; set; }
}

public class SunoCredentialConfig
{
    [JsonProperty("email")]
    public string? Email { get; set; }

    [JsonProperty("password")]
    public string? Password { get; set; }

    [JsonProperty("autoLogin")]
    public bool AutoLogin { get; set; } = false;
}
