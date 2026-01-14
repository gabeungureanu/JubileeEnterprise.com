using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using JubileeMusic.Models;
using Microsoft.Extensions.Logging;

namespace JubileeMusic.Services;

public class LibraryService : ILibraryService
{
    private readonly ILogger<LibraryService> _logger;
    private readonly string _libraryPath;
    private readonly string _metadataPath;
    private readonly string _audioPath;
    private readonly string _coversPath;
    private List<MusicTrack> _tracks = new();
    private readonly SemaphoreSlim _lock = new(1, 1);
    private bool _initialized;

    public string LibraryPath => _libraryPath;

    public event EventHandler<MusicTrack>? TrackAdded;
    public event EventHandler<MusicTrack>? TrackUpdated;
    public event EventHandler<string>? TrackDeleted;

    public LibraryService(ILogger<LibraryService> logger)
    {
        _logger = logger;

        // Use LocalApplicationData for library storage
        var appDataPath = Environment.GetFolderPath(Environment.SpecialFolder.LocalApplicationData);
        _libraryPath = Path.Combine(appDataPath, "JubileeMusic", "Library");
        _metadataPath = Path.Combine(_libraryPath, "metadata");
        _audioPath = Path.Combine(_libraryPath, "audio");
        _coversPath = Path.Combine(_libraryPath, "covers");
    }

