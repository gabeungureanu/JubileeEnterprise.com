using System.IO;
using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace JubileeBrowser.Services;

/// <summary>
/// Service for evaluating web page content for spiritual nutrition using a 10-category
/// framework that assesses truthfulness, moral alignment, human dignity, and biblical worldview.
/// </summary>
public class SpiritualNutritionService
{
    private readonly HttpClient _httpClient;
    private readonly string _primaryApiKey;
    private readonly string _backupApiKey;
    private readonly string _apiEndpoint = "https://api.openai.com/v1/chat/completions";
    private readonly string _model = "gpt-4o-mini";

    private bool _usingBackupKey = false;
    private DateTime? _primaryKeyBlockedUntil = null;

    // Cache for storing evaluation results keyed by URL
    private Dictionary<string, CachedNutritionResult> _cache = new();
    private readonly TimeSpan _cacheExpiration = TimeSpan.FromMinutes(60); // Cache results for 60 minutes - ignore content changes during this window

    // Persistent cache file path
    private readonly string _cacheFilePath;
    private static readonly JsonSerializerOptions _jsonOptions = new()
    {
        WriteIndented = false,
        PropertyNameCaseInsensitive = true
    };

    // Category weights for overall score calculation (total = 100%)
    private static readonly Dictionary<string, double> CategoryWeights = new()
    {
        { "truthfulness", 0.15 },           // 15% - Foundation of all evaluation
        { "moralAlignment", 0.12 },         // 12% - Ethical framework
        { "humanDignity", 0.10 },           // 10% - Image-bearing respect
        { "emotionalImpact", 0.08 },        // 8% - Heart and mind effect
        { "wisdomVsFolly", 0.10 },          // 10% - Depth of reasoning
        { "intentDirection", 0.08 },        // 8% - Motivational analysis
        { "biblicalWorldview", 0.12 },      // 12% - Core principles alignment
        { "earlyChurchResonance", 0.10 },   // 10% - Acts-era lens
        { "constructiveInfluence", 0.08 },  // 8% - Building up vs tearing down
        { "spiritualDensity", 0.07 }        // 7% - Nutritional substance
    };

