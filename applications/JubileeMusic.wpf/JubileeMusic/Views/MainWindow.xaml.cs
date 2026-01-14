using System.Windows;
using JubileeMusic.ViewModels;

namespace JubileeMusic.Views;

public partial class MainWindow : Window
{
    public MainWindow(MainViewModel viewModel)
    {
        InitializeComponent();
        DataContext = viewModel;

        Loaded += async (s, e) =>
        {
            await viewModel.InitializeAsync();
        };
    }
}
