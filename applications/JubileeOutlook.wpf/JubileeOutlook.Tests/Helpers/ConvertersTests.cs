using System.Globalization;
using System.Windows;
using System.Windows.Media;
using JubileeOutlook.Helpers;
using JubileeOutlook.Models;
using Xunit;

namespace JubileeOutlook.Tests.Helpers;

#region Visibility Converters

public class BoolToVisibilityConverterTests
{
    private readonly BoolToVisibilityConverter _converter = new();

    [Theory]
    [InlineData(true, Visibility.Visible)]
    [InlineData(false, Visibility.Collapsed)]
    public void Convert_BoolValue_ReturnsExpectedVisibility(bool input, Visibility expected)
    {
        var result = _converter.Convert(input, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(null!, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_NonBoolValue_ReturnsCollapsed()
    {
        var result = _converter.Convert("not a bool", typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_IntegerValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(1, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }
}

public class InverseBoolToVisibilityConverterTests
{
    private readonly InverseBoolToVisibilityConverter _converter = new();

    [Theory]
    [InlineData(true, Visibility.Collapsed)]
    [InlineData(false, Visibility.Visible)]
    public void Convert_BoolValue_ReturnsInverseVisibility(bool input, Visibility expected)
    {
        var result = _converter.Convert(input, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsVisible()
    {
        var result = _converter.Convert(null!, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }

    [Fact]
    public void Convert_NonBoolValue_ReturnsVisible()
    {
        var result = _converter.Convert("not a bool", typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }
}

public class NullToVisibilityConverterTests
{
    private readonly NullToVisibilityConverter _converter = new();

    [Fact]
    public void Convert_NonNullValue_ReturnsVisible()
    {
        var result = _converter.Convert(new object(), typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(null!, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_EmptyString_ReturnsVisible()
    {
        var result = _converter.Convert(string.Empty, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }

    [Fact]
    public void Convert_ZeroInteger_ReturnsVisible()
    {
        var result = _converter.Convert(0, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }
}

public class StringToVisibilityConverterTests
{
    private readonly StringToVisibilityConverter _converter = new();

    [Theory]
    [InlineData("Hello", Visibility.Visible)]
    [InlineData("  text  ", Visibility.Visible)]
    [InlineData("", Visibility.Collapsed)]
    [InlineData("   ", Visibility.Collapsed)]
    public void Convert_StringValue_ReturnsExpectedVisibility(string input, Visibility expected)
    {
        var result = _converter.Convert(input, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(null!, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_NonStringValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(123, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }
}

public class CountToVisibilityConverterTests
{
    private readonly CountToVisibilityConverter _converter = new();

    [Theory]
    [InlineData(0, Visibility.Collapsed)]
    [InlineData(1, Visibility.Visible)]
    [InlineData(100, Visibility.Visible)]
    [InlineData(-1, Visibility.Collapsed)]
    public void Convert_IntValue_ReturnsExpectedVisibility(int input, Visibility expected)
    {
        var result = _converter.Convert(input, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(null!, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_NonIntValue_ReturnsCollapsed()
    {
        var result = _converter.Convert("5", typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }
}

#endregion

#region Text/Style Converters

public class ReadToWeightConverterTests
{
    private readonly ReadToWeightConverter _converter = new();

    [Fact]
    public void Convert_ReadTrue_ReturnsNormal()
    {
        var result = _converter.Convert(true, typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }

    [Fact]
    public void Convert_ReadFalse_ReturnsBold()
    {
        var result = _converter.Convert(false, typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Bold, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsNormal()
    {
        var result = _converter.Convert(null!, typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }

    [Fact]
    public void Convert_NonBoolValue_ReturnsNormal()
    {
        var result = _converter.Convert("true", typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }
}

public class ListToStringConverterTests
{
    private readonly ListToStringConverter _converter = new();

    [Fact]
    public void Convert_ListWithItems_ReturnsJoinedString()
    {
        var list = new List<string> { "Alice", "Bob", "Charlie" };
        var result = _converter.Convert(list, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("Alice; Bob; Charlie", result);
    }

    [Fact]
    public void Convert_EmptyList_ReturnsEmptyString()
    {
        var list = new List<string>();
        var result = _converter.Convert(list, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Convert_SingleItem_ReturnsSingleItem()
    {
        var list = new List<string> { "Alice" };
        var result = _converter.Convert(list, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("Alice", result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsEmptyString()
    {
        var result = _converter.Convert(null!, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(string.Empty, result);
    }

    [Fact]
    public void Convert_NonListValue_ReturnsEmptyString()
    {
        var result = _converter.Convert("not a list", typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(string.Empty, result);
    }
}

public class FileSizeConverterTests
{
    private readonly FileSizeConverter _converter = new();

    [Theory]
    [InlineData(0L, "0 B")]
    [InlineData(512L, "512 B")]
    [InlineData(1024L, "1 KB")]
    [InlineData(1536L, "1.5 KB")]
    [InlineData(1048576L, "1 MB")]
    [InlineData(1073741824L, "1 GB")]
    public void Convert_LongValue_ReturnsFormattedSize(long input, string expected)
    {
        var result = _converter.Convert(input, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsZeroB()
    {
        var result = _converter.Convert(null!, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("0 B", result);
    }

    [Fact]
    public void Convert_NonLongValue_ReturnsZeroB()
    {
        var result = _converter.Convert("1024", typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("0 B", result);
    }
}

#endregion

#region Calendar Date Converters

public class IsTodayConverterTests
{
    private readonly IsTodayConverter _converter = new();

    [Fact]
    public void Convert_Today_ReturnsTrue()
    {
        var result = _converter.Convert(DateTime.Today, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(true, result);
    }

    [Fact]
    public void Convert_TodayWithTime_ReturnsTrue()
    {
        var result = _converter.Convert(DateTime.Today.AddHours(14).AddMinutes(30), typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(true, result);
    }

    [Fact]
    public void Convert_Yesterday_ReturnsFalse()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(-1), typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }

    [Fact]
    public void Convert_Tomorrow_ReturnsFalse()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(1), typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsFalse()
    {
        var result = _converter.Convert(null!, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }

    [Fact]
    public void Convert_NonDateTimeValue_ReturnsFalse()
    {
        var result = _converter.Convert("2024-01-14", typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }
}

public class IsTodayToBackgroundConverterTests
{
    private readonly IsTodayToBackgroundConverter _converter = new();

    [Fact]
    public void Convert_Today_ReturnsHighlightColor()
    {
        var result = _converter.Convert(DateTime.Today, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(9, 71, 113), result.Color);
    }

    [Fact]
    public void Convert_NotToday_ReturnsTransparent()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(1), typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Colors.Transparent, result.Color);
    }

    [Fact]
    public void Convert_NullValue_ReturnsTransparent()
    {
        var result = _converter.Convert(null!, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Colors.Transparent, result.Color);
    }
}

public class IsTodayToForegroundConverterTests
{
    private readonly IsTodayToForegroundConverter _converter = new();

    [Fact]
    public void Convert_Today_ReturnsWhite()
    {
        var result = _converter.Convert(DateTime.Today, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(255, 255, 255), result.Color);
    }

    [Fact]
    public void Convert_NotToday_ReturnsGray()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(1), typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(204, 204, 204), result.Color);
    }

    [Fact]
    public void Convert_NotTodayWithHeaderParameter_ReturnsDarkerGray()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(1), typeof(Brush), "header", CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(136, 136, 136), result.Color);
    }
}

public class IsTodayToFontWeightConverterTests
{
    private readonly IsTodayToFontWeightConverter _converter = new();

    [Fact]
    public void Convert_Today_ReturnsBold()
    {
        var result = _converter.Convert(DateTime.Today, typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Bold, result);
    }

    [Fact]
    public void Convert_TodayWithTime_ReturnsBold()
    {
        var result = _converter.Convert(DateTime.Today.AddHours(10), typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Bold, result);
    }

    [Fact]
    public void Convert_NotToday_ReturnsNormal()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(1), typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsNormal()
    {
        var result = _converter.Convert(null!, typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }

    [Fact]
    public void Convert_NonDateTimeValue_ReturnsNormal()
    {
        var result = _converter.Convert("today", typeof(FontWeight), null!, CultureInfo.InvariantCulture);
        Assert.Equal(FontWeights.Normal, result);
    }
}

public class AddDaysConverterTests
{
    private readonly AddDaysConverter _converter = new();

    [Theory]
    [InlineData(0)]
    [InlineData(1)]
    [InlineData(-1)]
    [InlineData(7)]
    [InlineData(-30)]
    public void Convert_DateWithDaysParameter_ReturnsCorrectDate(int daysToAdd)
    {
        var baseDate = new DateTime(2026, 1, 14);
        var result = _converter.Convert(baseDate, typeof(DateTime), daysToAdd.ToString(), CultureInfo.InvariantCulture);
        Assert.Equal(baseDate.AddDays(daysToAdd), result);
    }

    [Fact]
    public void Convert_NullParameter_ReturnsOriginalDate()
    {
        var baseDate = new DateTime(2026, 1, 14);
        var result = _converter.Convert(baseDate, typeof(DateTime), null!, CultureInfo.InvariantCulture);
        Assert.Equal(baseDate, result);
    }

    [Fact]
    public void Convert_InvalidParameter_ReturnsOriginalDate()
    {
        var baseDate = new DateTime(2026, 1, 14);
        var result = _converter.Convert(baseDate, typeof(DateTime), "invalid", CultureInfo.InvariantCulture);
        Assert.Equal(baseDate, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsNull()
    {
        var result = _converter.Convert(null!, typeof(DateTime), "1", CultureInfo.InvariantCulture);
        Assert.Null(result);
    }
}

public class DateToDayOfWeekConverterTests
{
    private readonly DateToDayOfWeekConverter _converter = new();

    [Fact]
    public void Convert_Monday_ReturnsMON()
    {
        var monday = new DateTime(2026, 1, 12); // Monday
        var result = _converter.Convert(monday, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("MON", result);
    }

    [Fact]
    public void Convert_Sunday_ReturnsSUN()
    {
        var sunday = new DateTime(2026, 1, 11); // Sunday
        var result = _converter.Convert(sunday, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal("SUN", result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsEmptyString()
    {
        var result = _converter.Convert(null!, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(string.Empty, result);
    }
}

public class DateToDayNumberConverterTests
{
    private readonly DateToDayNumberConverter _converter = new();

    [Theory]
    [InlineData(2026, 1, 1, "1")]
    [InlineData(2026, 1, 14, "14")]
    [InlineData(2026, 1, 31, "31")]
    public void Convert_Date_ReturnsDayNumber(int year, int month, int day, string expected)
    {
        var date = new DateTime(year, month, day);
        var result = _converter.Convert(date, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsEmptyString()
    {
        var result = _converter.Convert(null!, typeof(string), null!, CultureInfo.InvariantCulture);
        Assert.Equal(string.Empty, result);
    }
}

#endregion

#region Calendar Event Converters

public class EventTopPositionConverterTests
{
    private readonly EventTopPositionConverter _converter = new();

    [Theory]
    [InlineData(0, 0, 0.0)]      // Midnight = 0px
    [InlineData(1, 0, 60.0)]     // 1 AM = 60px
    [InlineData(12, 0, 720.0)]   // Noon = 720px
    [InlineData(12, 30, 750.0)]  // 12:30 PM = 750px
    [InlineData(23, 59, 1439.0)] // 11:59 PM = ~1439px
    public void Convert_TimeOfDay_ReturnsCorrectTopPosition(int hour, int minute, double expected)
    {
        var dateTime = DateTime.Today.AddHours(hour).AddMinutes(minute);
        var result = (double)_converter.Convert(dateTime, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(expected, result, 0.1);
    }

    [Fact]
    public void Convert_NullValue_ReturnsZero()
    {
        var result = _converter.Convert(null!, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(0.0, result);
    }
}

public class EventHeightConverterTests
{
    private readonly EventHeightConverter _converter = new();

    [Fact]
    public void Convert_OneHourEvent_Returns60px()
    {
        var calEvent = new CalendarEvent
        {
            StartTime = DateTime.Today.AddHours(9),
            EndTime = DateTime.Today.AddHours(10)
        };
        var result = (double)_converter.Convert(calEvent, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(60.0, result);
    }

    [Fact]
    public void Convert_TwoHourEvent_Returns120px()
    {
        var calEvent = new CalendarEvent
        {
            StartTime = DateTime.Today.AddHours(9),
            EndTime = DateTime.Today.AddHours(11)
        };
        var result = (double)_converter.Convert(calEvent, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(120.0, result);
    }

    [Fact]
    public void Convert_HalfHourEvent_Returns30pxMinimum()
    {
        var calEvent = new CalendarEvent
        {
            StartTime = DateTime.Today.AddHours(9),
            EndTime = DateTime.Today.AddHours(9).AddMinutes(30)
        };
        var result = (double)_converter.Convert(calEvent, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(30.0, result);
    }

    [Fact]
    public void Convert_FifteenMinuteEvent_Returns30pxMinimum()
    {
        var calEvent = new CalendarEvent
        {
            StartTime = DateTime.Today.AddHours(9),
            EndTime = DateTime.Today.AddHours(9).AddMinutes(15)
        };
        var result = (double)_converter.Convert(calEvent, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(30.0, result);
    }

    [Fact]
    public void Convert_NullValue_Returns30pxMinimum()
    {
        var result = (double)_converter.Convert(null!, typeof(double), null!, CultureInfo.InvariantCulture);
        Assert.Equal(30.0, result);
    }
}

public class EventColorConverterTests
{
    private readonly EventColorConverter _converter = new();

    [Fact]
    public void Convert_BusinessCategory_ReturnsBlue()
    {
        var result = _converter.Convert(EventCategory.Business, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(0, 120, 212), result.Color);
    }

    [Fact]
    public void Convert_PersonalCategory_ReturnsGreen()
    {
        var result = _converter.Convert(EventCategory.Personal, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(16, 124, 16), result.Color);
    }

    [Fact]
    public void Convert_HolidayCategory_ReturnsRed()
    {
        var result = _converter.Convert(EventCategory.Holiday, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(209, 52, 56), result.Color);
    }

    [Fact]
    public void Convert_BirthdayCategory_ReturnsGold()
    {
        var result = _converter.Convert(EventCategory.Birthday, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(255, 189, 89), result.Color);
    }

    [Fact]
    public void Convert_NoneCategory_ReturnsGray()
    {
        var result = _converter.Convert(EventCategory.None, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(136, 136, 136), result.Color);
    }

    [Fact]
    public void Convert_NullValue_ReturnsGray()
    {
        var result = _converter.Convert(null!, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(136, 136, 136), result.Color);
    }

    [Fact]
    public void Convert_NonEnumValue_ReturnsGray()
    {
        var result = _converter.Convert("Business", typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(136, 136, 136), result.Color);
    }
}

public class EnumToVisibilityConverterTests
{
    private readonly EnumToVisibilityConverter _converter = new();

    [Fact]
    public void Convert_MatchingEnumValue_ReturnsVisible()
    {
        var result = _converter.Convert(EventCategory.Business, typeof(Visibility), "Business", CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }

    [Fact]
    public void Convert_NonMatchingEnumValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(EventCategory.Business, typeof(Visibility), "Personal", CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_NullValue_ReturnsCollapsed()
    {
        var result = _converter.Convert(null!, typeof(Visibility), "Business", CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_NullParameter_ReturnsCollapsed()
    {
        var result = _converter.Convert(EventCategory.Business, typeof(Visibility), null!, CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Collapsed, result);
    }

    [Fact]
    public void Convert_CaseInsensitiveMatch_ReturnsVisible()
    {
        var result = _converter.Convert(EventCategory.Business, typeof(Visibility), "business", CultureInfo.InvariantCulture);
        Assert.Equal(Visibility.Visible, result);
    }
}

#endregion

#region Mini Calendar Converters

public class MiniCalendarDayBackgroundConverterTests
{
    private readonly MiniCalendarDayBackgroundConverter _converter = new();

    [Fact]
    public void Convert_Today_ReturnsHighlightColor()
    {
        var result = _converter.Convert(DateTime.Today, typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Color.FromRgb(9, 71, 113), result.Color);
    }

    [Fact]
    public void Convert_NotToday_ReturnsTransparent()
    {
        var result = _converter.Convert(DateTime.Today.AddDays(5), typeof(Brush), null!, CultureInfo.InvariantCulture) as SolidColorBrush;
        Assert.NotNull(result);
        Assert.Equal(Colors.Transparent, result.Color);
    }
}

public class IsCurrentMonthConverterTests
{
    private readonly IsCurrentMonthConverter _converter = new();

    [Fact]
    public void Convert_SameMonth_ReturnsTrue()
    {
        var date = new DateTime(2026, 1, 15);
        var selectedDate = new DateTime(2026, 1, 1);
        var result = _converter.Convert(new object[] { date, selectedDate }, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(true, result);
    }

    [Fact]
    public void Convert_DifferentMonth_ReturnsFalse()
    {
        var date = new DateTime(2026, 2, 15);
        var selectedDate = new DateTime(2026, 1, 1);
        var result = _converter.Convert(new object[] { date, selectedDate }, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }

    [Fact]
    public void Convert_DifferentYear_ReturnsFalse()
    {
        var date = new DateTime(2025, 1, 15);
        var selectedDate = new DateTime(2026, 1, 1);
        var result = _converter.Convert(new object[] { date, selectedDate }, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(false, result);
    }

    [Fact]
    public void Convert_InsufficientValues_ReturnsTrue()
    {
        var result = _converter.Convert(new object[] { DateTime.Today }, typeof(bool), null!, CultureInfo.InvariantCulture);
        Assert.Equal(true, result);
    }
}

#endregion
