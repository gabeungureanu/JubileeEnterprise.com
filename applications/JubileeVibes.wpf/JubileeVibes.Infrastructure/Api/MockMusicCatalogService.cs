using JubileeVibes.Core.Enums;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Api;

public class MockMusicCatalogService : IMusicCatalogService
{
    private readonly List<Track> _allTracks;
    private readonly List<Album> _allAlbums;
    private readonly List<Artist> _allArtists;
    private readonly List<Playlist> _featuredPlaylists;
    private readonly List<Category> _categories;

    public MockMusicCatalogService()
    {
        _allArtists = GenerateMockArtists();
        _allAlbums = GenerateMockAlbums();
        _allTracks = GenerateMockTracks();
        _featuredPlaylists = GenerateMockPlaylists();
        _categories = GenerateMockCategories();
    }

    private List<Artist> GenerateMockArtists()
    {
        return new List<Artist>
        {
            new() { Id = "artist-1", Name = "The Midnight", ImageUrl = "https://picsum.photos/seed/artist1/300/300", MonthlyListeners = 2500000, Bio = "Synthwave duo from Los Angeles" },
            new() { Id = "artist-2", Name = "ODESZA", ImageUrl = "https://picsum.photos/seed/artist2/300/300", MonthlyListeners = 8500000, Bio = "Electronic music duo from Washington" },
            new() { Id = "artist-3", Name = "Tycho", ImageUrl = "https://picsum.photos/seed/artist3/300/300", MonthlyListeners = 3200000, Bio = "Ambient music project by Scott Hansen" },
            new() { Id = "artist-4", Name = "Bonobo", ImageUrl = "https://picsum.photos/seed/artist4/300/300", MonthlyListeners = 4100000, Bio = "British musician and producer Simon Green" },
            new() { Id = "artist-5", Name = "Rufus Du Sol", ImageUrl = "https://picsum.photos/seed/artist5/300/300", MonthlyListeners = 6800000, Bio = "Australian alternative dance group" },
            new() { Id = "artist-6", Name = "Lane 8", ImageUrl = "https://picsum.photos/seed/artist6/300/300", MonthlyListeners = 1900000, Bio = "American DJ and producer Daniel Goldstein" },
            new() { Id = "artist-7", Name = "Four Tet", ImageUrl = "https://picsum.photos/seed/artist7/300/300", MonthlyListeners = 2800000, Bio = "British electronic musician Kieran Hebden" },
            new() { Id = "artist-8", Name = "Jamie xx", ImageUrl = "https://picsum.photos/seed/artist8/300/300", MonthlyListeners = 5200000, Bio = "English DJ and producer" },
            new() { Id = "artist-9", Name = "Caribou", ImageUrl = "https://picsum.photos/seed/artist9/300/300", MonthlyListeners = 2100000, Bio = "Canadian electronic musician Dan Snaith" },
            new() { Id = "artist-10", Name = "Fred again..", ImageUrl = "https://picsum.photos/seed/artist10/300/300", MonthlyListeners = 12000000, Bio = "British DJ and producer" }
        };
    }

