using System;
using System.Collections.Generic;
using System.Linq;
using NAudio.Wave;
using NAudio.CoreAudioApi;

namespace JubileeAvatar.Services
{
    public class AudioService : IAudioService, IDisposable
    {
        private WaveInEvent? _waveIn;
        private WaveOutEvent? _waveOut;
        private BufferedWaveProvider? _bufferedWaveProvider;
        private readonly ISettingsService _settingsService;

        private bool _isCapturing = false;
        private bool _microphoneEnabled = true;
        private bool _speakerEnabled = true;
        private double _inputLevel = 0;
        private double _outputLevel = 0;

        private readonly List<byte> _audioBuffer = new();
        private DateTime _lastSoundTime = DateTime.MinValue;
        private bool _isSpeaking = false;

        public event EventHandler<byte[]>? OnAudioCaptured;

        public AudioService(ISettingsService settingsService)
        {
            _settingsService = settingsService;
        }

        public void StartCapture()
        {
            if (_isCapturing) return;

            try
            {
                var settings = _settingsService.Settings.Audio;

                _waveIn = new WaveInEvent
                {
                    WaveFormat = new WaveFormat(settings.SampleRate, 16, settings.Channels),
                    BufferMilliseconds = 100
                };

                _waveIn.DataAvailable += WaveIn_DataAvailable;
                _waveIn.RecordingStopped += WaveIn_RecordingStopped;

                _waveIn.StartRecording();
                _isCapturing = true;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error starting audio capture: {ex.Message}");
            }
        }

        public void StopCapture()
        {
            if (!_isCapturing) return;

            try
            {
                _waveIn?.StopRecording();
                _waveIn?.Dispose();
                _waveIn = null;
                _isCapturing = false;
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error stopping audio capture: {ex.Message}");
            }
        }

        private void WaveIn_DataAvailable(object? sender, WaveInEventArgs e)
        {
            if (!_microphoneEnabled) return;

            // Calculate input level
            var max = 0f;
            for (int i = 0; i < e.BytesRecorded; i += 2)
            {
                var sample = BitConverter.ToInt16(e.Buffer, i) / 32768f;
                max = Math.Max(max, Math.Abs(sample));
            }
            _inputLevel = max * 100;

            // Voice activity detection
            var settings = _settingsService.Settings.Audio;
            if (max > settings.SilenceThreshold)
            {
                _lastSoundTime = DateTime.Now;
                if (!_isSpeaking)
                {
                    _isSpeaking = true;
                    _audioBuffer.Clear();
                }
                _audioBuffer.AddRange(e.Buffer.Take(e.BytesRecorded));
            }
            else if (_isSpeaking)
            {
                // Continue buffering during brief silence
                _audioBuffer.AddRange(e.Buffer.Take(e.BytesRecorded));

                // Check if silence duration exceeded
                if ((DateTime.Now - _lastSoundTime).TotalMilliseconds > settings.SilenceDurationMs)
                {
                    _isSpeaking = false;
                    if (_audioBuffer.Count > 0)
                    {
                        // Send the complete audio chunk
                        OnAudioCaptured?.Invoke(this, _audioBuffer.ToArray());
                        _audioBuffer.Clear();
                    }
                }
            }
        }

        private void WaveIn_RecordingStopped(object? sender, StoppedEventArgs e)
        {
            if (e.Exception != null)
            {
                Console.WriteLine($"Recording stopped due to error: {e.Exception.Message}");
            }
        }

        public void PlayAudio(byte[] audioData)
        {
            if (!_speakerEnabled) return;

            try
            {
                // Stop any existing playback
                StopPlayback();

                // Create a memory stream from the audio data
                var ms = new System.IO.MemoryStream(audioData);
                var reader = new Mp3FileReader(ms);

                _waveOut = new WaveOutEvent();
                _bufferedWaveProvider = new BufferedWaveProvider(reader.WaveFormat)
                {
                    DiscardOnBufferOverflow = true
                };

                // Copy audio data to buffer
                var buffer = new byte[4096];
                int read;
                while ((read = reader.Read(buffer, 0, buffer.Length)) > 0)
                {
                    _bufferedWaveProvider.AddSamples(buffer, 0, read);
                }

                _waveOut.Init(_bufferedWaveProvider);
                _waveOut.PlaybackStopped += WaveOut_PlaybackStopped;
                _waveOut.Play();
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error playing audio: {ex.Message}");
            }
        }

        private void WaveOut_PlaybackStopped(object? sender, StoppedEventArgs e)
        {
            _outputLevel = 0;
        }

        public void StopPlayback()
        {
            try
            {
                if (_waveOut != null)
                {
                    _waveOut.Stop();
                    _waveOut.Dispose();
                    _waveOut = null;
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error stopping playback: {ex.Message}");
            }
        }

        public double GetInputLevel() => _inputLevel;

        public double GetOutputLevel()
        {
            // Estimate output level from playback state
            if (_waveOut?.PlaybackState == PlaybackState.Playing && _bufferedWaveProvider != null)
            {
                _outputLevel = Math.Max(0, _outputLevel - 2); // Decay
                if (_bufferedWaveProvider.BufferedBytes > 0)
                    _outputLevel = Math.Min(100, _outputLevel + 10); // Active playback
            }
            return _outputLevel;
        }

        public void SetMicrophoneEnabled(bool enabled)
        {
            _microphoneEnabled = enabled;
            if (!enabled)
            {
                _inputLevel = 0;
                _audioBuffer.Clear();
                _isSpeaking = false;
            }
        }

        public void SetSpeakerEnabled(bool enabled)
        {
            _speakerEnabled = enabled;
            if (!enabled)
            {
                StopPlayback();
                _outputLevel = 0;
            }
        }

        public void SetInputDevice(string deviceName)
        {
            // Implementation for device selection
            // Would require restarting capture with new device
        }

        public void SetOutputDevice(string deviceName)
        {
            // Implementation for device selection
        }

        public string[] GetInputDevices()
        {
            var devices = new List<string>();
            var enumerator = new MMDeviceEnumerator();
            foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Capture, DeviceState.Active))
            {
                devices.Add(device.FriendlyName);
            }
            return devices.ToArray();
        }

        public string[] GetOutputDevices()
        {
            var devices = new List<string>();
            var enumerator = new MMDeviceEnumerator();
            foreach (var device in enumerator.EnumerateAudioEndPoints(DataFlow.Render, DeviceState.Active))
            {
                devices.Add(device.FriendlyName);
            }
            return devices.ToArray();
        }

        public void Dispose()
        {
            StopCapture();
            StopPlayback();
        }
    }
}
