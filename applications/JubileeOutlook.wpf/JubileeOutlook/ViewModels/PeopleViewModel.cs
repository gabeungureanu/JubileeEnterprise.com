using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using JubileeOutlook.Services;
using DbContact = JubileeOutlook.Models.Contact;

namespace JubileeOutlook.ViewModels;

/// <summary>
/// ViewModel for the People/Contacts module
/// Uses ApiContactService for API-based contact operations with offline-first support
/// </summary>
public partial class PeopleViewModel : ObservableObject
{
    private readonly ApiContactService _contactService;

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
        _contactService = ApiContactService.Instance;
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

    /// <summary>
    /// Loads contacts from the API (with offline-first support)
    /// </summary>
    public async Task LoadContactsFromDatabaseAsync()
    {
        try
        {
            IsLoading = true;
            System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Loading contacts from API...");

            var result = await _contactService.GetContactsWithResultAsync();

            if (result.Success && result.Data != null)
            {
                Contacts.Clear();
                foreach (var apiContact in result.Data)
                {
                    var contact = MapFromApiContact(apiContact);
                    Contacts.Add(contact);
                }

                FilterContacts();
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Loaded {Contacts.Count} contacts from API");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load contacts: {result.Error}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load contacts: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// Creates a new contact via API
    /// </summary>
    public async Task<Models.Contact> CreateContactViaApiAsync(Contact contact)
    {
        try
        {
            var apiContact = MapToApiContact(contact);
            var result = await _contactService.CreateContactWithResultAsync(apiContact);

            if (result.Success && result.Data != null)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Created contact via API: {contact.DisplayName}");
                return result.Data;
            }
            else
            {
                throw new Exception(result.Error ?? "Failed to create contact");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to create contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Updates an existing contact via API
    /// </summary>
    public async Task<Models.Contact> UpdateContactViaApiAsync(Contact contact)
    {
        try
        {
            var apiContact = MapToApiContact(contact);
            var result = await _contactService.UpdateContactWithResultAsync(apiContact);

            if (result.Success && result.Data != null)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Updated contact via API: {contact.DisplayName}");
                return result.Data;
            }
            else
            {
                throw new Exception(result.Error ?? "Failed to update contact");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to update contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Deletes a contact via API
    /// </summary>
    public async Task DeleteContactViaApiAsync(string contactId)
    {
        try
        {
            var result = await _contactService.DeleteContactWithResultAsync(contactId);

            if (result.Success)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Deleted contact via API: {contactId}");
            }
            else
            {
                throw new Exception(result.Error ?? "Failed to delete contact");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Searches contacts via API
    /// </summary>
    public async Task<List<Contact>> SearchContactsViaApiAsync(string query)
    {
        try
        {
            var result = await _contactService.SearchContactsWithResultAsync(query);

            if (result.Success && result.Data != null)
            {
                return result.Data.Select(MapFromApiContact).ToList();
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Search failed: {result.Error}");
                return new List<Contact>();
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Search error: {ex.Message}");
            return new List<Contact>();
        }
    }

    /// <summary>
    /// Maps an API Contact (Models.Contact) to a ViewModel Contact
    /// </summary>
    private Contact MapFromApiContact(DbContact apiContact)
    {
        return new Contact
        {
            Id = apiContact.Id,
            DisplayName = apiContact.DisplayName,
            FirstName = apiContact.FirstName ?? string.Empty,
            LastName = apiContact.LastName ?? string.Empty,
            Email = apiContact.PrimaryEmail ?? string.Empty,
            Phone = apiContact.PrimaryPhone ?? string.Empty,
            MobilePhone = apiContact.MobilePhone ?? string.Empty,
            Company = apiContact.Company ?? string.Empty,
            JobTitle = apiContact.JobTitle ?? string.Empty,
            Department = apiContact.Department ?? string.Empty,
            Address = apiContact.Address ?? string.Empty,
            City = apiContact.City ?? string.Empty,
            State = apiContact.State ?? string.Empty,
            PostalCode = apiContact.PostalCode ?? string.Empty,
            Country = apiContact.Country ?? string.Empty,
            Notes = apiContact.Notes ?? string.Empty,
            Birthday = apiContact.Birthday,
            Anniversary = apiContact.Anniversary,
            Spouse = apiContact.Spouse ?? string.Empty,
            Website = apiContact.Website ?? string.Empty,
            AvatarPath = apiContact.PhotoUrl,
            IsFavorite = apiContact.IsFavorite,
            Category = apiContact.Category ?? string.Empty,
            CreatedAt = apiContact.CreatedDate,
            ModifiedAt = apiContact.ModifiedDate
        };
    }

    /// <summary>
    /// Maps a ViewModel Contact to an API Contact (Models.Contact)
    /// </summary>
    private DbContact MapToApiContact(Contact contact)
    {
        var emailAddresses = new List<string>();
        if (!string.IsNullOrWhiteSpace(contact.Email))
            emailAddresses.Add(contact.Email);

        var phoneNumbers = new List<string>();
        if (!string.IsNullOrWhiteSpace(contact.Phone))
            phoneNumbers.Add(contact.Phone);

        return new DbContact
        {
            Id = contact.Id,
            DisplayName = contact.DisplayName,
            FirstName = string.IsNullOrEmpty(contact.FirstName) ? null : contact.FirstName,
            LastName = string.IsNullOrEmpty(contact.LastName) ? null : contact.LastName,
            EmailAddresses = emailAddresses,
            PhoneNumbers = phoneNumbers,
            MobilePhone = string.IsNullOrEmpty(contact.MobilePhone) ? null : contact.MobilePhone,
            Company = string.IsNullOrEmpty(contact.Company) ? null : contact.Company,
            JobTitle = string.IsNullOrEmpty(contact.JobTitle) ? null : contact.JobTitle,
            Department = string.IsNullOrEmpty(contact.Department) ? null : contact.Department,
            Address = string.IsNullOrEmpty(contact.Address) ? null : contact.Address,
            City = string.IsNullOrEmpty(contact.City) ? null : contact.City,
            State = string.IsNullOrEmpty(contact.State) ? null : contact.State,
            PostalCode = string.IsNullOrEmpty(contact.PostalCode) ? null : contact.PostalCode,
            Country = string.IsNullOrEmpty(contact.Country) ? null : contact.Country,
            Notes = string.IsNullOrEmpty(contact.Notes) ? null : contact.Notes,
            Birthday = contact.Birthday,
            Anniversary = contact.Anniversary,
            Spouse = string.IsNullOrEmpty(contact.Spouse) ? null : contact.Spouse,
            Website = string.IsNullOrEmpty(contact.Website) ? null : contact.Website,
            PhotoUrl = contact.AvatarPath,
            IsFavorite = contact.IsFavorite,
            Category = string.IsNullOrEmpty(contact.Category) ? null : contact.Category,
            CreatedDate = contact.CreatedAt,
            ModifiedDate = contact.ModifiedAt
        };
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

    /// <summary>
    /// Event raised when a new contact dialog should be opened
    /// </summary>
    public event EventHandler? NewContactRequested;

    /// <summary>
    /// Event raised when a contact should be edited
    /// </summary>
    public event EventHandler<Contact>? EditContactRequested;

    [RelayCommand]
    private void NewContact()
    {
        NewContactRequested?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Add a new contact to the collection and save via API
    /// </summary>
    public async Task AddContactAsync(Contact contact)
    {
        try
        {
            // Create via API first
            var createdContact = await CreateContactViaApiAsync(contact);

            // Update the contact with the server-assigned ID
            contact.Id = createdContact.Id;

            // Add to local collection
            Contacts.Add(contact);
            FilterContacts();

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Added contact: {contact.DisplayName}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to add contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Update an existing contact in the collection and save via API
    /// </summary>
    public async Task UpdateContactAsync(Contact oldContact, Contact newContact)
    {
        try
        {
            // Keep the same ID for updates
            newContact.Id = oldContact.Id;

            // Update via API first
            await UpdateContactViaApiAsync(newContact);

            // Update local collection
            var index = Contacts.IndexOf(oldContact);
            if (index >= 0)
            {
                Contacts[index] = newContact;
                FilterContacts();
            }

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Updated contact: {newContact.DisplayName}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to update contact: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Add a new contact to the collection (legacy sync method)
    /// </summary>
    public void AddContact(Contact contact)
    {
        _ = AddContactAsync(contact);
    }

    /// <summary>
    /// Update an existing contact in the collection (legacy sync method)
    /// </summary>
    public void UpdateContact(Contact oldContact, Contact newContact)
    {
        _ = UpdateContactAsync(oldContact, newContact);
    }

    [RelayCommand]
    private void EditContact()
    {
        if (SelectedContact == null) return;
        EditContactRequested?.Invoke(this, SelectedContact);
    }

    [RelayCommand]
    private async Task DeleteContactAsync()
    {
        if (SelectedContact == null) return;

        try
        {
            var contactToDelete = SelectedContact;
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Deleting contact: {contactToDelete.DisplayName}");

            // Delete via API
            await DeleteContactViaApiAsync(contactToDelete.Id);

            // Remove from local collection
            Contacts.Remove(contactToDelete);
            FilterContacts();

            // Clear selection
            SelectedContact = null;

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Contact deleted successfully: {contactToDelete.DisplayName}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete contact: {ex.Message}");
        }
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
    private DateTime? _birthday = null;

    [ObservableProperty]
    private DateTime? _anniversary = null;

    [ObservableProperty]
    private string _spouse = string.Empty;

    [ObservableProperty]
    private string _website = string.Empty;

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
