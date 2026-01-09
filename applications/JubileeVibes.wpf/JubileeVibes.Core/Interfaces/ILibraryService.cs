using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface ILibraryService
{
    // Liked songs
    Task<IEnumerable<Track>> GetLikedSongsAsync();
    Task<bool> LikeTrackAsync(string trackId);
    Task<bool> UnlikeTrackAsync(string trackId);
    Task<bool> IsTrackLikedAsync(string trackId);

    // Saved albums
    Task<IEnumerable<Album>> GetSavedAlbumsAsync();
    Task<bool> SaveAlbumAsync(string albumId);
    Task<bool> RemoveAlbumAsync(string albumId);
    Task<bool> IsAlbumSavedAsync(string albumId);

    // Followed artists
    Task<IEnumerable<Artist>> GetFollowedArtistsAsync();
    Task<bool> FollowArtistAsync(string artistId);
    Task<bool> UnfollowArtistAsync(string artistId);
    Task<bool> IsArtistFollowedAsync(string artistId);

    // Recently played
    Task<IEnumerable<Track>> GetRecentlyPlayedAsync(int limit = 50);
    Task AddToRecentlyPlayedAsync(Track track);

    // Local files
    Task<IEnumerable<Track>> GetLocalFilesAsync();
    Task ScanLocalFoldersAsync(IEnumerable<string> folderPaths);
    Task<Track?> ImportLocalFileAsync(string filePath);
}
