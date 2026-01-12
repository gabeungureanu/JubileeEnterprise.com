using System.Net.Http;
using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public interface IApiService
    {
        Task<ApiResponse> FetchDataAsync(ApiEndpoint endpoint);
        Task<ApiResponse> FetchDataAsync(string url, HttpMethod method, Dictionary<string, string>? headers = null, string? body = null);
        void StartAutoRefresh(ApiEndpoint endpoint, Action<ApiResponse> onDataReceived);
        void StopAutoRefresh(string endpointId);
        void StopAllAutoRefresh();
    }
}