    private readonly string _systemPrompt = @"You are a Spiritual Nutrition Evaluator for the Jubilee Browser. Your role is to analyze web content using a comprehensive 10-category framework that assesses spiritual, moral, and intellectual nutritional value.

EVALUATION FRAMEWORK - Score each category from 0-100:

1. TRUTHFULNESS AND FACTUAL INTEGRITY (0-100)
   - Is this content grounded in truth?
   - Measure factual accuracy, internal consistency, and honesty
   - Detect misinformation, exaggeration, manipulation, or selective framing
   - Cross-check claims against logical coherence
   - Score 0-30: Contains significant falsehoods or manipulation
   - Score 31-60: Mixed accuracy, some questionable claims
   - Score 61-80: Generally accurate with minor issues
   - Score 81-100: Highly truthful and factually sound

2. MORAL AND ETHICAL ALIGNMENT (0-100)
   - Does this promote what is good, just, and righteous?
   - Evaluate moral framing of actions, people, and outcomes
   - Detect normalization of violence, exploitation, injustice, or immorality
   - Assess ethical reasoning even in secular contexts
   - Score based on alignment with universal moral principles

3. HUMAN DIGNITY AND IMAGE-BEARING (0-100)
   - Are people treated as valuable, or as objects?
   - Analyze how individuals or groups are portrayed
   - Detect dehumanization, stereotyping, contempt, or commodification
   - Identify respect for life, worth, and intrinsic value
   - Every human bears inherent dignity - score reflects this recognition

4. EMOTIONAL AND SPIRITUAL IMPACT (0-100)
   - What does this do to the heart and mind?
   - Use sentiment analysis to assess fear, anger, despair, hope, peace
   - Measure emotional manipulation versus emotional honesty
   - Evaluate whether content agitates, nourishes, or stabilizes the reader
   - Higher scores for content that brings peace, hope, and clarity

5. WISDOM VERSUS FOLLY (0-100)
   - Does this reflect thoughtful insight or reckless thinking?
   - Assess depth, nuance, and humility of reasoning
   - Detect impulsive, simplistic, or reactionary narratives
   - Reward prudence, balance, and long-term perspective
   - Wisdom shows careful thought; folly shows recklessness

6. INTENT AND MOTIVATIONAL DIRECTION (0-100)
   - What is this trying to move me toward?
   - Identify underlying motives: profit, fear, outrage, control, service
   - Detect manipulation, propaganda, or agenda-driven framing
   - Evaluate whether intent aligns with truth-seeking or self-interest
   - Higher scores for content serving readers vs exploiting them

7. ALIGNMENT WITH BIBLICAL WORLDVIEW (0-100)
   - Does this align with or oppose core biblical principles?
   - Compare themes against biblical values: justice, mercy, humility, faithfulness, accountability
   - Works even when God or Scripture is never mentioned
   - Worldviews shape behavior - this surfaces underlying assumptions
   - Score based on principle alignment, not religious language

8. EARLY CHURCH RESONANCE (Acts-Era Lens) (0-100)
   - Would the early Church recognize this as life-giving or harmful?
   - Evaluate through lens of: community, sacrifice, truth under pressure, love of neighbor, faithfulness
   - Helps avoid modern distortions of faith
   - The Book of Acts provides baseline for lived, embodied faith
   - Higher scores for content the apostles would affirm

9. CONSTRUCTIVE VERSUS DESTRUCTIVE INFLUENCE (0-100)
   - Does this build up or tear down?
   - Measure whether content encourages growth, reconciliation, understanding
   - Or fuels division, cynicism, despair, or hatred
   - Applies even to critical or investigative journalism
   - Scripture calls believers to what edifies - score reflects this

10. SPIRITUAL NUTRITIONAL DENSITY (0-100)
    - Is this nourishing or empty?
    - Evaluate signal-to-noise ratio
    - Distinguish substantive insight from clickbait or outrage cycles
    - Detect ""empty calories"" content that consumes attention without benefit
    - Not everything harmful is evil - much is simply empty

CONTENT TYPE: Categorize the content (e.g., ""News Article"", ""Opinion Piece"", ""Educational"", ""Entertainment"", ""E-Commerce"", ""Social Media"", ""Faith-Based"", ""Scientific"", ""Political"", etc.)

INGREDIENTS: Provide a 2-4 sentence summary describing the dominant themes, values, narratives, or spiritual influences detected. Explain what factors most influenced the scores in plain, user-readable language.

CATEGORY SUMMARIES: For each category, provide a brief 1-sentence explanation of why that score was given.

RESPONSE FORMAT:
You MUST respond with ONLY a valid JSON object in this exact format (no markdown, no explanation, no additional text):
{
  ""truthfulness"": 0,
  ""truthfulnessSummary"": ""string"",
  ""moralAlignment"": 0,
  ""moralAlignmentSummary"": ""string"",
  ""humanDignity"": 0,
  ""humanDignitySummary"": ""string"",
  ""emotionalImpact"": 0,
  ""emotionalImpactSummary"": ""string"",
  ""wisdomVsFolly"": 0,
  ""wisdomVsFollySummary"": ""string"",
  ""intentDirection"": 0,
  ""intentDirectionSummary"": ""string"",
  ""biblicalWorldview"": 0,
  ""biblicalWorldviewSummary"": ""string"",
  ""earlyChurchResonance"": 0,
  ""earlyChurchResonanceSummary"": ""string"",
  ""constructiveInfluence"": 0,
  ""constructiveInfluenceSummary"": ""string"",
  ""spiritualDensity"": 0,
  ""spiritualDensitySummary"": ""string"",
  ""contentType"": ""string"",
  ""ingredients"": ""string""
}

IMPORTANT NOTES:
- This framework works for ALL content types: secular, news, academic, entertainment, faith-based
- Religious language is NOT required for high scores - evaluate underlying principles
- Be consistent and reproducible - same content should yield similar scores
- Provide honest, balanced assessments without bias toward or against any topic
- Empty/clickbait content should score low on density even if not harmful";

