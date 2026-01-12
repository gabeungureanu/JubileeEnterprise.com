using System.Diagnostics;
using System.Net.Http;
using System.Text;
using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public class ApiService : IApiService, IDisposable
    {
        private readonly IHttpClientFactory _httpClientFactory;
        private readonly Dictionary<string, CancellationTokenSource> _activeRefreshTasks = new();
        private bool _disposed;

        public ApiService(IHttpClientFactory httpClientFactory)
        {
            _httpClientFactory = httpClientFactory;
        }

        public async Task<ApiResponse> FetchDataAsync(ApiEndpoint endpoint)
        {
            return await FetchDataAsync(endpoint.Url, endpoint.Method, endpoint.Headers, endpoint.Body);
        }

        public async Task<ApiResponse> FetchDataAsync(string url, HttpMethod method, Dictionary<string, string>? headers = null, string? body = null)
        {
            var stopwatch = Stopwatch.StartNew();
            var response = new ApiResponse();

            try
            {
                var client = _httpClientFactory.CreateClient();
                client.Timeout = TimeSpan.FromSeconds(30);

                var request = new HttpRequestMessage(method, url);

                if (headers != null)
                {
                    foreach (var header in headers)
                    {
                        request.Headers.TryAddWithoutValidation(header.Key, header.Value);
                    }
                }

                if (!string.IsNullOrEmpty(body) && (method == HttpMethod.Post || method == HttpMethod.Put || method == HttpMethod.Patch))
                {
                    request.Content = new StringContent(body, Encoding.UTF8, "application/json");
                }

                var httpResponse = await client.SendAsync(request);
                stopwatch.Stop();

                response.ResponseTimeMs = stopwatch.ElapsedMilliseconds;
                response.Data = await httpResponse.Content.ReadAsStringAsync();
                response.Success = httpResponse.IsSuccessStatusCode;

                if (!response.Success)
                {
                    response.Error = $"HTTP {(int)httpResponse.StatusCode}: {httpResponse.ReasonPhrase}";
                }
            }
            catch (TaskCanceledException)
            {
                stopwatch.Stop();
                response.ResponseTimeMs = stopwatch.ElapsedMilliseconds;
                response.Success = false;
                response.Error = "Request timed out";
            }
            catch (HttpRequestException ex)
            {
                stopwatch.Stop();
                response.ResponseTimeMs = stopwatch.ElapsedMilliseconds;
                response.Success = false;
                response.Error = $"Network error: {ex.Message}";
            }
            catch (Exception ex)
            {
                stopwatch.Stop();
                response.ResponseTimeMs = stopwatch.ElapsedMilliseconds;
                response.Success = false;
                response.Error = $"Error: {ex.Message}";
            }

            return response;
        }

        public void StartAutoRefresh(ApiEndpoint endpoint, Action<ApiResponse> onDataReceived)
        {
            StopAutoRefresh(endpoint.Id);

            var cts = new CancellationTokenSource();
            _activeRefreshTasks[endpoint.Id] = cts;

            _ = RunAutoRefreshAsync(endpoint, onDataReceived, cts.Token);
        }

        private async Task RunAutoRefreshAsync(ApiEndpoint endpoint, Action<ApiResponse> onDataReceived, CancellationToken cancellationToken)
        {
            while (!cancellationToken.IsCancellationRequested)
            {
                try
                {
                    var response = await FetchDataAsync(endpoint);
                    endpoint.LastFetched = DateTime.UtcNow;
                    endpoint.LastError = response.Error;

                    if (!cancellationToken.IsCancellationRequested)
                    {
                        Application.Current?.Dispatcher.Invoke(() => onDataReceived(response));
                    }

                    await Task.Delay(TimeSpan.FromSeconds(endpoint.RefreshIntervalSeconds), cancellationToken);
                }
                catch (OperationCanceledException)
                {
                    break;
                }
                catch (Exception ex)
                {
                    endpoint.LastError = ex.Message;
                    await Task.Delay(TimeSpan.FromSeconds(5), cancellationToken);
                }
            }
        }

        public void StopAutoRefresh(string endpointId)
        {
            if (_activeRefreshTasks.TryGetValue(endpointId, out var cts))
            {
                cts.Cancel();
                cts.Dispose();
                _activeRefreshTasks.Remove(endpointId);
            }
        }

        public void StopAllAutoRefresh()
        {
            foreach (var cts in _activeRefreshTasks.Values)
            {
                cts.Cancel();
                cts.Dispose();
            }
            _activeRefreshTasks.Clear();
        }

        public void Dispose()
        {
            if (!_disposed)
            {
                StopAllAutoRefresh();
                _disposed = true;
            }
            GC.SuppressFinalize(this);
        }
    }
}