    private List<Album> GenerateMockAlbums()
    {
        return new List<Album>
        {
            new() { Id = "album-1", Title = "Monsters", ArtistId = "artist-1", ArtistName = "The Midnight", CoverArtUrl = "https://picsum.photos/seed/album1/300/300", ReleaseDate = new DateTime(2020, 7, 10), Genres = new() { "Synthwave" } },
            new() { Id = "album-2", Title = "A Moment Apart", ArtistId = "artist-2", ArtistName = "ODESZA", CoverArtUrl = "https://picsum.photos/seed/album2/300/300", ReleaseDate = new DateTime(2017, 9, 8), Genres = new() { "Electronic" } },
            new() { Id = "album-3", Title = "Weather", ArtistId = "artist-3", ArtistName = "Tycho", CoverArtUrl = "https://picsum.photos/seed/album3/300/300", ReleaseDate = new DateTime(2019, 7, 12), Genres = new() { "Ambient" } },
            new() { Id = "album-4", Title = "Migration", ArtistId = "artist-4", ArtistName = "Bonobo", CoverArtUrl = "https://picsum.photos/seed/album4/300/300", ReleaseDate = new DateTime(2017, 1, 13), Genres = new() { "Downtempo" } },
            new() { Id = "album-5", Title = "Surrender", ArtistId = "artist-5", ArtistName = "Rufus Du Sol", CoverArtUrl = "https://picsum.photos/seed/album5/300/300", ReleaseDate = new DateTime(2021, 10, 22), Genres = new() { "Alternative Dance" } },
            new() { Id = "album-6", Title = "Brightest Lights", ArtistId = "artist-6", ArtistName = "Lane 8", CoverArtUrl = "https://picsum.photos/seed/album6/300/300", ReleaseDate = new DateTime(2020, 1, 17), Genres = new() { "Deep House" } },
            new() { Id = "album-7", Title = "Sixteen Oceans", ArtistId = "artist-7", ArtistName = "Four Tet", CoverArtUrl = "https://picsum.photos/seed/album7/300/300", ReleaseDate = new DateTime(2020, 3, 13), Genres = new() { "Electronic" } },
            new() { Id = "album-8", Title = "In Colour", ArtistId = "artist-8", ArtistName = "Jamie xx", CoverArtUrl = "https://picsum.photos/seed/album8/300/300", ReleaseDate = new DateTime(2015, 5, 29), Genres = new() { "Electronic" } },
            new() { Id = "album-9", Title = "Suddenly", ArtistId = "artist-9", ArtistName = "Caribou", CoverArtUrl = "https://picsum.photos/seed/album9/300/300", ReleaseDate = new DateTime(2020, 2, 28), Genres = new() { "Electronic" } },
            new() { Id = "album-10", Title = "Actual Life 3", ArtistId = "artist-10", ArtistName = "Fred again..", CoverArtUrl = "https://picsum.photos/seed/album10/300/300", ReleaseDate = new DateTime(2022, 10, 28), Genres = new() { "Electronic" } },
            new() { Id = "album-11", Title = "Nocturnal", ArtistId = "artist-1", ArtistName = "The Midnight", CoverArtUrl = "https://picsum.photos/seed/album11/300/300", ReleaseDate = new DateTime(2017, 9, 1), Genres = new() { "Synthwave" } },
            new() { Id = "album-12", Title = "The Last Goodbye", ArtistId = "artist-2", ArtistName = "ODESZA", CoverArtUrl = "https://picsum.photos/seed/album12/300/300", ReleaseDate = new DateTime(2022, 7, 22), Genres = new() { "Electronic" } }
        };
    }

