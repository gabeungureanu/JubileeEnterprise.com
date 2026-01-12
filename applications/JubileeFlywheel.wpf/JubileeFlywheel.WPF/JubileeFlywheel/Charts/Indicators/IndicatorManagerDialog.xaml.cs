using System.Windows;
using System.Windows.Controls;
using System.Windows.Media;

namespace JubileeFlywheel.Charts.Indicators;

/// <summary>
/// Dialog for managing chart indicators
/// </summary>
public partial class IndicatorManagerDialog : Window
{
    private readonly IndicatorRenderer _indicatorRenderer;
    private readonly ChartDataSeries _data;
    private IIndicator? _selectedActiveIndicator;

    public IndicatorManagerDialog(IndicatorRenderer indicatorRenderer, ChartDataSeries data)
    {
        InitializeComponent();

        _indicatorRenderer = indicatorRenderer;
        _data = data;

        RefreshAvailableIndicators();
        RefreshActiveIndicators();
    }

    private void CategoryCombo_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        RefreshAvailableIndicators();
    }

    private void RefreshAvailableIndicators()
    {
        if (CategoryCombo == null || AvailableIndicatorsList == null) return;

        var selectedCategory = (CategoryCombo.SelectedItem as ComboBoxItem)?.Content?.ToString() ?? "All";

        var filtered = selectedCategory == "All"
            ? IndicatorFactory.AvailableIndicators
            : IndicatorFactory.AvailableIndicators.Where(i => i.Category == selectedCategory).ToList();

        AvailableIndicatorsList.ItemsSource = filtered;
    }

    private void RefreshActiveIndicators()
    {
        if (ActiveIndicatorsList == null) return;
        ActiveIndicatorsList.ItemsSource = null;
        ActiveIndicatorsList.ItemsSource = _indicatorRenderer.Indicators.ToList();
    }

    private void AvailableIndicatorsList_MouseDoubleClick(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        AddSelectedIndicator();
    }

    private void AddButton_Click(object sender, RoutedEventArgs e)
    {
        AddSelectedIndicator();
    }

    private void AddSelectedIndicator()
    {
        if (AvailableIndicatorsList.SelectedItem is IndicatorInfo info)
        {
            var indicator = info.CreateInstance();
            indicator.Calculate(_data.Bars);
            _indicatorRenderer.AddIndicator(indicator);
            RefreshActiveIndicators();
        }
    }

    private void RemoveButton_Click(object sender, RoutedEventArgs e)
    {
        if (ActiveIndicatorsList.SelectedItem is IIndicator indicator)
        {
            _indicatorRenderer.RemoveIndicator(indicator);
            RefreshActiveIndicators();
            ClearParameterPanel();
        }
    }

    private void ActiveIndicatorsList_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        _selectedActiveIndicator = ActiveIndicatorsList.SelectedItem as IIndicator;
        UpdateParameterPanel();
    }

    private void UpdateParameterPanel()
    {
        ClearParameterPanel();

        if (_selectedActiveIndicator == null) return;

        foreach (var param in _selectedActiveIndicator.Parameters)
        {
            var panel = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(0, 4, 0, 4) };

            var label = new TextBlock
            {
                Text = param.DisplayName + ":",
                Width = 120,
                Foreground = new SolidColorBrush(Color.FromRgb(0xE0, 0xE0, 0xE0)),
                VerticalAlignment = VerticalAlignment.Center
            };

            if (param.Type == ParameterType.Integer || param.Type == ParameterType.Double)
            {
                var slider = new Slider
                {
                    Minimum = param.MinValue,
                    Maximum = param.MaxValue,
                    Value = param.Value,
                    Width = 100,
                    TickFrequency = param.Step,
                    IsSnapToTickEnabled = param.Type == ParameterType.Integer
                };

                var valueLabel = new TextBlock
                {
                    Text = param.Value.ToString(param.Type == ParameterType.Integer ? "N0" : "N2"),
                    Width = 50,
                    Foreground = new SolidColorBrush(Color.FromRgb(0xE0, 0xE0, 0xE0)),
                    Margin = new Thickness(8, 0, 0, 0),
                    VerticalAlignment = VerticalAlignment.Center
                };

                var indicatorCapture = _selectedActiveIndicator;
                var paramNameCapture = param.Name;
                var paramTypeCapture = param.Type;

                slider.ValueChanged += (s, e) =>
                {
                    double newValue = paramTypeCapture == ParameterType.Integer
                        ? Math.Round(slider.Value)
                        : slider.Value;

                    indicatorCapture.SetParameter(paramNameCapture, newValue);
                    valueLabel.Text = newValue.ToString(paramTypeCapture == ParameterType.Integer ? "N0" : "N2");

                    // Recalculate indicator with new parameter
                    indicatorCapture.Calculate(_data.Bars);
                };

                panel.Children.Add(label);
                panel.Children.Add(slider);
                panel.Children.Add(valueLabel);
            }
            else if (param.Type == ParameterType.Boolean)
            {
                var checkBox = new CheckBox
                {
                    IsChecked = param.Value > 0,
                    VerticalAlignment = VerticalAlignment.Center
                };

                var indicatorCapture = _selectedActiveIndicator;
                var paramNameCapture = param.Name;

                checkBox.Checked += (s, e) =>
                {
                    indicatorCapture.SetParameter(paramNameCapture, 1);
                    indicatorCapture.Calculate(_data.Bars);
                };

                checkBox.Unchecked += (s, e) =>
                {
                    indicatorCapture.SetParameter(paramNameCapture, 0);
                    indicatorCapture.Calculate(_data.Bars);
                };

                panel.Children.Add(label);
                panel.Children.Add(checkBox);
            }

            ParameterPanel.Children.Add(panel);
        }
    }

    private void ClearParameterPanel()
    {
        ParameterPanel.Children.Clear();
    }

    private void OkButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = true;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
