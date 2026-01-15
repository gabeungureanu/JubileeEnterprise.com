using System.Diagnostics;
using System.Windows;
using System.Windows.Input;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using System;
using JubileeBrowser.Services;
using JubileeBrowser.Models;

namespace JubileeBrowser;

public partial class AboutWindow : Window
{
    private readonly UpdateManager _updateManager;

    public AboutWindow()
    {
        InitializeComponent();

        _updateManager = new UpdateManager();
        _updateManager.StateChanged += UpdateManager_StateChanged;

        // Set version
        var version = typeof(MainWindow).Assembly.GetName().Version;
        VersionText.Text = $"Version {version?.Major}.{version?.Minor}.{version?.Build}";

        // Load high-quality logo from embedded resources
        try
        {
            var logoImage = new BitmapImage();
            logoImage.BeginInit();
            logoImage.UriSource = new Uri("pack://application:,,,/Resources/Icons/jubilee-logo.png", UriKind.Absolute);
            logoImage.DecodePixelWidth = 172; // 2x the display size (86px) for high-DPI clarity
            logoImage.CacheOption = BitmapCacheOption.OnLoad;
            logoImage.EndInit();
            logoImage.Freeze(); // Make thread-safe and improve performance

            AvatarImageBrush.ImageSource = logoImage;
        }
        catch
        {
            // Logo not found, leave empty
        }

        // Initialize update state display
        UpdateStatusText.Text = "Click to check for updates";
        UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#C0C0D0"));
    }

    private void UpdateManager_StateChanged(object? sender, UpdateState state)
    {
        Dispatcher.Invoke(() =>
        {
            UpdateUI(state);
        });
    }

    private void UpdateUI(UpdateState state)
    {
        // Update channel text
        ChannelText.Text = $"Channel: {(state.Channel == UpdateChannel.Beta ? "Beta" : "Stable")}";

        // Update last checked text
        if (state.LastCheckTime.HasValue && state.LastCheckTime > 0)
        {
            var lastCheck = DateTimeOffset.FromUnixTimeMilliseconds(state.LastCheckTime.Value);
            var ago = DateTime.UtcNow - lastCheck.UtcDateTime;
            string agoText;
            if (ago.TotalMinutes < 1)
                agoText = "Just now";
            else if (ago.TotalMinutes < 60)
                agoText = $"{(int)ago.TotalMinutes}m ago";
            else if (ago.TotalHours < 24)
                agoText = $"{(int)ago.TotalHours}h ago";
            else
                agoText = $"{(int)ago.TotalDays}d ago";
            LastCheckedText.Text = $"Last checked: {agoText}";
        }

        // Update status and buttons based on state
        switch (state.Status)
        {
            case UpdateStatus.Checking:
                UpdateStatusText.Text = "Checking for updates...";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#C0C0D0"));
                CheckUpdatesButton.IsEnabled = false;
                CheckUpdatesButton.Content = "Checking...";
                DownloadUpdateButton.Visibility = Visibility.Collapsed;
                break;

            case UpdateStatus.Available:
                UpdateStatusText.Text = $"Update available: {state.AvailableVersion}";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFA500"));
                CheckUpdatesButton.IsEnabled = true;
                CheckUpdatesButton.Content = "Check for Updates";
                DownloadUpdateButton.Visibility = Visibility.Visible;
                DownloadUpdateButton.Content = $"Download {state.AvailableVersion}";
                break;

            case UpdateStatus.NotAvailable:
                UpdateStatusText.Text = "Jubilee is up to date.";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#43D17A"));
                CheckUpdatesButton.IsEnabled = true;
                CheckUpdatesButton.Content = "Check for Updates";
                DownloadUpdateButton.Visibility = Visibility.Collapsed;
                break;

            case UpdateStatus.Downloading:
                var progress = state.DownloadProgress ?? 0;
                UpdateStatusText.Text = $"Downloading... {progress:F0}%";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#5AC8FA"));
                CheckUpdatesButton.IsEnabled = false;
                DownloadUpdateButton.IsEnabled = false;
                DownloadUpdateButton.Content = $"Downloading {progress:F0}%...";
                break;

            case UpdateStatus.Downloaded:
                UpdateStatusText.Text = "Update downloaded! Restart to install.";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#43D17A"));
                CheckUpdatesButton.IsEnabled = true;
                CheckUpdatesButton.Content = "Check for Updates";
                DownloadUpdateButton.Visibility = Visibility.Visible;
                DownloadUpdateButton.Content = "Restart to Install";
                break;

            case UpdateStatus.Error:
                UpdateStatusText.Text = $"Error: {state.LastError ?? "Unknown error"}";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF6B6B"));
                CheckUpdatesButton.IsEnabled = true;
                CheckUpdatesButton.Content = "Retry Check";
                DownloadUpdateButton.Visibility = Visibility.Collapsed;
                break;

            default:
                UpdateStatusText.Text = "Click to check for updates";
                UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#C0C0D0"));
                CheckUpdatesButton.IsEnabled = true;
                CheckUpdatesButton.Content = "Check for Updates";
                DownloadUpdateButton.Visibility = Visibility.Collapsed;
                break;
        }
    }

    private async void CheckUpdatesButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            CheckUpdatesButton.IsEnabled = false;
            CheckUpdatesButton.Content = "Checking...";
            UpdateStatusText.Text = "Checking for updates...";
            UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#C0C0D0"));

            var state = await _updateManager.CheckForUpdatesAsync();
            UpdateUI(state);
        }
        catch (Exception ex)
        {
            UpdateStatusText.Text = $"Error: {ex.Message}";
            UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF6B6B"));
            CheckUpdatesButton.IsEnabled = true;
            CheckUpdatesButton.Content = "Retry Check";
        }
    }

    private async void DownloadUpdateButton_Click(object sender, RoutedEventArgs e)
    {
        try
        {
            if (_updateManager.State.Status == UpdateStatus.Downloaded)
            {
                // Restart application to install update
                var exePath = Process.GetCurrentProcess().MainModule?.FileName;
                if (exePath != null)
                {
                    Process.Start(exePath);
                    Application.Current.Shutdown();
                }
                return;
            }

            DownloadUpdateButton.IsEnabled = false;
            await _updateManager.DownloadUpdateAsync();
        }
        catch (Exception ex)
        {
            UpdateStatusText.Text = $"Download failed: {ex.Message}";
            UpdateStatusText.Foreground = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF6B6B"));
            DownloadUpdateButton.IsEnabled = true;
            DownloadUpdateButton.Content = "Retry Download";
        }
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        Close();
    }
}
