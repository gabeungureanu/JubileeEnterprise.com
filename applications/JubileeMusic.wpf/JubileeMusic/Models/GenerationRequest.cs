using Newtonsoft.Json;

namespace JubileeMusic.Models;

public class GenerationRequest
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonProperty("lyrics")]
    public string Lyrics { get; set; } = string.Empty;

    [JsonProperty("stylePrompt")]
    public string StylePrompt { get; set; } = string.Empty;

    [JsonProperty("title")]
    public string? Title { get; set; }

    [JsonProperty("tags")]
    public List<string> Tags { get; set; } = new();

    [JsonProperty("isInstrumental")]
    public bool IsInstrumental { get; set; } = false;

    [JsonProperty("model")]
    public string Model { get; set; } = "v3.5";

    [JsonProperty("makeInstrumental")]
    public bool MakeInstrumental { get; set; } = false;

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsValid => !string.IsNullOrWhiteSpace(StylePrompt) &&
                          (IsInstrumental || !string.IsNullOrWhiteSpace(Lyrics));
}

public class GenerationResult
{
    public bool Success { get; set; }
    public string? TrackId { get; set; }
    public string? SunoJobId { get; set; }
    public string? ErrorMessage { get; set; }
    public MusicTrack? Track { get; set; }
}
