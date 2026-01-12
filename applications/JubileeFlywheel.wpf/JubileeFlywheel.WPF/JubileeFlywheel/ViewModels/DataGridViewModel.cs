using System.Data;
using System.IO;
using System.Text;
using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using Newtonsoft.Json;
using Newtonsoft.Json.Linq;

namespace JubileeFlywheel.ViewModels
{
    public partial class DataGridViewModel : ObservableObject
    {
        private readonly IApiService _apiService;
        private readonly ISettingsService _settingsService;

        [ObservableProperty]
        private DataTable _dataTable = new();

        [ObservableProperty]
        private ObservableCollection<ApiEndpoint> _availableEndpoints = new();

        [ObservableProperty]
        private ApiEndpoint? _selectedEndpoint;

        [ObservableProperty]
        private string _filterText = string.Empty;

        [ObservableProperty]
        private bool _isLoading;

        [ObservableProperty]
        private string? _errorMessage;

        [ObservableProperty]
        private int _totalRows;

        [ObservableProperty]
        private int _filteredRows;

        [ObservableProperty]
        private string _dataPath = string.Empty;

        private DataTable _originalData = new();

        public DataGridViewModel(IApiService apiService, ISettingsService settingsService)
        {
            _apiService = apiService;
            _settingsService = settingsService;

            LoadEndpoints();
        }

        private void LoadEndpoints()
        {
            AvailableEndpoints.Clear();
            foreach (var endpoint in _settingsService.Settings.ApiEndpoints)
            {
                AvailableEndpoints.Add(endpoint);
            }
        }

        [RelayCommand]
        private async Task FetchData()
        {
            if (SelectedEndpoint == null)
            {
                ErrorMessage = "Please select an API endpoint";
                return;
            }

            IsLoading = true;
            ErrorMessage = null;

            try
            {
                var response = await _apiService.FetchDataAsync(SelectedEndpoint);

                if (response.Success && !string.IsNullOrEmpty(response.Data))
                {
                    ParseJsonToDataTable(response.Data);
                }
                else
                {
                    ErrorMessage = response.Error ?? "No data received";
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = ex.Message;
            }
            finally
            {
                IsLoading = false;
            }
        }

        private void ParseJsonToDataTable(string json)
        {
            try
            {
                var token = JToken.Parse(json);

                if (!string.IsNullOrWhiteSpace(DataPath))
                {
                    token = token.SelectToken(DataPath) ?? token;
                }

                JArray array;

                if (token is JArray jArray)
                {
                    array = jArray;
                }
                else if (token is JObject jObj)
                {
                    var arrayProp = jObj.Properties()
                        .FirstOrDefault(p => p.Value is JArray);

                    if (arrayProp != null)
                    {
                        array = (JArray)arrayProp.Value;
                    }
                    else
                    {
                        array = new JArray { jObj };
                    }
                }
                else
                {
                    ErrorMessage = "JSON must be an array or object";
                    return;
                }

                var dt = new DataTable();

                if (array.Count > 0 && array[0] is JObject firstObj)
                {
                    foreach (var prop in firstObj.Properties())
                    {
                        dt.Columns.Add(prop.Name, typeof(string));
                    }
                }

                foreach (var item in array)
                {
                    if (item is JObject obj)
                    {
                        var row = dt.NewRow();
                        foreach (DataColumn col in dt.Columns)
                        {
                            var value = obj[col.ColumnName];
                            row[col.ColumnName] = value?.ToString() ?? string.Empty;
                        }
                        dt.Rows.Add(row);
                    }
                }

                _originalData = dt;
                DataTable = dt;
                TotalRows = dt.Rows.Count;
                FilteredRows = TotalRows;
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Failed to parse JSON: {ex.Message}";
            }
        }

        partial void OnFilterTextChanged(string value)
        {
            ApplyFilter();
        }

        private void ApplyFilter()
        {
            if (_originalData.Rows.Count == 0)
            {
                FilteredRows = 0;
                return;
            }

            if (string.IsNullOrWhiteSpace(FilterText))
            {
                DataTable = _originalData;
                FilteredRows = TotalRows;
                return;
            }

            var filtered = _originalData.Clone();
            var searchLower = FilterText.ToLowerInvariant();

            foreach (DataRow row in _originalData.Rows)
            {
                foreach (var item in row.ItemArray)
                {
                    if (item?.ToString()?.ToLowerInvariant().Contains(searchLower) == true)
                    {
                        filtered.ImportRow(row);
                        break;
                    }
                }
            }

            DataTable = filtered;
            FilteredRows = filtered.Rows.Count;
        }

        [RelayCommand]
        private async Task ExportToCsv()
        {
            if (DataTable.Rows.Count == 0)
            {
                ErrorMessage = "No data to export";
                return;
            }

            try
            {
                var dialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "CSV files (*.csv)|*.csv|All files (*.*)|*.*",
                    DefaultExt = ".csv",
                    FileName = $"export_{DateTime.Now:yyyyMMdd_HHmmss}.csv"
                };

                if (dialog.ShowDialog() == true)
                {
                    var sb = new StringBuilder();

                    var headers = DataTable.Columns.Cast<DataColumn>().Select(c => c.ColumnName);
                    sb.AppendLine(string.Join(",", headers.Select(h => $"\"{h}\"")));

                    foreach (DataRow row in DataTable.Rows)
                    {
                        var values = row.ItemArray.Select(v => $"\"{v?.ToString()?.Replace("\"", "\"\"")}\"");
                        sb.AppendLine(string.Join(",", values));
                    }

                    await File.WriteAllTextAsync(dialog.FileName, sb.ToString());
                    ErrorMessage = null;
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Export failed: {ex.Message}";
            }
        }

        [RelayCommand]
        private async Task ExportToJson()
        {
            if (DataTable.Rows.Count == 0)
            {
                ErrorMessage = "No data to export";
                return;
            }

            try
            {
                var dialog = new Microsoft.Win32.SaveFileDialog
                {
                    Filter = "JSON files (*.json)|*.json|All files (*.*)|*.*",
                    DefaultExt = ".json",
                    FileName = $"export_{DateTime.Now:yyyyMMdd_HHmmss}.json"
                };

                if (dialog.ShowDialog() == true)
                {
                    var data = new List<Dictionary<string, object?>>();

                    foreach (DataRow row in DataTable.Rows)
                    {
                        var dict = new Dictionary<string, object?>();
                        foreach (DataColumn col in DataTable.Columns)
                        {
                            dict[col.ColumnName] = row[col];
                        }
                        data.Add(dict);
                    }

                    var json = JsonConvert.SerializeObject(data, Formatting.Indented);
                    await File.WriteAllTextAsync(dialog.FileName, json);
                    ErrorMessage = null;
                }
            }
            catch (Exception ex)
            {
                ErrorMessage = $"Export failed: {ex.Message}";
            }
        }

        [RelayCommand]
        private void ClearData()
        {
            DataTable = new DataTable();
            _originalData = new DataTable();
            TotalRows = 0;
            FilteredRows = 0;
            FilterText = string.Empty;
            ErrorMessage = null;
        }

        [RelayCommand]
        private void RefreshEndpoints()
        {
            LoadEndpoints();
        }
    }
}
