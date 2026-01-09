using System.Net.Http;
using System.Text.Json;
using JubileeBrowser.Models;

namespace JubileeBrowser.Services;

/// <summary>
/// DNS Resolver for the World Wide Bible Web (WWBW) private protocol system.
/// Resolves private protocol URLs (e.g., inspire://home.inspire) to public URLs.
/// Uses the InspireCodex API for iDNS resolution.
/// </summary>
public class WWBWDnsResolver
{
    private readonly HttpClient _httpClient;
    private readonly string _apiBaseUrl;
    private readonly Dictionary<string, DnsResolutionResult> _cache = new(StringComparer.OrdinalIgnoreCase);
    private readonly Dictionary<string, DnsResolutionResult> _reverseCache = new(StringComparer.OrdinalIgnoreCase);
    private DateTime _cacheLastRefresh = DateTime.MinValue;
    private readonly TimeSpan _cacheExpiry = TimeSpan.FromMinutes(5);
    private bool _isInitialized = false;
    private bool _useFallbackOnly = false;

    // Abbreviated domain suffix mappings (short form -> full form)
    private static readonly Dictionary<string, string> DomainAbbreviations = new(StringComparer.OrdinalIgnoreCase)
    {
        { ".webs", ".webspace" },
        { ".insp", ".inspire" },
        { ".chur", ".church" },
        { ".apos", ".apostle" },
        { ".prop", ".prophet" },
    };

    // Fallback DNS mappings when API is unavailable
    // All WWBW URLs use the inspire:// protocol only
    private static readonly Dictionary<string, (string PublicUrl, string? ThirdPartyOverride)> FallbackMappings = new(StringComparer.OrdinalIgnoreCase)
    {
        // inspire:// protocol mappings - the ONLY protocol for WWBW
        // Full form
        { "inspire://jubileeverse.webspace", ("https://www.worldwidebibleweb.com/webspace/jubileeverse/", "https://www.jubileeverse.com") },
        { "inspire://jubileebrowser.webspace", ("https://www.worldwidebibleweb.com/webspace/jubileebrowser/", "http://www.jubileebrowser.com") },
        { "inspire://home.inspire", ("https://www.worldwidebibleweb.com/inspire/home/", "https://www.jubileeverse.com") },
        { "inspire://jubileeverse.inspire", ("https://www.worldwidebibleweb.com/inspire/jubileeverse/", "https://www.jubileeverse.com") },
        { "inspire://trumplicated.webspace", ("https://www.worldwidebibleweb.com/webspace/trumplicated/", "https://www.trumplicated.com") },
        { "inspire://home.church", ("https://www.worldwidebibleweb.com/church/home/", null) },
        { "inspire://home.apostle", ("https://www.worldwidebibleweb.com/apostle/home/", null) },
        { "inspire://home.prophet", ("https://www.worldwidebibleweb.com/prophet/home/", null) },
        // Abbreviated forms
        { "inspire://jubileeverse.webs", ("https://www.worldwidebibleweb.com/webspace/jubileeverse/", "https://www.jubileeverse.com") },
        { "inspire://jubileebrowser.webs", ("https://www.worldwidebibleweb.com/webspace/jubileebrowser/", "http://www.jubileebrowser.com") },
        { "inspire://home.insp", ("https://www.worldwidebibleweb.com/inspire/home/", "https://www.jubileeverse.com") },
        { "inspire://jubileeverse.insp", ("https://www.worldwidebibleweb.com/inspire/jubileeverse/", "https://www.jubileeverse.com") },
        { "inspire://trumplicated.webs", ("https://www.worldwidebibleweb.com/webspace/trumplicated/", "https://www.trumplicated.com") },
        { "inspire://home.chur", ("https://www.worldwidebibleweb.com/church/home/", null) },
        { "inspire://home.apos", ("https://www.worldwidebibleweb.com/apostle/home/", null) },
        { "inspire://home.prop", ("https://www.worldwidebibleweb.com/prophet/home/", null) },
    };

    // Known private protocol schemes - only inspire:// is valid for WWBW mode
    private static readonly HashSet<string> PrivateProtocols = new(StringComparer.OrdinalIgnoreCase)
    {
        "inspire"
    };

    public WWBWDnsResolver(string? apiBaseUrl = null)
    {
        _apiBaseUrl = apiBaseUrl ?? "https://inspirecodex.com";
        _httpClient = new HttpClient
        {
            Timeout = TimeSpan.FromSeconds(10)
        };
    }

