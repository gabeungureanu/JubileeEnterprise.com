using System.Windows;

namespace JubileeMusic.Services;

public interface IWindowSettingsService
{
    WindowSettings LoadSettings();
    void SaveSettings(WindowSettings settings);
}

public class WindowSettings
{
    // Schema version for future compatibility
    public int Version { get; set; } = 1;

    // Window geometry
    public double Left { get; set; } = double.NaN;
    public double Top { get; set; } = double.NaN;
    public double Width { get; set; } = 1280;
    public double Height { get; set; } = 800;
    public WindowState WindowState { get; set; } = WindowState.Normal;

    // Monitor identification for multi-monitor setups
    public string? MonitorDeviceName { get; set; }
    public double MonitorLeft { get; set; } = double.NaN;
    public double MonitorTop { get; set; } = double.NaN;
    public double MonitorWidth { get; set; } = double.NaN;
    public double MonitorHeight { get; set; } = double.NaN;

    // Restore dimensions when coming out of maximized state
    public double RestoreWidth { get; set; } = 1280;
    public double RestoreHeight { get; set; } = 800;

    // Navigation state
    public string LastView { get; set; } = "Browser";
    public string? LastUrl { get; set; }

    // Suno WebView state
    public double SunoZoomFactor { get; set; } = 1.0;
    public string? SunoLastUrl { get; set; }

    // Create panel state (right side)
    public bool IsCreatorPanelOpen { get; set; } = false;
    public double CreatorPanelWidth { get; set; } = 320;

    // ChatGPT panel state (left side)
    public bool IsChatGptPanelOpen { get; set; } = false;
    public double ChatGptPanelWidth { get; set; } = 400;

    // Form data state (transient but useful for session continuity)
    public CreateFormState? CreateFormState { get; set; }
}

public class CreateFormState
{
    public string? Workspace { get; set; }
    public string? Title { get; set; }
    public string? MusicStyle { get; set; }
    public string? Lyrics { get; set; }
    public bool IsInstrumental { get; set; }
}
