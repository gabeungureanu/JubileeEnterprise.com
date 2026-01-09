using System.IO;
using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Services;

public class LibraryService : ILibraryService
{
    private readonly List<Track> _likedTracks = new();
    private readonly List<Album> _savedAlbums = new();
    private readonly List<Artist> _followedArtists = new();
    private readonly List<Track> _localTracks = new();
    private readonly List<Track> _recentlyPlayed = new();

    public LibraryService()
    {
        InitializeMockLibrary();
    }

    private void InitializeMockLibrary()
    {
        _likedTracks.AddRange(new[]
        {
            new Track
            {
                Id = "liked-1",
                Title = "Monsters",
                ArtistName = "The Midnight",
                AlbumName = "Monsters",
                AlbumArtUrl = "https://picsum.photos/seed/album1/300/300",
                Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(32)),
                IsLiked = true
            },
            new Track
            {
                Id = "liked-2",
                Title = "Higher Ground",
                ArtistName = "ODESZA",
                AlbumName = "A Moment Apart",
                AlbumArtUrl = "https://picsum.photos/seed/album2/300/300",
                Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(47)),
                IsLiked = true
            },
            new Track
            {
                Id = "liked-3",
                Title = "Alive",
                ArtistName = "Rufus Du Sol",
                AlbumName = "Surrender",
                AlbumArtUrl = "https://picsum.photos/seed/album5/300/300",
                Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(8)),
                IsLiked = true
            }
        });

        _savedAlbums.AddRange(new[]
        {
            new Album
            {
                Id = "album-1",
                Title = "Monsters",
                ArtistName = "The Midnight",
                CoverArtUrl = "https://picsum.photos/seed/album1/300/300",
                ReleaseDate = new DateTime(2020, 7, 10),
                IsSaved = true
            },
            new Album
            {
                Id = "album-2",
                Title = "A Moment Apart",
                ArtistName = "ODESZA",
                CoverArtUrl = "https://picsum.photos/seed/album2/300/300",
                ReleaseDate = new DateTime(2017, 9, 8),
                IsSaved = true
            }
        });

        _followedArtists.AddRange(new[]
        {
            new Artist
            {
                Id = "artist-1",
                Name = "The Midnight",
                ImageUrl = "https://picsum.photos/seed/artist1/300/300",
                IsFollowed = true
            },
            new Artist
            {
                Id = "artist-2",
                Name = "ODESZA",
                ImageUrl = "https://picsum.photos/seed/artist2/300/300",
                IsFollowed = true
            },
            new Artist
            {
                Id = "artist-5",
                Name = "Rufus Du Sol",
                ImageUrl = "https://picsum.photos/seed/artist5/300/300",
                IsFollowed = true
            }
        });
    }

    // Liked Songs
    public Task<IEnumerable<Track>> GetLikedSongsAsync()
    {
        return Task.FromResult(_likedTracks.AsEnumerable());
    }

    public Task<bool> LikeTrackAsync(string trackId)
    {
        var existing = _likedTracks.FirstOrDefault(t => t.Id == trackId);
        if (existing != null)
            return Task.FromResult(false);

        // In a real app, we'd fetch the track details
        var track = new Track { Id = trackId, IsLiked = true };
        _likedTracks.Insert(0, track);
        return Task.FromResult(true);
    }

    public Task<bool> UnlikeTrackAsync(string trackId)
    {
        var track = _likedTracks.FirstOrDefault(t => t.Id == trackId);
        if (track == null)
            return Task.FromResult(false);

        track.IsLiked = false;
        _likedTracks.Remove(track);
        return Task.FromResult(true);
    }

    public Task<bool> IsTrackLikedAsync(string trackId)
    {
        return Task.FromResult(_likedTracks.Any(t => t.Id == trackId));
    }

    // Saved Albums
    public Task<IEnumerable<Album>> GetSavedAlbumsAsync()
    {
        return Task.FromResult(_savedAlbums.AsEnumerable());
    }

    public Task<bool> SaveAlbumAsync(string albumId)
    {
        var existing = _savedAlbums.FirstOrDefault(a => a.Id == albumId);
        if (existing != null)
            return Task.FromResult(false);

        var album = new Album { Id = albumId, IsSaved = true };
        _savedAlbums.Insert(0, album);
        return Task.FromResult(true);
    }

    public Task<bool> RemoveAlbumAsync(string albumId)
    {
        var album = _savedAlbums.FirstOrDefault(a => a.Id == albumId);
        if (album == null)
            return Task.FromResult(false);

        album.IsSaved = false;
        _savedAlbums.Remove(album);
        return Task.FromResult(true);
    }

    public Task<bool> IsAlbumSavedAsync(string albumId)
    {
        return Task.FromResult(_savedAlbums.Any(a => a.Id == albumId));
    }

    // Followed Artists
    public Task<IEnumerable<Artist>> GetFollowedArtistsAsync()
    {
        return Task.FromResult(_followedArtists.AsEnumerable());
    }

    public Task<bool> FollowArtistAsync(string artistId)
    {
        var existing = _followedArtists.FirstOrDefault(a => a.Id == artistId);
        if (existing != null)
            return Task.FromResult(false);

        var artist = new Artist { Id = artistId, IsFollowed = true };
        _followedArtists.Insert(0, artist);
        return Task.FromResult(true);
    }

    public Task<bool> UnfollowArtistAsync(string artistId)
    {
        var artist = _followedArtists.FirstOrDefault(a => a.Id == artistId);
        if (artist == null)
            return Task.FromResult(false);

        artist.IsFollowed = false;
        _followedArtists.Remove(artist);
        return Task.FromResult(true);
    }

    public Task<bool> IsArtistFollowedAsync(string artistId)
    {
        return Task.FromResult(_followedArtists.Any(a => a.Id == artistId));
    }

    // Recently Played
    public Task<IEnumerable<Track>> GetRecentlyPlayedAsync(int limit = 50)
    {
        return Task.FromResult(_recentlyPlayed.Take(limit).AsEnumerable());
    }

    public Task AddToRecentlyPlayedAsync(Track track)
    {
        _recentlyPlayed.RemoveAll(t => t.Id == track.Id);
        _recentlyPlayed.Insert(0, track);

        // Keep only last 100 tracks
        if (_recentlyPlayed.Count > 100)
        {
            _recentlyPlayed.RemoveRange(100, _recentlyPlayed.Count - 100);
        }

        return Task.CompletedTask;
    }

    // Local Files
    public Task<IEnumerable<Track>> GetLocalFilesAsync()
    {
        return Task.FromResult(_localTracks.AsEnumerable());
    }

    public Task ScanLocalFoldersAsync(IEnumerable<string> folderPaths)
    {
        _localTracks.Clear();

        var supportedExtensions = new[] { ".mp3", ".flac", ".wav", ".m4a", ".ogg", ".wma" };

        foreach (var folder in folderPaths)
        {
            if (!Directory.Exists(folder))
                continue;

            try
            {
                var files = Directory.EnumerateFiles(folder, "*.*", SearchOption.AllDirectories)
                    .Where(f => supportedExtensions.Contains(Path.GetExtension(f).ToLowerInvariant()));

                foreach (var file in files)
                {
                    var track = CreateTrackFromFile(file);
                    if (track != null)
                    {
                        _localTracks.Add(track);
                    }
                }
            }
            catch (UnauthorizedAccessException)
            {
                // Skip folders we can't access
            }
        }

        return Task.CompletedTask;
    }

    public Task<Track?> ImportLocalFileAsync(string filePath)
    {
        var track = CreateTrackFromFile(filePath);
        if (track != null)
        {
            _localTracks.Add(track);
        }
        return Task.FromResult(track);
    }

    private Track? CreateTrackFromFile(string filePath)
    {
        try
        {
            var fileName = Path.GetFileNameWithoutExtension(filePath);

            var parts = fileName.Split(" - ", 2);
            var artistName = parts.Length > 1 ? parts[0].Trim() : "Unknown Artist";
            var title = parts.Length > 1 ? parts[1].Trim() : fileName;

            return new Track
            {
                Id = $"local-{Guid.NewGuid():N}",
                Title = title,
                ArtistName = artistName,
                AlbumName = Path.GetFileName(Path.GetDirectoryName(filePath)) ?? "Unknown Album",
                LocalPath = filePath,
                IsLocal = true,
                Duration = TimeSpan.Zero
            };
        }
        catch
        {
            return null;
        }
    }
}
