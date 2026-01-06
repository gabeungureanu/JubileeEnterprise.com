namespace JubileeBrowser.Models;

/// <summary>
/// Represents a mobile device profile for emulation.
/// Contains device-specific properties like screen dimensions, pixel density, and user agent.
/// </summary>
public class DeviceProfile
{
    /// <summary>
    /// Unique identifier for the device profile.
    /// </summary>
    public string Id { get; set; } = string.Empty;

    /// <summary>
    /// Display name of the device (e.g., "iPhone 14 Pro").
    /// </summary>
    public string Name { get; set; } = string.Empty;

    /// <summary>
    /// Category of the device (e.g., "Apple", "Android", "Tablet", "Custom").
    /// </summary>
    public string Category { get; set; } = string.Empty;

    /// <summary>
    /// Viewport width in CSS pixels (portrait mode).
    /// </summary>
    public int Width { get; set; }

    /// <summary>
    /// Viewport height in CSS pixels (portrait mode).
    /// </summary>
    public int Height { get; set; }

    /// <summary>
    /// Device pixel ratio (DPR) - the ratio of physical pixels to CSS pixels.
    /// </summary>
    public double DevicePixelRatio { get; set; } = 1.0;

    /// <summary>
    /// User agent string to use when emulating this device.
    /// </summary>
    public string UserAgent { get; set; } = string.Empty;

    /// <summary>
    /// Whether the device supports touch events.
    /// </summary>
    public bool HasTouch { get; set; } = true;

    /// <summary>
    /// Whether the device is a mobile device (affects CSS mobile media queries).
    /// </summary>
    public bool IsMobile { get; set; } = true;

    /// <summary>
    /// Platform name for navigator.platform.
    /// </summary>
    public string Platform { get; set; } = string.Empty;

    /// <summary>
    /// Creates a clone of this device profile.
    /// </summary>
    public DeviceProfile Clone()
    {
        return new DeviceProfile
        {
            Id = Id,
            Name = Name,
            Category = Category,
            Width = Width,
            Height = Height,
            DevicePixelRatio = DevicePixelRatio,
            UserAgent = UserAgent,
            HasTouch = HasTouch,
            IsMobile = IsMobile,
            Platform = Platform
        };
    }
}

/// <summary>
/// Device orientation mode.
/// </summary>
public enum DeviceOrientation
{
    Portrait,
    Landscape
}

/// <summary>
/// Network throttling preset.
/// </summary>
public enum NetworkThrottlePreset
{
    None,
    Fast4G,
    Slow4G,
    Fast3G,
    Slow3G,
    Offline
}

/// <summary>
/// CPU throttling preset.
/// </summary>
public enum CpuThrottlePreset
{
    None,
    LowEnd2x,
    MidTier4x,
    LowTier6x
}

/// <summary>
/// Network throttling configuration.
/// </summary>
public class NetworkThrottleConfig
{
    public string Name { get; set; } = string.Empty;
    public double DownloadKbps { get; set; }
    public double UploadKbps { get; set; }
    public int LatencyMs { get; set; }

    public static NetworkThrottleConfig GetPreset(NetworkThrottlePreset preset)
    {
        return preset switch
        {
            NetworkThrottlePreset.Fast4G => new NetworkThrottleConfig
            {
                Name = "Fast 4G",
                DownloadKbps = 15000,
                UploadKbps = 5000,
                LatencyMs = 20
            },
            NetworkThrottlePreset.Slow4G => new NetworkThrottleConfig
            {
                Name = "Slow 4G",
                DownloadKbps = 4000,
                UploadKbps = 1000,
                LatencyMs = 100
            },
            NetworkThrottlePreset.Fast3G => new NetworkThrottleConfig
            {
                Name = "Fast 3G",
                DownloadKbps = 1500,
                UploadKbps = 750,
                LatencyMs = 150
            },
            NetworkThrottlePreset.Slow3G => new NetworkThrottleConfig
            {
                Name = "Slow 3G",
                DownloadKbps = 500,
                UploadKbps = 250,
                LatencyMs = 400
            },
            NetworkThrottlePreset.Offline => new NetworkThrottleConfig
            {
                Name = "Offline",
                DownloadKbps = 0,
                UploadKbps = 0,
                LatencyMs = 0
            },
            _ => new NetworkThrottleConfig
            {
                Name = "No Throttling",
                DownloadKbps = -1,
                UploadKbps = -1,
                LatencyMs = 0
            }
        };
    }
}

