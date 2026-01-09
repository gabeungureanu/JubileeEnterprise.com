using System.Windows;
using System.Windows.Input;
using System.Windows.Interop;
using JubileeBrowser.Services;

namespace JubileeBrowser;

public partial class SpiritualNutritionWindow : Window
{
    private readonly SpiritualNutritionService _nutritionService;
    private string _currentDomain = "";
    private bool _isClosing = false;

    public SpiritualNutritionWindow(SpiritualNutritionService nutritionService)
    {
        InitializeComponent();
        _nutritionService = nutritionService;
    }

    protected override void OnSourceInitialized(EventArgs e)
    {
        base.OnSourceInitialized(e);

        // Hook into Windows messages to detect when another window in our app gets focus
        var hwndSource = PresentationSource.FromVisual(this) as HwndSource;
        hwndSource?.AddHook(WndProc);
    }

    private IntPtr WndProc(IntPtr hwnd, int msg, IntPtr wParam, IntPtr lParam, ref bool handled)
    {
        // WM_ACTIVATEAPP = 0x001C - sent when a window belonging to a different app gets activated
        const int WM_ACTIVATEAPP = 0x001C;

        if (msg == WM_ACTIVATEAPP)
        {
            bool appIsActive = wParam != IntPtr.Zero;
            if (!appIsActive && !_isClosing)
            {
                // App is losing focus to another application - close popup and reactivate owner
                _isClosing = true;
                Close();
                Owner?.Activate();
            }
        }

        return IntPtr.Zero;
    }

    /// <summary>
    /// Positions the window on the right side of the owner window
    /// </summary>
    public void PositionOnRightSide(Window ownerWindow)
    {
        if (ownerWindow != null)
        {
            // Position on the right side of the owner window with some padding
            Left = ownerWindow.Left + ownerWindow.Width - Width - 20;
            Top = ownerWindow.Top + 80; // Below the toolbar area

            // Make sure window stays on screen
            var screenWidth = SystemParameters.PrimaryScreenWidth;
            var screenHeight = SystemParameters.PrimaryScreenHeight;

            if (Left + Width > screenWidth)
                Left = screenWidth - Width - 10;
            if (Top + Height > screenHeight)
                Top = screenHeight - Height - 10;
            if (Left < 0)
                Left = 10;
            if (Top < 0)
                Top = 10;
        }
    }

    public async Task EvaluateContentAsync(string pageContent, string pageUrl, string pageTitle)
    {
        // Extract domain from URL
        _currentDomain = ExtractDomain(pageUrl);

        // Show loading state
        LoadingPanel.Visibility = Visibility.Visible;
        ContentPanel.Visibility = Visibility.Collapsed;
        DomainUrlText.Text = _currentDomain;

        try
        {
            var result = await _nutritionService.EvaluateContentAsync(pageContent, pageUrl, pageTitle);

            // Update UI with results
            Application.Current.Dispatcher.Invoke(() =>
            {
                UpdateUI(result);
                LoadingPanel.Visibility = Visibility.Collapsed;
                ContentPanel.Visibility = Visibility.Visible;
            });
        }
        catch (Exception ex)
        {
            Application.Current.Dispatcher.Invoke(() =>
            {
                OverallScoreText.Text = "N/A";
                DomainUrlText.Text = _currentDomain;
                IngredientsText.Text = $"Unable to analyze content: {ex.Message}";
                LoadingPanel.Visibility = Visibility.Collapsed;
                ContentPanel.Visibility = Visibility.Visible;
            });
        }
    }

    /// <summary>
    /// Extracts just the domain from a URL (e.g., "example.com" from "https://www.example.com/path/page")
    /// </summary>
    private string ExtractDomain(string url)
    {
        try
        {
            var uri = new Uri(url);
            var host = uri.Host;
            // Remove www. prefix if present
            if (host.StartsWith("www."))
                host = host.Substring(4);
            return host;
        }
        catch
        {
            return url;
        }
    }

    private void UpdateUI(SpiritualNutritionResult result)
    {
        // Update overall score with percentage symbol
        OverallScoreText.Text = $"{result.OverallScore}%";

        // Update domain URL
        DomainUrlText.Text = _currentDomain;

        // Update all 10 category scores
        TruthfulnessText.Text = $"{result.Truthfulness}%";
        MoralAlignmentText.Text = $"{result.MoralAlignment}%";
        HumanDignityText.Text = $"{result.HumanDignity}%";
        EmotionalImpactText.Text = $"{result.EmotionalImpact}%";
        WisdomVsFollyText.Text = $"{result.WisdomVsFolly}%";
        IntentDirectionText.Text = $"{result.IntentDirection}%";
        BiblicalWorldviewText.Text = $"{result.BiblicalWorldview}%";
        EarlyChurchText.Text = $"{result.EarlyChurchResonance}%";
        ConstructiveText.Text = $"{result.ConstructiveInfluence}%";
        SpiritualDensityText.Text = $"{result.SpiritualDensity}%";

        // Update ingredients text
        IngredientsText.Text = result.Ingredients;
    }

    private void TitleBar_MouseLeftButtonDown(object sender, MouseButtonEventArgs e)
    {
        if (e.ClickCount == 1)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        _isClosing = true;
        Close();
    }

    private void Window_Deactivated(object sender, EventArgs e)
    {
        // Close the window when it loses focus (user clicks on main browser window)
        // But only if we're not already in the process of closing
        if (!_isClosing)
        {
            _isClosing = true;

            // Use Dispatcher to ensure we close after the activation event completes
            // This prevents race conditions with focus
            Dispatcher.BeginInvoke(new Action(() =>
            {
                Close();
                // Ensure the main browser stays in focus
                Owner?.Activate();
            }), System.Windows.Threading.DispatcherPriority.Background);
        }
    }
}
