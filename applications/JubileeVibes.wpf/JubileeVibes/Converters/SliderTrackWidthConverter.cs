using System.Globalization;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class SliderTrackWidthConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.Length >= 3 &&
            values[0] is double value &&
            values[1] is double maximum &&
            values[2] is double actualWidth &&
            maximum > 0)
        {
            return (value / maximum) * actualWidth;
        }
        return 0.0;
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
