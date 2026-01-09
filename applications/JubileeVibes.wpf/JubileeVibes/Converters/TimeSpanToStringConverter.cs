using System.Globalization;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class TimeSpanToStringConverter : IValueConverter
{
    public bool ShowHours { get; set; }

    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is not TimeSpan timeSpan)
            return "0:00";

        if (ShowHours || timeSpan.TotalHours >= 1)
        {
            return $"{(int)timeSpan.TotalHours}:{timeSpan.Minutes:D2}:{timeSpan.Seconds:D2}";
        }

        return $"{(int)timeSpan.TotalMinutes}:{timeSpan.Seconds:D2}";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is string s && TimeSpan.TryParse(s, out var result))
            return result;

        return TimeSpan.Zero;
    }
}
