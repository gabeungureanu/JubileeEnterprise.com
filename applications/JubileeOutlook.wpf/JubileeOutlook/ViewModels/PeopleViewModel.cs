using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;

namespace JubileeOutlook.ViewModels;

/// <summary>
/// ViewModel for the People/Contacts module
/// </summary>
public partial class PeopleViewModel : ObservableObject
{
    [ObservableProperty]
    private string _userEmail = string.Empty;

    [ObservableProperty]
    private string _searchText = string.Empty;

    [ObservableProperty]
    private ContactFolder? _selectedFolder;

    [ObservableProperty]
    private Contact? _selectedContact;

    [ObservableProperty]
    private bool _isLoading = false;

    [ObservableProperty]
    private bool _hasContacts = false;

    public ObservableCollection<ContactFolder> Folders { get; } = new();
    public ObservableCollection<Contact> Contacts { get; } = new();
    public ObservableCollection<Contact> FilteredContacts { get; } = new();

    public PeopleViewModel()
    {
        InitializeFolders();
    }

    private void InitializeFolders()
    {
        // Initialize default folders matching Outlook structure
        Folders.Add(new ContactFolder { Name = "Your contacts", Icon = "\ue7fb", IsSelected = true });
        Folders.Add(new ContactFolder { Name = "Favorites", Icon = "\ue838" });
        Folders.Add(new ContactFolder { Name = "Your contact lists", Icon = "\ue7ef" });
        Folders.Add(new ContactFolder { Name = "Deleted", Icon = "\ue872" });

        SelectedFolder = Folders.FirstOrDefault();
    }

    public void SetUserEmail(string email)
    {
        UserEmail = email;
    }

    partial void OnSearchTextChanged(string value)
    {
        FilterContacts();
    }

    partial void OnSelectedFolderChanged(ContactFolder? value)
    {
        // Update selection state
        foreach (var folder in Folders)
        {
            folder.IsSelected = folder == value;
        }

        // Reload contacts for the selected folder
        LoadContactsForFolder();
    }

    private void FilterContacts()
    {
        FilteredContacts.Clear();

        var query = SearchText?.Trim().ToLowerInvariant() ?? string.Empty;

        foreach (var contact in Contacts)
        {
            if (string.IsNullOrEmpty(query) ||
                contact.DisplayName.ToLowerInvariant().Contains(query) ||
                contact.Email.ToLowerInvariant().Contains(query) ||
                (contact.Company?.ToLowerInvariant().Contains(query) ?? false))
            {
                FilteredContacts.Add(contact);
            }
        }

        HasContacts = FilteredContacts.Count > 0;
    }

    private void LoadContactsForFolder()
    {
        // Clear existing contacts
        Contacts.Clear();
        FilteredContacts.Clear();
        HasContacts = false;

        // TODO: Load contacts from the selected folder
        // For now, just update the filtered view
        FilterContacts();
    }

