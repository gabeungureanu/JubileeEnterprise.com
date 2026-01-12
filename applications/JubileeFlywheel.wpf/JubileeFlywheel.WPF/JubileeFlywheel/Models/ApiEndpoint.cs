using System.Net.Http;

namespace JubileeFlywheel.Models
{
    public class ApiEndpoint
    {
        public string Id { get; set; } = Guid.NewGuid().ToString();
        public string Name { get; set; } = string.Empty;
        public string Url { get; set; } = string.Empty;
        public HttpMethod Method { get; set; } = HttpMethod.Get;
        public Dictionary<string, string> Headers { get; set; } = new();
        public string? Body { get; set; }
        public int RefreshIntervalSeconds { get; set; } = 30;
        public bool IsEnabled { get; set; } = true;
        public DateTime LastFetched { get; set; }
        public string? LastError { get; set; }
    }

    public class ApiResponse
    {
        public bool Success { get; set; }
        public string? Data { get; set; }
        public string? Error { get; set; }
        public DateTime Timestamp { get; set; } = DateTime.UtcNow;
        public long ResponseTimeMs { get; set; }
    }
}
