using System;
using System.Collections.ObjectModel;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;
using System.Windows.Threading;
using Microsoft.Extensions.DependencyInjection;
using JubileeAvatar.Models;
using JubileeAvatar.Services;
using JubileeAvatar.ViewModels;

namespace JubileeAvatar.Views
{
    public partial class MainWindow : Window
    {
        private readonly MainViewModel _viewModel;
        private readonly IAudioService _audioService;
        private readonly IBackendService _backendService;
        private readonly IConversationLogger _conversationLogger;
        private readonly DispatcherTimer _levelTimer;
        private bool _isSessionActive = false;
        private bool _debugMode = false;

        public ObservableCollection<ConversationEntry> ConversationLog { get; } = new();

        public MainWindow()
        {
            InitializeComponent();

            _viewModel = App.ServiceProvider.GetRequiredService<MainViewModel>();
            _audioService = App.ServiceProvider.GetRequiredService<IAudioService>();
            _backendService = App.ServiceProvider.GetRequiredService<IBackendService>();
            _conversationLogger = App.ServiceProvider.GetRequiredService<IConversationLogger>();

            DataContext = _viewModel;
            ConversationLogItems.ItemsSource = ConversationLog;

            // Subscribe to events
            _backendService.OnTranscriptionReceived += OnTranscriptionReceived;
            _backendService.OnAIResponseReceived += OnAIResponseReceived;
            _backendService.OnTTSAudioReady += OnTTSAudioReady;
            _backendService.OnAvatarFrameReady += OnAvatarFrameReady;
            _backendService.OnPipelineStatusChanged += OnPipelineStatusChanged;
            _backendService.OnDebugLog += OnDebugLog;
            _backendService.OnLatencyUpdate += OnLatencyUpdate;

            // Audio level monitoring
            _levelTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromMilliseconds(50)
            };
            _levelTimer.Tick += LevelTimer_Tick;

            // Check initial routing status
            CheckRoutingStatus();
            LogDebug("Application initialized successfully");
        }

        private async void StartSessionButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                StartSessionButton.IsEnabled = false;
                LogDebug("Starting avatar session...");

