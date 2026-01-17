using System.Windows;
using Microsoft.Extensions.DependencyInjection;
using JubileeAvatar.Services;

namespace JubileeAvatar.Views
{
    public partial class SettingsWindow : Window
    {
        private readonly ISettingsService _settingsService;

        public SettingsWindow()
        {
            InitializeComponent();
            _settingsService = App.ServiceProvider.GetRequiredService<ISettingsService>();
            LoadSettings();
        }

        private void LoadSettings()
        {
            var settings = _settingsService.Settings;

            // Mask API keys but allow editing
            if (!string.IsNullOrEmpty(settings.Api.OpenAIApiKey))
                OpenAIKeyBox.Password = settings.Api.OpenAIApiKey;
            if (!string.IsNullOrEmpty(settings.Api.ElevenLabsApiKey))
                ElevenLabsKeyBox.Password = settings.Api.ElevenLabsApiKey;
            if (!string.IsNullOrEmpty(settings.Api.DIDApiKey))
                DIDKeyBox.Password = settings.Api.DIDApiKey;
            if (!string.IsNullOrEmpty(settings.Api.HeyGenApiKey))
                HeyGenKeyBox.Password = settings.Api.HeyGenApiKey;

            BackendUrlBox.Text = settings.Backend.Url;
            UseWebSocketCheck.IsChecked = settings.Backend.UseWebSocket;
            TimeoutBox.Text = settings.Backend.TimeoutSeconds.ToString();

            AvatarIdBox.Text = settings.Avatar.AvatarId;
            VoiceIdBox.Text = settings.Avatar.VoiceId;

            // Set avatar provider
            foreach (System.Windows.Controls.ComboBoxItem item in AvatarProviderCombo.Items)
            {
                if (item.Content.ToString()?.ToLower() == settings.Avatar.Provider.ToLower())
                {
                    AvatarProviderCombo.SelectedItem = item;
                    break;
                }
            }
        }

        private async void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            var settings = _settingsService.Settings;

            // Update API keys
            if (!string.IsNullOrEmpty(OpenAIKeyBox.Password))
                settings.Api.OpenAIApiKey = OpenAIKeyBox.Password;
            if (!string.IsNullOrEmpty(ElevenLabsKeyBox.Password))
                settings.Api.ElevenLabsApiKey = ElevenLabsKeyBox.Password;
            if (!string.IsNullOrEmpty(DIDKeyBox.Password))
                settings.Api.DIDApiKey = DIDKeyBox.Password;
            if (!string.IsNullOrEmpty(HeyGenKeyBox.Password))
                settings.Api.HeyGenApiKey = HeyGenKeyBox.Password;

            // Update backend settings
            settings.Backend.Url = BackendUrlBox.Text;
            settings.Backend.UseWebSocket = UseWebSocketCheck.IsChecked == true;
            if (int.TryParse(TimeoutBox.Text, out var timeout))
                settings.Backend.TimeoutSeconds = timeout;

            // Update avatar settings
            settings.Avatar.AvatarId = AvatarIdBox.Text;
            settings.Avatar.VoiceId = VoiceIdBox.Text;
            if (AvatarProviderCombo.SelectedItem is System.Windows.Controls.ComboBoxItem selectedItem)
                settings.Avatar.Provider = selectedItem.Content.ToString()?.ToLower() ?? "d-id";

            await _settingsService.SaveAsync();

            MessageBox.Show("Settings saved successfully!", "Settings", MessageBoxButton.OK, MessageBoxImage.Information);
            DialogResult = true;
            Close();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            DialogResult = false;
            Close();
        }
    }
}
