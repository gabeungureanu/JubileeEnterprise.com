using System.Windows;
using System.Windows.Controls;
using JubileeFlywheel.Models;
using JubileeFlywheel.ViewModels;

namespace JubileeFlywheel.Controls
{
    public class WidgetTemplateSelector : DataTemplateSelector
    {
        public override DataTemplate? SelectTemplate(object item, DependencyObject container)
        {
            if (item is not WidgetViewModel widgetVm || container is not FrameworkElement element)
            {
                return null;
            }

            var templateKey = widgetVm.Widget.Type switch
            {
                WidgetType.LineChart => "LineChartTemplate",
                WidgetType.BarChart => "BarChartTemplate",
                WidgetType.PieChart => "PieChartTemplate",
                WidgetType.AreaChart => "AreaChartTemplate",
                WidgetType.Gauge => "GaugeTemplate",
                WidgetType.KpiCard => "KpiCardTemplate",
                WidgetType.DataGrid => "DataGridWidgetTemplate",
                WidgetType.DonutChart => "PieChartTemplate",
                _ => null
            };

            if (templateKey != null)
            {
                var template = element.TryFindResource(templateKey) as DataTemplate;
                return template;
            }

            return null;
        }
    }
}
