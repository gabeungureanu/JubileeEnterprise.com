using System;
using System.IO;
using Newtonsoft.Json;

namespace JubileeMusic.Models;

public class AppSettings
{
    [JsonProperty("libraryPath")]
    public string LibraryPath { get; set; } = Path.Combine(
        Environment.GetFolderPath(Environment.SpecialFolder.MyMusic),
        "JubileeMusic"
    );

    [JsonProperty("autoDownload")]
    public bool AutoDownload { get; set; } = true;

    [JsonProperty("pollingIntervalMs")]
    public int PollingIntervalMs { get; set; } = 5000;

    [JsonProperty("maxPollingAttempts")]
    public int MaxPollingAttempts { get; set; } = 120; // 10 minutes at 5s intervals

    [JsonProperty("downloadTimeout")]
    public int DownloadTimeoutSeconds { get; set; } = 120;

    [JsonProperty("theme")]
    public string Theme { get; set; } = "Dark";

    [JsonProperty("volume")]
    public double Volume { get; set; } = 0.8;

    [JsonProperty("windowState")]
    public WindowStateSettings WindowState { get; set; } = new();

    [JsonProperty("lastSyncTime")]
    public DateTime? LastSyncTime { get; set; }
}

public class WindowStateSettings
{
    [JsonProperty("width")]
    public double Width { get; set; } = 1400;

    [JsonProperty("height")]
    public double Height { get; set; } = 900;

    [JsonProperty("left")]
    public double Left { get; set; } = 100;

    [JsonProperty("top")]
    public double Top { get; set; } = 100;

    [JsonProperty("isMaximized")]
    public bool IsMaximized { get; set; } = false;
}