    public SpiritualNutritionService(string primaryApiKey, string backupApiKey)
    {
        _primaryApiKey = primaryApiKey;
        _backupApiKey = backupApiKey;
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromSeconds(120);

        // Set up persistent cache file path in AppData
        var appDataPath = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData),
            "JubileeBrowser",
            "Cache"
        );
        Directory.CreateDirectory(appDataPath);
        _cacheFilePath = Path.Combine(appDataPath, "spiritual_nutrition_cache.json");

        // Load existing cache from disk
        LoadCacheFromDisk();
    }

    public async Task<SpiritualNutritionResult> EvaluateContentAsync(string pageContent, string pageUrl, string pageTitle)
    {
        // Check cache first - use URL only, ignore content changes for 60 minutes
        var cacheKey = NormalizeUrlForCache(pageUrl);
        System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Checking cache for {cacheKey}, cache count: {_cache.Count}");
        if (TryGetFromCache(cacheKey, out var cachedResult))
        {
            System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: CACHE HIT - Returning cached result for {pageUrl}");
            return cachedResult!;
        }
        System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: CACHE MISS - Calling API for {pageUrl}");

        // Truncate content if too long (max ~10000 chars to stay within token limits while getting good analysis)
        var truncatedContent = pageContent.Length > 10000
            ? pageContent.Substring(0, 10000) + "... [content truncated for analysis]"
            : pageContent;

        var userMessage = $@"Analyze the following web page content using the 10-category Spiritual Nutrition framework:

PAGE URL: {pageUrl}
PAGE TITLE: {pageTitle}

CONTENT:
{truncatedContent}

Provide your evaluation with scores (0-100) for all 10 categories and brief summaries for each, plus the content type and ingredients section. Respond ONLY with the JSON object.";

        var messages = new List<object>
        {
            new { role = "system", content = _systemPrompt },
            new { role = "user", content = userMessage }
        };

        string apiKey = GetCurrentApiKey();

        try
        {
            var response = await CallOpenAIAsync(messages, apiKey);
            var result = ParseResponse(response);
            AddToCache(cacheKey, result);
            return result;
        }
        catch (RateLimitException)
        {
            if (!_usingBackupKey && !string.IsNullOrEmpty(_backupApiKey))
            {
                _usingBackupKey = true;
                _primaryKeyBlockedUntil = DateTime.UtcNow.AddSeconds(60);

                var response = await CallOpenAIAsync(messages, _backupApiKey);
                var result = ParseResponse(response);
                AddToCache(cacheKey, result);
                return result;
            }
            throw;
        }
    }

    private string GetCurrentApiKey()
    {
        if (_usingBackupKey && _primaryKeyBlockedUntil.HasValue)
        {
            if (DateTime.UtcNow > _primaryKeyBlockedUntil.Value)
            {
                _usingBackupKey = false;
                _primaryKeyBlockedUntil = null;
            }
        }
        return _usingBackupKey ? _backupApiKey : _primaryApiKey;
    }

    private async Task<string> CallOpenAIAsync(List<object> messages, string apiKey)
    {
        var requestBody = new
        {
            model = _model,
            messages = messages,
            max_tokens = 2000,
            temperature = 0.2 // Low temperature for consistent, reproducible scoring
        };

        var json = JsonSerializer.Serialize(requestBody);
        var content = new StringContent(json, Encoding.UTF8, "application/json");

        using var request = new HttpRequestMessage(HttpMethod.Post, _apiEndpoint);
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);
        request.Content = content;

        var response = await _httpClient.SendAsync(request);
        var responseContent = await response.Content.ReadAsStringAsync();

        if (response.StatusCode == System.Net.HttpStatusCode.TooManyRequests)
        {
            throw new RateLimitException("Rate limit exceeded", 60);
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"API error: {response.StatusCode} - {responseContent}");
        }

        var openAIResponse = JsonSerializer.Deserialize<OpenAIResponse>(responseContent);
        return openAIResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? string.Empty;
    }

    private SpiritualNutritionResult ParseResponse(string responseText)
    {
        try
        {
            // Clean up the response - remove any markdown code blocks if present
            var cleanedResponse = responseText.Trim();
            if (cleanedResponse.StartsWith("```json"))
                cleanedResponse = cleanedResponse.Substring(7);
            if (cleanedResponse.StartsWith("```"))
                cleanedResponse = cleanedResponse.Substring(3);
            if (cleanedResponse.EndsWith("```"))
                cleanedResponse = cleanedResponse.Substring(0, cleanedResponse.Length - 3);
            cleanedResponse = cleanedResponse.Trim();

            var result = JsonSerializer.Deserialize<SpiritualNutritionJsonResponse>(cleanedResponse,
                new JsonSerializerOptions { PropertyNameCaseInsensitive = true });

            if (result == null)
                return GetDefaultResult("Unable to parse response");

            // Calculate weighted overall score
            int overallScore = CalculateOverallScore(result);

            return new SpiritualNutritionResult
            {
                OverallScore = overallScore,
                Truthfulness = ClampScore(result.Truthfulness),
                TruthfulnessSummary = result.TruthfulnessSummary ?? "",
                MoralAlignment = ClampScore(result.MoralAlignment),
                MoralAlignmentSummary = result.MoralAlignmentSummary ?? "",
                HumanDignity = ClampScore(result.HumanDignity),
                HumanDignitySummary = result.HumanDignitySummary ?? "",
                EmotionalImpact = ClampScore(result.EmotionalImpact),
                EmotionalImpactSummary = result.EmotionalImpactSummary ?? "",
                WisdomVsFolly = ClampScore(result.WisdomVsFolly),
                WisdomVsFollySummary = result.WisdomVsFollySummary ?? "",
                IntentDirection = ClampScore(result.IntentDirection),
                IntentDirectionSummary = result.IntentDirectionSummary ?? "",
                BiblicalWorldview = ClampScore(result.BiblicalWorldview),
                BiblicalWorldviewSummary = result.BiblicalWorldviewSummary ?? "",
                EarlyChurchResonance = ClampScore(result.EarlyChurchResonance),
                EarlyChurchResonanceSummary = result.EarlyChurchResonanceSummary ?? "",
                ConstructiveInfluence = ClampScore(result.ConstructiveInfluence),
                ConstructiveInfluenceSummary = result.ConstructiveInfluenceSummary ?? "",
                SpiritualDensity = ClampScore(result.SpiritualDensity),
                SpiritualDensitySummary = result.SpiritualDensitySummary ?? "",
                ContentType = result.ContentType ?? "Unknown",
                Ingredients = result.Ingredients ?? "Content analysis unavailable."
            };
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Failed to parse nutrition response: {ex.Message}");
            return GetDefaultResult($"Analysis error: {ex.Message}");
        }
    }

    private int CalculateOverallScore(SpiritualNutritionJsonResponse result)
    {
        double weightedSum = 0;
        weightedSum += ClampScore(result.Truthfulness) * CategoryWeights["truthfulness"];
        weightedSum += ClampScore(result.MoralAlignment) * CategoryWeights["moralAlignment"];
        weightedSum += ClampScore(result.HumanDignity) * CategoryWeights["humanDignity"];
        weightedSum += ClampScore(result.EmotionalImpact) * CategoryWeights["emotionalImpact"];
        weightedSum += ClampScore(result.WisdomVsFolly) * CategoryWeights["wisdomVsFolly"];
        weightedSum += ClampScore(result.IntentDirection) * CategoryWeights["intentDirection"];
        weightedSum += ClampScore(result.BiblicalWorldview) * CategoryWeights["biblicalWorldview"];
        weightedSum += ClampScore(result.EarlyChurchResonance) * CategoryWeights["earlyChurchResonance"];
        weightedSum += ClampScore(result.ConstructiveInfluence) * CategoryWeights["constructiveInfluence"];
        weightedSum += ClampScore(result.SpiritualDensity) * CategoryWeights["spiritualDensity"];

        return (int)Math.Round(weightedSum);
    }

    private int ClampScore(int score) => Math.Max(0, Math.Min(100, score));

    private SpiritualNutritionResult GetDefaultResult(string errorMessage)
    {
        return new SpiritualNutritionResult
        {
            OverallScore = 0,
            Truthfulness = 0, TruthfulnessSummary = "Unable to evaluate",
            MoralAlignment = 0, MoralAlignmentSummary = "Unable to evaluate",
            HumanDignity = 0, HumanDignitySummary = "Unable to evaluate",
            EmotionalImpact = 0, EmotionalImpactSummary = "Unable to evaluate",
            WisdomVsFolly = 0, WisdomVsFollySummary = "Unable to evaluate",
            IntentDirection = 0, IntentDirectionSummary = "Unable to evaluate",
            BiblicalWorldview = 0, BiblicalWorldviewSummary = "Unable to evaluate",
            EarlyChurchResonance = 0, EarlyChurchResonanceSummary = "Unable to evaluate",
            ConstructiveInfluence = 0, ConstructiveInfluenceSummary = "Unable to evaluate",
            SpiritualDensity = 0, SpiritualDensitySummary = "Unable to evaluate",
            ContentType = "Error",
            Ingredients = errorMessage
        };
    }

    #region Cache Methods

    /// <summary>
    /// Normalizes a URL for use as a cache key (removes fragments, normalizes casing)
    /// </summary>
    private string NormalizeUrlForCache(string url)
    {
        try
        {
            var uri = new Uri(url);
            // Create normalized URL without fragment, lowercase host
            return $"{uri.Scheme}://{uri.Host.ToLowerInvariant()}{uri.AbsolutePath}{uri.Query}";
        }
        catch
        {
            // If URL parsing fails, use the original URL lowercase
            return url.ToLowerInvariant();
        }
    }

    /// <summary>
    /// Attempts to retrieve a cached result for the given URL.
    /// Within the 60-minute cache window, content changes are ignored.
    /// </summary>
    private bool TryGetFromCache(string cacheKey, out SpiritualNutritionResult? result)
    {
        result = null;

        if (_cache.TryGetValue(cacheKey, out var cached) && cached.Result != null)
        {
            // Check if cache entry has expired (60 minutes)
            if (DateTime.UtcNow - cached.CachedAt < _cacheExpiration)
            {
                // Within cache window - return cached result regardless of content changes
                result = cached.Result;
                System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Cache valid - cached at {cached.CachedAt}, age: {(DateTime.UtcNow - cached.CachedAt).TotalMinutes:F1} minutes");
                return true;
            }
            else
            {
                // Remove expired entry
                System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Cache expired for {cacheKey} - age: {(DateTime.UtcNow - cached.CachedAt).TotalMinutes:F1} minutes");
                _cache.Remove(cacheKey);
            }
        }

        return false;
    }

    /// <summary>
    /// Adds a result to the cache (URL-based, 60-minute expiration) and persists to disk
    /// </summary>
    private void AddToCache(string cacheKey, SpiritualNutritionResult result)
    {
        // Only cache successful results (not errors)
        if (result.ContentType != "Error")
        {
            _cache[cacheKey] = new CachedNutritionResult
            {
                Result = result,
                CachedAt = DateTime.UtcNow
            };
            System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Added to cache - key: {cacheKey}, expires in 60 minutes, total cached: {_cache.Count}");

            // Clean up old entries if cache gets too large (keep max 100 entries)
            if (_cache.Count > 100)
            {
                CleanupOldCacheEntries();
            }

            // Save cache to disk for persistence across browser restarts
            SaveCacheToDisk();
        }
    }

    /// <summary>
    /// Removes the oldest cache entries when cache exceeds size limit
    /// </summary>
    private void CleanupOldCacheEntries()
    {
        var expiredOrOldest = _cache
            .OrderBy(kvp => kvp.Value.CachedAt)
            .Take(_cache.Count - 50) // Keep only 50 most recent
            .Select(kvp => kvp.Key)
            .ToList();

        foreach (var key in expiredOrOldest)
        {
            _cache.Remove(key);
        }
    }

    /// <summary>
    /// Clears all cached results
    /// </summary>
    public void ClearCache()
    {
        _cache.Clear();
    }

    /// <summary>
    /// Gets the number of cached entries
    /// </summary>
    public int CacheCount => _cache.Count;

    /// <summary>
    /// Loads the cache from disk on startup
    /// </summary>
    private void LoadCacheFromDisk()
    {
        try
        {
            if (File.Exists(_cacheFilePath))
            {
                var json = File.ReadAllText(_cacheFilePath);
                var persistedCache = JsonSerializer.Deserialize<PersistentCacheFile>(json, _jsonOptions);

                if (persistedCache?.Entries != null)
                {
                    _cache = new Dictionary<string, CachedNutritionResult>();
                    int loadedCount = 0;
                    int expiredCount = 0;

                    foreach (var entry in persistedCache.Entries)
                    {
                        // Only load entries that haven't expired
                        if (DateTime.UtcNow - entry.Value.CachedAt < _cacheExpiration)
                        {
                            _cache[entry.Key] = entry.Value;
                            loadedCount++;
                        }
                        else
                        {
                            expiredCount++;
                        }
                    }

                    System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Loaded {loadedCount} cached entries from disk ({expiredCount} expired entries discarded)");

                    // If we discarded expired entries, save the cleaned cache back
                    if (expiredCount > 0)
                    {
                        SaveCacheToDisk();
                    }
                }
            }
            else
            {
                System.Diagnostics.Debug.WriteLine("Spiritual Nutrition: No persistent cache file found, starting fresh");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Failed to load cache from disk: {ex.Message}");
            _cache = new Dictionary<string, CachedNutritionResult>();
        }
    }

    /// <summary>
    /// Saves the current cache to disk for persistence
    /// </summary>
    private void SaveCacheToDisk()
    {
        try
        {
            var persistedCache = new PersistentCacheFile
            {
                Entries = _cache,
                SavedAt = DateTime.UtcNow
            };

            var json = JsonSerializer.Serialize(persistedCache, _jsonOptions);
            File.WriteAllText(_cacheFilePath, json);
            System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Saved {_cache.Count} entries to disk cache");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"Spiritual Nutrition: Failed to save cache to disk: {ex.Message}");
        }
    }

    #endregion
}