                var success = await _backendService.StartSessionAsync();
                if (success)
                {
                    _isSessionActive = true;
                    StopSessionButton.IsEnabled = true;
                    UpdateSessionStatus(true);
                    _levelTimer.Start();
                    _audioService.StartCapture();
                    LogDebug("Session started successfully");
                    AddConversationEntry("System", "Avatar session started. Listening for input...", "#3498DB");
                }
                else
                {
                    StartSessionButton.IsEnabled = true;
                    LogDebug("Failed to start session - backend connection error");
                    MessageBox.Show("Failed to connect to backend service. Ensure the backend is running.",
                        "Connection Error", MessageBoxButton.OK, MessageBoxImage.Error);
                }
            }
            catch (Exception ex)
            {
                StartSessionButton.IsEnabled = true;
                LogDebug($"Session start error: {ex.Message}");
                MessageBox.Show($"Error starting session: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }

        private async void StopSessionButton_Click(object sender, RoutedEventArgs e)
        {
            try
            {
                StopSessionButton.IsEnabled = false;
                LogDebug("Stopping avatar session...");

                await _backendService.StopSessionAsync();
                _audioService.StopCapture();
                _levelTimer.Stop();
                _isSessionActive = false;

                StartSessionButton.IsEnabled = true;
                UpdateSessionStatus(false);
                ResetPipelineStatus();
                LogDebug("Session stopped successfully");
                AddConversationEntry("System", "Avatar session ended.", "#3498DB");
            }
            catch (Exception ex)
            {
                StopSessionButton.IsEnabled = true;
                LogDebug($"Session stop error: {ex.Message}");
            }
        }

        private void OnTranscriptionReceived(object? sender, TranscriptionEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                AddConversationEntry("User", e.Text, "#E74C3C");
                LogDebug($"[STT] Transcription received: {e.Text.Substring(0, Math.Min(50, e.Text.Length))}...");
                UpdatePipelineStatus(STTStatusIndicator, true);
            });
        }

        private void OnAIResponseReceived(object? sender, AIResponseEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                AddConversationEntry("Jubilee", e.Response, "#27AE60");
                LogDebug($"[AI] Response received: {e.Response.Substring(0, Math.Min(50, e.Response.Length))}...");
                UpdatePipelineStatus(AIStatusIndicator, true);
            });
        }

        private void OnTTSAudioReady(object? sender, TTSAudioEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                LogDebug($"[TTS] Audio ready: {e.Duration:F2}s");
                UpdatePipelineStatus(TTSStatusIndicator, true);

                if (SpeakerToggle.IsChecked == true)
                {
                    _audioService.PlayAudio(e.AudioData);
                }
            });
        }

        private void OnAvatarFrameReady(object? sender, AvatarFrameEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                LogDebug("[Avatar] Frame received");
                UpdatePipelineStatus(AvatarStatusIndicator, true);
                // Update avatar preview image
                // AvatarPreviewImage.Source = e.Frame;
            });
        }

        private void OnPipelineStatusChanged(object? sender, PipelineStatusEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                switch (e.Stage)
                {
                    case PipelineStage.Idle:
                        ResetPipelineStatus();
                        break;
                    case PipelineStage.Listening:
                        UpdatePipelineStatus(STTStatusIndicator, false, true);
                        break;
                    case PipelineStage.Transcribing:
                        UpdatePipelineStatus(STTStatusIndicator, false, true);
                        break;
                    case PipelineStage.GeneratingResponse:
                        UpdatePipelineStatus(AIStatusIndicator, false, true);
                        break;
                    case PipelineStage.GeneratingSpeech:
                        UpdatePipelineStatus(TTSStatusIndicator, false, true);
                        break;
                    case PipelineStage.RenderingAvatar:
                        UpdatePipelineStatus(AvatarStatusIndicator, false, true);
                        break;
                }
            });
        }

        private void OnLatencyUpdate(object? sender, LatencyUpdateEventArgs e)
        {
            Dispatcher.Invoke(() =>
            {
                LatencyText.Text = $"{e.TotalLatency:F0} ms";
                STTLatency.Text = $"{e.STTLatency:F0}ms";
                AILatency.Text = $"{e.AILatency:F0}ms";
                TTSLatency.Text = $"{e.TTSLatency:F0}ms";
                AvatarLatency.Text = $"{e.AvatarLatency:F0}ms";

                // Color code based on latency target
                var targetLatency = LatencySlider.Value * 1000;
                LatencyText.Foreground = e.TotalLatency <= targetLatency
                    ? (Brush)FindResource("SuccessBrush")
                    : (Brush)FindResource("WarningBrush");
            });
        }

        private void OnDebugLog(object? sender, string message)
        {
            if (_debugMode)
            {
                Dispatcher.Invoke(() => LogDebug(message));
            }
        }

        private void LevelTimer_Tick(object? sender, EventArgs e)
        {
            InputLevelBar.Value = _audioService.GetInputLevel();
            OutputLevelBar.Value = _audioService.GetOutputLevel();
        }

        private void UpdateSessionStatus(bool isActive)
        {
            if (isActive)
            {
                SessionStatusIndicator.Fill = (Brush)FindResource("SuccessBrush");
                SessionStatusText.Text = "Live";
            }
            else
            {
                SessionStatusIndicator.Fill = new SolidColorBrush(Color.FromRgb(127, 140, 141));
                SessionStatusText.Text = "Offline";
                LatencyText.Text = "-- ms";
            }
        }

        private void UpdatePipelineStatus(System.Windows.Shapes.Ellipse indicator, bool success, bool processing = false)
        {
            if (processing)
            {
                indicator.Fill = (Brush)FindResource("WarningBrush");
            }
            else if (success)
            {
                indicator.Fill = (Brush)FindResource("SuccessBrush");
            }
            else
            {
                indicator.Fill = (Brush)FindResource("AccentBrush");
            }
        }

        private void ResetPipelineStatus()
        {
            var idleBrush = new SolidColorBrush(Color.FromRgb(127, 140, 141));
            STTStatusIndicator.Fill = idleBrush;
            AIStatusIndicator.Fill = idleBrush;
            TTSStatusIndicator.Fill = idleBrush;
            AvatarStatusIndicator.Fill = idleBrush;

            STTLatency.Text = "--";
            AILatency.Text = "--";
            TTSLatency.Text = "--";
            AvatarLatency.Text = "--";
        }

        private void CheckRoutingStatus()
        {
            // Check VoiceMeeter
            var voiceMeeterRunning = Process.GetProcessesByName("voicemeeter").Length > 0 ||
                                     Process.GetProcessesByName("voicemeeterpro").Length > 0;
            VoiceMeeterStatus.Fill = voiceMeeterRunning
                ? (Brush)FindResource("SuccessBrush")
                : new SolidColorBrush(Color.FromRgb(127, 140, 141));

            // Check OBS
            var obsRunning = Process.GetProcessesByName("obs64").Length > 0 ||
                            Process.GetProcessesByName("obs32").Length > 0;
            OBSVirtualCamStatus.Fill = obsRunning
                ? (Brush)FindResource("SuccessBrush")
                : new SolidColorBrush(Color.FromRgb(127, 140, 141));

            LogDebug($"VoiceMeeter: {(voiceMeeterRunning ? "Running" : "Not detected")}");
            LogDebug($"OBS: {(obsRunning ? "Running" : "Not detected")}");
        }

        private void AddConversationEntry(string role, string message, string colorHex)
        {
            var entry = new ConversationEntry
            {
                Role = role,
                Message = message,
                Timestamp = DateTime.Now.ToString("HH:mm:ss"),
                RoleColor = new SolidColorBrush((Color)ColorConverter.ConvertFromString(colorHex))
            };

            ConversationLog.Add(entry);
            _conversationLogger.Log(entry);

            // Auto-scroll to bottom
            LogScrollViewer.ScrollToEnd();
        }

        private void LogDebug(string message)
        {
            var timestamp = DateTime.Now.ToString("HH:mm:ss.fff");
            DebugLogTextBox.AppendText($"[{timestamp}] {message}\n");
            DebugScrollViewer.ScrollToEnd();
        }

        private void ClearLogButton_Click(object sender, RoutedEventArgs e)
        {
            ConversationLog.Clear();
            LogDebug("Conversation log cleared");
        }

        private async void ExportLogButton_Click(object sender, RoutedEventArgs e)
        {
            var dialog = new Microsoft.Win32.SaveFileDialog
            {
                Filter = "JSON files (*.json)|*.json|Text files (*.txt)|*.txt",
                DefaultExt = ".json",
                FileName = $"JubileeAvatar_Log_{DateTime.Now:yyyyMMdd_HHmmss}"
            };

            if (dialog.ShowDialog() == true)
            {
                await _conversationLogger.ExportAsync(dialog.FileName);
                LogDebug($"Log exported to: {dialog.FileName}");
            }
        }

        private void MicrophoneToggle_Changed(object sender, RoutedEventArgs e)
        {
            var isEnabled = MicrophoneToggle.IsChecked == true;
            _audioService.SetMicrophoneEnabled(isEnabled);
            LogDebug($"Microphone {(isEnabled ? "enabled" : "muted")}");
        }

        private void SpeakerToggle_Changed(object sender, RoutedEventArgs e)
        {
            var isEnabled = SpeakerToggle.IsChecked == true;
            _audioService.SetSpeakerEnabled(isEnabled);
            LogDebug($"Speaker {(isEnabled ? "enabled" : "muted")}");
        }

        private void DebugModeToggle_Changed(object sender, RoutedEventArgs e)
        {
            _debugMode = DebugModeToggle.IsChecked == true;
            LogDebug($"Debug mode {(_debugMode ? "enabled" : "disabled")}");
        }

        private void RefreshRoutingButton_Click(object sender, RoutedEventArgs e)
        {
            CheckRoutingStatus();
        }

        private void SettingsButton_Click(object sender, RoutedEventArgs e)
        {
            var settingsWindow = new SettingsWindow();
            settingsWindow.Owner = this;
            settingsWindow.ShowDialog();
        }

        private void HelpButton_Click(object sender, RoutedEventArgs e)
        {
            MessageBox.Show(
                "Jubilee Avatar - AI Live Avatar System\n\n" +
                "Setup Instructions:\n" +
                "1. Start VoiceMeeter Banana and configure virtual inputs\n" +
                "2. Start OBS Studio and enable Virtual Camera\n" +
                "3. Configure Zoom to use VoiceMeeter Output as microphone\n" +
                "4. Configure Zoom to use OBS Virtual Camera as video\n" +
                "5. Click 'Start Session' to begin\n\n" +
                "For detailed setup, see the README file.",
                "Help",
                MessageBoxButton.OK,
                MessageBoxImage.Information);
        }

        protected override void OnClosed(EventArgs e)
        {
            if (_isSessionActive)
            {
                _backendService.StopSessionAsync().Wait();
                _audioService.StopCapture();
            }
            _levelTimer.Stop();
            base.OnClosed(e);
        }
    }
}
