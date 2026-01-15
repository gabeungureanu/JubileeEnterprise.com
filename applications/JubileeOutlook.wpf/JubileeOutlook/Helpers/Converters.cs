using System.Globalization;
using System.Windows;
using System.Windows.Data;

namespace JubileeOutlook.Helpers;

public class BoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool boolValue)
        {
            return boolValue ? Visibility.Visible : Visibility.Collapsed;
        }
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class InverseBoolToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool boolValue)
        {
            return boolValue ? Visibility.Collapsed : Visibility.Visible;
        }
        return Visibility.Visible;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a null object to Collapsed visibility, non-null to Visible
/// </summary>
public class NullToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        return value != null ? Visibility.Visible : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class CountToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is int count)
        {
            return count > 0 ? Visibility.Visible : Visibility.Collapsed;
        }
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class ReadToWeightConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool isRead)
        {
            return isRead ? FontWeights.Normal : FontWeights.Bold;
        }
        return FontWeights.Normal;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class ListToStringConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is List<string> list)
        {
            return string.Join("; ", list);
        }
        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class FileSizeConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is long fileSize)
        {
            string[] sizes = { "B", "KB", "MB", "GB", "TB" };
            double len = fileSize;
            int order = 0;

            while (len >= 1024 && order < sizes.Length - 1)
            {
                order++;
                len = len / 1024;
            }

            return $"{len:0.##} {sizes[order]}";
        }
        return "0 B";
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class EnumToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value == null || parameter == null)
            return Visibility.Collapsed;

        var enumValue = value.ToString();
        var targetValue = parameter.ToString();

        return string.Equals(enumValue, targetValue, StringComparison.OrdinalIgnoreCase)
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class StringToVisibilityConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is string str && !string.IsNullOrWhiteSpace(str))
        {
            return Visibility.Visible;
        }
        return Visibility.Collapsed;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class EventTopPositionConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime startTime)
        {
            var dayStart = startTime.Date;
            var duration = startTime - dayStart;
            return duration.TotalHours * 60; // 60px per hour
        }
        return 0.0;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a CalendarEvent to its height in pixels based on duration
/// </summary>
public class EventHeightConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is JubileeOutlook.Models.CalendarEvent calEvent)
        {
            var duration = calEvent.EndTime - calEvent.StartTime;
            return Math.Max(duration.TotalHours * 60, 30); // 60px per hour, minimum 30px
        }
        return 30.0;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converter to get events for a specific day column index from VisibleDays
/// </summary>
public class EventsForDayColumnConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.Length >= 3 &&
            values[0] is System.Collections.IEnumerable events &&
            values[1] is System.Collections.IEnumerable visibleDays &&
            parameter != null &&
            int.TryParse(parameter.ToString(), out int dayIndex))
        {
            var daysList = visibleDays.Cast<DateTime>().ToList();
            if (dayIndex >= 0 && dayIndex < daysList.Count)
            {
                var targetDate = daysList[dayIndex];
                var filteredEvents = new System.Collections.ObjectModel.ObservableCollection<JubileeOutlook.Models.CalendarEvent>();
                foreach (var evt in events)
                {
                    if (evt is JubileeOutlook.Models.CalendarEvent calEvent)
                    {
                        if (calEvent.StartTime.Date == targetDate.Date)
                        {
                            filteredEvents.Add(calEvent);
                        }
                    }
                }
                return filteredEvents;
            }
        }
        return new System.Collections.ObjectModel.ObservableCollection<JubileeOutlook.Models.CalendarEvent>();
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

public class EventsByDateConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.Length >= 2 &&
            values[0] is System.Collections.IEnumerable events &&
            values[1] is DateTime targetDate)
        {
            var filteredEvents = new System.Collections.ObjectModel.ObservableCollection<object>();
            foreach (var evt in events)
            {
                if (evt is JubileeOutlook.Models.CalendarEvent calEvent)
                {
                    if (calEvent.StartTime.Date == targetDate.Date)
                    {
                        filteredEvents.Add(calEvent);
                    }
                }
            }
            return filteredEvents;
        }
        return new System.Collections.ObjectModel.ObservableCollection<object>();
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a DateTime to check if it's today for highlighting purposes
/// </summary>
public class IsTodayConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            return date.Date == DateTime.Today;
        }
        return false;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a DateTime to check if it's today and returns appropriate background brush
