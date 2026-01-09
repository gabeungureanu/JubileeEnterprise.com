using System.Windows.Controls;
using Microsoft.Extensions.DependencyInjection;
using JubileeVibes.ViewModels.Shell;

namespace JubileeVibes.Views.Shell;

public partial class SidebarView : UserControl
{
    public SidebarView()
    {
        InitializeComponent();
        DataContext = App.Services.GetRequiredService<SidebarViewModel>();
    }
}
