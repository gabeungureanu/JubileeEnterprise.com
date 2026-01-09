using System.Windows.Controls;
using Microsoft.Extensions.DependencyInjection;
using JubileeVibes.ViewModels.Shell;

namespace JubileeVibes.Views.Shell;

public partial class ShellView : UserControl
{
    public ShellView()
    {
        InitializeComponent();
        DataContext = App.Services.GetRequiredService<ShellViewModel>();
    }
}
