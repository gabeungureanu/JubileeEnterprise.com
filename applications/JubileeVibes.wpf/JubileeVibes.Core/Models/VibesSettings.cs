using JubileeVibes.Core.Enums;

namespace JubileeVibes.Core.Models;

public class VibesSettings
{
    public ThemeSettings Theme { get; set; } = new();
    public PlaybackSettings Playback { get; set; } = new();
    public AudioSettings Audio { get; set; } = new();
    public LibrarySettings Library { get; set; } = new();
    public NotificationSettings Notifications { get; set; } = new();
    public WindowSettings Window { get; set; } = new();
}

public class ThemeSettings
{
    public string Mode { get; set; } = "dark";
    public string AccentColor { get; set; } = "#1DB954";
    public bool UseSystemAccent { get; set; }
}

public class PlaybackSettings
{
    public AudioQuality StreamingQuality { get; set; } = AudioQuality.High;
    public AudioQuality DownloadQuality { get; set; } = AudioQuality.VeryHigh;
    public bool CrossfadeEnabled { get; set; }
    public int CrossfadeDurationMs { get; set; } = 5000;
    public bool NormalizationEnabled { get; set; } = true;
    public double NormalizationLevel { get; set; } = -14.0;
    public bool GaplessPlayback { get; set; } = true;
    public bool AutoPlay { get; set; } = true;
}

public class AudioSettings
{
    public string? SelectedDeviceId { get; set; }
    public double Volume { get; set; } = 0.7;
    public bool RememberVolume { get; set; } = true;
    public bool MonoAudio { get; set; }
}

public class LibrarySettings
{
    public List<string> LocalMusicFolders { get; set; } = new();
    public bool AutoScanFolders { get; set; } = true;
    public bool ShowLocalFiles { get; set; } = true;
}

public class NotificationSettings
{
    public bool ShowNowPlaying { get; set; } = true;
    public bool ShowTrackChange { get; set; }
    public bool DesktopNotifications { get; set; } = true;
}

public class WindowSettings
{
    public double Left { get; set; } = double.NaN;
    public double Top { get; set; } = double.NaN;
    public double Width { get; set; } = 1400;
    public double Height { get; set; } = 900;
    public int WindowState { get; set; } = 0; // 0 = Normal, 1 = Minimized, 2 = Maximized
    public bool IsFirstRun { get; set; } = true;
}
