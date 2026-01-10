using System.Windows;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

public partial class NewEventWindow : Window
{
    public NewEventWindow()
    {
        InitializeComponent();

        if (DataContext is NewEventViewModel viewModel)
        {
            viewModel.SaveCompleted += (s, e) =>
            {
                DialogResult = true;
                Close();
            };
        }
    }

    private void MinimizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void MaximizeButton_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState == WindowState.Maximized
            ? WindowState.Normal
            : WindowState.Maximized;
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }
}
