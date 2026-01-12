using System.Windows;
using System.Windows.Controls;
using JubileeFlywheel.Models;
using JubileeFlywheel.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel.Views
{
    public partial class DataGridView : UserControl
    {
        private readonly DataGridViewModel _viewModel;

        public DataGridView()
        {
            InitializeComponent();

            _viewModel = App.ServiceProvider.GetRequiredService<DataGridViewModel>();
            DataContext = _viewModel;

            Loaded += DataGridView_Loaded;

            _viewModel.PropertyChanged += ViewModel_PropertyChanged;
        }

        private void DataGridView_Loaded(object sender, RoutedEventArgs e)
        {
            _viewModel.RefreshEndpointsCommand.Execute(null);
            EndpointComboBox.ItemsSource = _viewModel.AvailableEndpoints;
        }

        private void ViewModel_PropertyChanged(object? sender, System.ComponentModel.PropertyChangedEventArgs e)
        {
            switch (e.PropertyName)
            {
                case nameof(_viewModel.DataTable):
                    MainDataGrid.ItemsSource = _viewModel.DataTable.DefaultView;
                    UpdateEmptyState();
                    break;
                case nameof(_viewModel.IsLoading):
                    LoadingOverlay.Visibility = _viewModel.IsLoading
                        ? Visibility.Visible
                        : Visibility.Collapsed;
                    break;
                case nameof(_viewModel.ErrorMessage):
                    ErrorText.Text = _viewModel.ErrorMessage ?? string.Empty;
                    break;
                case nameof(_viewModel.FilteredRows):
                case nameof(_viewModel.TotalRows):
                    UpdateRowCount();
                    break;
            }
        }

        private void EndpointComboBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (EndpointComboBox.SelectedItem is ApiEndpoint endpoint)
            {
                _viewModel.SelectedEndpoint = endpoint;
            }
        }

        private async void FetchDataButton_Click(object sender, RoutedEventArgs e)
        {
            _viewModel.DataPath = DataPathTextBox.Text;
            await _viewModel.FetchDataCommand.ExecuteAsync(null);
        }

        private void FilterTextBox_TextChanged(object sender, TextChangedEventArgs e)
        {
            _viewModel.FilterText = FilterTextBox.Text;
        }

        private async void ExportCsvButton_Click(object sender, RoutedEventArgs e)
        {
            await _viewModel.ExportToCsvCommand.ExecuteAsync(null);
        }

        private async void ExportJsonButton_Click(object sender, RoutedEventArgs e)
        {
            await _viewModel.ExportToJsonCommand.ExecuteAsync(null);
        }

        private void UpdateEmptyState()
        {
            EmptyState.Visibility = _viewModel.DataTable.Rows.Count == 0
                ? Visibility.Visible
                : Visibility.Collapsed;
        }

        private void UpdateRowCount()
        {
            if (_viewModel.TotalRows == 0)
            {
                RowCountText.Text = string.Empty;
            }
            else if (_viewModel.FilteredRows == _viewModel.TotalRows)
            {
                RowCountText.Text = $"{_viewModel.TotalRows:N0} rows";
            }
            else
            {
                RowCountText.Text = $"{_viewModel.FilteredRows:N0} of {_viewModel.TotalRows:N0} rows";
            }
        }
    }
}