    public async Task InitializeAsync()
    {
        if (_initialized) return;

        await _lock.WaitAsync();
        try
        {
            if (_initialized) return;

            _logger.LogInformation("Initializing library at {Path}", _libraryPath);

            // Create directory structure
            Directory.CreateDirectory(_libraryPath);
            Directory.CreateDirectory(_metadataPath);
            Directory.CreateDirectory(_audioPath);
            Directory.CreateDirectory(_coversPath);

            // Load existing tracks
            await LoadTracksAsync();

            _initialized = true;
            _logger.LogInformation("Library initialized with {Count} tracks", _tracks.Count);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to initialize library");
            throw;
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task LoadTracksAsync()
    {
        _tracks.Clear();

        if (!Directory.Exists(_metadataPath))
        {
            return;
        }

        var metadataFiles = Directory.GetFiles(_metadataPath, "*.json");

        foreach (var file in metadataFiles)
        {
            try
            {
                var json = await File.ReadAllTextAsync(file);
                var track = JsonSerializer.Deserialize<MusicTrack>(json, GetJsonOptions());
                if (track != null)
                {
                    _tracks.Add(track);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to load track metadata from {File}", file);
            }
        }

        // Sort by creation date descending
        _tracks = _tracks.OrderByDescending(t => t.CreatedAt).ToList();
    }

    public async Task<List<MusicTrack>> GetAllTracksAsync()
    {
        await EnsureInitializedAsync();

        await _lock.WaitAsync();
        try
        {
            return _tracks.ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<MusicTrack?> GetTrackByIdAsync(string id)
    {
        await EnsureInitializedAsync();

        await _lock.WaitAsync();
        try
        {
            return _tracks.FirstOrDefault(t => t.Id == id);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<MusicTrack> SaveTrackAsync(MusicTrack track)
    {
        await EnsureInitializedAsync();

        await _lock.WaitAsync();
        try
        {
            var existingIndex = _tracks.FindIndex(t => t.Id == track.Id);
            var isNew = existingIndex < 0;

            track.UpdatedAt = DateTime.UtcNow;

            if (isNew)
            {
                track.CreatedAt = DateTime.UtcNow;
                _tracks.Insert(0, track);
            }
            else
            {
                _tracks[existingIndex] = track;
            }

            // Save to disk
            var metadataFile = GetMetadataFilePath(track.Id);
            var json = JsonSerializer.Serialize(track, GetJsonOptions());
            await File.WriteAllTextAsync(metadataFile, json);

            _logger.LogInformation("Saved track {Id}: {Title}", track.Id, track.Title);

            // Raise events
            if (isNew)
            {
                TrackAdded?.Invoke(this, track);
            }
            else
            {
                TrackUpdated?.Invoke(this, track);
            }

            return track;
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task DeleteTrackAsync(string id)
    {
        await EnsureInitializedAsync();

        await _lock.WaitAsync();
        try
        {
            var track = _tracks.FirstOrDefault(t => t.Id == id);
            if (track == null)
            {
                _logger.LogWarning("Track {Id} not found for deletion", id);
                return;
            }

            // Remove from memory
            _tracks.Remove(track);

            // Delete files
            var metadataFile = GetMetadataFilePath(id);
            if (File.Exists(metadataFile))
            {
                File.Delete(metadataFile);
            }

            if (!string.IsNullOrEmpty(track.AudioFilePath) && File.Exists(track.AudioFilePath))
            {
                File.Delete(track.AudioFilePath);
            }

            if (!string.IsNullOrEmpty(track.CoverImagePath) && File.Exists(track.CoverImagePath))
            {
                File.Delete(track.CoverImagePath);
            }

            _logger.LogInformation("Deleted track {Id}: {Title}", id, track.Title);
            TrackDeleted?.Invoke(this, id);
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<string> SaveAudioFileAsync(string trackId, byte[] audioData, string extension = ".mp3")
    {
        await EnsureInitializedAsync();

        var sanitizedId = SanitizeFileName(trackId);
        var fileName = $"{sanitizedId}_{DateTime.UtcNow:yyyyMMdd_HHmmss}{extension}";
        var filePath = Path.Combine(_audioPath, fileName);

        await File.WriteAllBytesAsync(filePath, audioData);
        _logger.LogInformation("Saved audio file for track {Id}: {Path}", trackId, filePath);

        return filePath;
    }

    public async Task<string> SaveCoverImageAsync(string trackId, byte[] imageData)
    {
        await EnsureInitializedAsync();

        var sanitizedId = SanitizeFileName(trackId);
        var fileName = $"{sanitizedId}_cover.jpg";
        var filePath = Path.Combine(_coversPath, fileName);

        await File.WriteAllBytesAsync(filePath, imageData);
        _logger.LogInformation("Saved cover image for track {Id}: {Path}", trackId, filePath);

        return filePath;
    }

    public async Task<List<MusicTrack>> SearchTracksAsync(string query)
    {
        await EnsureInitializedAsync();

        if (string.IsNullOrWhiteSpace(query))
        {
            return await GetAllTracksAsync();
        }

        await _lock.WaitAsync();
        try
        {
            var lowerQuery = query.ToLowerInvariant();
            return _tracks.Where(t =>
                (t.Title?.ToLowerInvariant().Contains(lowerQuery) ?? false) ||
                (t.Lyrics?.ToLowerInvariant().Contains(lowerQuery) ?? false) ||
                (t.StylePrompt?.ToLowerInvariant().Contains(lowerQuery) ?? false) ||
                (t.Tags?.Any(tag => tag.ToLowerInvariant().Contains(lowerQuery)) ?? false)
            ).ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    public async Task<List<MusicTrack>> GetTracksByStatusAsync(GenerationStatus status)
    {
        await EnsureInitializedAsync();

        await _lock.WaitAsync();
        try
        {
            return _tracks.Where(t => t.GenerationStatus == status).ToList();
        }
        finally
        {
            _lock.Release();
        }
    }

    private async Task EnsureInitializedAsync()
    {
        if (!_initialized)
        {
            await InitializeAsync();
        }
    }

    private string GetMetadataFilePath(string trackId)
    {
        var sanitizedId = SanitizeFileName(trackId);
        return Path.Combine(_metadataPath, $"{sanitizedId}.json");
    }

    private static string SanitizeFileName(string fileName)
    {
        var invalid = Path.GetInvalidFileNameChars();
        return string.Join("_", fileName.Split(invalid, StringSplitOptions.RemoveEmptyEntries));
    }

    private static JsonSerializerOptions GetJsonOptions()
    {
        return new JsonSerializerOptions
        {
            WriteIndented = true,
            PropertyNamingPolicy = JsonNamingPolicy.CamelCase
        };
    }
}
