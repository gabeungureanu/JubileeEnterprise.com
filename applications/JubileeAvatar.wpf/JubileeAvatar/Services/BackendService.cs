using System;
using System.Net.Http;
using System.Net.WebSockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Newtonsoft.Json;
using JubileeAvatar.Models;

namespace JubileeAvatar.Services
{
    public class BackendService : IBackendService, IDisposable
    {
        private readonly HttpClient _httpClient;
        private readonly ISettingsService _settingsService;
        private readonly IAudioService _audioService;
        private ClientWebSocket? _webSocket;
        private CancellationTokenSource? _cancellationTokenSource;
        private bool _isConnected = false;

        public event EventHandler<TranscriptionEventArgs>? OnTranscriptionReceived;
        public event EventHandler<AIResponseEventArgs>? OnAIResponseReceived;
        public event EventHandler<TTSAudioEventArgs>? OnTTSAudioReady;
        public event EventHandler<AvatarFrameEventArgs>? OnAvatarFrameReady;
        public event EventHandler<PipelineStatusEventArgs>? OnPipelineStatusChanged;
        public event EventHandler<LatencyUpdateEventArgs>? OnLatencyUpdate;
        public event EventHandler<string>? OnDebugLog;

        public bool IsConnected => _isConnected;

        public BackendService(IHttpClientFactory httpClientFactory, ISettingsService settingsService, IAudioService audioService)
        {
            _httpClient = httpClientFactory.CreateClient();
            _settingsService = settingsService;
            _audioService = audioService;

            // Subscribe to audio events
            _audioService.OnAudioCaptured += OnAudioCaptured;
        }

        public async Task<bool> StartSessionAsync()
        {
            try
            {
                var settings = _settingsService.Settings.Backend;
                _httpClient.BaseAddress = new Uri(settings.Url);

                // Check backend health
                if (!await CheckHealthAsync())
                {
                    Log("Backend health check failed");
                    return false;
                }

                // Connect WebSocket for real-time communication
                if (settings.UseWebSocket)
                {
                    await ConnectWebSocketAsync();
                }

                // Start session on backend
                var response = await _httpClient.PostAsync("/api/session/start",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                if (response.IsSuccessStatusCode)
                {
                    _isConnected = true;
                    Log("Session started successfully");
                    RaisePipelineStatus(PipelineStage.Listening, "Listening for audio input");
                    return true;
                }

                Log($"Failed to start session: {response.StatusCode}");
                return false;
            }
            catch (Exception ex)
            {
                Log($"Error starting session: {ex.Message}");
                return false;
            }
        }

        public async Task StopSessionAsync()
        {
            try
            {
                _isConnected = false;

                // Stop WebSocket
                if (_webSocket != null && _webSocket.State == WebSocketState.Open)
                {
                    await _webSocket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Session ended", CancellationToken.None);
                }

                _cancellationTokenSource?.Cancel();

                // Notify backend
                await _httpClient.PostAsync("/api/session/stop",
                    new StringContent("{}", Encoding.UTF8, "application/json"));

                RaisePipelineStatus(PipelineStage.Idle, "Session stopped");
                Log("Session stopped");
            }
            catch (Exception ex)
            {
                Log($"Error stopping session: {ex.Message}");
            }
        }

        private async Task ConnectWebSocketAsync()
        {
            try
            {
                var settings = _settingsService.Settings.Backend;
                var wsUrl = settings.Url.Replace("http://", "ws://").Replace("https://", "wss://");

                _webSocket = new ClientWebSocket();
                _cancellationTokenSource = new CancellationTokenSource();

                await _webSocket.ConnectAsync(new Uri($"{wsUrl}/ws"), _cancellationTokenSource.Token);
                Log("WebSocket connected");

                // Start receiving messages
                _ = ReceiveWebSocketMessagesAsync();
            }
            catch (Exception ex)
            {
                Log($"WebSocket connection error: {ex.Message}");
                // Fall back to HTTP polling
            }
        }

        private async Task ReceiveWebSocketMessagesAsync()
        {
            var buffer = new byte[8192];

            while (_webSocket?.State == WebSocketState.Open && !_cancellationTokenSource!.Token.IsCancellationRequested)
            {
                try
                {
                    var result = await _webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), _cancellationTokenSource.Token);

                    if (result.MessageType == WebSocketMessageType.Text)
                    {
                        var message = Encoding.UTF8.GetString(buffer, 0, result.Count);
                        ProcessWebSocketMessage(message);
                    }
                    else if (result.MessageType == WebSocketMessageType.Binary)
                    {
                        // Handle binary audio/video data
                        var data = new byte[result.Count];
                        Array.Copy(buffer, data, result.Count);
                        ProcessBinaryMessage(data);
                    }
                    else if (result.MessageType == WebSocketMessageType.Close)
                    {
                        Log("WebSocket closed by server");
                        break;
                    }
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    Log($"WebSocket receive error: {ex.Message}");
                }
            }
        }

