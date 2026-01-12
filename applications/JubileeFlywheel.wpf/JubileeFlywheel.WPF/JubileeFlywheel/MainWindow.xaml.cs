using System.Windows;
using System.Windows.Controls;
using System.Windows.Threading;
using JubileeFlywheel.ViewModels;
using Microsoft.Extensions.DependencyInjection;

namespace JubileeFlywheel
{
    public partial class MainWindow : Window
    {
        private readonly MainViewModel _viewModel;
        private readonly DispatcherTimer _clockTimer;

        public MainWindow()
        {
            InitializeComponent();

            _viewModel = App.ServiceProvider.GetRequiredService<MainViewModel>();
            DataContext = _viewModel;

            _clockTimer = new DispatcherTimer
            {
                Interval = TimeSpan.FromSeconds(1)
            };
            _clockTimer.Tick += ClockTimer_Tick;
            _clockTimer.Start();

            UpdateClock();
        }

        private void ClockTimer_Tick(object? sender, EventArgs e)
        {
            UpdateClock();
        }

        private void UpdateClock()
        {
            ClockText.Text = DateTime.Now.ToString("HH:mm:ss");
        }

        private void NavTab_Checked(object sender, RoutedEventArgs e)
        {
            if (sender is RadioButton tab)
            {
                DashboardViewControl.Visibility = Visibility.Collapsed;
                DataGridViewControl.Visibility = Visibility.Collapsed;
                ApiConfigViewControl.Visibility = Visibility.Collapsed;
                SettingsViewControl.Visibility = Visibility.Collapsed;

                switch (tab.Name)
                {
                    case "DashboardTab":
                        DashboardViewControl.Visibility = Visibility.Visible;
                        break;
                    case "DataGridTab":
                        DataGridViewControl.Visibility = Visibility.Visible;
                        break;
                    case "ApiConfigTab":
                        ApiConfigViewControl.Visibility = Visibility.Visible;
                        break;
                    case "SettingsTab":
                        SettingsViewControl.Visibility = Visibility.Visible;
                        break;
                }
            }
        }

        private async void RefreshButton_Click(object sender, RoutedEventArgs e)
        {
            StatusText.Text = "Refreshing data...";
            await _viewModel.RefreshDataCommand.ExecuteAsync(null);
            StatusText.Text = _viewModel.StatusMessage;
        }

        private void AddWidgetButton_Click(object sender, RoutedEventArgs e)
        {
            var menu = new ContextMenu
            {
                Style = (Style)FindResource(typeof(ContextMenu))
            };

            var widgetTypes = new[]
            {
                ("Line Chart", Models.WidgetType.LineChart),
                ("Bar Chart", Models.WidgetType.BarChart),
                ("Pie Chart", Models.WidgetType.PieChart),
                ("Area Chart", Models.WidgetType.AreaChart),
                ("Gauge", Models.WidgetType.Gauge),
                ("KPI Card", Models.WidgetType.KpiCard),
                ("Data Grid", Models.WidgetType.DataGrid)
            };

            foreach (var (name, type) in widgetTypes)
            {
                var item = new MenuItem
                {
                    Header = name,
                    Tag = type
                };
                item.Click += AddWidgetMenuItem_Click;
                menu.Items.Add(item);
            }

            menu.PlacementTarget = sender as Button;
            menu.IsOpen = true;
        }

        private void AddWidgetMenuItem_Click(object sender, RoutedEventArgs e)
        {
            if (sender is MenuItem item && item.Tag is Models.WidgetType type)
            {
                _viewModel.DashboardViewModel.AddWidgetCommand.Execute(type);
                StatusText.Text = $"Added {type} widget";
            }
        }

        protected override void OnClosed(EventArgs e)
        {
            _clockTimer.Stop();
            base.OnClosed(e);
        }
    }
}
