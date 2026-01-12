using JubileeFlywheel.Models;
using JubileeFlywheel.Services;

namespace JubileeFlywheel.ViewModels
{
    public partial class ApiConfigViewModel : ObservableObject
    {
        private readonly ISettingsService _settingsService;
        private readonly IApiService _apiService;

        [ObservableProperty]
        private ObservableCollection<ApiEndpoint> _endpoints = new();

        [ObservableProperty]
        private ApiEndpoint? _selectedEndpoint;

        [ObservableProperty]
        private bool _isEditing;

        [ObservableProperty]
        private string _editName = string.Empty;

        [ObservableProperty]
        private string _editUrl = string.Empty;

        [ObservableProperty]
        private string _editMethod = "GET";

        [ObservableProperty]
        private int _editRefreshInterval = 30;

        [ObservableProperty]
        private string _editHeaders = string.Empty;

        [ObservableProperty]
        private string _editBody = string.Empty;

        [ObservableProperty]
        private string? _testResult;

        [ObservableProperty]
        private bool _isTesting;

        public string[] HttpMethods { get; } = { "GET", "POST", "PUT", "PATCH", "DELETE" };

        public ApiConfigViewModel(ISettingsService settingsService, IApiService apiService)
        {
            _settingsService = settingsService;
            _apiService = apiService;

            LoadEndpoints();
        }

        private void LoadEndpoints()
        {
            Endpoints.Clear();
            foreach (var endpoint in _settingsService.Settings.ApiEndpoints)
            {
                Endpoints.Add(endpoint);
            }
        }

        [RelayCommand]
        private void NewEndpoint()
        {
            SelectedEndpoint = null;
            EditName = string.Empty;
            EditUrl = string.Empty;
            EditMethod = "GET";
            EditRefreshInterval = 30;
            EditHeaders = string.Empty;
            EditBody = string.Empty;
            TestResult = null;
            IsEditing = true;
        }

        [RelayCommand]
        private void EditEndpoint(ApiEndpoint endpoint)
        {
            SelectedEndpoint = endpoint;
            EditName = endpoint.Name;
            EditUrl = endpoint.Url;
            EditMethod = endpoint.Method.Method;
            EditRefreshInterval = endpoint.RefreshIntervalSeconds;
            EditHeaders = string.Join("\n", endpoint.Headers.Select(h => $"{h.Key}: {h.Value}"));
            EditBody = endpoint.Body ?? string.Empty;
            TestResult = null;
            IsEditing = true;
        }

        [RelayCommand]
        private void SaveEndpoint()
        {
            if (string.IsNullOrWhiteSpace(EditName) || string.IsNullOrWhiteSpace(EditUrl))
            {
                TestResult = "Name and URL are required";
                return;
            }

            var headers = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(EditHeaders))
            {
                foreach (var line in EditHeaders.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                {
                    var parts = line.Split(':', 2);
                    if (parts.Length == 2)
                    {
                        headers[parts[0].Trim()] = parts[1].Trim();
                    }
                }
            }

            if (SelectedEndpoint != null)
            {
                SelectedEndpoint.Name = EditName;
                SelectedEndpoint.Url = EditUrl;
                SelectedEndpoint.Method = new HttpMethod(EditMethod);
                SelectedEndpoint.RefreshIntervalSeconds = EditRefreshInterval;
                SelectedEndpoint.Headers = headers;
                SelectedEndpoint.Body = string.IsNullOrWhiteSpace(EditBody) ? null : EditBody;

                _settingsService.UpdateApiEndpoint(SelectedEndpoint);
            }
            else
            {
                var newEndpoint = new ApiEndpoint
                {
                    Name = EditName,
                    Url = EditUrl,
                    Method = new HttpMethod(EditMethod),
                    RefreshIntervalSeconds = EditRefreshInterval,
                    Headers = headers,
                    Body = string.IsNullOrWhiteSpace(EditBody) ? null : EditBody
                };

                _settingsService.AddApiEndpoint(newEndpoint);
                Endpoints.Add(newEndpoint);
            }

            IsEditing = false;
            LoadEndpoints();
        }

        [RelayCommand]
        private void CancelEdit()
        {
            IsEditing = false;
            SelectedEndpoint = null;
            TestResult = null;
        }

        [RelayCommand]
        private void DeleteEndpoint(ApiEndpoint endpoint)
        {
            _settingsService.RemoveApiEndpoint(endpoint.Id);
            Endpoints.Remove(endpoint);

            if (SelectedEndpoint?.Id == endpoint.Id)
            {
                IsEditing = false;
                SelectedEndpoint = null;
            }
        }

        [RelayCommand]
        private async Task TestConnection()
        {
            if (string.IsNullOrWhiteSpace(EditUrl))
            {
                TestResult = "URL is required";
                return;
            }

            IsTesting = true;
            TestResult = "Testing connection...";

            try
            {
                var headers = new Dictionary<string, string>();
                if (!string.IsNullOrWhiteSpace(EditHeaders))
                {
                    foreach (var line in EditHeaders.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                    {
                        var parts = line.Split(':', 2);
                        if (parts.Length == 2)
                        {
                            headers[parts[0].Trim()] = parts[1].Trim();
                        }
                    }
                }

                var response = await _apiService.FetchDataAsync(
                    EditUrl,
                    new HttpMethod(EditMethod),
                    headers,
                    string.IsNullOrWhiteSpace(EditBody) ? null : EditBody
                );

                if (response.Success)
                {
                    TestResult = $"Success! Response time: {response.ResponseTimeMs}ms\nData length: {response.Data?.Length ?? 0} chars";
                }
                else
                {
                    TestResult = $"Failed: {response.Error}";
                }
            }
            catch (Exception ex)
            {
                TestResult = $"Error: {ex.Message}";
            }
            finally
            {
                IsTesting = false;
            }
        }

        [RelayCommand]
        private void ToggleEndpointEnabled(ApiEndpoint endpoint)
        {
            endpoint.IsEnabled = !endpoint.IsEnabled;
            _settingsService.UpdateApiEndpoint(endpoint);
        }
    }
}
