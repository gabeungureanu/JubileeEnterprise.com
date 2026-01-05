using System.Net.Http;
using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace JubileeBrowser.Services;

/// <summary>
/// OpenAI Chat Service with primary/backup API key fallback.
/// Automatically switches to backup key when primary is rate-limited.
/// </summary>
public class OpenAIChatService
{
    private readonly HttpClient _httpClient;
    private readonly string _primaryApiKey;
    private readonly string _backupApiKey;
    private readonly string _apiEndpoint = "https://api.openai.com/v1/chat/completions";
    private readonly string _model = "gpt-4o-mini"; // Cost-effective model

    private bool _usingBackupKey = false;
    private DateTime? _primaryKeyBlockedUntil = null;

    private readonly string _systemPrompt = @"You are Jubilee Inspire, a helpful AI assistant for the WorldWideBibleWeb browser.
You specialize in:
- Biblical knowledge, scripture references, and theological topics
- Helping users explore faith-based content
- Providing encouraging and spiritually uplifting responses
- Answering questions about the Bible, Christianity, and spiritual growth

Always be respectful, compassionate, and grounded in Biblical truth.
When citing scripture, include the book, chapter, and verse.
Keep responses concise but helpful.";

    public OpenAIChatService(string primaryApiKey, string backupApiKey)
    {
        _primaryApiKey = primaryApiKey;
        _backupApiKey = backupApiKey;
        _httpClient = new HttpClient();
        _httpClient.Timeout = TimeSpan.FromSeconds(60);
    }

    public async Task<ChatResponse> SendMessageAsync(List<ChatMessageDto> conversationHistory, string userMessage)
    {
        // Add the new user message to conversation
        var messages = new List<object>
        {
            new { role = "system", content = _systemPrompt }
        };

        // Add conversation history
        foreach (var msg in conversationHistory.TakeLast(10)) // Keep last 10 messages for context
        {
            messages.Add(new { role = msg.Role, content = msg.Content });
        }

        // Add current user message
        messages.Add(new { role = "user", content = userMessage });

        // Determine which API key to use
        string apiKey = GetCurrentApiKey();

        try
        {
            var response = await CallOpenAIAsync(messages, apiKey);
            return response;
        }
        catch (RateLimitException ex)
        {
            // If we hit rate limit on primary, switch to backup
            if (!_usingBackupKey && !string.IsNullOrEmpty(_backupApiKey))
            {
                _usingBackupKey = true;
                _primaryKeyBlockedUntil = DateTime.UtcNow.AddSeconds(ex.RetryAfter);

                // Retry with backup key
                return await CallOpenAIAsync(messages, _backupApiKey);
            }

            // Both keys rate-limited
            throw;
        }
    }

    private string GetCurrentApiKey()
    {
        // Check if primary key block has expired
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

    private async Task<ChatResponse> CallOpenAIAsync(List<object> messages, string apiKey)
    {
        var requestBody = new
        {
            model = _model,
            messages = messages,
            max_tokens = 1000,
            temperature = 0.7
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
            // Parse retry-after if available
            int retryAfter = 60; // Default 60 seconds
            if (response.Headers.TryGetValues("Retry-After", out var retryValues))
            {
                int.TryParse(retryValues.FirstOrDefault(), out retryAfter);
            }
            else
            {
                // Try to parse from response body
                try
                {
                    var errorResponse = JsonSerializer.Deserialize<OpenAIErrorResponse>(responseContent);
                    if (errorResponse?.Error?.Message?.Contains("Please retry after") == true)
                    {
                        // Extract seconds from message like "Please retry after X seconds"
                        var match = System.Text.RegularExpressions.Regex.Match(
                            errorResponse.Error.Message, @"(\d+)\s*seconds?");
                        if (match.Success)
                        {
                            int.TryParse(match.Groups[1].Value, out retryAfter);
                        }
                    }
                }
                catch { }
            }

            throw new RateLimitException($"Rate limit exceeded. Retry after {retryAfter} seconds.", retryAfter);
        }

        if (!response.IsSuccessStatusCode)
        {
            throw new Exception($"OpenAI API error: {response.StatusCode} - {responseContent}");
        }

        var openAIResponse = JsonSerializer.Deserialize<OpenAIResponse>(responseContent);

        return new ChatResponse
        {
            Success = true,
            Message = openAIResponse?.Choices?.FirstOrDefault()?.Message?.Content ?? "No response received.",
            UsingBackupKey = _usingBackupKey
        };
    }

    public bool IsUsingBackupKey => _usingBackupKey;
}

public class ChatMessageDto
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}

public class ChatResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public bool UsingBackupKey { get; set; }
}

public class RateLimitException : Exception
{
    public int RetryAfter { get; }

    public RateLimitException(string message, int retryAfter) : base(message)
    {
        RetryAfter = retryAfter;
    }
}

// OpenAI Response Models
public class OpenAIResponse
{
    [JsonPropertyName("choices")]
    public List<OpenAIChoice>? Choices { get; set; }
}

public class OpenAIChoice
{
    [JsonPropertyName("message")]
    public OpenAIMessage? Message { get; set; }
}

public class OpenAIMessage
{
    [JsonPropertyName("content")]
    public string? Content { get; set; }
}

public class OpenAIErrorResponse
{
    [JsonPropertyName("error")]
    public OpenAIError? Error { get; set; }
}

public class OpenAIError
{
    [JsonPropertyName("message")]
    public string? Message { get; set; }

    [JsonPropertyName("type")]
    public string? Type { get; set; }
}
