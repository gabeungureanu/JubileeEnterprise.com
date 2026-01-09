using JubileeVibes.Core.Interfaces;
using JubileeVibes.Core.Models;

namespace JubileeVibes.Infrastructure.Services;

public class PlaylistService : IPlaylistService
{
    private readonly List<Playlist> _userPlaylists = new();
    private readonly Dictionary<string, List<Track>> _playlistTracks = new();

    public PlaylistService()
    {
        InitializeMockPlaylists();
    }

    private void InitializeMockPlaylists()
    {
        var playlist1 = new Playlist
        {
            Id = "user-playlist-1",
            Name = "My Favorites",
            Description = "My all-time favorite tracks",
            CoverImageUrl = "https://picsum.photos/seed/myplaylist1/300/300",
            TrackCount = 3,
            IsPublic = false,
            OwnerId = "current-user"
        };

        var playlist2 = new Playlist
        {
            Id = "user-playlist-2",
            Name = "Workout Mix",
            Description = "High energy tracks for the gym",
            CoverImageUrl = "https://picsum.photos/seed/myplaylist2/300/300",
            TrackCount = 2,
            IsPublic = false,
            OwnerId = "current-user"
        };

        var playlist3 = new Playlist
        {
            Id = "user-playlist-3",
            Name = "Road Trip",
            Description = "Songs for long drives",
            CoverImageUrl = "https://picsum.photos/seed/myplaylist3/300/300",
            TrackCount = 2,
            IsPublic = true,
            OwnerId = "current-user"
        };

        _userPlaylists.AddRange(new[] { playlist1, playlist2, playlist3 });

        // Add mock tracks to playlists
        _playlistTracks["user-playlist-1"] = new List<Track>
        {
            new() { Id = "track-1", Title = "Monsters", ArtistName = "The Midnight", AlbumArtUrl = "https://picsum.photos/seed/album1/300/300", Duration = TimeSpan.FromMinutes(4).Add(TimeSpan.FromSeconds(32)) },
            new() { Id = "track-4", Title = "A Moment Apart", ArtistName = "ODESZA", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(2)) },
            new() { Id = "track-14", Title = "Alive", ArtistName = "Rufus Du Sol", AlbumArtUrl = "https://picsum.photos/seed/album5/300/300", Duration = TimeSpan.FromMinutes(5).Add(TimeSpan.FromSeconds(8)) }
        };

        _playlistTracks["user-playlist-2"] = new List<Track>
        {
            new() { Id = "track-5", Title = "Higher Ground", ArtistName = "ODESZA", AlbumArtUrl = "https://picsum.photos/seed/album2/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(47)) },
            new() { Id = "track-25", Title = "Danielle", ArtistName = "Fred again..", AlbumArtUrl = "https://picsum.photos/seed/album10/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(22)) }
        };

        _playlistTracks["user-playlist-3"] = new List<Track>
        {
            new() { Id = "track-8", Title = "Easy", ArtistName = "Tycho", AlbumArtUrl = "https://picsum.photos/seed/album3/300/300", Duration = TimeSpan.FromMinutes(3).Add(TimeSpan.FromSeconds(52)) },
            new() { Id = "track-17", Title = "Brightest Lights", ArtistName = "Lane 8", AlbumArtUrl = "https://picsum.photos/seed/album6/300/300", Duration = TimeSpan.FromMinutes(6).Add(TimeSpan.FromSeconds(48)) }
        };
    }

    public Task<IEnumerable<Playlist>> GetUserPlaylistsAsync()
    {
        return Task.FromResult(_userPlaylists.AsEnumerable());
    }

    public Task<Playlist?> GetPlaylistAsync(string playlistId)
    {
        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        return Task.FromResult(playlist);
    }

    public Task<IEnumerable<Track>> GetPlaylistTracksAsync(string playlistId)
    {
        if (_playlistTracks.TryGetValue(playlistId, out var tracks))
        {
            return Task.FromResult(tracks.AsEnumerable());
        }
        return Task.FromResult(Enumerable.Empty<Track>());
    }

    public Task<Playlist> CreatePlaylistAsync(string name, string? description = null)
    {
        var playlist = new Playlist
        {
            Id = $"user-playlist-{Guid.NewGuid():N}",
            Name = name,
            Description = description,
            TrackCount = 0,
            IsPublic = false,
            OwnerId = "current-user",
            CreatedAt = DateTime.UtcNow
        };

        _userPlaylists.Insert(0, playlist);
        _playlistTracks[playlist.Id] = new List<Track>();

        return Task.FromResult(playlist);
    }

    public Task<bool> UpdatePlaylistAsync(string playlistId, string? name = null, string? description = null)
    {
        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        if (playlist == null)
            return Task.FromResult(false);

        if (name != null)
            playlist.Name = name;

        if (description != null)
            playlist.Description = description;

        return Task.FromResult(true);
    }

    public Task<bool> DeletePlaylistAsync(string playlistId)
    {
        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        if (playlist == null)
            return Task.FromResult(false);

        _userPlaylists.Remove(playlist);
        _playlistTracks.Remove(playlistId);

        return Task.FromResult(true);
    }

    public Task<bool> AddTrackToPlaylistAsync(string playlistId, string trackId)
    {
        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        if (playlist == null)
            return Task.FromResult(false);

        if (!_playlistTracks.ContainsKey(playlistId))
            _playlistTracks[playlistId] = new List<Track>();

        if (_playlistTracks[playlistId].Any(t => t.Id == trackId))
            return Task.FromResult(false);

        // In a real app, we'd fetch track details
        var track = new Track { Id = trackId };
        _playlistTracks[playlistId].Add(track);
        playlist.TrackCount = _playlistTracks[playlistId].Count;

        return Task.FromResult(true);
    }

    public Task<bool> AddTracksToPlaylistAsync(string playlistId, IEnumerable<string> trackIds)
    {
        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        if (playlist == null)
            return Task.FromResult(false);

        if (!_playlistTracks.ContainsKey(playlistId))
            _playlistTracks[playlistId] = new List<Track>();

        foreach (var trackId in trackIds)
        {
            if (!_playlistTracks[playlistId].Any(t => t.Id == trackId))
            {
                _playlistTracks[playlistId].Add(new Track { Id = trackId });
            }
        }

        playlist.TrackCount = _playlistTracks[playlistId].Count;
        return Task.FromResult(true);
    }

    public Task<bool> RemoveTrackFromPlaylistAsync(string playlistId, string trackId)
    {
        if (!_playlistTracks.TryGetValue(playlistId, out var tracks))
            return Task.FromResult(false);

        var track = tracks.FirstOrDefault(t => t.Id == trackId);
        if (track == null)
            return Task.FromResult(false);

        tracks.Remove(track);

        var playlist = _userPlaylists.FirstOrDefault(p => p.Id == playlistId);
        if (playlist != null)
            playlist.TrackCount = tracks.Count;

        return Task.FromResult(true);
    }

    public Task<bool> ReorderPlaylistAsync(string playlistId, int fromIndex, int toIndex)
    {
        if (!_playlistTracks.TryGetValue(playlistId, out var tracks))
            return Task.FromResult(false);

        if (fromIndex < 0 || fromIndex >= tracks.Count)
            return Task.FromResult(false);

        var track = tracks[fromIndex];
        tracks.RemoveAt(fromIndex);
        tracks.Insert(Math.Clamp(toIndex, 0, tracks.Count), track);

        return Task.FromResult(true);
    }
}
