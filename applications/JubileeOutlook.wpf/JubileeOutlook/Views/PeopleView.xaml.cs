using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
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

        // Subscribe to ViewModel events when DataContext is set
        DataContextChanged += PeopleView_DataContextChanged;

        // Also subscribe to the initial DataContext (set in XAML before this runs)
        if (DataContext is PeopleViewModel viewModel)
        {
            viewModel.NewContactRequested += ViewModel_NewContactRequested;
            viewModel.EditContactRequested += ViewModel_EditContactRequested;
        }

        // Load contacts when the view is loaded
        Loaded += PeopleView_Loaded;
    }

    private async void PeopleView_Loaded(object sender, RoutedEventArgs e)
    {
        // Load contacts from database when view is shown
        if (DataContext is PeopleViewModel viewModel)
        {
            await viewModel.LoadContactsFromDatabaseAsync();
        }
    }

    private void PeopleView_DataContextChanged(object sender, DependencyPropertyChangedEventArgs e)
    {
        if (e.OldValue is PeopleViewModel oldViewModel)
        {
            oldViewModel.NewContactRequested -= ViewModel_NewContactRequested;
            oldViewModel.EditContactRequested -= ViewModel_EditContactRequested;
        }

        if (e.NewValue is PeopleViewModel newViewModel)
        {
            newViewModel.NewContactRequested += ViewModel_NewContactRequested;
            newViewModel.EditContactRequested += ViewModel_EditContactRequested;

            // Load contacts when DataContext changes
            _ = newViewModel.LoadContactsFromDatabaseAsync();
        }
    }

    private async void ViewModel_NewContactRequested(object? sender, EventArgs e)
    {
        var dialog = new NewContactDialog();
        dialog.Owner = Window.GetWindow(this);

        if (dialog.ShowDialog() == true && dialog.CreatedContact != null)
        {
            if (DataContext is PeopleViewModel viewModel)
            {
                try
                {
                    await viewModel.AddContactAsync(dialog.CreatedContact);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to add contact: {ex.Message}");
                    ThemedMessageBox.Show(Window.GetWindow(this),
                        $"Failed to save contact: {ex.Message}",
                        "Error",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
            }
        }
    }

    private async void ViewModel_EditContactRequested(object? sender, Contact contact)
    {
        System.Diagnostics.Debug.WriteLine($"[PeopleView] EditContactRequested - DisplayName: {contact.DisplayName}, FirstName: {contact.FirstName}, LastName: {contact.LastName}, Email: {contact.Email}, Phone: {contact.Phone}");
        var dialog = new NewContactDialog(contact);
        dialog.Owner = Window.GetWindow(this);

        if (dialog.ShowDialog() == true && dialog.CreatedContact != null)
        {
            if (DataContext is PeopleViewModel viewModel)
            {
                try
                {
                    await viewModel.UpdateContactAsync(contact, dialog.CreatedContact);
                }
                catch (Exception ex)
                {
                    System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to update contact: {ex.Message}");
                    ThemedMessageBox.Show(Window.GetWindow(this),
                        $"Failed to update contact: {ex.Message}",
                        "Error",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
            }
        }
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

    /// <summary>
    /// Handle double-click on contact to open edit dialog
    /// </summary>
    private void ContactsListBox_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is PeopleViewModel viewModel && viewModel.SelectedContact != null)
        {
            viewModel.EditContactCommand.Execute(null);
        }
    }
}