        private void ProcessWebSocketMessage(string message)
        {
            try
            {
                var data = JsonConvert.DeserializeObject<dynamic>(message);
                string type = data?.type;

                switch (type)
                {
                    case "transcription":
                        OnTranscriptionReceived?.Invoke(this, new TranscriptionEventArgs
                        {
                            Text = data?.text ?? "",
                            Confidence = data?.confidence ?? 0,
                            Duration = data?.duration ?? 0
                        });
                        break;

                    case "ai_response":
                        OnAIResponseReceived?.Invoke(this, new AIResponseEventArgs
                        {
                            Response = data?.response ?? "",
                            TokensUsed = data?.tokens ?? 0,
                            ProcessingTime = data?.processing_time ?? 0
                        });
                        break;

                    case "tts_ready":
                        // Audio data will come as binary message
                        break;

                    case "avatar_frame":
                        // Frame data will come as binary message
                        break;

                    case "pipeline_status":
                        var stage = Enum.Parse<PipelineStage>(data?.stage ?? "Idle");
                        RaisePipelineStatus(stage, data?.message ?? "");
                        break;

                    case "latency":
                        OnLatencyUpdate?.Invoke(this, new LatencyUpdateEventArgs
                        {
                            STTLatency = data?.stt ?? 0,
                            AILatency = data?.ai ?? 0,
                            TTSLatency = data?.tts ?? 0,
                            AvatarLatency = data?.avatar ?? 0
                        });
                        break;

                    case "debug":
                        Log(data?.message ?? "");
                        break;
                }
            }
            catch (Exception ex)
            {
                Log($"Error processing message: {ex.Message}");
            }
        }

        private void ProcessBinaryMessage(byte[] data)
        {
            // First byte indicates message type
            if (data.Length < 1) return;

            var messageType = data[0];
            var payload = new byte[data.Length - 1];
            Array.Copy(data, 1, payload, 0, payload.Length);

            switch (messageType)
            {
                case 0x01: // TTS Audio
                    OnTTSAudioReady?.Invoke(this, new TTSAudioEventArgs
                    {
                        AudioData = payload,
                        Format = "mp3"
                    });
                    break;

                case 0x02: // Avatar Frame
                    // Convert to BitmapSource if needed
                    OnAvatarFrameReady?.Invoke(this, new AvatarFrameEventArgs
                    {
                        // Frame conversion would go here
                    });
                    break;
            }
        }

        public async Task SendAudioAsync(byte[] audioData)
        {
            if (!_isConnected) return;

            try
            {
                RaisePipelineStatus(PipelineStage.Transcribing, "Processing speech...");

                if (_webSocket?.State == WebSocketState.Open)
                {
                    // Send via WebSocket for lower latency
                    var message = new byte[audioData.Length + 1];
                    message[0] = 0x00; // Audio data type
                    Array.Copy(audioData, 0, message, 1, audioData.Length);

                    await _webSocket.SendAsync(new ArraySegment<byte>(message),
                        WebSocketMessageType.Binary, true, CancellationToken.None);
                }
                else
                {
                    // Fall back to HTTP
                    var content = new ByteArrayContent(audioData);
                    content.Headers.ContentType = new System.Net.Http.Headers.MediaTypeHeaderValue("audio/wav");
                    await _httpClient.PostAsync("/api/audio/process", content);
                }

                Log($"Sent {audioData.Length} bytes of audio");
            }
            catch (Exception ex)
            {
                Log($"Error sending audio: {ex.Message}");
            }
        }

        private async void OnAudioCaptured(object? sender, byte[] audioData)
        {
            await SendAudioAsync(audioData);
        }

        public async Task<bool> CheckHealthAsync()
        {
            try
            {
                var settings = _settingsService.Settings.Backend;
                _httpClient.BaseAddress = new Uri(settings.Url);
                _httpClient.Timeout = TimeSpan.FromSeconds(5);

                var response = await _httpClient.GetAsync("/health");
                return response.IsSuccessStatusCode;
            }
            catch
            {
                return false;
            }
        }

        private void RaisePipelineStatus(PipelineStage stage, string message)
        {
            OnPipelineStatusChanged?.Invoke(this, new PipelineStatusEventArgs
            {
                Stage = stage,
                Message = message
            });
        }

        private void Log(string message)
        {
            OnDebugLog?.Invoke(this, message);
        }

        public void Dispose()
        {
            _cancellationTokenSource?.Cancel();
            _webSocket?.Dispose();
            _httpClient.Dispose();
        }
    }
}
