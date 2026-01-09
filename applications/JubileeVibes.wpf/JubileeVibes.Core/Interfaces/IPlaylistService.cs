using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface IPlaylistService
{
    Task<IEnumerable<Playlist>> GetUserPlaylistsAsync();
    Task<Playlist?> GetPlaylistAsync(string playlistId);
    Task<IEnumerable<Track>> GetPlaylistTracksAsync(string playlistId);

    Task<Playlist> CreatePlaylistAsync(string name, string? description = null);
    Task<bool> UpdatePlaylistAsync(string playlistId, string? name = null, string? description = null);
    Task<bool> DeletePlaylistAsync(string playlistId);

    Task<bool> AddTrackToPlaylistAsync(string playlistId, string trackId);
    Task<bool> AddTracksToPlaylistAsync(string playlistId, IEnumerable<string> trackIds);
    Task<bool> RemoveTrackFromPlaylistAsync(string playlistId, string trackId);
    Task<bool> ReorderPlaylistAsync(string playlistId, int fromIndex, int toIndex);
}
