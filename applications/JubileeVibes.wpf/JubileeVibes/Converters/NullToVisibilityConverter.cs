using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class NullToVisibilityConverter : IValueConverter
{
    public bool Invert { get; set; }
    public bool UseHidden { get; set; }

    public object Convert(object? value, Type targetType, object parameter, CultureInfo culture)
    {
        var isNotNull = value != null;

        if (value is string s)
            isNotNull = !string.IsNullOrEmpty(s);

        if (Invert)
            isNotNull = !isNotNull;

        if (isNotNull)
            return Visibility.Visible;

        return UseHidden ? Visibility.Hidden : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
