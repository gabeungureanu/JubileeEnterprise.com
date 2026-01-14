using JubileeMusic.Models;

namespace JubileeMusic.Services;

public interface ILibraryService
{
    Task InitializeAsync();
    Task<List<MusicTrack>> GetAllTracksAsync();
    Task<MusicTrack?> GetTrackByIdAsync(string id);
    Task<MusicTrack> SaveTrackAsync(MusicTrack track);
    Task DeleteTrackAsync(string id);
    Task<string> SaveAudioFileAsync(string trackId, byte[] audioData, string extension = ".mp3");
    Task<string> SaveCoverImageAsync(string trackId, byte[] imageData);
    Task<List<MusicTrack>> SearchTracksAsync(string query);
    Task<List<MusicTrack>> GetTracksByStatusAsync(GenerationStatus status);
    string LibraryPath { get; }
    event EventHandler<MusicTrack>? TrackAdded;
    event EventHandler<MusicTrack>? TrackUpdated;
    event EventHandler<string>? TrackDeleted;
}
