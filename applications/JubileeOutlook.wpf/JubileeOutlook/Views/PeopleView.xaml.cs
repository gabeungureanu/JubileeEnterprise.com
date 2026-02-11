using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using JubileeOutlook.ViewModels;
using Microsoft.Win32;
using IOFile = System.IO.File;

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
            viewModel.ShareAsVCardRequested += ViewModel_ShareAsVCardRequested;
            viewModel.AddCategoryRequested += ViewModel_AddCategoryRequested;
            viewModel.ImportContactsRequested += ViewModel_ImportContactsRequested;
            viewModel.ExportContactsRequested += ViewModel_ExportContactsRequested;
            viewModel.EmptyDeletedFolderRequested += ViewModel_EmptyDeletedFolderRequested;
            viewModel.BulkDeleteRequested += ViewModel_BulkDeleteRequested;
            viewModel.BulkAddCategoryRequested += ViewModel_BulkAddCategoryRequested;
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
            oldViewModel.ShareAsVCardRequested -= ViewModel_ShareAsVCardRequested;
            oldViewModel.AddCategoryRequested -= ViewModel_AddCategoryRequested;
            oldViewModel.ImportContactsRequested -= ViewModel_ImportContactsRequested;
            oldViewModel.ExportContactsRequested -= ViewModel_ExportContactsRequested;
            oldViewModel.EmptyDeletedFolderRequested -= ViewModel_EmptyDeletedFolderRequested;
            oldViewModel.BulkDeleteRequested -= ViewModel_BulkDeleteRequested;
            oldViewModel.BulkAddCategoryRequested -= ViewModel_BulkAddCategoryRequested;
        }

        if (e.NewValue is PeopleViewModel newViewModel)
        {
            newViewModel.NewContactRequested += ViewModel_NewContactRequested;
            newViewModel.EditContactRequested += ViewModel_EditContactRequested;
            newViewModel.ShareAsVCardRequested += ViewModel_ShareAsVCardRequested;
            newViewModel.AddCategoryRequested += ViewModel_AddCategoryRequested;
            newViewModel.ImportContactsRequested += ViewModel_ImportContactsRequested;
            newViewModel.ExportContactsRequested += ViewModel_ExportContactsRequested;
            newViewModel.EmptyDeletedFolderRequested += ViewModel_EmptyDeletedFolderRequested;
            newViewModel.BulkDeleteRequested += ViewModel_BulkDeleteRequested;
            newViewModel.BulkAddCategoryRequested += ViewModel_BulkAddCategoryRequested;

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

    /// <summary>
    /// Handle dropdown menu item click - close the dropdown
    /// </summary>
    private void DropdownMenuItem_Click(object sender, RoutedEventArgs e)
    {
        // Close the dropdown by unchecking the toggle button
        if (NewContactDropdownButton != null)
        {
            NewContactDropdownButton.IsChecked = false;
        }
    }

    /// <summary>
    /// Handle sort menu item click - close the sort dropdown
    /// </summary>
    private void SortMenuItem_Click(object sender, RoutedEventArgs e)
    {
        // Close the dropdown by unchecking the toggle button
        if (SortDropdownButton != null)
        {
            SortDropdownButton.IsChecked = false;
        }
    }

    /// <summary>
    /// Handle selection changed to update multi-select collection
    /// </summary>
    private void ContactsListBox_SelectionChanged(object sender, SelectionChangedEventArgs e)
    {
        if (DataContext is PeopleViewModel viewModel && sender is ListBox listBox)
        {
            viewModel.UpdateSelectedContacts(listBox.SelectedItems);
        }
    }

    /// <summary>
    /// Handle bulk delete request - show confirmation dialog
    /// </summary>
    private async void ViewModel_BulkDeleteRequested(object? sender, int count)
    {
        try
        {
            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                $"Are you sure you want to delete {count} contact(s)?",
                "Delete Contacts",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    var deletedCount = await viewModel.BulkDeleteConfirmedAsync();
                    if (deletedCount > 0)
                    {
                        Services.NotificationService.Instance.ShowSuccess($"{deletedCount} contact(s) deleted");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Bulk delete failed: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to delete contacts: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle bulk category request - show input dialog
    /// </summary>
    private async void ViewModel_BulkAddCategoryRequested(object? sender, List<Contact> contacts)
    {
        try
        {
            var dialog = new InputDialog(
                "Set Category",
                $"Enter a category for {contacts.Count} contact(s):",
                ""
            );
            dialog.Owner = Window.GetWindow(this);

            if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    var updatedCount = await viewModel.BulkUpdateCategoryAsync(dialog.InputValue.Trim());
                    Services.NotificationService.Instance.ShowSuccess($"Category set for {updatedCount} contact(s)");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Bulk category failed: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to set category: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle share as vCard request - show save file dialog
    /// </summary>
    private void ViewModel_ShareAsVCardRequested(object? sender, (Contact Contact, string VCardContent) args)
    {
        try
        {
            var saveDialog = new SaveFileDialog
            {
                Title = "Save Contact as vCard",
                Filter = "vCard Files (*.vcf)|*.vcf",
                FileName = SanitizeFileName(args.Contact.DisplayName) + ".vcf",
                DefaultExt = ".vcf"
            };

            if (saveDialog.ShowDialog() == true)
            {
                IOFile.WriteAllText(saveDialog.FileName, args.VCardContent);
                System.Diagnostics.Debug.WriteLine($"[PeopleView] vCard saved to: {saveDialog.FileName}");

                // Show success notification
                Services.NotificationService.Instance.ShowSuccess($"Contact saved to {System.IO.Path.GetFileName(saveDialog.FileName)}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to save vCard: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to save vCard: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Sanitizes a filename by removing invalid characters
    /// </summary>
    private static string SanitizeFileName(string fileName)
    {
        var invalidChars = System.IO.Path.GetInvalidFileNameChars();
        return string.Join("_", fileName.Split(invalidChars, StringSplitOptions.RemoveEmptyEntries));
    }

    /// <summary>
    /// Handle add category request - show input dialog
    /// </summary>
    private async void ViewModel_AddCategoryRequested(object? sender, Contact contact)
    {
        try
        {
            var dialog = new InputDialog(
                "Add Category",
                $"Enter a category for {contact.DisplayName}:",
                contact.Category ?? ""
            );
            dialog.Owner = Window.GetWindow(this);

            if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    await viewModel.UpdateContactCategoryAsync(contact, dialog.InputValue.Trim());
                    Services.NotificationService.Instance.ShowSuccess($"Category set to '{dialog.InputValue.Trim()}'");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to add category: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to add category: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle import contacts request - show open file dialog
    /// </summary>
    private async void ViewModel_ImportContactsRequested(object? sender, EventArgs e)
    {
        try
        {
            var openDialog = new OpenFileDialog
            {
                Title = "Import Contacts",
                Filter = "vCard Files (*.vcf)|*.vcf|CSV Files (*.csv)|*.csv|All Files (*.*)|*.*",
                DefaultExt = ".vcf",
                Multiselect = false
            };

            if (openDialog.ShowDialog() == true)
            {
                var content = IOFile.ReadAllText(openDialog.FileName);
                var extension = System.IO.Path.GetExtension(openDialog.FileName).ToLowerInvariant();

                if (DataContext is PeopleViewModel viewModel)
                {
                    if (extension == ".vcf")
                    {
                        await viewModel.ImportContactsFromVCardAsync(content);
                        Services.NotificationService.Instance.ShowSuccess("Contacts imported successfully");
                    }
                    else if (extension == ".csv")
                    {
                        var importedCount = await viewModel.ImportContactsFromCsvAsync(content);
                        if (importedCount > 0)
                        {
                            Services.NotificationService.Instance.ShowSuccess($"{importedCount} contact(s) imported successfully");
                        }
                        else
                        {
                            Services.NotificationService.Instance.ShowWarning("No contacts found in CSV file. Please check the file format.");
                        }
                    }
                    else
                    {
                        Services.NotificationService.Instance.ShowWarning("Unsupported file format. Please use vCard (.vcf) or CSV format.");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to import contacts: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to import contacts: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle export contacts request - show save file dialog
    /// </summary>
    private void ViewModel_ExportContactsRequested(object? sender, List<Contact> contacts)
    {
        try
        {
            if (contacts.Count == 0)
            {
                Services.NotificationService.Instance.ShowInfo("No contacts to export.");
                return;
            }

            var saveDialog = new SaveFileDialog
            {
                Title = "Export Contacts",
                Filter = "vCard Files (*.vcf)|*.vcf",
                FileName = "contacts.vcf",
                DefaultExt = ".vcf"
            };

            if (saveDialog.ShowDialog() == true)
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    var vCardContent = viewModel.GenerateMultipleVCards(contacts);
                    IOFile.WriteAllText(saveDialog.FileName, vCardContent);
                    System.Diagnostics.Debug.WriteLine($"[PeopleView] Contacts exported to: {saveDialog.FileName}");
                    Services.NotificationService.Instance.ShowSuccess($"{contacts.Count} contacts exported successfully");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to export contacts: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to export contacts: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle empty deleted folder request - show confirmation dialog
    /// </summary>
    private async void ViewModel_EmptyDeletedFolderRequested(object? sender, int deletedCount)
    {
        try
        {
            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                $"Are you sure you want to permanently delete {deletedCount} contact(s)?\n\nThis action cannot be undone.",
                "Empty Deleted Folder",
                MessageBoxButton.YesNo,
                MessageBoxImage.Warning);

            if (result == MessageBoxResult.Yes)
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    var actualDeleted = await viewModel.EmptyDeletedFolderConfirmedAsync();
                    if (actualDeleted > 0)
                    {
                        Services.NotificationService.Instance.ShowSuccess($"{actualDeleted} contact(s) permanently deleted");
                    }
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Failed to empty deleted folder: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to empty deleted folder: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    private void ClearSearchButton_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is ViewModels.PeopleViewModel vm)
        {
            vm.SearchText = string.Empty;
            SearchTextBox.Focus();
        }
    }

    private void ViewOnMap_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (DataContext is ViewModels.PeopleViewModel vm && vm.SelectedContact != null)
        {
            var contact = vm.SelectedContact;
            var parts = new[] { contact.Address, contact.City, contact.State, contact.PostalCode, contact.Country }
                .Where(p => !string.IsNullOrWhiteSpace(p));
            var query = Uri.EscapeDataString(string.Join(", ", parts));
            if (!string.IsNullOrEmpty(query))
            {
                System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
                {
                    FileName = $"https://www.google.com/maps/search/?api=1&query={query}",
                    UseShellExecute = true
                });
            }
        }
    }

    private void Email_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is System.Windows.Controls.TextBlock tb && !string.IsNullOrWhiteSpace(tb.Text))
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = $"mailto:{tb.Text}",
                UseShellExecute = true
            });
        }
    }

    private void Phone_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is System.Windows.Controls.TextBlock tb && !string.IsNullOrWhiteSpace(tb.Text))
        {
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = $"tel:{tb.Text}",
                UseShellExecute = true
            });
        }
    }

    private void Website_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is System.Windows.Controls.TextBlock tb && !string.IsNullOrWhiteSpace(tb.Text))
        {
            var url = tb.Text;
            if (!url.StartsWith("http://", StringComparison.OrdinalIgnoreCase) &&
                !url.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            {
                url = "https://" + url;
            }
            System.Diagnostics.Process.Start(new System.Diagnostics.ProcessStartInfo
            {
                FileName = url,
                UseShellExecute = true
            });
        }
    }
}
