using System.Globalization;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Data;
using System.Windows.Media;
using JubileeFlywheel.Models;
using JubileeFlywheel.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel.Views
{
    public partial class ApiConfigView : UserControl
    {
        private readonly ApiConfigViewModel _viewModel;
        private ApiEndpoint? _selectedEndpoint;

        public ApiConfigView()
        {
            InitializeComponent();

            _viewModel = App.ServiceProvider.GetRequiredService<ApiConfigViewModel>();
            DataContext = _viewModel;

            Loaded += ApiConfigView_Loaded;
        }

        private void ApiConfigView_Loaded(object sender, RoutedEventArgs e)
        {
            EndpointsList.ItemsSource = _viewModel.Endpoints;
        }

        private void EndpointsList_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (EndpointsList.SelectedItem is ApiEndpoint endpoint)
            {
                _selectedEndpoint = endpoint;
                LoadEndpointToEditor(endpoint);
                ShowEditor();
            }
        }

        private void LoadEndpointToEditor(ApiEndpoint endpoint)
        {
            NameTextBox.Text = endpoint.Name;
            UrlTextBox.Text = endpoint.Url;

            for (int i = 0; i < MethodComboBox.Items.Count; i++)
            {
                if (MethodComboBox.Items[i] is ComboBoxItem item &&
                    item.Content?.ToString() == endpoint.Method.Method)
                {
                    MethodComboBox.SelectedIndex = i;
                    break;
                }
            }

            RefreshIntervalTextBox.Text = endpoint.RefreshIntervalSeconds.ToString();
            HeadersTextBox.Text = string.Join("\n", endpoint.Headers.Select(h => $"{h.Key}: {h.Value}"));
            BodyTextBox.Text = endpoint.Body ?? string.Empty;
            TestResultText.Text = string.Empty;
        }

        private void ClearEditor()
        {
            _selectedEndpoint = null;
            NameTextBox.Text = string.Empty;
            UrlTextBox.Text = string.Empty;
            MethodComboBox.SelectedIndex = 0;
            RefreshIntervalTextBox.Text = "30";
            HeadersTextBox.Text = string.Empty;
            BodyTextBox.Text = string.Empty;
            TestResultText.Text = string.Empty;
        }

        private void ShowEditor()
        {
            EditorPanel.Visibility = Visibility.Visible;
            EditorEmptyState.Visibility = Visibility.Collapsed;
        }

        private void HideEditor()
        {
            EditorPanel.Visibility = Visibility.Collapsed;
            EditorEmptyState.Visibility = Visibility.Visible;
        }

        private void AddEndpointButton_Click(object sender, RoutedEventArgs e)
        {
            ClearEditor();
            ShowEditor();
            EndpointsList.SelectedItem = null;
        }

        private void DeleteEndpointButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button button && button.Tag is ApiEndpoint endpoint)
            {
                var result = MessageBox.Show(
                    $"Delete endpoint '{endpoint.Name}'?",
                    "Confirm Delete",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Warning);

                if (result == MessageBoxResult.Yes)
                {
                    _viewModel.DeleteEndpointCommand.Execute(endpoint);

                    if (_selectedEndpoint?.Id == endpoint.Id)
                    {
                        ClearEditor();
                        HideEditor();
                    }
                }
            }
        }

        private async void TestConnectionButton_Click(object sender, RoutedEventArgs e)
        {
            _viewModel.EditUrl = UrlTextBox.Text;
            _viewModel.EditMethod = (MethodComboBox.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "GET";
            _viewModel.EditHeaders = HeadersTextBox.Text;
            _viewModel.EditBody = BodyTextBox.Text;

            TestResultText.Text = "Testing...";
            await _viewModel.TestConnectionCommand.ExecuteAsync(null);
            TestResultText.Text = _viewModel.TestResult ?? string.Empty;
        }

        private void SaveButton_Click(object sender, RoutedEventArgs e)
        {
            if (string.IsNullOrWhiteSpace(NameTextBox.Text))
            {
                TestResultText.Text = "Name is required";
                return;
            }

            if (string.IsNullOrWhiteSpace(UrlTextBox.Text))
            {
                TestResultText.Text = "URL is required";
                return;
            }

            if (!int.TryParse(RefreshIntervalTextBox.Text, out var interval) || interval < 1)
            {
                TestResultText.Text = "Refresh interval must be a positive number";
                return;
            }

            var headers = new Dictionary<string, string>();
            if (!string.IsNullOrWhiteSpace(HeadersTextBox.Text))
            {
                foreach (var line in HeadersTextBox.Text.Split('\n', StringSplitOptions.RemoveEmptyEntries))
                {
                    var parts = line.Split(':', 2);
                    if (parts.Length == 2)
                    {
                        headers[parts[0].Trim()] = parts[1].Trim();
                    }
                }
            }

            var method = (MethodComboBox.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "GET";

            if (_selectedEndpoint != null)
            {
                _selectedEndpoint.Name = NameTextBox.Text;
                _selectedEndpoint.Url = UrlTextBox.Text;
                _selectedEndpoint.Method = new HttpMethod(method);
                _selectedEndpoint.RefreshIntervalSeconds = interval;
                _selectedEndpoint.Headers = headers;
                _selectedEndpoint.Body = string.IsNullOrWhiteSpace(BodyTextBox.Text) ? null : BodyTextBox.Text;

                _viewModel.SelectedEndpoint = _selectedEndpoint;
                _viewModel.SaveEndpointCommand.Execute(null);
            }
            else
            {
                var newEndpoint = new ApiEndpoint
                {
                    Name = NameTextBox.Text,
                    Url = UrlTextBox.Text,
                    Method = new HttpMethod(method),
                    RefreshIntervalSeconds = interval,
                    Headers = headers,
                    Body = string.IsNullOrWhiteSpace(BodyTextBox.Text) ? null : BodyTextBox.Text
                };

                _viewModel.EditName = newEndpoint.Name;
                _viewModel.EditUrl = newEndpoint.Url;
                _viewModel.EditMethod = method;
                _viewModel.EditRefreshInterval = interval;
                _viewModel.EditHeaders = HeadersTextBox.Text;
                _viewModel.EditBody = BodyTextBox.Text;
                _viewModel.SelectedEndpoint = null;
                _viewModel.SaveEndpointCommand.Execute(null);
            }

            EndpointsList.ItemsSource = null;
            EndpointsList.ItemsSource = _viewModel.Endpoints;

            ClearEditor();
            HideEditor();
        }

        private void CancelButton_Click(object sender, RoutedEventArgs e)
        {
            ClearEditor();
            HideEditor();
            EndpointsList.SelectedItem = null;
        }
    }

    public class BoolToColorConverter : IValueConverter
    {
        public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
        {
            if (value is bool isEnabled)
            {
                return isEnabled
                    ? new SolidColorBrush(Color.FromRgb(76, 175, 80))
                    : new SolidColorBrush(Color.FromRgb(244, 67, 54));
            }
            return new SolidColorBrush(Colors.Gray);
        }

        public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
        {
            throw new NotImplementedException();
        }
    }
}
