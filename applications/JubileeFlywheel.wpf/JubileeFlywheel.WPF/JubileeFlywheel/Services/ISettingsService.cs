using JubileeFlywheel.Models;

namespace JubileeFlywheel.Services
{
    public interface ISettingsService
    {
        AppSettings Settings { get; }
        Task LoadAsync();
        Task SaveAsync();
        void AddApiEndpoint(ApiEndpoint endpoint);
        void UpdateApiEndpoint(ApiEndpoint endpoint);
        void RemoveApiEndpoint(string endpointId);
        void AddDashboard(Dashboard dashboard);
        void UpdateDashboard(Dashboard dashboard);
        void RemoveDashboard(string dashboardId);
    }
}
