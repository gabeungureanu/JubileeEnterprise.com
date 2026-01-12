using JubileeFlywheel.Models;
using JubileeFlywheel.Services;
using LiveChartsCore;
using LiveChartsCore.SkiaSharpView;
using LiveChartsCore.SkiaSharpView.Painting;
using SkiaSharp;

namespace JubileeFlywheel.ViewModels
{
    public partial class DashboardViewModel : ObservableObject
    {
        private readonly IApiService _apiService;
        private readonly ISettingsService _settingsService;

        [ObservableProperty]
        private Dashboard? _currentDashboard;

        [ObservableProperty]
        private ObservableCollection<WidgetViewModel> _widgets = new();

        [ObservableProperty]
        private bool _isEditMode;

        public DashboardViewModel(IApiService apiService, ISettingsService settingsService)
        {
            _apiService = apiService;
            _settingsService = settingsService;
        }

        public void LoadDashboard(Dashboard dashboard)
        {
            CurrentDashboard = dashboard;
            Widgets.Clear();

            foreach (var widget in dashboard.Widgets)
            {
                Widgets.Add(new WidgetViewModel(widget, _apiService));
            }
        }

        [RelayCommand]
        private void AddWidget(WidgetType type)
        {
            if (CurrentDashboard == null) return;

            var widget = new DashboardWidget
            {
                Title = $"New {type}",
                Type = type,
                Row = CurrentDashboard.Widgets.Count / CurrentDashboard.Columns,
                Column = CurrentDashboard.Widgets.Count % CurrentDashboard.Columns
            };

            CurrentDashboard.Widgets.Add(widget);
            Widgets.Add(new WidgetViewModel(widget, _apiService));
            _settingsService.UpdateDashboard(CurrentDashboard);
        }

        [RelayCommand]
        private void RemoveWidget(WidgetViewModel widgetVm)
        {
            if (CurrentDashboard == null) return;

            var widget = CurrentDashboard.Widgets.FirstOrDefault(w => w.Id == widgetVm.Widget.Id);
            if (widget != null)
            {
                CurrentDashboard.Widgets.Remove(widget);
                Widgets.Remove(widgetVm);
                _settingsService.UpdateDashboard(CurrentDashboard);
            }
        }

        [RelayCommand]
        private void ToggleEditMode()
        {
            IsEditMode = !IsEditMode;
        }

        [RelayCommand]
        private void SaveLayout()
        {
            if (CurrentDashboard != null)
            {
                _settingsService.UpdateDashboard(CurrentDashboard);
            }
            IsEditMode = false;
        }
    }

    public partial class WidgetViewModel : ObservableObject
    {
        private readonly IApiService _apiService;

        public DashboardWidget Widget { get; }

        [ObservableProperty]
        private string _title = string.Empty;

        [ObservableProperty]
        private bool _isLoading;

        [ObservableProperty]
        private string? _errorMessage;

        [ObservableProperty]
        private ISeries[] _chartSeries = Array.Empty<ISeries>();

        [ObservableProperty]
        private Axis[] _xAxes = Array.Empty<Axis>();

        [ObservableProperty]
        private Axis[] _yAxes = Array.Empty<Axis>();

        [ObservableProperty]
        private double _gaugeValue;

        [ObservableProperty]
        private double _kpiValue;

        [ObservableProperty]
        private double _kpiChange;

        [ObservableProperty]
        private string _kpiUnit = string.Empty;

        public WidgetViewModel(DashboardWidget widget, IApiService apiService)
        {
            Widget = widget;
            _apiService = apiService;
            Title = widget.Title;

            InitializeWidget();
        }

        private void InitializeWidget()
        {
            var primaryColor = new SKColor(230, 172, 0);
            var textColor = new SKColor(255, 255, 255);

            switch (Widget.Type)
            {
                case WidgetType.LineChart:
                    ChartSeries = new ISeries[]
                    {
                        new LineSeries<double>
                        {
                            Values = new double[] { 3, 5, 7, 4, 6, 8, 5, 9, 7, 10 },
                            Stroke = new SolidColorPaint(primaryColor) { StrokeThickness = 2 },
                            GeometryStroke = new SolidColorPaint(primaryColor) { StrokeThickness = 2 },
                            GeometrySize = 8,
                            Fill = null
                        }
                    };
                    SetupAxes(textColor);
                    break;

                case WidgetType.BarChart:
                    ChartSeries = new ISeries[]
                    {
                        new ColumnSeries<double>
                        {
                            Values = new double[] { 5, 8, 3, 9, 6, 4, 7 },
                            Fill = new SolidColorPaint(primaryColor)
                        }
                    };
                    SetupAxes(textColor);
                    break;

                case WidgetType.PieChart:
                    ChartSeries = new ISeries[]
                    {
                        new PieSeries<double> { Values = new double[] { 3 }, Name = "Category A" },
                        new PieSeries<double> { Values = new double[] { 5 }, Name = "Category B" },
                        new PieSeries<double> { Values = new double[] { 2 }, Name = "Category C" },
                        new PieSeries<double> { Values = new double[] { 4 }, Name = "Category D" }
                    };
                    break;

                case WidgetType.AreaChart:
                    ChartSeries = new ISeries[]
                    {
                        new LineSeries<double>
                        {
                            Values = new double[] { 2, 4, 6, 3, 5, 8, 4, 7, 9, 6 },
                            Fill = new SolidColorPaint(new SKColor(230, 172, 0, 80)),
                            Stroke = new SolidColorPaint(primaryColor) { StrokeThickness = 2 },
                            GeometrySize = 0
                        }
                    };
                    SetupAxes(textColor);
                    break;

                case WidgetType.Gauge:
                    GaugeValue = 72;
                    ChartSeries = new ISeries[]
                    {
                        new PieSeries<double>
                        {
                            Values = new double[] { GaugeValue },
                            InnerRadius = 50,
                            MaxRadialColumnWidth = 20
                        },
                        new PieSeries<double>
                        {
                            Values = new double[] { 100 - GaugeValue },
                            InnerRadius = 50,
                            MaxRadialColumnWidth = 20,
                            Fill = new SolidColorPaint(new SKColor(42, 42, 78))
                        }
                    };
                    break;

                case WidgetType.KpiCard:
                    KpiValue = 12847;
                    KpiChange = 12.5;
                    KpiUnit = "users";
                    break;

                case WidgetType.DataGrid:
                    break;
            }
        }

        private void SetupAxes(SKColor textColor)
        {
            XAxes = new Axis[]
            {
                new Axis
                {
                    LabelsPaint = new SolidColorPaint(textColor),
                    TextSize = 12
                }
            };

            YAxes = new Axis[]
            {
                new Axis
                {
                    LabelsPaint = new SolidColorPaint(textColor),
                    TextSize = 12
                }
            };
        }

        public async Task RefreshDataAsync(ApiEndpoint endpoint)
        {
            if (string.IsNullOrEmpty(Widget.ApiEndpointId)) return;

            IsLoading = true;
            ErrorMessage = null;

            try
            {
                var response = await _apiService.FetchDataAsync(endpoint);
                if (response.Success && response.Data != null)
                {
                    // Parse and update widget data based on DataPath
                    // Implementation depends on the data structure
                }
                else
                {
                    ErrorMessage = response.Error;
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
    }
}
