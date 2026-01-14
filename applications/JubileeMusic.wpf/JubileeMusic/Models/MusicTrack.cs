using System;
using System.IO;
using System.Collections.Generic;
using Newtonsoft.Json;

namespace JubileeMusic.Models;

public class MusicTrack
{
    [JsonProperty("id")]
    public string Id { get; set; } = Guid.NewGuid().ToString();

    [JsonProperty("title")]
    public string Title { get; set; } = string.Empty;

    [JsonProperty("lyrics")]
    public string Lyrics { get; set; } = string.Empty;

    [JsonProperty("stylePrompt")]
    public string StylePrompt { get; set; } = string.Empty;

    [JsonProperty("tags")]
    public List<string> Tags { get; set; } = new();

    [JsonProperty("duration")]
    public TimeSpan Duration { get; set; }

    [JsonProperty("createdAt")]
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    [JsonProperty("generationStatus")]
    public GenerationStatus GenerationStatus { get; set; } = GenerationStatus.Pending;

    [JsonProperty("sunoJobId")]
    public string? SunoJobId { get; set; }

    [JsonProperty("sunoUrl")]
    public string? SunoUrl { get; set; }

    [JsonProperty("audioFilePath")]
    public string? AudioFilePath { get; set; }

    [JsonProperty("coverImagePath")]
    public string? CoverImagePath { get; set; }

    [JsonProperty("isInstrumental")]
    public bool IsInstrumental { get; set; }

    [JsonProperty("model")]
    public string Model { get; set; } = "v3.5";

    [JsonProperty("errorMessage")]
    public string? ErrorMessage { get; set; }

    [JsonProperty("metadata")]
    public Dictionary<string, string> Metadata { get; set; } = new();

    // Computed properties
    [JsonIgnore]
    public string DurationFormatted => Duration.ToString(@"mm\:ss");

    [JsonIgnore]
    public string CreatedAtFormatted => CreatedAt.ToString("MMM dd, yyyy HH:mm");

    [JsonIgnore]
    public bool HasAudioFile => !string.IsNullOrEmpty(AudioFilePath) && File.Exists(AudioFilePath);

    [JsonIgnore]
    public string StatusDisplay => GenerationStatus switch
    {
        GenerationStatus.Pending => "Pending",
        GenerationStatus.Queued => "Queued",
        GenerationStatus.Generating => "Generating...",
        GenerationStatus.Downloading => "Downloading...",
        GenerationStatus.Completed => "Complete",
        GenerationStatus.Failed => "Failed",
        _ => "Unknown"
    };

    [JsonProperty("playCount")]
    public int PlayCount { get; set; }

    [JsonProperty("lastPlayedAt")]
    public DateTime? LastPlayedAt { get; set; }

    [JsonProperty("updatedAt")]
    public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
}

public enum GenerationStatus
{
    None,
    Pending,
    Queued,
    Generating,
    Downloading,
    Completed,
    Failed,
    Unknown
}
