using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace JubileeVibes.Converters;

public class LikedToIconConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        var isLiked = value is bool b && b;
        var resourceKey = isLiked ? "HeartFilledIcon" : "HeartOutlineIcon";
        return Application.Current.TryFindResource(resourceKey) ?? DependencyProperty.UnsetValue;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }
}