/// <summary>
/// File format for persistent cache storage
/// </summary>
internal class PersistentCacheFile
{
    public Dictionary<string, CachedNutritionResult>? Entries { get; set; }
    public DateTime SavedAt { get; set; }
}

/// <summary>
/// Wrapper for cached nutrition results with timestamp (60-minute URL-based caching)
/// </summary>
internal class CachedNutritionResult
{
    public SpiritualNutritionResult? Result { get; set; }
    public DateTime CachedAt { get; set; }
}

/// <summary>
/// Result of spiritual nutrition evaluation with 10 categories
/// </summary>
public class SpiritualNutritionResult
{
    public int OverallScore { get; set; }

    public int Truthfulness { get; set; }
    public string TruthfulnessSummary { get; set; } = "";

    public int MoralAlignment { get; set; }
    public string MoralAlignmentSummary { get; set; } = "";

    public int HumanDignity { get; set; }
    public string HumanDignitySummary { get; set; } = "";

    public int EmotionalImpact { get; set; }
    public string EmotionalImpactSummary { get; set; } = "";

    public int WisdomVsFolly { get; set; }
    public string WisdomVsFollySummary { get; set; } = "";

    public int IntentDirection { get; set; }
    public string IntentDirectionSummary { get; set; } = "";

    public int BiblicalWorldview { get; set; }
    public string BiblicalWorldviewSummary { get; set; } = "";