/// </summary>
public class IsTodayToBackgroundConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            if (date.Date == DateTime.Today)
            {
                return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(9, 71, 113)); // #094771
            }
        }
        return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent);
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a DateTime to check if it's today and returns appropriate foreground color
/// </summary>
public class IsTodayToForegroundConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            if (date.Date == DateTime.Today)
            {
                return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 255, 255)); // White
            }
        }
        // Default gray for non-today dates
        var paramStr = parameter as string;
        if (paramStr == "header")
        {
            return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136)); // #888888
        }
        return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(204, 204, 204)); // #CCCCCC
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a DateTime to check if it's today and returns appropriate font weight
/// </summary>
public class IsTodayToFontWeightConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            return date.Date == DateTime.Today ? FontWeights.Bold : FontWeights.Normal;
        }
        return FontWeights.Normal;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Adds days to a DateTime value
/// </summary>
public class AddDaysConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date && parameter != null)
        {
            if (int.TryParse(parameter.ToString(), out int days))
            {
                return date.AddDays(days);
            }
        }
        return value;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts DateTime to day-of-week abbreviation (uppercase 3 letters)
/// </summary>
public class DateToDayOfWeekConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            return date.ToString("ddd", CultureInfo.InvariantCulture).ToUpper();
        }
        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts DateTime to day number string
/// </summary>
public class DateToDayNumberConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            return date.Day.ToString();
        }
        return string.Empty;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Checks if date is in the current month for mini calendar styling
/// </summary>
public class IsCurrentMonthConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.Length >= 2 && values[0] is DateTime date && values[1] is DateTime selectedDate)
        {
            return date.Month == selectedDate.Month && date.Year == selectedDate.Year;
        }
        return true;
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a date to foreground color based on whether it's in current month
/// </summary>
public class MiniCalendarDayForegroundConverter : IMultiValueConverter
{
    public object Convert(object[] values, Type targetType, object parameter, CultureInfo culture)
    {
        if (values.Length >= 2 && values[0] is DateTime date && values[1] is DateTime selectedDate)
        {
            // Today gets white text
            if (date.Date == DateTime.Today)
            {
                return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 255, 255));
            }
            // Same month gets normal white/gray text
            if (date.Month == selectedDate.Month && date.Year == selectedDate.Year)
            {
                return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(204, 204, 204));
            }
            // Different month gets dim text
            return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(85, 85, 85));
        }
        return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(204, 204, 204));
    }

    public object[] ConvertBack(object value, Type[] targetTypes, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts a date to background color for mini calendar (highlights today)
/// </summary>
public class MiniCalendarDayBackgroundConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is DateTime date)
        {
            if (date.Date == DateTime.Today)
            {
                return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(9, 71, 113)); // #094771
            }
        }
        return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Colors.Transparent);
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}

/// <summary>
/// Converts an EventCategory to its corresponding color brush
/// </summary>
public class EventColorConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is JubileeOutlook.Models.EventCategory category)
        {
            return category switch
            {
                JubileeOutlook.Models.EventCategory.Business => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(0, 120, 212)),
                JubileeOutlook.Models.EventCategory.Personal => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(16, 124, 16)),
                JubileeOutlook.Models.EventCategory.Holiday => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(209, 52, 56)),
                JubileeOutlook.Models.EventCategory.Birthday => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(255, 189, 89)),
                _ => new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136))
            };
        }
        return new System.Windows.Media.SolidColorBrush(System.Windows.Media.Color.FromRgb(136, 136, 136));
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        throw new NotImplementedException();
    }
}
