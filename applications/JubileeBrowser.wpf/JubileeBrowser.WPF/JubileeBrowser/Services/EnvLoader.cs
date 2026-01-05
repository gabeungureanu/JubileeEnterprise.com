using System.IO;

namespace JubileeBrowser.Services;

/// <summary>
/// Loads environment variables from .env files.
/// </summary>
public static class EnvLoader
{
    private static readonly Dictionary<string, string> _envVariables = new();
    private static bool _isLoaded = false;

    /// <summary>
    /// Loads environment variables from the .env file.
    /// Searches up from the executable directory to find the .env file.
    /// </summary>
    public static void Load()
    {
        if (_isLoaded) return;

        var envPath = FindEnvFile();
        if (envPath != null && File.Exists(envPath))
        {
            LoadFromFile(envPath);
        }

        _isLoaded = true;
    }

    /// <summary>
    /// Gets an environment variable value.
    /// First checks loaded .env values, then falls back to system environment variables.
    /// </summary>
    public static string? GetVariable(string key)
    {
        if (!_isLoaded)
        {
            Load();
        }

        if (_envVariables.TryGetValue(key, out var value))
        {
            return value;
        }

        return Environment.GetEnvironmentVariable(key);
    }

    /// <summary>
    /// Gets an environment variable value or returns the default if not found.
    /// </summary>
    public static string GetVariable(string key, string defaultValue)
    {
        return GetVariable(key) ?? defaultValue;
    }

    private static string? FindEnvFile()
    {
        // Start from executable directory and search up
        var currentDir = AppDomain.CurrentDomain.BaseDirectory;

        // Try common locations
        var searchPaths = new[]
        {
            Path.Combine(currentDir, ".env"),
            Path.Combine(currentDir, "..", ".env"),
            Path.Combine(currentDir, "..", "..", ".env"),
            Path.Combine(currentDir, "..", "..", "..", ".env"),
            Path.Combine(currentDir, "..", "..", "..", "..", ".env"),
            Path.Combine(currentDir, "..", "..", "..", "..", "..", ".env"),
            // Also try from the solution root
            @"C:\data\JubileeBrowser.com\.env",
            // JubileeEnterprise.com monorepo location
            @"C:\data\JubileeEnterprise.com\applications\JubileeBrowser.wpf\.env"
        };

        foreach (var path in searchPaths)
        {
            var fullPath = Path.GetFullPath(path);
            if (File.Exists(fullPath))
            {
                return fullPath;
            }
        }

        return null;
    }

    private static void LoadFromFile(string path)
    {
        try
        {
            var lines = File.ReadAllLines(path);

            foreach (var line in lines)
            {
                // Skip empty lines and comments
                var trimmed = line.Trim();
                if (string.IsNullOrEmpty(trimmed) || trimmed.StartsWith("#"))
                {
                    continue;
                }

                // Parse KEY=VALUE format
                var equalsIndex = trimmed.IndexOf('=');
                if (equalsIndex > 0)
                {
                    var key = trimmed.Substring(0, equalsIndex).Trim();
                    var value = trimmed.Substring(equalsIndex + 1).Trim();

                    // Remove quotes if present
                    if ((value.StartsWith("\"") && value.EndsWith("\"")) ||
                        (value.StartsWith("'") && value.EndsWith("'")))
                    {
                        value = value.Substring(1, value.Length - 2);
                    }

                    _envVariables[key] = value;
                }
            }
        }
        catch (Exception)
        {
            // Silently ignore errors reading .env file
        }
    }
}
