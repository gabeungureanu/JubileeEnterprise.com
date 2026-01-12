using System.IO;
using System.Windows;
using System.Windows.Controls;
using JubileeFlywheel.Services;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Win32;
using Newtonsoft.Json;

namespace JubileeFlywheel.Views
{
    public partial class SettingsView : UserControl
    {
        private readonly ISettingsService _settingsService;
        private readonly IDataCacheService _cacheService;

        public SettingsView()
        {
            InitializeComponent();

            _settingsService = App.ServiceProvider.GetRequiredService<ISettingsService>();
            _cacheService = App.ServiceProvider.GetRequiredService<IDataCacheService>();

            Loaded += SettingsView_Loaded;
        }

        private void SettingsView_Loaded(object sender, RoutedEventArgs e)
        {
            LoadSettings();
        }

        private void LoadSettings()
        {
            AutoRefreshCheckBox.IsChecked = _settingsService.Settings.AutoRefreshEnabled;
            DefaultIntervalTextBox.Text = _settingsService.Settings.DefaultRefreshInterval.ToString();

            for (int i = 0; i < ThemeComboBox.Items.Count; i++)
            {
                if (ThemeComboBox.Items[i] is ComboBoxItem item &&
                    item.Content?.ToString() == _settingsService.Settings.Theme)
                {
                    ThemeComboBox.SelectedIndex = i;
                    break;
                }
            }
        }

        private async void SaveSettingsButton_Click(object sender, RoutedEventArgs e)
        {
            if (!int.TryParse(DefaultIntervalTextBox.Text, out var interval) || interval < 1)
            {
                MessageBox.Show("Refresh interval must be a positive number.",
                    "Validation Error", MessageBoxButton.OK, MessageBoxImage.Warning);
                return;
            }

            _settingsService.Settings.AutoRefreshEnabled = AutoRefreshCheckBox.IsChecked ?? true;
            _settingsService.Settings.DefaultRefreshInterval = interval;
            _settingsService.Settings.Theme = (ThemeComboBox.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "Dark";

            await _settingsService.SaveAsync();

            MessageBox.Show("Settings saved successfully.",
                "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
        }

        private void ClearCacheButton_Click(object sender, RoutedEventArgs e)
        {
            var result = MessageBox.Show(
                "This will clear all cached data. Continue?",
                "Clear Cache",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                _cacheService.Clear();
                MessageBox.Show("Cache cleared successfully.",
                    "Cache", MessageBoxButton.OK, MessageBoxImage.Information);
            }
        }

        private async void ExportSettingsButton_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new SaveFileDialog
            {
                Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                DefaultExt = ".json",
                FileName = $"flywheel_settings_{DateTime.Now:yyyyMMdd}.json"
            };

            if (dialog.ShowDialog() == true)
            {
                try
                {
                    var json = JsonConvert.SerializeObject(_settingsService.Settings, Formatting.Indented);
                    await File.WriteAllTextAsync(dialog.FileName, json);

                    MessageBox.Show("Settings exported successfully.",
                        "Export", MessageBoxButton.OK, MessageBoxImage.Information);
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Export failed: {ex.Message}",
                        "Export Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }

        private async void ImportSettingsButton_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new OpenFileDialog
            {
                Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                DefaultExt = ".json"
            };

            if (dialog.ShowDialog() == true)
            {
                try
                {
                    var json = await File.ReadAllTextAsync(dialog.FileName);
                    var settings = JsonConvert.DeserializeObject<Models.AppSettings>(json);

                    if (settings != null)
                    {
                        _settingsService.Settings.ApiEndpoints = settings.ApiEndpoints;
                        _settingsService.Settings.Dashboards = settings.Dashboards;
                        _settingsService.Settings.AutoRefreshEnabled = settings.AutoRefreshEnabled;
                        _settingsService.Settings.DefaultRefreshInterval = settings.DefaultRefreshInterval;
                        _settingsService.Settings.Theme = settings.Theme;

                        await _settingsService.SaveAsync();
                        LoadSettings();

                        MessageBox.Show("Settings imported successfully. Please restart the application.",
                            "Import", MessageBoxButton.OK, MessageBoxImage.Information);
                    }
                }
                catch (Exception ex)
                {
                    MessageBox.Show($"Import failed: {ex.Message}",
                        "Import Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
        }
    }
}
