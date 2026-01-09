using System.Globalization;
using System.Windows.Data;
using System.Windows.Media;
using JubileeVibes.Core.Enums;

namespace JubileeVibes.Converters;

public class PlayStateToIconConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is not PlayState state)
            return GetPlayIcon();

        return state switch
        {
            PlayState.Playing => GetPauseIcon(),
            _ => GetPlayIcon()
        };
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotSupportedException();
    }

    private static Geometry GetPlayIcon()
    {
        return Geometry.Parse("M8 5v14l11-7z");
    }

    private static Geometry GetPauseIcon()
    {
        return Geometry.Parse("M6 19h4V5H6v14zm8-14v14h4V5h-4z");
    }
}
