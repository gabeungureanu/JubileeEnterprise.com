using System;
using System.Windows;
using Microsoft.Win32;

namespace JubileeBrowser.Services;

/// <summary>
/// Manages application-wide theme switching between Dark, Light, and System themes.
/// Handles system theme detection and real-time monitoring of OS theme changes.
/// </summary>
public class ThemeManager : IDisposable
{
    private string _currentTheme = "dark";
    private bool _systemIsLight;
    private bool _isDisposed;

    /// <summary>
    /// Event fired when the theme changes. Provides the effective theme (dark/light).
    /// </summary>
    public event EventHandler<ThemeChangedEventArgs>? ThemeChanged;

    /// <summary>
    /// Gets the current theme setting (dark/light/system).
    /// </summary>
    public string CurrentTheme => _currentTheme;

    /// <summary>
    /// Gets whether the effective theme is light (considering system preference if theme is "system").
    /// </summary>
    public bool IsEffectivelyLight => _currentTheme == "light" ||
        (_currentTheme == "system" && _systemIsLight);

    /// <summary>
    /// Gets the effective theme name (always "dark" or "light", never "system").
    /// </summary>
    public string EffectiveTheme => IsEffectivelyLight ? "light" : "dark";

    /// <summary>
    /// Initializes the ThemeManager and starts monitoring system theme changes.
    /// </summary>
    public void Initialize()
    {
        _systemIsLight = DetectSystemTheme();

        // Subscribe to system theme changes
        SystemEvents.UserPreferenceChanged += OnSystemPreferenceChanged;
    }

    /// <summary>
    /// Sets the application theme and applies it immediately.
    /// </summary>
    /// <param name="theme">The theme to apply: "dark", "light", or "system".</param>
    public void SetTheme(string theme)
    {
        if (string.IsNullOrEmpty(theme))
            theme = "dark";

        // Normalize theme value
        theme = theme.ToLowerInvariant();
        if (theme != "dark" && theme != "light" && theme != "system")
            theme = "dark";

        _currentTheme = theme;

        // Update system theme detection if needed
        if (theme == "system")
            _systemIsLight = DetectSystemTheme();

        ApplyTheme();
    }

    /// <summary>
    /// Applies the current theme to the application resources.
    /// </summary>
    private void ApplyTheme()
    {
        Application.Current?.Dispatcher.Invoke(() =>
        {
            try
            {
                var resources = Application.Current?.Resources;
                if (resources == null) return;

                bool useLight = IsEffectivelyLight;

                // Find and remove existing theme dictionary
                ResourceDictionary? existingTheme = null;
                foreach (var dict in resources.MergedDictionaries)
                {
                    var source = dict.Source?.ToString() ?? "";
                    if (source.Contains("DarkTheme.xaml") || source.Contains("LightTheme.xaml"))
                    {
                        existingTheme = dict;
                        break;
                    }
                }

                if (existingTheme != null)
                {
                    resources.MergedDictionaries.Remove(existingTheme);
                }

                // Add the appropriate theme dictionary
                string themeFile = useLight ? "LightTheme.xaml" : "DarkTheme.xaml";
                var newTheme = new ResourceDictionary
                {
                    Source = new Uri($"pack://application:,,,/Themes/{themeFile}")
                };

                // Insert at the beginning to ensure theme colors are available to other dictionaries
                resources.MergedDictionaries.Insert(0, newTheme);

                // Fire the theme changed event
                ThemeChanged?.Invoke(this, new ThemeChangedEventArgs(_currentTheme, EffectiveTheme));
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"ThemeManager: Failed to apply theme - {ex.Message}");
            }
        });
    }

    /// <summary>
    /// Detects the current Windows system theme preference.
    /// </summary>
    /// <returns>True if the system is using light theme, false for dark theme.</returns>
    private bool DetectSystemTheme()
    {
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(
                @"Software\Microsoft\Windows\CurrentVersion\Themes\Personalize");

            if (key != null)
            {
                var value = key.GetValue("AppsUseLightTheme");
                return value is int intValue && intValue == 1;
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"ThemeManager: Failed to detect system theme - {ex.Message}");
        }

        // Default to dark theme if detection fails
        return false;
    }

    /// <summary>
    /// Handles system preference changes (including theme changes).
    /// </summary>
    private void OnSystemPreferenceChanged(object sender, UserPreferenceChangedEventArgs e)
    {
        if (e.Category == UserPreferenceCategory.General)
        {
            bool wasLight = _systemIsLight;
            _systemIsLight = DetectSystemTheme();

            // Only update if system theme actually changed and we're in system mode
            if (_currentTheme == "system" && wasLight != _systemIsLight)
            {
                ApplyTheme();
            }
        }
    }

    /// <summary>
    /// Cleans up resources and unsubscribes from events.
    /// </summary>
    public void Dispose()
    {
        if (_isDisposed) return;
        _isDisposed = true;

        SystemEvents.UserPreferenceChanged -= OnSystemPreferenceChanged;
    }
}

/// <summary>
/// Event arguments for theme change events.
/// </summary>
public class ThemeChangedEventArgs : EventArgs
{
    /// <summary>
    /// The theme setting (dark/light/system).
    /// </summary>
    public string Theme { get; }

    /// <summary>
    /// The effective theme being applied (always "dark" or "light").
    /// </summary>
    public string EffectiveTheme { get; }

    /// <summary>
    /// Whether the effective theme is light.
    /// </summary>
    public bool IsLight => EffectiveTheme == "light";

    public ThemeChangedEventArgs(string theme, string effectiveTheme)
    {
        Theme = theme;
        EffectiveTheme = effectiveTheme;
    }
}