/// <summary>
/// Mobile emulation state for a tab.
/// </summary>
public class MobileEmulationState
{
    /// <summary>
    /// Whether mobile emulation is enabled.
    /// </summary>
    public bool IsEnabled { get; set; }

    /// <summary>
    /// The currently selected device profile (null for responsive/custom mode).
    /// </summary>
    public DeviceProfile? SelectedDevice { get; set; }

    /// <summary>
    /// Current orientation.
    /// </summary>
    public DeviceOrientation Orientation { get; set; } = DeviceOrientation.Portrait;

    /// <summary>
    /// Custom width when in responsive mode.
    /// </summary>
    public int CustomWidth { get; set; } = 375;

    /// <summary>
    /// Custom height when in responsive mode.
    /// </summary>
    public int CustomHeight { get; set; } = 667;

    /// <summary>
    /// Custom device pixel ratio when in responsive mode.
    /// </summary>
    public double CustomDevicePixelRatio { get; set; } = 2.0;

    /// <summary>
    /// Whether using responsive/custom mode (no specific device).
    /// </summary>
    public bool IsResponsiveMode { get; set; }

    /// <summary>
    /// Current network throttling preset.
    /// </summary>
    public NetworkThrottlePreset NetworkThrottle { get; set; } = NetworkThrottlePreset.None;

    /// <summary>
    /// Current CPU throttling preset.
    /// </summary>
    public CpuThrottlePreset CpuThrottle { get; set; } = CpuThrottlePreset.None;

    /// <summary>
    /// Gets the effective viewport width based on orientation.
    /// </summary>
    public int EffectiveWidth
    {
        get
        {
            var baseWidth = IsResponsiveMode ? CustomWidth : (SelectedDevice?.Width ?? CustomWidth);
            var baseHeight = IsResponsiveMode ? CustomHeight : (SelectedDevice?.Height ?? CustomHeight);
            return Orientation == DeviceOrientation.Portrait ? baseWidth : baseHeight;
        }
    }

    /// <summary>
    /// Gets the effective viewport height based on orientation.
    /// </summary>
    public int EffectiveHeight
    {
        get
        {
            var baseWidth = IsResponsiveMode ? CustomWidth : (SelectedDevice?.Width ?? CustomWidth);
            var baseHeight = IsResponsiveMode ? CustomHeight : (SelectedDevice?.Height ?? CustomHeight);
            return Orientation == DeviceOrientation.Portrait ? baseHeight : baseWidth;
        }
    }

    /// <summary>
    /// Gets the effective device pixel ratio.
    /// </summary>
    public double EffectiveDevicePixelRatio =>
        IsResponsiveMode ? CustomDevicePixelRatio : (SelectedDevice?.DevicePixelRatio ?? CustomDevicePixelRatio);

    /// <summary>
    /// Creates a copy of the current emulation state.
    /// </summary>
    public MobileEmulationState Clone()
    {
        return new MobileEmulationState
        {
            IsEnabled = IsEnabled,
            SelectedDevice = SelectedDevice?.Clone(),
            Orientation = Orientation,
            CustomWidth = CustomWidth,
            CustomHeight = CustomHeight,
            CustomDevicePixelRatio = CustomDevicePixelRatio,
            IsResponsiveMode = IsResponsiveMode,
            NetworkThrottle = NetworkThrottle,
            CpuThrottle = CpuThrottle
        };
    }
}