    public int EarlyChurchResonance { get; set; }
    public string EarlyChurchResonanceSummary { get; set; } = "";

    public int ConstructiveInfluence { get; set; }
    public string ConstructiveInfluenceSummary { get; set; } = "";

    public int SpiritualDensity { get; set; }
    public string SpiritualDensitySummary { get; set; } = "";

    public string ContentType { get; set; } = "";
    public string Ingredients { get; set; } = "";
}

/// <summary>
/// JSON response structure from OpenAI for the 10-category framework
/// </summary>
internal class SpiritualNutritionJsonResponse
{
    [JsonPropertyName("truthfulness")]
    public int Truthfulness { get; set; }
    [JsonPropertyName("truthfulnessSummary")]
    public string? TruthfulnessSummary { get; set; }

    [JsonPropertyName("moralAlignment")]
    public int MoralAlignment { get; set; }
    [JsonPropertyName("moralAlignmentSummary")]
    public string? MoralAlignmentSummary { get; set; }

    [JsonPropertyName("humanDignity")]
    public int HumanDignity { get; set; }
    [JsonPropertyName("humanDignitySummary")]
    public string? HumanDignitySummary { get; set; }

    [JsonPropertyName("emotionalImpact")]
    public int EmotionalImpact { get; set; }
    [JsonPropertyName("emotionalImpactSummary")]
    public string? EmotionalImpactSummary { get; set; }

