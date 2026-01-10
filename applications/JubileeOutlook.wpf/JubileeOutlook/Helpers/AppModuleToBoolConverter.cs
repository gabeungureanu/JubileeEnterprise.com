using System.Globalization;
using System.Windows.Data;
using JubileeOutlook.Models;

namespace JubileeOutlook.Helpers;

/// <summary>
/// Converts an AppModule enum value to a boolean for RadioButton binding.
/// Returns true if the bound value matches the parameter.
/// </summary>
public class AppModuleToBoolConverter : IValueConverter
{
    public object Convert(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is AppModule module && parameter is string paramString)
        {
            if (Enum.TryParse<AppModule>(paramString, out var targetModule))
            {
                return module == targetModule;
            }
        }
        return false;
    }

    public object ConvertBack(object value, Type targetType, object parameter, CultureInfo culture)
    {
        if (value is bool isChecked && isChecked && parameter is string paramString)
        {
            if (Enum.TryParse<AppModule>(paramString, out var targetModule))
            {
                return targetModule;
            }
        }
        return Binding.DoNothing;
    }
}
