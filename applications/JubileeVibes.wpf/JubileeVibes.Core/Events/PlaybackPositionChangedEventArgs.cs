namespace JubileeVibes.Core.Events;

public class PlaybackPositionChangedEventArgs : EventArgs
{
    public TimeSpan Position { get; }
    public TimeSpan Duration { get; }
    public double Progress => Duration.TotalSeconds > 0 ? Position.TotalSeconds / Duration.TotalSeconds : 0;

    public PlaybackPositionChangedEventArgs(TimeSpan position, TimeSpan duration)
    {
        Position = position;
        Duration = duration;
    }
}