    [JsonPropertyName("wisdomVsFolly")]
    public int WisdomVsFolly { get; set; }
    [JsonPropertyName("wisdomVsFollySummary")]
    public string? WisdomVsFollySummary { get; set; }

    [JsonPropertyName("intentDirection")]
    public int IntentDirection { get; set; }
    [JsonPropertyName("intentDirectionSummary")]
    public string? IntentDirectionSummary { get; set; }

    [JsonPropertyName("biblicalWorldview")]
    public int BiblicalWorldview { get; set; }
    [JsonPropertyName("biblicalWorldviewSummary")]
    public string? BiblicalWorldviewSummary { get; set; }

    [JsonPropertyName("earlyChurchResonance")]
    public int EarlyChurchResonance { get; set; }
    [JsonPropertyName("earlyChurchResonanceSummary")]
    public string? EarlyChurchResonanceSummary { get; set; }

    [JsonPropertyName("constructiveInfluence")]
    public int ConstructiveInfluence { get; set; }
    [JsonPropertyName("constructiveInfluenceSummary")]
    public string? ConstructiveInfluenceSummary { get; set; }

    [JsonPropertyName("spiritualDensity")]
    public int SpiritualDensity { get; set; }
    [JsonPropertyName("spiritualDensitySummary")]
    public string? SpiritualDensitySummary { get; set; }

    [JsonPropertyName("contentType")]
    public string? ContentType { get; set; }

    [JsonPropertyName("ingredients")]
    public string? Ingredients { get; set; }
}
