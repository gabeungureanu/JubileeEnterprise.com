using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel.ViewModels
{
    public partial class MainViewModel : ObservableObject
    {
        private readonly ISettingsService _settingsService;
        private readonly IApiService _apiService;

        [ObservableProperty]
        private string _currentView = "Dashboard";

        [ObservableProperty]
        private bool _isLoading;

        [ObservableProperty]
        private string _statusMessage = "Ready";

        [ObservableProperty]
        private ObservableCollection<Dashboard> _dashboards = new();

        [ObservableProperty]
        private Dashboard? _activeDashboard;

        [ObservableProperty]
        private ObservableCollection<ApiEndpoint> _apiEndpoints = new();

        public DashboardViewModel DashboardViewModel { get; }
        public ApiConfigViewModel ApiConfigViewModel { get; }
        public DataGridViewModel DataGridViewModel { get; }

        public MainViewModel()
        {
            _settingsService = App.ServiceProvider.GetRequiredService<ISettingsService>();
            _apiService = App.ServiceProvider.GetRequiredService<IApiService>();

            DashboardViewModel = App.ServiceProvider.GetRequiredService<DashboardViewModel>();
            ApiConfigViewModel = App.ServiceProvider.GetRequiredService<ApiConfigViewModel>();
            DataGridViewModel = App.ServiceProvider.GetRequiredService<DataGridViewModel>();

            _ = InitializeAsync();
        }

        private async Task InitializeAsync()
        {
            IsLoading = true;
            StatusMessage = "Loading settings...";

            try
            {
                await _settingsService.LoadAsync();

                foreach (var endpoint in _settingsService.Settings.ApiEndpoints)
                {
                    ApiEndpoints.Add(endpoint);
                }

                foreach (var dashboard in _settingsService.Settings.Dashboards)
                {
                    Dashboards.Add(dashboard);
                }

                if (Dashboards.Count == 0)
                {
                    var defaultDashboard = CreateDefaultDashboard();
                    Dashboards.Add(defaultDashboard);
                    _settingsService.AddDashboard(defaultDashboard);
                }

                ActiveDashboard = Dashboards.FirstOrDefault(d => d.Id == _settingsService.Settings.ActiveDashboardId)
                    ?? Dashboards.FirstOrDefault();

                StatusMessage = "Ready";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Error: {ex.Message}";
            }
            finally
            {
                IsLoading = false;
            }
        }

        private static Dashboard CreateDefaultDashboard()
        {
            return new Dashboard
            {
                Name = "My Dashboard",
                Columns = 4,
                Widgets = new List<DashboardWidget>
                {
                    new()
                    {
                        Title = "Sample KPI",
                        Type = WidgetType.KpiCard,
                        Row = 0,
                        Column = 0,
                        ColumnSpan = 1,
                        RowSpan = 1
                    },
                    new()
                    {
                        Title = "Sample Chart",
                        Type = WidgetType.LineChart,
                        Row = 0,
                        Column = 1,
                        ColumnSpan = 2,
                        RowSpan = 2
                    },
                    new()
                    {
                        Title = "Sample Gauge",
                        Type = WidgetType.Gauge,
                        Row = 0,
                        Column = 3,
                        ColumnSpan = 1,
                        RowSpan = 1
                    }
                }
            };
        }

        [RelayCommand]
        private void NavigateTo(string view)
        {
            CurrentView = view;
        }

        [RelayCommand]
        private async Task RefreshData()
        {
            IsLoading = true;
            StatusMessage = "Refreshing data...";

            try
            {
                foreach (var endpoint in ApiEndpoints.Where(e => e.IsEnabled))
                {
                    var response = await _apiService.FetchDataAsync(endpoint);
                    endpoint.LastFetched = DateTime.UtcNow;
                    endpoint.LastError = response.Error;
                }

                StatusMessage = $"Data refreshed at {DateTime.Now:HH:mm:ss}";
            }
            catch (Exception ex)
            {
                StatusMessage = $"Refresh error: {ex.Message}";
            }
            finally
            {
                IsLoading = false;
            }
        }

        [RelayCommand]
        private void AddDashboard()
        {
            var dashboard = new Dashboard
            {
                Name = $"Dashboard {Dashboards.Count + 1}"
            };

            Dashboards.Add(dashboard);
            _settingsService.AddDashboard(dashboard);
            ActiveDashboard = dashboard;
        }

        [RelayCommand]
        private void DeleteDashboard(Dashboard dashboard)
        {
            if (Dashboards.Count <= 1) return;

            Dashboards.Remove(dashboard);
            _settingsService.RemoveDashboard(dashboard.Id);

            if (ActiveDashboard?.Id == dashboard.Id)
            {
                ActiveDashboard = Dashboards.FirstOrDefault();
            }
        }

        partial void OnActiveDashboardChanged(Dashboard? value)
        {
            if (value != null)
            {
                _settingsService.Settings.ActiveDashboardId = value.Id;
                _ = _settingsService.SaveAsync();
            }
        }
    }
}
