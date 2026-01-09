using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class EqualityToVisibilityConverter : IValueConverter
{
    public bool Invert { get; set; }

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var isEqual = Equals(value?.ToString(), parameter?.ToString());

        if (Invert)
            isEqual = !isEqual;

        return isEqual ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
