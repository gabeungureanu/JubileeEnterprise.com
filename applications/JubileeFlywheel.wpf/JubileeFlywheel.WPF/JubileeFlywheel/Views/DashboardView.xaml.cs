using System.Windows;
using System.Windows.Controls;
using JubileeFlywheel.Models;
using JubileeFlywheel.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel.Views
{
    public partial class DashboardView : UserControl
    {
        private readonly MainViewModel _mainViewModel;
        private readonly DashboardViewModel _dashboardViewModel;

        public DashboardView()
        {
            InitializeComponent();

            _mainViewModel = App.ServiceProvider.GetRequiredService<MainViewModel>();
            _dashboardViewModel = _mainViewModel.DashboardViewModel;

            DataContext = _dashboardViewModel;

            Loaded += DashboardView_Loaded;
        }

        private void DashboardView_Loaded(object sender, RoutedEventArgs e)
        {
            LoadDashboards();
        }

        private void LoadDashboards()
        {
            DashboardSelector.ItemsSource = _mainViewModel.Dashboards;
            DashboardSelector.DisplayMemberPath = "Name";
            DashboardSelector.SelectedItem = _mainViewModel.ActiveDashboard;

            if (_mainViewModel.ActiveDashboard != null)
            {
                _dashboardViewModel.LoadDashboard(_mainViewModel.ActiveDashboard);
                WidgetsContainer.ItemsSource = _dashboardViewModel.Widgets;
                UpdateEmptyState();
            }
        }

        private void DashboardSelector_SelectionChanged(object sender, SelectionChangedEventArgs e)
        {
            if (DashboardSelector.SelectedItem is Dashboard dashboard)
            {
                _mainViewModel.ActiveDashboard = dashboard;
                _dashboardViewModel.LoadDashboard(dashboard);
                DashboardTitle.Text = dashboard.Name;
                WidgetsContainer.ItemsSource = _dashboardViewModel.Widgets;
                UpdateEmptyState();
            }
        }

        private void EditLayoutButton_Click(object sender, RoutedEventArgs e)
        {
            _dashboardViewModel.ToggleEditModeCommand.Execute(null);

            if (_dashboardViewModel.IsEditMode)
            {
                EditLayoutButton.Content = "Save Layout";
            }
            else
            {
                EditLayoutButton.Content = "Edit Layout";
            }
        }

        private void NewDashboardButton_Click(object sender, RoutedEventArgs e)
        {
            _mainViewModel.AddDashboardCommand.Execute(null);
            LoadDashboards();
            DashboardSelector.SelectedItem = _mainViewModel.ActiveDashboard;
        }

        private void RemoveWidgetButton_Click(object sender, RoutedEventArgs e)
        {
            if (sender is Button button && button.Tag is WidgetViewModel widgetVm)
            {
                var result = MessageBox.Show(
                    $"Remove widget '{widgetVm.Title}'?",
                    "Confirm Remove",
                    MessageBoxButton.YesNo,
                    MessageBoxImage.Question);

                if (result == MessageBoxResult.Yes)
                {
                    _dashboardViewModel.RemoveWidgetCommand.Execute(widgetVm);
                    UpdateEmptyState();
                }
            }
        }

        private void UpdateEmptyState()
        {
            EmptyState.Visibility = _dashboardViewModel.Widgets.Count == 0
                ? Visibility.Visible
                : Visibility.Collapsed;
        }

        private void CollapseWidgetsButton_Click(object sender, RoutedEventArgs e)
        {
            WidgetsPanel.Height = 0;
            ExpandWidgetsButton.Visibility = Visibility.Visible;
        }

        private void ExpandWidgetsButton_Click(object sender, RoutedEventArgs e)
        {
            WidgetsPanel.Height = 250;
            ExpandWidgetsButton.Visibility = Visibility.Collapsed;
        }

        public void LoadSymbol(string symbol)
        {
            MainStockChart.Symbol = symbol;
            MainStockChart.InvalidateChart();
        }
    }
}