/// <summary>
/// Predefined device profiles for common mobile devices.
/// </summary>
public static class DeviceProfiles
{
    private static readonly List<DeviceProfile> _profiles = new()
    {
        // Apple iPhones
        new DeviceProfile
        {
            Id = "iphone-se",
            Name = "iPhone SE",
            Category = "Apple",
            Width = 375,
            Height = 667,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "iphone-12",
            Name = "iPhone 12/13",
            Category = "Apple",
            Width = 390,
            Height = 844,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "iphone-14-pro",
            Name = "iPhone 14 Pro",
            Category = "Apple",
            Width = 393,
            Height = 852,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "iphone-14-pro-max",
            Name = "iPhone 14 Pro Max",
            Category = "Apple",
            Width = 430,
            Height = 932,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "iphone-15-pro",
            Name = "iPhone 15 Pro",
            Category = "Apple",
            Width = 393,
            Height = 852,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },

        // Android Phones
        new DeviceProfile
        {
            Id = "pixel-7",
            Name = "Google Pixel 7",
            Category = "Android",
            Width = 412,
            Height = 915,
            DevicePixelRatio = 2.625,
            UserAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "pixel-8-pro",
            Name = "Google Pixel 8 Pro",
            Category = "Android",
            Width = 448,
            Height = 998,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14; Pixel 8 Pro) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "samsung-galaxy-s23",
            Name = "Samsung Galaxy S23",
            Category = "Android",
            Width = 360,
            Height = 780,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14; SM-S911B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "samsung-galaxy-s23-ultra",
            Name = "Samsung Galaxy S23 Ultra",
            Category = "Android",
            Width = 384,
            Height = 824,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14; SM-S918B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "samsung-galaxy-a54",
            Name = "Samsung Galaxy A54",
            Category = "Android",
            Width = 360,
            Height = 800,
            DevicePixelRatio = 2.625,
            UserAgent = "Mozilla/5.0 (Linux; Android 13; SM-A546B) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },

        // Tablets
        new DeviceProfile
        {
            Id = "ipad-mini",
            Name = "iPad Mini",
            Category = "Tablet",
            Width = 768,
            Height = 1024,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPad",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "ipad-air",
            Name = "iPad Air",
            Category = "Tablet",
            Width = 820,
            Height = 1180,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPad",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "ipad-pro-11",
            Name = "iPad Pro 11\"",
            Category = "Tablet",
            Width = 834,
            Height = 1194,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPad",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "ipad-pro-12.9",
            Name = "iPad Pro 12.9\"",
            Category = "Tablet",
            Width = 1024,
            Height = 1366,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPad",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "samsung-galaxy-tab-s9",
            Name = "Samsung Galaxy Tab S9",
            Category = "Tablet",
            Width = 800,
            Height = 1280,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },

        // Generic presets
        new DeviceProfile
        {
            Id = "small-phone",
            Name = "Small Phone (320x568)",
            Category = "Generic",
            Width = 320,
            Height = 568,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
            Platform = "iPhone",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "medium-phone",
            Name = "Medium Phone (375x667)",
            Category = "Generic",
            Width = 375,
            Height = 667,
            DevicePixelRatio = 2.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        },
        new DeviceProfile
        {
            Id = "large-phone",
            Name = "Large Phone (414x896)",
            Category = "Generic",
            Width = 414,
            Height = 896,
            DevicePixelRatio = 3.0,
            UserAgent = "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
            Platform = "Linux armv8l",
            HasTouch = true,
            IsMobile = true
        }
    };

    /// <summary>
    /// Gets all predefined device profiles.
    /// </summary>
    public static IReadOnlyList<DeviceProfile> All => _profiles.AsReadOnly();

    /// <summary>
    /// Gets device profiles filtered by category.
    /// </summary>
    public static IEnumerable<DeviceProfile> GetByCategory(string category) =>
        _profiles.Where(p => p.Category.Equals(category, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Gets a device profile by its ID.
    /// </summary>
    public static DeviceProfile? GetById(string id) =>
        _profiles.FirstOrDefault(p => p.Id.Equals(id, StringComparison.OrdinalIgnoreCase));

    /// <summary>
    /// Gets all unique categories.
    /// </summary>
    public static IEnumerable<string> Categories =>
        _profiles.Select(p => p.Category).Distinct().OrderBy(c => c);
}
