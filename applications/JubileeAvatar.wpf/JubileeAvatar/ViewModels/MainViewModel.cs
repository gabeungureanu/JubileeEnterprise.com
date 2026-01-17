using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using JubileeAvatar.Services;

namespace JubileeAvatar.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        private readonly ISettingsService _settingsService;
        private readonly IBackendService _backendService;

        [ObservableProperty]
        private bool _isSessionActive;

        [ObservableProperty]
        private string _sessionStatus = "Offline";

        [ObservableProperty]
        private double _totalLatency;

        [ObservableProperty]
        private bool _isMicrophoneEnabled = true;

        [ObservableProperty]
        private bool _isSpeakerEnabled = true;

        [ObservableProperty]
        private bool _isDebugMode;

        [ObservableProperty]
        private string _selectedVoice = "Rachel (Female)";

        [ObservableProperty]
        private int _latencyTarget = 3;

        public MainViewModel(ISettingsService settingsService, IBackendService backendService)
        {
            _settingsService = settingsService;
            _backendService = backendService;
        }
    }
}
