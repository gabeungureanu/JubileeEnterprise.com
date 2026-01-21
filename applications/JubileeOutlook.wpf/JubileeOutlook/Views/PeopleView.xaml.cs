using System.Windows.Controls;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

/// <summary>
/// Interaction logic for PeopleView.xaml
/// </summary>
public partial class PeopleView : UserControl
{
    public PeopleView()
    {
        InitializeComponent();
    }

    /// <summary>
    /// Set the user email for the People view
    /// </summary>
    public void SetUserEmail(string email)
    {
        if (DataContext is PeopleViewModel viewModel)
        {
            viewModel.SetUserEmail(email);
        }
    }
}