    public async Task InitializeAsync()
    {
        try
        {
            // Test API connectivity
            var testUrl = "inspire://jubileeverse.webspace";
            var result = await ResolveFromApiAsync(testUrl);

            if (result != null)
            {
                _isInitialized = true;
                _useFallbackOnly = false;
                System.Diagnostics.Debug.WriteLine($"WWBW DNS Resolver initialized with API at {_apiBaseUrl}");
            }
            else
            {
                throw new Exception("API returned null for test URL");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"WWBW DNS Resolver API unavailable: {ex.Message}");
            System.Diagnostics.Debug.WriteLine("Using fallback DNS mappings");
            // Continue without API - use fallback resolution
            _useFallbackOnly = true;
            _isInitialized = true; // Mark as initialized so we can use fallback mappings
            LoadFallbackMappings();
        }
    }

    private void LoadFallbackMappings()
    {
        _cache.Clear();
        _reverseCache.Clear();

        foreach (var mapping in FallbackMappings)
        {
            var privateUrl = mapping.Key;
            var (publicUrl, thirdPartyOverride) = mapping.Value;
            var resolvedUrl = thirdPartyOverride ?? publicUrl;

            // Parse the private URL to get type and domain
            var parsed = ParsePrivateUrl(privateUrl);
            var webSpaceType = parsed?.Type ?? "unknown";
            var domainName = parsed?.Domain ?? "unknown";

            var result = new DnsResolutionResult
            {
                PrivateProtocolUrl = privateUrl,
                ShortPrivateUrl = null,
                PublicUrl = publicUrl,
                ThirdPartyOverrideUrl = thirdPartyOverride,
                WebSpaceType = webSpaceType,
                DomainName = domainName,
                Priority = 1,
                ResolvedUrl = resolvedUrl
            };

            _cache[privateUrl] = result;
            _reverseCache[resolvedUrl] = result;
            if (!string.IsNullOrEmpty(thirdPartyOverride) && thirdPartyOverride != publicUrl)
            {
                _reverseCache[publicUrl] = result;
            }
        }

        _cacheLastRefresh = DateTime.UtcNow;
        System.Diagnostics.Debug.WriteLine($"WWBW DNS Resolver loaded {_cache.Count} fallback mappings");
    }

    /// <summary>
    /// Checks if the given URL uses a private WWBW protocol.
    /// </summary>
    public static bool IsPrivateProtocol(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        var colonIndex = url.IndexOf("://", StringComparison.Ordinal);
        if (colonIndex <= 0) return false;

        var scheme = url[..colonIndex];
        return PrivateProtocols.Contains(scheme);
    }

    /// <summary>
    /// Checks if a URL is valid for the given browser mode.
    /// - WWBW mode: Only inspire:// protocol URLs are allowed
    ///              Regular http:// and https:// URLs are NOT allowed
    /// - WWW mode: Both inspire:// protocol URLs and regular URLs are allowed
    /// </summary>
    public bool IsValidForMode(string url, BrowserMode mode)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        var isPrivate = IsPrivateProtocol(url);

