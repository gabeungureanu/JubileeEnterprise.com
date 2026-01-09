using System.Globalization;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class NumberFormatConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is not long and not int and not double)
            return value?.ToString() ?? "0";

        var number = System.Convert.ToDouble(value);

        return number switch
        {
            >= 1_000_000_000 => $"{number / 1_000_000_000:0.#}B",
            >= 1_000_000 => $"{number / 1_000_000:0.#}M",
            >= 1_000 => $"{number / 1_000:0.#}K",
            _ => number.ToString("N0", culture)
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