    private List<Track> GenerateMockTracks()
    {
        return new List<Track>
        {
            new() { Id = "track-1", Title = "Monsters", ArtistId = "artist-1", ArtistName = "The Midnight", AlbumId = "album-1", AlbumName = "Monsters", AlbumArtUrl = "https://picsum.photos/seed/album1/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(32)), TrackNumber = 1 },
            new() { Id = "track-2", Title = "Deep Blue", ArtistId = "artist-1", ArtistName = "The Midnight", AlbumId = "album-1", AlbumName = "Monsters", AlbumArtUrl = "https://picsum.photos/seed/album1/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(18)), TrackNumber = 2 },
            new() { Id = "track-3", Title = "Dance With Somebody", ArtistId = "artist-1", ArtistName = "The Midnight", AlbumId = "album-1", AlbumName = "Monsters", AlbumArtUrl = "https://picsum.photos/seed/album1/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(45)), TrackNumber = 3 },
            new() { Id = "track-4", Title = "A Moment Apart", ArtistId = "artist-2", ArtistName = "ODESZA", AlbumId = "album-2", AlbumName = "A Moment Apart", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(2)), TrackNumber = 1 },
            new() { Id = "track-5", Title = "Higher Ground", ArtistId = "artist-2", ArtistName = "ODESZA", AlbumId = "album-2", AlbumName = "A Moment Apart", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(47)), TrackNumber = 2 },
            new() { Id = "track-6", Title = "Line of Sight", ArtistId = "artist-2", ArtistName = "ODESZA", AlbumId = "album-2", AlbumName = "A Moment Apart", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(23)), TrackNumber = 3 },
            new() { Id = "track-7", Title = "Late Night", ArtistId = "artist-2", ArtistName = "ODESZA", AlbumId = "album-2", AlbumName = "A Moment Apart", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(58)), TrackNumber = 4 },
            new() { Id = "track-8", Title = "Easy", ArtistId = "artist-3", ArtistName = "Tycho", AlbumId = "album-3", AlbumName = "Weather", AlbumArtUrl = "https://picsum.photos/seed/album3/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(52)), TrackNumber = 1 },
            new() { Id = "track-9", Title = "Pink & Blue", ArtistId = "artist-3", ArtistName = "Tycho", AlbumId = "album-3", AlbumName = "Weather", AlbumArtUrl = "https://picsum.photos/seed/album3/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(15)), TrackNumber = 2 },
            new() { Id = "track-10", Title = "Into the Woods", ArtistId = "artist-3", ArtistName = "Tycho", AlbumId = "album-3", AlbumName = "Weather", AlbumArtUrl = "https://picsum.photos/seed/album3/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(28)), TrackNumber = 3 },
            new() { Id = "track-11", Title = "Migration", ArtistId = "artist-4", ArtistName = "Bonobo", AlbumId = "album-4", AlbumName = "Migration", AlbumArtUrl = "https://picsum.photos/seed/album4/300/300", Duration = TimeSpan.FromMinutes(2).Add(TimeSpan.FromSeconds(45)), TrackNumber = 1 },
            new() { Id = "track-12", Title = "Break Apart", ArtistId = "artist-4", ArtistName = "Bonobo", AlbumId = "album-4", AlbumName = "Migration", AlbumArtUrl = "https://picsum.photos/seed/album4/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(32)), TrackNumber = 2 },
            new() { Id = "track-13", Title = "Bambro Koyo Ganda", ArtistId = "artist-4", ArtistName = "Bonobo", AlbumId = "album-4", AlbumName = "Migration", AlbumArtUrl = "https://picsum.photos/seed/album4/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(18)), TrackNumber = 3 },
            new() { Id = "track-14", Title = "Alive", ArtistId = "artist-5", ArtistName = "Rufus Du Sol", AlbumId = "album-5", AlbumName = "Surrender", AlbumArtUrl = "https://picsum.photos/seed/album5/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(8)), TrackNumber = 1 },
            new() { Id = "track-15", Title = "Next To Me", ArtistId = "artist-5", ArtistName = "Rufus Du Sol", AlbumId = "album-5", AlbumName = "Surrender", AlbumArtUrl = "https://picsum.photos/seed/album5/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(42)), TrackNumber = 2 },
            new() { Id = "track-16", Title = "On My Knees", ArtistId = "artist-5", ArtistName = "Rufus Du Sol", AlbumId = "album-5", AlbumName = "Surrender", AlbumArtUrl = "https://picsum.photos/seed/album5/300/300", Duration = TimeSpan.FromMinutes(6).Add(TimeSpan.FromSeconds(15)), TrackNumber = 3 },
            new() { Id = "track-17", Title = "Brightest Lights", ArtistId = "artist-6", ArtistName = "Lane 8", AlbumId = "album-6", AlbumName = "Brightest Lights", AlbumArtUrl = "https://picsum.photos/seed/album6/300/300", Duration = TimeSpan.FromMinutes(6).Add(TimeSpan.FromSeconds(48)), TrackNumber = 1 },
            new() { Id = "track-18", Title = "Road", ArtistId = "artist-6", ArtistName = "Lane 8", AlbumId = "album-6", AlbumName = "Brightest Lights", AlbumArtUrl = "https://picsum.photos/seed/album6/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(22)), TrackNumber = 2 },
            new() { Id = "track-19", Title = "School", ArtistId = "artist-7", ArtistName = "Four Tet", AlbumId = "album-7", AlbumName = "Sixteen Oceans", AlbumArtUrl = "https://picsum.photos/seed/album7/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(55)), TrackNumber = 1 },
            new() { Id = "track-20", Title = "Baby", ArtistId = "artist-7", ArtistName = "Four Tet", AlbumId = "album-7", AlbumName = "Sixteen Oceans", AlbumArtUrl = "https://picsum.photos/seed/album7/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(32)), TrackNumber = 2 },
            new() { Id = "track-21", Title = "Gosh", ArtistId = "artist-8", ArtistName = "Jamie xx", AlbumId = "album-8", AlbumName = "In Colour", AlbumArtUrl = "https://picsum.photos/seed/album8/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(55)), TrackNumber = 1 },
            new() { Id = "track-22", Title = "Loud Places", ArtistId = "artist-8", ArtistName = "Jamie xx", AlbumId = "album-8", AlbumName = "In Colour", AlbumArtUrl = "https://picsum.photos/seed/album8/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(38)), TrackNumber = 2 },
            new() { Id = "track-23", Title = "Never Come Back", ArtistId = "artist-9", ArtistName = "Caribou", AlbumId = "album-9", AlbumName = "Suddenly", AlbumArtUrl = "https://picsum.photos/seed/album9/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(12)), TrackNumber = 1 },
            new() { Id = "track-24", Title = "Home", ArtistId = "artist-9", ArtistName = "Caribou", AlbumId = "album-9", AlbumName = "Suddenly", AlbumArtUrl = "https://picsum.photos/seed/album9/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(48)), TrackNumber = 2 },
            new() { Id = "track-25", Title = "Danielle (smile on my face)", ArtistId = "artist-10", ArtistName = "Fred again..", AlbumId = "album-10", AlbumName = "Actual Life 3", AlbumArtUrl = "https://picsum.photos/seed/album10/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(22)), TrackNumber = 1 },
            new() { Id = "track-26", Title = "Delilah (pull me out of this)", ArtistId = "artist-10", ArtistName = "Fred again..", AlbumId = "album-10", AlbumName = "Actual Life 3", AlbumArtUrl = "https://picsum.photos/seed/album10/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(45)), TrackNumber = 2 },
            new() { Id = "track-27", Title = "Turn On The Lights again..", ArtistId = "artist-10", ArtistName = "Fred again..", AlbumId = "album-10", AlbumName = "Actual Life 3", AlbumArtUrl = "https://picsum.photos/seed/album10/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(8)), TrackNumber = 3 }
        };
    }

    private List<Playlist> GenerateMockPlaylists()
    {
        return new List<Playlist>
        {
            new() { Id = "playlist-1", Name = "Chill Vibes", Description = "Relaxing electronic music for focus and calm", CoverImageUrl = "https://picsum.photos/seed/playlist1/300/300", TrackCount = 45, IsPublic = true },
            new() { Id = "playlist-2", Name = "Late Night Drive", Description = "Synthwave and retrowave for night cruising", CoverImageUrl = "https://picsum.photos/seed/playlist2/300/300", TrackCount = 32, IsPublic = true },
            new() { Id = "playlist-3", Name = "Deep Focus", Description = "Ambient electronic for deep concentration", CoverImageUrl = "https://picsum.photos/seed/playlist3/300/300", TrackCount = 58, IsPublic = true },
            new() { Id = "playlist-4", Name = "Morning Coffee", Description = "Easy listening to start your day right", CoverImageUrl = "https://picsum.photos/seed/playlist4/300/300", TrackCount = 28, IsPublic = true },
            new() { Id = "playlist-5", Name = "Workout Energy", Description = "High energy beats to fuel your workout", CoverImageUrl = "https://picsum.photos/seed/playlist5/300/300", TrackCount = 40, IsPublic = true },
            new() { Id = "playlist-6", Name = "Sunset Sessions", Description = "Perfect sounds for golden hour", CoverImageUrl = "https://picsum.photos/seed/playlist6/300/300", TrackCount = 35, IsPublic = true }
        };
    }

    private List<Category> GenerateMockCategories()
    {
        return new List<Category>
        {
            new() { Id = "cat-1", Name = "Electronic", Color = "#1DB954" },
            new() { Id = "cat-2", Name = "Ambient", Color = "#4A90D9" },
            new() { Id = "cat-3", Name = "Synthwave", Color = "#FF6B6B" },
            new() { Id = "cat-4", Name = "Deep House", Color = "#9B59B6" },
            new() { Id = "cat-5", Name = "Downtempo", Color = "#F39C12" },
            new() { Id = "cat-6", Name = "Indie", Color = "#27AE60" }
        };
    }

    public Task<IEnumerable<Track>> GetFeaturedTracksAsync()
    {
        var featured = _allTracks.OrderBy(_ => Guid.NewGuid()).Take(10);
        return Task.FromResult(featured);
    }

    public Task<IEnumerable<Album>> GetNewReleasesAsync()
    {
        var releases = _allAlbums.OrderByDescending(a => a.ReleaseDate).Take(8);
        return Task.FromResult(releases);
    }

    public Task<IEnumerable<Artist>> GetTopArtistsAsync()
    {
        var artists = _allArtists.OrderByDescending(a => a.MonthlyListeners).Take(6);
        return Task.FromResult(artists);
    }

    public Task<IEnumerable<Playlist>> GetFeaturedPlaylistsAsync()
    {
        return Task.FromResult(_featuredPlaylists.AsEnumerable());
    }

    public Task<IEnumerable<Category>> GetCategoriesAsync()
    {
        return Task.FromResult(_categories.AsEnumerable());
    }

    public Task<SearchResult> SearchAsync(string query)
    {
        return SearchAsync(query, new SearchFilter());
    }

    public Task<SearchResult> SearchAsync(string query, SearchFilter filter)
    {
        var result = new SearchResult { Query = query };

        if (filter.IncludeTracks)
        {
            result.Tracks = _allTracks
                .Where(t => t.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                           t.ArtistName.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                           t.AlbumName?.Contains(query, StringComparison.OrdinalIgnoreCase) == true)
                .Take(filter.Limit)
                .ToList();
        }

        if (filter.IncludeAlbums)
        {
            result.Albums = _allAlbums
                .Where(a => a.Title.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                           a.ArtistName.Contains(query, StringComparison.OrdinalIgnoreCase))
                .Take(filter.Limit)
                .ToList();
        }

        if (filter.IncludeArtists)
        {
            result.Artists = _allArtists
                .Where(a => a.Name.Contains(query, StringComparison.OrdinalIgnoreCase))
                .Take(filter.Limit)
                .ToList();
        }

        if (filter.IncludePlaylists)
        {
            result.Playlists = _featuredPlaylists
                .Where(p => p.Name.Contains(query, StringComparison.OrdinalIgnoreCase) ||
                           p.Description?.Contains(query, StringComparison.OrdinalIgnoreCase) == true)
                .Take(filter.Limit)
                .ToList();
        }

        return Task.FromResult(result);
    }

    public Task<Album?> GetAlbumAsync(string albumId)
    {
        var album = _allAlbums.FirstOrDefault(a => a.Id == albumId);
        if (album != null)
        {
            album.TrackCount = _allTracks.Count(t => t.AlbumId == albumId);
        }
        return Task.FromResult(album);
    }

    public Task<IEnumerable<Track>> GetAlbumTracksAsync(string albumId)
    {
        var tracks = _allTracks.Where(t => t.AlbumId == albumId).OrderBy(t => t.TrackNumber);
        return Task.FromResult(tracks.AsEnumerable());
    }

    public Task<Artist?> GetArtistAsync(string artistId)
    {
        var artist = _allArtists.FirstOrDefault(a => a.Id == artistId);
        return Task.FromResult(artist);
    }

    public Task<IEnumerable<Track>> GetArtistTopTracksAsync(string artistId)
    {
        var tracks = _allTracks.Where(t => t.ArtistId == artistId).Take(10);
        return Task.FromResult(tracks);
    }

    public Task<IEnumerable<Album>> GetArtistAlbumsAsync(string artistId)
    {
        var albums = _allAlbums.Where(a => a.ArtistId == artistId);
        return Task.FromResult(albums);
    }

    public Task<IEnumerable<Artist>> GetRelatedArtistsAsync(string artistId)
    {
        var related = _allArtists.Where(a => a.Id != artistId).OrderBy(_ => Guid.NewGuid()).Take(6);
        return Task.FromResult(related);
    }

    public Task<Track?> GetTrackAsync(string trackId)
    {
        return Task.FromResult(_allTracks.FirstOrDefault(t => t.Id == trackId));
    }

    public Task<string?> GetTrackStreamUrlAsync(string trackId, AudioQuality quality = AudioQuality.High)
    {
        return Task.FromResult<string?>(null);
    }
}