        if (mode == BrowserMode.JubileeBibles)
        {
            // WWBW mode: ONLY inspire:// protocol allowed
            // Regular http:// and https:// URLs are blocked
            return isPrivate;
        }
        else
        {
            // WWW mode: All URLs allowed (inspire:// and regular http/https)
            return true;
        }
    }

    /// <summary>
    /// Checks if a URL should be blocked in WWBW mode.
    /// Returns true for http:// and https:// URLs that are not the result of resolving a private URL.
    /// </summary>
    public bool ShouldBlockInWWBWMode(string url, bool isResolvedFromPrivateUrl)
    {
        if (string.IsNullOrWhiteSpace(url)) return false;

        // If this is a resolved URL from a private protocol, allow it
        if (isResolvedFromPrivateUrl) return false;

        // Check if it's a regular http/https URL
        if (Uri.TryCreate(url, UriKind.Absolute, out var uri))
        {
            if (uri.Scheme.Equals("http", StringComparison.OrdinalIgnoreCase) ||
                uri.Scheme.Equals("https", StringComparison.OrdinalIgnoreCase))
            {
                // Block regular web URLs in WWBW mode
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Resolves a private protocol URL to its public equivalent.
    /// Returns null if resolution fails or URL is not a private protocol.
    /// </summary>
    public async Task<DnsResolutionResult?> ResolveAsync(string privateUrl)
    {
        if (!IsPrivateProtocol(privateUrl))
            return null;

        // Check cache first
        if (_cache.TryGetValue(privateUrl, out var cached) &&
            DateTime.UtcNow - _cacheLastRefresh < _cacheExpiry)
        {
            return cached;
        }

        // If using fallback only, try local fallback
        if (_useFallbackOnly)
        {
            return TryResolveFallback(privateUrl);
        }

        // Try to resolve from API
        try
        {
            var result = await ResolveFromApiAsync(privateUrl);
            if (result != null)
            {
                _cache[privateUrl] = result;
                if (!string.IsNullOrEmpty(result.ResolvedUrl))
                {
                    _reverseCache[result.ResolvedUrl] = result;
                }
                return result;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"API DNS resolution error: {ex.Message}");
        }

        // Fall back to local mappings
        return TryResolveFallback(privateUrl);
    }

    /// <summary>
    /// Resolves a private URL using the InspireCodex API.
    /// </summary>
    private async Task<DnsResolutionResult?> ResolveFromApiAsync(string privateUrl)
    {
        try
        {
            var encodedUrl = Uri.EscapeDataString(privateUrl);
            var apiUrl = $"{_apiBaseUrl}/api/v1/idns/resolve?url={encodedUrl}";

            var response = await _httpClient.GetAsync(apiUrl);
            var content = await response.Content.ReadAsStringAsync();

            if (response.IsSuccessStatusCode)
            {
                var apiResult = JsonSerializer.Deserialize<IdnsApiResponse>(content, new JsonSerializerOptions
                {
                    PropertyNameCaseInsensitive = true
                });

                if (apiResult?.Success == true && !string.IsNullOrEmpty(apiResult.ResolvedUrl))
                {
                    var result = new DnsResolutionResult
                    {
                        PrivateProtocolUrl = privateUrl,
                        ShortPrivateUrl = null,
                        PublicUrl = apiResult.ResolvedUrl,
                        ThirdPartyOverrideUrl = null,
                        WebSpaceType = apiResult.DomainType ?? "unknown",
                        DomainName = apiResult.DomainKey ?? "unknown",
                        Priority = 1,
                        ResolvedUrl = apiResult.ResolvedUrl
                    };

                    return result;
                }
            }

            System.Diagnostics.Debug.WriteLine($"API resolution failed for {privateUrl}: {content}");
            return null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"API call failed: {ex.Message}");
            return null;
        }
    }

    /// <summary>
    /// Tries to resolve using local fallback mappings.
    /// </summary>
    private DnsResolutionResult? TryResolveFallback(string privateUrl)
    {
        // Check cache
        if (_cache.TryGetValue(privateUrl, out var cached))
        {
            return cached;
        }

        // Try fallback mappings
        if (FallbackMappings.TryGetValue(privateUrl, out var fallback))
        {
            var parsed = ParsePrivateUrl(privateUrl);
            var result = new DnsResolutionResult
            {
                PrivateProtocolUrl = privateUrl,
                ShortPrivateUrl = null,
                PublicUrl = fallback.PublicUrl,
                ThirdPartyOverrideUrl = fallback.ThirdPartyOverride,
                WebSpaceType = parsed?.Type ?? "unknown",
                DomainName = parsed?.Domain ?? "unknown",
                Priority = 1,
                ResolvedUrl = fallback.ThirdPartyOverride ?? fallback.PublicUrl
            };

            _cache[privateUrl] = result;
            return result;
        }

        // Try creating dynamic fallback
        return TryCreateFallbackMapping(privateUrl);
    }

    /// <summary>
    /// Creates a dynamic fallback mapping for unknown private URLs.
    /// This allows any private protocol URL to resolve to a predictable public URL structure.
    /// </summary>
    private DnsResolutionResult? TryCreateFallbackMapping(string privateUrl)
    {
        var parsed = ParsePrivateUrl(privateUrl);
        if (parsed == null) return null;

        var (type, domain) = parsed.Value;

        // Create a dynamic public URL based on the pattern
        var publicUrl = $"https://www.worldwidebibleweb.com/{type.ToLowerInvariant()}/{domain.ToLowerInvariant()}/";

        var result = new DnsResolutionResult
        {
            PrivateProtocolUrl = privateUrl,
            ShortPrivateUrl = null,
            PublicUrl = publicUrl,
            ThirdPartyOverrideUrl = null,
            WebSpaceType = type,
            DomainName = domain,
            Priority = 100, // Lower priority than explicit mappings
            ResolvedUrl = publicUrl
        };

        // Cache the dynamic mapping
        _cache[privateUrl] = result;
        _reverseCache[publicUrl] = result;

        System.Diagnostics.Debug.WriteLine($"Created dynamic fallback mapping: {privateUrl} -> {publicUrl}");
        return result;
    }

    /// <summary>
    /// Resolves a private URL and returns the appropriate public URL.
    /// Uses ThirdPartyOverrideURL if available, otherwise uses PublicURL.
    /// </summary>
    public async Task<string?> ResolveToPublicUrlAsync(string privateUrl)
    {
        var result = await ResolveAsync(privateUrl);
        return result?.ResolvedUrl;
    }

    /// <summary>
    /// Reverse resolves a public URL to its private protocol equivalent.
    /// </summary>
    public async Task<string?> ReverseResolveAsync(string publicUrl)
    {
        if (string.IsNullOrWhiteSpace(publicUrl)) return null;

        // Check reverse cache
        if (_reverseCache.TryGetValue(publicUrl, out var cached) &&
            DateTime.UtcNow - _cacheLastRefresh < _cacheExpiry)
        {
            return cached.PrivateProtocolUrl;
        }

        // Also try matching just by the host (for cases where the path changes)
        if (Uri.TryCreate(publicUrl, UriKind.Absolute, out var uri))
        {
            var hostOnly = $"{uri.Scheme}://{uri.Host}";
            var hostWithSlash = $"{uri.Scheme}://{uri.Host}/";
            var wwwHost = uri.Host.StartsWith("www.") ? uri.Host : $"www.{uri.Host}";
            var nonWwwHost = uri.Host.StartsWith("www.") ? uri.Host[4..] : uri.Host;

            var variations = new[]
            {
                publicUrl,
                hostOnly,
                hostWithSlash,
                $"https://{wwwHost}",
                $"https://{wwwHost}/",
                $"https://{nonWwwHost}",
                $"https://{nonWwwHost}/",
                $"http://{wwwHost}",
                $"http://{wwwHost}/",
                $"http://{nonWwwHost}",
                $"http://{nonWwwHost}/"
            };

            foreach (var variation in variations)
            {
                if (_reverseCache.TryGetValue(variation, out var result))
                {
                    return result.PrivateProtocolUrl;
                }
            }
        }

        return null;
    }

    /// <summary>
    /// Parses a private URL into its type and domain components.
    /// Example: "inspire://home.inspire" -> (Type: "inspire", Domain: "home")
    /// </summary>
    public static (string Type, string Domain)? ParsePrivateUrl(string privateUrl)
    {
        if (string.IsNullOrWhiteSpace(privateUrl)) return null;

        try
        {
            var colonIndex = privateUrl.IndexOf("://", StringComparison.Ordinal);
            if (colonIndex <= 0) return null;

            var rest = privateUrl[(colonIndex + 3)..];
            var dotIndex = rest.LastIndexOf('.');
            if (dotIndex <= 0) return null;

            var domain = rest[..dotIndex];
            var type = rest[(dotIndex + 1)..];

            // Expand abbreviated types
            foreach (var abbrev in DomainAbbreviations)
            {
                if (type.Equals(abbrev.Key.TrimStart('.'), StringComparison.OrdinalIgnoreCase))
                {
                    type = abbrev.Value.TrimStart('.');
                    break;
                }
            }

            return (type, domain);
        }
        catch
        {
            return null;
        }
    }
}

/// <summary>
/// Response model for the iDNS API.
/// </summary>
internal class IdnsApiResponse
{
    public bool Success { get; set; }
    public string? PrivateUrl { get; set; }
    public string? ResolvedUrl { get; set; }
    public string? DomainKey { get; set; }
    public string? DomainType { get; set; }
    public string? DisplayName { get; set; }
    public bool Managed { get; set; }
    public string? Error { get; set; }
}

/// <summary>
/// Result of a DNS resolution operation.
/// </summary>
public class DnsResolutionResult
{
    public string? PrivateProtocolUrl { get; set; }
    public string? ShortPrivateUrl { get; set; }
    public string? PublicUrl { get; set; }
    public string? ThirdPartyOverrideUrl { get; set; }
    public string? WebSpaceType { get; set; }
    public string? DomainName { get; set; }
    public int Priority { get; set; }
    public string? ResolvedUrl { get; set; }
}
