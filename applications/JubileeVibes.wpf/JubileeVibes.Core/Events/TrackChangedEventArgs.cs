using JubileeVibes.Core.Models;

namespace JubileeVibes.Core.Events;

public class TrackChangedEventArgs : EventArgs
{
    public Track? PreviousTrack { get; }
    public Track? CurrentTrack { get; }

    public TrackChangedEventArgs(Track? currentTrack, Track? previousTrack = null)
    {
        CurrentTrack = currentTrack;
        PreviousTrack = previousTrack;
    }
}