    [RelayCommand]
    private void NewContact()
    {
        // TODO: Open new contact dialog/form
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] New contact requested");
    }

    [RelayCommand]
    private void EditContact()
    {
        if (SelectedContact == null) return;
        // TODO: Open edit contact dialog/form
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Edit contact: {SelectedContact.DisplayName}");
    }

    [RelayCommand]
    private void DeleteContact()
    {
        if (SelectedContact == null) return;
        // TODO: Delete the selected contact
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Delete contact: {SelectedContact.DisplayName}");
    }

    [RelayCommand]
    private void EmailContact()
    {
        if (SelectedContact == null || string.IsNullOrEmpty(SelectedContact.Email)) return;
        // TODO: Open compose mail with this contact's email
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Email contact: {SelectedContact.Email}");
    }

    [RelayCommand]
    private void CallContact()
    {
        if (SelectedContact == null || string.IsNullOrEmpty(SelectedContact.Phone)) return;
        // TODO: Initiate call
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Call contact: {SelectedContact.Phone}");
    }

    [RelayCommand]
    private void ChatContact()
    {
        if (SelectedContact == null) return;
        // TODO: Open chat
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Chat with: {SelectedContact.DisplayName}");
    }

    [RelayCommand]
    private void ShareAsVCard()
    {
        if (SelectedContact == null) return;
        // TODO: Export as vCard
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Share as vCard: {SelectedContact.DisplayName}");
    }

    [RelayCommand]
    private void AddToFavorites()
    {
        if (SelectedContact == null) return;
        SelectedContact.IsFavorite = !SelectedContact.IsFavorite;
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Toggle favorite: {SelectedContact.DisplayName} = {SelectedContact.IsFavorite}");
    }

    [RelayCommand]
    private void AddCategory()
    {
        // TODO: Open category picker
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Add category requested");
    }

    [RelayCommand]
    private void ImportContacts()
    {
        // TODO: Open import dialog
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Import contacts requested");
    }

    [RelayCommand]
    private void ExportContacts()
    {
        // TODO: Open export dialog
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Export contacts requested");
    }

    [RelayCommand]
    private void SelectFolder(ContactFolder folder)
    {
        SelectedFolder = folder;
    }
}

/// <summary>
/// Represents a contact folder in the People module
/// </summary>
public partial class ContactFolder : ObservableObject
{
    [ObservableProperty]
    private string _name = string.Empty;

    [ObservableProperty]
    private string _icon = "\ue7fb";

    [ObservableProperty]
    private bool _isSelected = false;

    [ObservableProperty]
    private bool _isExpanded = false;

    public ObservableCollection<ContactFolder> SubFolders { get; } = new();
}

/// <summary>
/// Represents a contact in the People module
/// </summary>
public partial class Contact : ObservableObject
{
    [ObservableProperty]
    private string _id = string.Empty;

    [ObservableProperty]
    private string _displayName = string.Empty;

    [ObservableProperty]
    private string _firstName = string.Empty;

    [ObservableProperty]
    private string _lastName = string.Empty;

    [ObservableProperty]
    private string _email = string.Empty;

    [ObservableProperty]
    private string _phone = string.Empty;

    [ObservableProperty]
    private string _mobilePhone = string.Empty;

    [ObservableProperty]
    private string _company = string.Empty;

    [ObservableProperty]
    private string _jobTitle = string.Empty;

    [ObservableProperty]
    private string _department = string.Empty;

    [ObservableProperty]
    private string _address = string.Empty;

    [ObservableProperty]
    private string _city = string.Empty;

    [ObservableProperty]
    private string _state = string.Empty;

    [ObservableProperty]
    private string _postalCode = string.Empty;

    [ObservableProperty]
    private string _country = string.Empty;

    [ObservableProperty]
    private string _notes = string.Empty;

    [ObservableProperty]
    private string? _avatarPath = null;

    [ObservableProperty]
    private bool _isFavorite = false;

    [ObservableProperty]
    private string _category = string.Empty;

    [ObservableProperty]
    private DateTime _createdAt = DateTime.UtcNow;

    [ObservableProperty]
    private DateTime _modifiedAt = DateTime.UtcNow;

    /// <summary>
    /// Gets the initials for avatar display
    /// </summary>
    public string Initials
    {
        get
        {
            if (!string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName))
            {
                return $"{FirstName[0]}{LastName[0]}".ToUpperInvariant();
            }
            if (!string.IsNullOrEmpty(DisplayName))
            {
                var parts = DisplayName.Split(' ', StringSplitOptions.RemoveEmptyEntries);
                if (parts.Length >= 2)
                {
                    return $"{parts[0][0]}{parts[1][0]}".ToUpperInvariant();
                }
                return DisplayName.Length >= 2 ? DisplayName.Substring(0, 2).ToUpperInvariant() : DisplayName.ToUpperInvariant();
            }
            return "?";
        }
    }
}
