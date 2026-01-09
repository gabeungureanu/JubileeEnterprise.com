using System.Globalization;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class BoolToFollowTextConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var isFollowing = value is bool b && b;
        return isFollowing ? "FOLLOWING" : "FOLLOW";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
