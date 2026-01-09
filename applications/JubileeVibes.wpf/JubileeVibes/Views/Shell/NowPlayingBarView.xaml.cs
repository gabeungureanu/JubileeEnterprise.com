using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using Microsoft.Extensions.DependencyInjection;
using JubileeVibes.ViewModels.Shell;

namespace JubileeVibes.Views.Shell;

public partial class NowPlayingBarView : UserControl
{
    private NowPlayingBarViewModel ViewModel => (NowPlayingBarViewModel)DataContext;

    public NowPlayingBarView()
    {
        InitializeComponent();
        DataContext = App.Services.GetRequiredService<NowPlayingBarViewModel>();
    }

    private void SeekSlider_MouseUp(object sender, MouseButtonEventArgs e)
    {
        if (sender is Slider slider)
        {
            ViewModel.SeekToPosition(slider.Value);
        }
    }
}
