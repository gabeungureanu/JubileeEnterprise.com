using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Interfaces;

public interface IMusicCatalogService
{
    // Featured content
    Task<IEnumerable<Track>> GetFeaturedTracksAsync();
    Task<IEnumerable<Album>> GetNewReleasesAsync();
    Task<IEnumerable<Artist>> GetTopArtistsAsync();
    Task<IEnumerable<Playlist>> GetFeaturedPlaylistsAsync();
    Task<IEnumerable<Category>> GetCategoriesAsync();

    // Search
    Task<SearchResult> SearchAsync(string query);
    Task<SearchResult> SearchAsync(string query, SearchFilter filter);

    // Album
    Task<Album?> GetAlbumAsync(string albumId);
    Task<IEnumerable<Track>> GetAlbumTracksAsync(string albumId);

    // Artist
    Task<Artist?> GetArtistAsync(string artistId);
    Task<IEnumerable<Track>> GetArtistTopTracksAsync(string artistId);
    Task<IEnumerable<Album>> GetArtistAlbumsAsync(string artistId);
    Task<IEnumerable<Artist>> GetRelatedArtistsAsync(string artistId);

    // Track
    Task<Track?> GetTrackAsync(string trackId);
    Task<string?> GetTrackStreamUrlAsync(string trackId, AudioQuality quality = AudioQuality.High);
}

public class SearchResult
{
    public string Query { get; set; } = string.Empty;
    public List<Track> Tracks { get; set; } = new();
    public List<Album> Albums { get; set; } = new();
    public List<Artist> Artists { get; set; } = new();
    public List<Playlist> Playlists { get; set; } = new();
}

public class SearchFilter
{
    public bool IncludeTracks { get; set; } = true;
    public bool IncludeAlbums { get; set; } = true;
    public bool IncludeArtists { get; set; } = true;
    public bool IncludePlaylists { get; set; } = true;
    public int Limit { get; set; } = 20;
}

public class Category
{
    public string Id { get; set; } = string.Empty;
    public string Name { get; set; } = string.Empty;
    public string? IconUrl { get; set; }
    public string Color { get; set; } = "#282828";
}
