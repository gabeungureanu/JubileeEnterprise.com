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
            viewModel.CreateContactListRequested += ViewModel_CreateContactListRequested;
            viewModel.DuplicateContactDetected += ViewModel_DuplicateContactDetected;
            viewModel.RenameContactListRequested += ViewModel_RenameContactListRequested;
            viewModel.DeleteContactListConfirmRequested += ViewModel_DeleteContactListConfirmRequested;
            viewModel.DeleteContactConfirmRequested += ViewModel_DeleteContactConfirmRequested;
        }

        // Load contacts when the view is loaded
        Loaded += PeopleView_Loaded;
    }

    private async void PeopleView_Loaded(object sender, RoutedEventArgs e)
    {
        // Load contacts and contact groups from database when view is shown
        if (DataContext is PeopleViewModel viewModel)
        {
            await viewModel.LoadContactsFromDatabaseAsync();
            await viewModel.LoadContactGroupsAsync();
        }

        // Ensure we can receive keyboard events
        Focusable = true;
        Focus();
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
            oldViewModel.CreateContactListRequested -= ViewModel_CreateContactListRequested;
            oldViewModel.DuplicateContactDetected -= ViewModel_DuplicateContactDetected;
            oldViewModel.RenameContactListRequested -= ViewModel_RenameContactListRequested;
            oldViewModel.DeleteContactListConfirmRequested -= ViewModel_DeleteContactListConfirmRequested;
            oldViewModel.DeleteContactConfirmRequested -= ViewModel_DeleteContactConfirmRequested;
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
            newViewModel.CreateContactListRequested += ViewModel_CreateContactListRequested;
            newViewModel.DuplicateContactDetected += ViewModel_DuplicateContactDetected;
            newViewModel.RenameContactListRequested += ViewModel_RenameContactListRequested;
            newViewModel.DeleteContactListConfirmRequested += ViewModel_DeleteContactListConfirmRequested;
            newViewModel.DeleteContactConfirmRequested += ViewModel_DeleteContactConfirmRequested;

            // Load contacts and groups when DataContext changes
            _ = newViewModel.LoadContactsFromDatabaseAsync();
            _ = newViewModel.LoadContactGroupsAsync();
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
    /// Handle double-click on contact to show detail preview
    /// </summary>
    private void ContactsListBox_MouseDoubleClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is PeopleViewModel viewModel && viewModel.SelectedContact != null)
        {
            viewModel.PreviewContact = viewModel.SelectedContact;
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
        if (DataContext is ViewModels.PeopleViewModel vm && vm.PreviewContact != null)
        {
            var contact = vm.PreviewContact;
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

    private void SubFolder_Click(object sender, System.Windows.Input.MouseButtonEventArgs e)
    {
        if (sender is FrameworkElement fe && fe.DataContext is ContactFolder subFolder && subFolder.GroupId != null)
        {
            if (DataContext is PeopleViewModel vm)
            {
                vm.SelectedFolder = subFolder;
            }
        }
    }

    private async void ViewModel_CreateContactListRequested(object? sender, EventArgs e)
    {
        var inputDialog = new InputDialog("New contact list", "Enter a name for the new list:");
        inputDialog.Owner = Window.GetWindow(this);

        if (inputDialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(inputDialog.InputValue))
        {
            if (DataContext is PeopleViewModel vm)
            {
                var success = await vm.CreateContactListAsync(inputDialog.InputValue.Trim());
                if (!success)
                {
                    ThemedMessageBox.Show(Window.GetWindow(this),
                        "Failed to create contact list. Please try again.",
                        "Error",
                        MessageBoxButton.OK,
                        MessageBoxImage.Error);
                }
            }
        }
    }

    private async Task<bool> ViewModel_DuplicateContactDetected(Contact contact)
    {
        var tcs = new TaskCompletionSource<bool>();

        // Must dispatch to UI thread for dialog
        Dispatcher.Invoke(() =>
        {
            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                $"A contact with the name '{contact.DisplayName}' may already exist.\n\nDo you want to create it anyway?",
                "Possible Duplicate",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            tcs.SetResult(result == MessageBoxResult.Yes);
        });

        return await tcs.Task;
    }

    /// <summary>
    /// Handle rename contact list event from ViewModel - show input dialog
    /// </summary>
    private async Task<string?> ViewModel_RenameContactListRequested(string currentName, string groupId)
    {
        var tcs = new TaskCompletionSource<string?>();

        Dispatcher.Invoke(() =>
        {
            var dialog = new InputDialog("Rename list", "Enter a new name for the list:", currentName);
            dialog.Owner = Window.GetWindow(this);

            if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
            {
                tcs.SetResult(dialog.InputValue.Trim());
            }
            else
            {
                tcs.SetResult(null);
            }
        });

        return await tcs.Task;
    }

    /// <summary>
    /// Handle delete contact list confirmation event from ViewModel
    /// </summary>
    private async Task<bool> ViewModel_DeleteContactListConfirmRequested(string listName)
    {
        var tcs = new TaskCompletionSource<bool>();

        Dispatcher.Invoke(() =>
        {
            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                $"Are you sure you want to delete the list '{listName}'?\n\nContacts in this list will not be deleted.",
                "Delete List",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            tcs.SetResult(result == MessageBoxResult.Yes);
        });

        return await tcs.Task;
    }

    /// <summary>
    /// Handle rename list context menu click on a subfolder
    /// </summary>
    private async void RenameList_Click(object sender, RoutedEventArgs e)
    {
        if (sender is MenuItem menuItem && menuItem.Tag is ContactFolder folder && folder.GroupId != null)
        {
            var dialog = new InputDialog("Rename list", "Enter a new name for the list:", folder.Name);
            dialog.Owner = Window.GetWindow(this);

            if (dialog.ShowDialog() == true && !string.IsNullOrWhiteSpace(dialog.InputValue))
            {
                if (DataContext is PeopleViewModel vm)
                {
                    await vm.RenameContactListAsync(folder.GroupId, dialog.InputValue.Trim());
                }
            }
        }
    }

    /// <summary>
    /// Handle delete list context menu click on a subfolder
    /// </summary>
    private async void DeleteList_Click(object sender, RoutedEventArgs e)
    {
        if (sender is MenuItem menuItem && menuItem.Tag is ContactFolder folder && folder.GroupId != null)
        {
            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                $"Are you sure you want to delete the list '{folder.Name}'?\n\nContacts in this list will not be deleted.",
                "Delete List",
                MessageBoxButton.YesNo,
                MessageBoxImage.Question);

            if (result == MessageBoxResult.Yes)
            {
                if (DataContext is PeopleViewModel vm)
                {
                    var success = await vm.DeleteContactListAsync(folder.GroupId);
                    if (success)
                    {
                        Services.NotificationService.Instance.ShowSuccess($"List '{folder.Name}' deleted.", "Contacts");
                    }
                    else
                    {
                        Services.NotificationService.Instance.ShowError("Failed to delete list. Please try again.", "Contacts");
                    }
                }
            }
        }
    }

    /// <summary>
    /// Dynamically populate context menu when it opens
    /// </summary>
    private void ContactContextMenu_Opened(object sender, RoutedEventArgs e)
    {
        if (DataContext is not PeopleViewModel vm) return;

        // Populate "Add to list" submenu with available contact groups
        AddToListMenuItem.Items.Clear();
        foreach (var group in vm.ContactGroups)
        {
            var item = new MenuItem
            {
                Header = group.Name,
                Tag = group.Id
            };
            item.Click += ContextMenu_AddToList_Click;
            AddToListMenuItem.Items.Add(item);
        }

        // Show/hide "Add to list" based on whether groups exist
        AddToListMenuItem.Visibility = vm.ContactGroups.Count > 0 ? Visibility.Visible : Visibility.Collapsed;

        // Show "Remove from this list" only when viewing a contact group folder
        RemoveFromListMenuItem.Visibility = vm.SelectedFolder?.GroupId != null
            ? Visibility.Visible
            : Visibility.Collapsed;
    }

    /// <summary>
    /// Handle "Edit" context menu click
    /// </summary>
    private void ContextMenu_EditContact_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.EditContactCommand.Execute(null);
        }
    }

    /// <summary>
    /// Handle "Add to favorites" context menu click
    /// </summary>
    private void ContextMenu_AddToFavorites_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.AddToFavoritesCommand.Execute(null);
        }
    }

    /// <summary>
    /// Handle "Set category" context menu click
    /// </summary>
    private void ContextMenu_SetCategory_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.AddCategoryCommand.Execute(null);
        }
    }

    /// <summary>
    /// Handle "Add to list" submenu click
    /// </summary>
    private async void ContextMenu_AddToList_Click(object sender, RoutedEventArgs e)
    {
        if (sender is MenuItem menuItem && menuItem.Tag is string groupId)
        {
            if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
            {
                var added = await vm.AddContactsToGroupAsync(groupId, new List<string> { vm.SelectedContact.Id });
                if (added > 0)
                {
                    Services.NotificationService.Instance.ShowSuccess(
                        $"'{vm.SelectedContact.DisplayName}' added to '{menuItem.Header}'.", "Contacts");
                }
                else
                {
                    Services.NotificationService.Instance.ShowWarning(
                        "Contact may already be in this list.", "Contacts");
                }
            }
        }
    }

    /// <summary>
    /// Handle "Remove from this list" context menu click
    /// </summary>
    private async void ContextMenu_RemoveFromList_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            var success = await vm.RemoveContactFromGroupAsync(vm.SelectedContact.Id);
            if (success)
            {
                Services.NotificationService.Instance.ShowSuccess(
                    $"'{vm.SelectedContact.DisplayName}' removed from list.", "Contacts");
            }
        }
    }

    /// <summary>
    /// Handle "Delete" context menu click
    /// </summary>
    private void ContextMenu_DeleteContact_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.DeleteContactCommand.Execute(null);
        }
    }

    /// <summary>
    /// Hover action: Email button clicked on a contact row
    /// </summary>
    private void RowAction_Email_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is Button btn && btn.DataContext is ViewModels.Contact contact
            && DataContext is PeopleViewModel vm)
        {
            vm.SelectedContact = contact;
            vm.EmailContactCommand.Execute(null);
        }
    }

    /// <summary>
    /// Hover action: More menu (...) button clicked on a contact row
    /// </summary>
    private void RowAction_MoreMenu_Click(object sender, RoutedEventArgs e)
    {
        e.Handled = true;
        if (sender is Button btn && btn.DataContext is ViewModels.Contact contact
            && DataContext is PeopleViewModel vm)
        {
            vm.SelectedContact = contact;
            var contextMenu = ContactsListBox.ContextMenu;
            if (contextMenu != null)
            {
                contextMenu.PlacementTarget = btn;
                contextMenu.Placement = System.Windows.Controls.Primitives.PlacementMode.Bottom;
                contextMenu.IsOpen = true;
            }
        }
    }

    /// <summary>
    /// Context menu: Share as vCard
    /// </summary>
    private void ContextMenu_ShareAsVCard_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.ShareAsVCardCommand.Execute(null);
        }
    }

    /// <summary>
    /// Context menu: Email contact
    /// </summary>
    private void ContextMenu_Email_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.EmailContactCommand.Execute(null);
        }
    }

    /// <summary>
    /// Context menu: Call contact
    /// </summary>
    private void ContextMenu_Call_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm && vm.SelectedContact != null)
        {
            vm.CallContactCommand.Execute(null);
        }
    }

    /// <summary>
    /// Close the detail modal when clicking the backdrop
    /// </summary>
    private void DetailOverlay_BackdropClick(object sender, MouseButtonEventArgs e)
    {
        if (DataContext is PeopleViewModel vm)
        {
            vm.PreviewContact = null;
        }
    }

    /// <summary>
    /// Close the detail modal via close button
    /// </summary>
    private void DetailModal_Close_Click(object sender, RoutedEventArgs e)
    {
        if (DataContext is PeopleViewModel vm)
        {
            vm.PreviewContact = null;
        }
    }

    /// <summary>
    /// Handle single contact delete request - show confirmation dialog
    /// </summary>
    private async void ViewModel_DeleteContactConfirmRequested(object? sender, Contact contact)
    {
        try
        {
            var isInDeletedFolder = DataContext is PeopleViewModel vm2 && vm2.IsInDeletedFolder;
            var message = isInDeletedFolder
                ? $"Are you sure you want to permanently delete '{contact.DisplayName}'?\n\nThis action cannot be undone."
                : $"Are you sure you want to delete '{contact.DisplayName}'?";
            var title = isInDeletedFolder ? "Permanently Delete Contact" : "Delete Contact";
            var icon = isInDeletedFolder ? MessageBoxImage.Warning : MessageBoxImage.Question;

            var result = ThemedMessageBox.Show(Window.GetWindow(this),
                message, title, MessageBoxButton.YesNo, icon);

            if (result == MessageBoxResult.Yes)
            {
                if (DataContext is PeopleViewModel viewModel)
                {
                    await viewModel.DeleteContactConfirmedAsync(contact);
                    Services.NotificationService.Instance.ShowSuccess($"'{contact.DisplayName}' deleted.", "Contacts");
                }
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleView] Delete contact failed: {ex.Message}");
            ThemedMessageBox.Show(Window.GetWindow(this),
                $"Failed to delete contact: {ex.Message}",
                "Error",
                MessageBoxButton.OK,
                MessageBoxImage.Error);
        }
    }

    /// <summary>
    /// Handle tab navigation in the detail modal
    /// </summary>
    private void DetailTab_Click(object sender, RoutedEventArgs e)
    {
        // Tab switching is visual-only for now (Overview is default active)
        // Future: show/hide content sections based on selected tab
        if (sender is not Button clickedTab) return;
        var tabName = clickedTab.Tag?.ToString() ?? "Overview";
        System.Diagnostics.Debug.WriteLine($"[PeopleView] Detail tab clicked: {tabName}");
    }

    /// <summary>
    /// Handle keyboard shortcuts for the People view
    /// </summary>
    private void PeopleView_KeyDown(object sender, KeyEventArgs e)
    {
        if (DataContext is not PeopleViewModel vm) return;

        if (Keyboard.Modifiers == ModifierKeys.Control)
        {
            switch (e.Key)
            {
                case Key.N:
                    // Ctrl+N: New contact
                    vm.NewContactCommand.Execute(null);
                    e.Handled = true;
                    break;

                case Key.F:
                    // Ctrl+F: Focus search box
                    SearchTextBox?.Focus();
                    SearchTextBox?.SelectAll();
                    e.Handled = true;
                    break;

                case Key.E:
                    // Ctrl+E: Edit selected contact
                    if (vm.SelectedContact != null)
                    {
                        vm.EditContactCommand.Execute(null);
                        e.Handled = true;
                    }
                    break;

                case Key.I:
                    // Ctrl+I: Import contacts
                    vm.ImportContactsCommand.Execute(null);
                    e.Handled = true;
                    break;
            }
        }
        else if (Keyboard.Modifiers == ModifierKeys.None)
        {
            switch (e.Key)
            {
                case Key.Delete:
                    // Delete: Delete selected contact
                    if (vm.SelectedContact != null)
                    {
                        vm.DeleteContactCommand.Execute(null);
                        e.Handled = true;
                    }
                    break;

                case Key.F2:
                    // F2: Edit selected contact (rename-style shortcut)
                    if (vm.SelectedContact != null)
                    {
                        vm.EditContactCommand.Execute(null);
                        e.Handled = true;
                    }
                    break;

                case Key.Escape:
                    // Escape: Close detail modal first, then clear search
                    if (vm.PreviewContact != null)
                    {
                        vm.PreviewContact = null;
                        e.Handled = true;
                    }
                    else if (!string.IsNullOrEmpty(vm.SearchText))
                    {
                        vm.SearchText = string.Empty;
                        e.Handled = true;
                    }
                    break;
            }
        }
    }
}
