using System.Windows.Controls;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class BrowserView : UserControl
{
    public BrowserView()
    {
        InitializeComponent();

        Loaded += async (s, e) =>
        {
            if (DataContext is BrowserViewModel viewModel)
            {
                await viewModel.InitializeWebViewAsync(WebView);
            }
        };
    }
}
