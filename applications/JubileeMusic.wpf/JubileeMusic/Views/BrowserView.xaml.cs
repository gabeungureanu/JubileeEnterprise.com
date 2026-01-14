using System.ComponentModel;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class BrowserView : UserControl
{
    private BrowserViewModel? _viewModel;
    private const double PanelWidth = 320;

    public BrowserView()
    {
        InitializeComponent();

        Loaded += async (s, e) =>
        {
            if (DataContext is BrowserViewModel viewModel)
            {
                _viewModel = viewModel;
                _viewModel.PropertyChanged += OnViewModelPropertyChanged;

                // Set initial panel state without animation
                UpdatePanelWidth(_viewModel.IsCreatorPanelOpen, animate: false);

                await viewModel.InitializeWebViewAsync(WebView);
            }
        };

        Unloaded += (s, e) =>
        {
            if (_viewModel != null)
            {
                _viewModel.PropertyChanged -= OnViewModelPropertyChanged;
            }
        };
    }

    private void OnViewModelPropertyChanged(object? sender, PropertyChangedEventArgs e)
    {
        if (e.PropertyName == nameof(BrowserViewModel.IsCreatorPanelOpen))
        {
            UpdatePanelWidth(_viewModel?.IsCreatorPanelOpen ?? false, animate: true);
        }
    }

    private void UpdatePanelWidth(bool isOpen, bool animate)
    {
        var targetWidth = isOpen ? PanelWidth : 0;

        if (!animate)
        {
            CreatorPanelColumn.Width = new GridLength(targetWidth);
            return;
        }

        // Use a timer-based approach for smooth animation since GridLength doesn't support standard animation
        AnimateGridColumn(CreatorPanelColumn, targetWidth, isOpen ? 250 : 200, isOpen);
    }

    private void AnimateGridColumn(ColumnDefinition column, double targetWidth, int durationMs, bool isOpening)
    {
        var startWidth = column.Width.Value;
        var startTime = DateTime.Now;

        System.Windows.Threading.DispatcherTimer timer = new()
        {
            Interval = TimeSpan.FromMilliseconds(16) // ~60fps
        };

        timer.Tick += (s, e) =>
        {
            var elapsed = DateTime.Now - startTime;
            var progress = Math.Min(1.0, elapsed.TotalMilliseconds / durationMs);

            // Apply easing
            var easedProgress = isOpening
                ? EaseOut(progress)
                : EaseIn(progress);

            var currentWidth = startWidth + (targetWidth - startWidth) * easedProgress;
            column.Width = new GridLength(Math.Max(0, currentWidth));

            if (progress >= 1.0)
            {
                timer.Stop();
                column.Width = new GridLength(targetWidth);
            }
        };

        timer.Start();
    }

    // Cubic ease out
    private static double EaseOut(double t)
    {
        return 1 - Math.Pow(1 - t, 3);
    }

    // Cubic ease in
    private static double EaseIn(double t)
    {
        return t * t * t;
    }

    // Handle TextBox focus to prevent WebView2 from stealing keyboard input
    private void TextBox_GotFocus(object sender, RoutedEventArgs e)
    {
        if (sender is TextBox textBox)
        {
            // Ensure the textbox captures keyboard input
            textBox.Focus();
            Keyboard.Focus(textBox);
        }
    }
}
