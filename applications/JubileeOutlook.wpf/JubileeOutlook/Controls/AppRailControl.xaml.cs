using System.Windows;
using System.Windows.Controls;

namespace JubileeOutlook.Controls;

/// <summary>
/// App Rail Control - Vertical module switcher that spans the full height of the window
/// </summary>
public partial class AppRailControl : UserControl
{
    /// <summary>
    /// Event raised when the hamburger menu button is clicked
    /// </summary>
    public event EventHandler? HamburgerMenuClicked;

    public AppRailControl()
    {
        InitializeComponent();
    }

    private void HamburgerButton_Click(object sender, RoutedEventArgs e)
    {
        System.Diagnostics.Debug.WriteLine("[AppRailControl] HamburgerButton_Click - raising event");
        HamburgerMenuClicked?.Invoke(this, EventArgs.Empty);
    }
}
