using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using System.Collections.ObjectModel;
using JubileeOutlook.Services;
using DbContact = JubileeOutlook.Models.Contact;

namespace JubileeOutlook.ViewModels;

/// <summary>
/// Sort options for contacts list
/// </summary>
public enum ContactSortOption
{
    NameAscending,
    NameDescending,
    CompanyAscending,
    CompanyDescending,
    DateAddedNewest,
    DateAddedOldest
}

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

    [ObservableProperty]
    private string? _selectedCategory;

    [ObservableProperty]
    private string _contentHeader = "Your contacts";

    [ObservableProperty]
    private ContactSortOption _selectedSortOption = ContactSortOption.NameAscending;

    /// <summary>
    /// Gets the display text for the current sort option
    /// </summary>
    public string SortOptionDisplayText => SelectedSortOption switch
    {
        ContactSortOption.NameAscending => "Name (A-Z)",
        ContactSortOption.NameDescending => "Name (Z-A)",
        ContactSortOption.CompanyAscending => "Company (A-Z)",
        ContactSortOption.CompanyDescending => "Company (Z-A)",
        ContactSortOption.DateAddedNewest => "Date Added (Newest)",
        ContactSortOption.DateAddedOldest => "Date Added (Oldest)",
        _ => "Name (A-Z)"
    };

    [ObservableProperty]
    private ContactGroup? _selectedContactGroup;

    public ObservableCollection<ContactFolder> Folders { get; } = new();
    public ObservableCollection<Contact> Contacts { get; } = new();
    public ObservableCollection<Contact> FilteredContacts { get; } = new();
    public ObservableCollection<string> Categories { get; } = new();
    public ObservableCollection<ContactGroup> ContactGroups { get; } = new();

    /// <summary>
    /// Collection of selected contacts for multi-select operations
    /// </summary>
    public ObservableCollection<Contact> SelectedContacts { get; } = new();

    /// <summary>
    /// Indicates if multiple contacts are selected
    /// </summary>
    public bool HasMultipleSelection => SelectedContacts.Count > 1;

    /// <summary>
    /// Gets the count of selected contacts
    /// </summary>
    public int SelectedCount => SelectedContacts.Count;

    /// <summary>
    /// Updates the selected contacts collection and notifies property changes
    /// </summary>
    public void UpdateSelectedContacts(System.Collections.IList selectedItems)
    {
        SelectedContacts.Clear();
        foreach (var item in selectedItems)
        {
            if (item is Contact contact)
            {
                SelectedContacts.Add(contact);
            }
        }
        OnPropertyChanged(nameof(HasMultipleSelection));
        OnPropertyChanged(nameof(SelectedCount));
    }

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
    /// Loads contact groups from the API and populates the "Your contact lists" subfolder tree
    /// </summary>
    public async Task LoadContactGroupsAsync()
    {
        try
        {
            System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Loading contact groups from API...");
            var result = await _contactService.GetContactGroupsAsync();

            if (result.Success && result.Data != null)
            {
                ContactGroups.Clear();
                var listsFolder = Folders.FirstOrDefault(f => f.Name == "Your contact lists");

                if (listsFolder != null)
                {
                    listsFolder.SubFolders.Clear();
                }

                foreach (var groupDto in result.Data)
                {
                    var group = new ContactGroup
                    {
                        Id = groupDto.Id ?? string.Empty,
                        Name = groupDto.Name ?? "Unnamed",
                        Description = groupDto.Description ?? string.Empty,
                        MemberCount = groupDto.MemberCount
                    };
                    ContactGroups.Add(group);

                    // Add as subfolder for tree display
                    listsFolder?.SubFolders.Add(new ContactFolder
                    {
                        Name = group.Name,
                        Icon = "\ue7ef",
                        GroupId = group.Id
                    });
                }

                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Loaded {ContactGroups.Count} contact groups");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load contact groups: {ex.Message}");
        }
    }

    /// <summary>
    /// Set of contact IDs that are members of the currently selected group
    /// </summary>
    private HashSet<string> _selectedGroupMemberIds = new();

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

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] API result - Success: {result.Success}, Data count: {result.Data?.Count ?? 0}, Error: {result.Error ?? "(none)"}");

            if (result.Success && result.Data != null)
            {
                Contacts.Clear();
                foreach (var apiContact in result.Data)
                {
                    System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] ---- Processing contact: {apiContact.DisplayName} ----");
                    System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] API Contact EmailAddresses count: {apiContact.EmailAddresses?.Count ?? 0}");
                    if (apiContact.EmailAddresses?.Count > 0)
                    {
                        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] API Contact Emails: {string.Join(", ", apiContact.EmailAddresses)}");
                    }
                    System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] API Contact PrimaryEmail: '{apiContact.PrimaryEmail}'");

                    var contact = MapFromApiContact(apiContact);
                    Contacts.Add(contact);
                    System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] VM Contact Email: '{contact.Email}'");
                    System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Added contact: {contact.DisplayName}");
                }

                FilterContacts();
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Loaded {Contacts.Count} contacts, FilteredContacts: {FilteredContacts.Count}");
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load contacts: {result.Error}");
                Services.NotificationService.Instance.ShowError(
                    result.Error ?? "Unable to load contacts. Please check your connection.",
                    "Contacts");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load contacts: {ex.Message}");
            Services.NotificationService.Instance.ShowError(
                "Unable to load contacts. Please check your connection.",
                "Contacts");
        }
        finally
        {
            IsLoading = false;
        }
    }

    /// <summary>
    /// Creates a new contact via API
    /// </summary>
    /// <param name="contact">The contact to create</param>
    /// <param name="skipDuplicateCheck">If true, skips duplicate detection</param>
    public async Task<Models.Contact> CreateContactViaApiAsync(Contact contact, bool skipDuplicateCheck = false)
    {
        try
        {
            var apiContact = MapToApiContact(contact);
            if (skipDuplicateCheck)
            {
                apiContact.SkipDuplicateCheck = true;
            }

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
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] MapFromApiContact - DisplayName: '{apiContact.DisplayName}', FirstName: '{apiContact.FirstName}', LastName: '{apiContact.LastName}'");
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] MapFromApiContact - EmailAddresses: [{string.Join(", ", apiContact.EmailAddresses)}], PrimaryEmail: '{apiContact.PrimaryEmail}'");
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] MapFromApiContact - PhoneNumbers: [{string.Join(", ", apiContact.PhoneNumbers)}], PrimaryPhone: '{apiContact.PrimaryPhone}'");

        // Extract emails from list: [0]=Work, [1]=Personal, [2]=Other
        var emails = apiContact.EmailAddresses ?? new List<string>();
        var workEmail = emails.Count > 0 ? emails[0] : string.Empty;
        var personalEmail = emails.Count > 1 ? emails[1] : string.Empty;
        var otherEmail = emails.Count > 2 ? emails[2] : string.Empty;

        // Extract phones from list: [0]=Work, [1]=Home
        var phones = apiContact.PhoneNumbers ?? new List<string>();
        var workPhone = phones.Count > 0 ? phones[0] : string.Empty;
        var homePhone = phones.Count > 1 ? phones[1] : string.Empty;

        return new Contact
        {
            Id = apiContact.Id,
            DisplayName = apiContact.DisplayName,
            FirstName = apiContact.FirstName ?? string.Empty,
            LastName = apiContact.LastName ?? string.Empty,
            Email = workEmail,
            PersonalEmail = personalEmail,
            OtherEmail = otherEmail,
            Phone = workPhone,
            HomePhone = homePhone,
            MobilePhone = apiContact.MobilePhone ?? string.Empty,
            Title = apiContact.Title ?? string.Empty,
            MiddleName = apiContact.MiddleName ?? string.Empty,
            Suffix = apiContact.Suffix ?? string.Empty,
            Nickname = apiContact.Nickname ?? string.Empty,
            Company = apiContact.Company ?? string.Empty,
            JobTitle = apiContact.JobTitle ?? string.Empty,
            Department = apiContact.Department ?? string.Empty,
            Office = apiContact.Office ?? string.Empty,
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
            IsDeleted = apiContact.IsDeleted,
            DeletedAt = apiContact.DeletedAt,
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
        // Build email list: Work, Personal, Other
        var emailAddresses = new List<string>();
        if (!string.IsNullOrWhiteSpace(contact.Email))
            emailAddresses.Add(contact.Email);
        if (!string.IsNullOrWhiteSpace(contact.PersonalEmail))
            emailAddresses.Add(contact.PersonalEmail);
        if (!string.IsNullOrWhiteSpace(contact.OtherEmail))
            emailAddresses.Add(contact.OtherEmail);

        // Build phone list: Work, Home
        var phoneNumbers = new List<string>();
        if (!string.IsNullOrWhiteSpace(contact.Phone))
            phoneNumbers.Add(contact.Phone);
        if (!string.IsNullOrWhiteSpace(contact.HomePhone))
            phoneNumbers.Add(contact.HomePhone);

        return new DbContact
        {
            Id = contact.Id,
            DisplayName = contact.DisplayName,
            FirstName = string.IsNullOrEmpty(contact.FirstName) ? null : contact.FirstName,
            LastName = string.IsNullOrEmpty(contact.LastName) ? null : contact.LastName,
            Title = string.IsNullOrEmpty(contact.Title) ? null : contact.Title,
            MiddleName = string.IsNullOrEmpty(contact.MiddleName) ? null : contact.MiddleName,
            Suffix = string.IsNullOrEmpty(contact.Suffix) ? null : contact.Suffix,
            Nickname = string.IsNullOrEmpty(contact.Nickname) ? null : contact.Nickname,
            EmailAddresses = emailAddresses,
            PhoneNumbers = phoneNumbers,
            MobilePhone = string.IsNullOrEmpty(contact.MobilePhone) ? null : contact.MobilePhone,
            Company = string.IsNullOrEmpty(contact.Company) ? null : contact.Company,
            JobTitle = string.IsNullOrEmpty(contact.JobTitle) ? null : contact.JobTitle,
            Department = string.IsNullOrEmpty(contact.Department) ? null : contact.Department,
            Office = string.IsNullOrEmpty(contact.Office) ? null : contact.Office,
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
            IsDeleted = contact.IsDeleted,
            DeletedAt = contact.DeletedAt,
            Category = string.IsNullOrEmpty(contact.Category) ? null : contact.Category,
            CreatedDate = contact.CreatedAt,
            ModifiedDate = contact.ModifiedAt
        };
    }

    partial void OnSearchTextChanged(string value)
    {
        FilterContacts();
    }

    partial void OnSelectedSortOptionChanged(ContactSortOption value)
    {
        OnPropertyChanged(nameof(SortOptionDisplayText));
        FilterContacts();
    }

    partial void OnSelectedFolderChanged(ContactFolder? value)
    {
        // Update selection state for top-level folders
        foreach (var folder in Folders)
        {
            folder.IsSelected = folder == value;
            // Also check sub-folders
            foreach (var sub in folder.SubFolders)
            {
                sub.IsSelected = sub == value;
            }
        }

        // Clear category selection when a folder is selected
        SelectedCategory = null;

        // Update the selected contact group reference
        if (value?.GroupId != null)
        {
            SelectedContactGroup = ContactGroups.FirstOrDefault(g => g.Id == value.GroupId);
        }
        else
        {
            SelectedContactGroup = null;
        }

        // Notify IsInDeletedFolder changed for UI binding
        OnPropertyChanged(nameof(IsInDeletedFolder));
        OnPropertyChanged(nameof(DeletedContactsCount));
        OnPropertyChanged(nameof(IsInContactListFolder));

        // Load group members if a group is selected, then filter
        if (value?.GroupId != null)
        {
            _ = LoadGroupMembersAndFilterAsync(value.GroupId);
        }
        else
        {
            _selectedGroupMemberIds.Clear();
            LoadContactsForFolder();
        }
    }

    /// <summary>
    /// Loads group members from the API and then filters the contact list
    /// </summary>
    private async Task LoadGroupMembersAndFilterAsync(string groupId)
    {
        try
        {
            IsLoading = true;
            var result = await _contactService.GetContactGroupAsync(groupId);
            _selectedGroupMemberIds.Clear();

            if (result.Success && result.Data?.Members != null)
            {
                foreach (var member in result.Data.Members)
                {
                    if (member.Id != null)
                        _selectedGroupMemberIds.Add(member.Id);
                }
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Loaded {_selectedGroupMemberIds.Count} members for group {groupId}");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to load group members: {ex.Message}");
        }
        finally
        {
            IsLoading = false;
            FilterContacts();
        }
    }

    /// <summary>
    /// Command to select a category for filtering
    /// </summary>
    [RelayCommand]
    private void SelectCategory(string? category)
    {
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] SelectCategory: {category ?? "(null)"}");

        // If the same category is clicked, deselect it
        if (SelectedCategory == category)
        {
            SelectedCategory = null;
        }
        else
        {
            SelectedCategory = category;
        }

        // Re-filter contacts
        FilterContacts();
    }

    /// <summary>
    /// Clears the category filter and returns to folder view
    /// </summary>
    [RelayCommand]
    private void ClearCategoryFilter()
    {
        SelectedCategory = null;
        FilterContacts();
    }

    /// <summary>
    /// Called when SelectedCategory changes (e.g., from ListBox selection)
    /// </summary>
    partial void OnSelectedCategoryChanged(string? value)
    {
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] OnSelectedCategoryChanged: {value ?? "(null)"}");

        // Clear folder selection visual when a category is selected
        if (!string.IsNullOrEmpty(value))
        {
            foreach (var folder in Folders)
            {
                folder.IsSelected = false;
            }
        }

        FilterContacts();
    }

    private void FilterContacts()
    {
        FilteredContacts.Clear();

        var query = SearchText?.Trim().ToLowerInvariant() ?? string.Empty;
        var folderName = SelectedFolder?.Name ?? "Your contacts";

        // Collect filtered contacts first
        var filteredList = new List<Contact>();

        foreach (var contact in Contacts)
        {
            // If a category is selected, filter by category
            if (!string.IsNullOrEmpty(SelectedCategory))
            {
                // Only show contacts with the selected category (and not deleted)
                if (contact.IsDeleted) continue;
                if (!string.Equals(contact.Category, SelectedCategory, StringComparison.OrdinalIgnoreCase)) continue;
            }
            else
            {
                // Apply folder filter when no category is selected
                bool matchesFolder;
                if (SelectedFolder?.GroupId != null)
                {
                    // Filtering by a specific contact group
                    matchesFolder = !contact.IsDeleted && _selectedGroupMemberIds.Contains(contact.Id);
                }
                else
                {
                    matchesFolder = folderName switch
                    {
                        "Your contacts" => !contact.IsDeleted,
                        "Favorites" => contact.IsFavorite && !contact.IsDeleted,
                        "Your contact lists" => false, // Parent folder shows nothing; select a sub-group
                        "Deleted" => contact.IsDeleted,
                        _ => !contact.IsDeleted
                    };
                }

                if (!matchesFolder) continue;
            }

            // Then apply search filter
            if (string.IsNullOrEmpty(query) ||
                contact.DisplayName.ToLowerInvariant().Contains(query) ||
                contact.Email.ToLowerInvariant().Contains(query) ||
                (contact.Company?.ToLowerInvariant().Contains(query) ?? false))
            {
                filteredList.Add(contact);
            }
        }

        // Apply sorting
        var sortedList = ApplySorting(filteredList);

        // Add to observable collection
        foreach (var contact in sortedList)
        {
            FilteredContacts.Add(contact);
        }

        HasContacts = FilteredContacts.Count > 0;

        // Update the content header based on what's being viewed
        UpdateContentHeader();

        // Update Categories collection with unique non-empty categories from all non-deleted contacts
        UpdateCategories();

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] FilterContacts - Folder: {folderName}, Category: {SelectedCategory ?? "(none)"}, Total: {Contacts.Count}, Filtered: {FilteredContacts.Count}, Categories: {Categories.Count}");
    }

    /// <summary>
    /// Applies sorting to the contact list based on the selected sort option
    /// </summary>
    private IEnumerable<Contact> ApplySorting(List<Contact> contacts)
    {
        return SelectedSortOption switch
        {
            ContactSortOption.NameAscending => contacts.OrderBy(c => c.DisplayName, StringComparer.OrdinalIgnoreCase),
            ContactSortOption.NameDescending => contacts.OrderByDescending(c => c.DisplayName, StringComparer.OrdinalIgnoreCase),
            ContactSortOption.CompanyAscending => contacts.OrderBy(c => string.IsNullOrEmpty(c.Company) ? "zzz" : c.Company, StringComparer.OrdinalIgnoreCase)
                                                         .ThenBy(c => c.DisplayName, StringComparer.OrdinalIgnoreCase),
            ContactSortOption.CompanyDescending => contacts.OrderByDescending(c => string.IsNullOrEmpty(c.Company) ? "" : c.Company, StringComparer.OrdinalIgnoreCase)
                                                          .ThenBy(c => c.DisplayName, StringComparer.OrdinalIgnoreCase),
            ContactSortOption.DateAddedNewest => contacts.OrderByDescending(c => c.CreatedAt),
            ContactSortOption.DateAddedOldest => contacts.OrderBy(c => c.CreatedAt),
            _ => contacts.OrderBy(c => c.DisplayName, StringComparer.OrdinalIgnoreCase)
        };
    }

    /// <summary>
    /// Updates the content header based on current filter state
    /// </summary>
    private void UpdateContentHeader()
    {
        if (!string.IsNullOrEmpty(SelectedCategory))
        {
            // Show category name with count (like Outlook: "office (1)")
            ContentHeader = $"{SelectedCategory} ({FilteredContacts.Count})";
        }
        else if (SelectedFolder?.GroupId != null)
        {
            // Show group name with member count
            ContentHeader = $"{SelectedFolder.Name} ({FilteredContacts.Count})";
        }
        else
        {
            // Show folder name
            ContentHeader = SelectedFolder?.Name ?? "Your contacts";
        }
    }

    /// <summary>
    /// Updates the Categories collection with unique category values from all contacts
    /// </summary>
    private void UpdateCategories()
    {
        var uniqueCategories = Contacts
            .Where(c => !c.IsDeleted && !string.IsNullOrWhiteSpace(c.Category))
            .Select(c => c.Category!)
            .Distinct()
            .OrderBy(c => c)
            .ToList();

        // Only update if categories changed
        var currentCategories = Categories.ToList();
        if (!uniqueCategories.SequenceEqual(currentCategories))
        {
            Categories.Clear();
            foreach (var category in uniqueCategories)
            {
                Categories.Add(category);
            }
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Categories updated: {string.Join(", ", uniqueCategories)}");
        }
    }

    private void LoadContactsForFolder()
    {
        // Just re-filter the existing contacts for the selected folder
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

    /// <summary>
    /// Event raised when composing an email to a contact
    /// </summary>
    public event EventHandler<string>? EmailContactRequested;

    [RelayCommand]
    private void NewContact()
    {
        NewContactRequested?.Invoke(this, EventArgs.Empty);
    }

    /// <summary>
    /// Add a new contact to the collection and save via API
    /// </summary>
    /// <summary>
    /// Event raised when a duplicate contact is detected during creation
    /// The handler should return true to proceed (skip duplicate check), false to cancel
    /// </summary>
    public event Func<Contact, Task<bool>>? DuplicateContactDetected;

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
            Services.NotificationService.Instance.ShowSuccess($"Contact '{contact.DisplayName}' saved.", "Contacts");
        }
        catch (Exception ex) when (ex.Message == "DUPLICATE_DETECTED")
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Duplicate detected for: {contact.DisplayName}");

            // Ask user if they want to proceed
            bool proceed = false;
            if (DuplicateContactDetected != null)
            {
                proceed = await DuplicateContactDetected.Invoke(contact);
            }

            if (proceed)
            {
                // Retry with skip flag
                var createdContact = await CreateContactViaApiAsync(contact, skipDuplicateCheck: true);
                contact.Id = createdContact.Id;
                Contacts.Add(contact);
                FilterContacts();
                Services.NotificationService.Instance.ShowSuccess($"Contact '{contact.DisplayName}' saved.", "Contacts");
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to add contact: {ex.Message}");
            Services.NotificationService.Instance.ShowError("Failed to save contact. Please try again.", "Contacts");
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

            // Update local collection - find by ID since oldContact may be a different object instance
            var existingContact = Contacts.FirstOrDefault(c => c.Id == oldContact.Id);
            if (existingContact != null)
            {
                var index = Contacts.IndexOf(existingContact);
                if (index >= 0)
                {
                    Contacts[index] = newContact;
                    FilterContacts();
                }
            }

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Updated contact: {newContact.DisplayName}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to update contact: {ex.Message}");
            Services.NotificationService.Instance.ShowError("Failed to update contact. Please try again.", "Contacts");
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
    private async Task EditContactAsync()
    {
        if (SelectedContact == null) return;

        try
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - Fetching contact by ID: {SelectedContact.Id}");

            // Fetch fresh contact data from API
            var userId = ServiceConfiguration.UserId ?? "00000000-0000-0000-0000-000000000001";
            var result = await _contactService.GetContactByIdWithResultAsync(SelectedContact.Id);

            if (result.Success && result.Data != null)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - Fetched contact: {result.Data.DisplayName}");
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - FirstName: '{result.Data.FirstName}', LastName: '{result.Data.LastName}'");
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - EmailAddresses: [{string.Join(", ", result.Data.EmailAddresses)}]");
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - PhoneNumbers: [{string.Join(", ", result.Data.PhoneNumbers)}]");

                // Map the API contact to ViewModel contact
                var contactToEdit = MapFromApiContact(result.Data);
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - Mapped Email: '{contactToEdit.Email}', Phone: '{contactToEdit.Phone}'");

                // Invoke the edit dialog with fresh data
                EditContactRequested?.Invoke(this, contactToEdit);
            }
            else
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact - Failed to fetch contact: {result.Error}");
                // Fall back to using local data
                EditContactRequested?.Invoke(this, SelectedContact);
            }
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] EditContact error: {ex.Message}");
            // Fall back to using local data
            EditContactRequested?.Invoke(this, SelectedContact);
        }
    }

    [RelayCommand]
    private async Task DeleteContactAsync()
    {
        if (SelectedContact == null) return;

        try
        {
            var contactToDelete = SelectedContact;
            var folderName = SelectedFolder?.Name ?? "Your contacts";

            // If already in Deleted folder, permanently delete
            if (folderName == "Deleted")
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Permanently deleting contact: {contactToDelete.DisplayName}");

                // Hard delete via API
                await DeleteContactViaApiAsync(contactToDelete.Id);

                // Remove from local collection
                Contacts.Remove(contactToDelete);
                FilterContacts();

                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Contact permanently deleted: {contactToDelete.DisplayName}");
            }
            else
            {
                // Soft delete - move to Deleted folder
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Moving contact to Deleted: {contactToDelete.DisplayName}");

                contactToDelete.IsDeleted = true;
                contactToDelete.DeletedAt = DateTime.UtcNow;

                // Update via API
                await UpdateContactViaApiAsync(contactToDelete);

                // Refresh the filtered view
                FilterContacts();

                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Contact moved to Deleted: {contactToDelete.DisplayName}");
            }

            // Clear selection
            SelectedContact = null;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete contact: {ex.Message}");
            Services.NotificationService.Instance.ShowError("Failed to delete contact. Please try again.", "Contacts");
        }
    }

    /// <summary>
    /// Restore a contact from the Deleted folder
    /// </summary>
    [RelayCommand]
    private async Task RestoreContactAsync()
    {
        if (SelectedContact == null || !SelectedContact.IsDeleted) return;

        try
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Restoring contact: {SelectedContact.DisplayName}");

            SelectedContact.IsDeleted = false;
            SelectedContact.DeletedAt = null;

            // Update via API
            await UpdateContactViaApiAsync(SelectedContact);

            // Refresh the filtered view
            FilterContacts();

            // Clear selection
            SelectedContact = null;

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Contact restored successfully");
        }
        catch (Exception ex)
        {
            // Revert on error
            SelectedContact.IsDeleted = true;
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to restore contact: {ex.Message}");
            Services.NotificationService.Instance.ShowError("Failed to restore contact. Please try again.", "Contacts");
        }
    }

    /// <summary>
    /// Event raised when empty deleted folder is requested (needs confirmation)
    /// </summary>
    public event EventHandler<int>? EmptyDeletedFolderRequested;

    /// <summary>
    /// Checks if currently viewing the Deleted folder
    /// </summary>
    public bool IsInDeletedFolder => SelectedFolder?.Name == "Deleted";

    /// <summary>
    /// Checks if currently viewing a contact list/group folder
    /// </summary>
    public bool IsInContactListFolder => SelectedFolder?.GroupId != null || SelectedFolder?.Name == "Your contact lists";

    /// <summary>
    /// Gets the count of deleted contacts
    /// </summary>
    public int DeletedContactsCount => Contacts.Count(c => c.IsDeleted);

    /// <summary>
    /// Event raised when a new contact list name should be entered
    /// </summary>
    public event EventHandler? CreateContactListRequested;

    /// <summary>
    /// Event raised when contacts should be picked for adding to a group
    /// </summary>
    public event EventHandler<string>? AddToContactListRequested;

    /// <summary>
    /// Creates a new contact group/list
    /// </summary>
    public async Task<bool> CreateContactListAsync(string name, string? description = null)
    {
        try
        {
            var result = await _contactService.CreateContactGroupAsync(name, description);
            if (result.Success && result.Data != null)
            {
                var group = new ContactGroup
                {
                    Id = result.Data.Id ?? string.Empty,
                    Name = result.Data.Name ?? name,
                    Description = result.Data.Description ?? string.Empty,
                    MemberCount = 0
                };
                ContactGroups.Add(group);

                // Add subfolder
                var listsFolder = Folders.FirstOrDefault(f => f.Name == "Your contact lists");
                listsFolder?.SubFolders.Add(new ContactFolder
                {
                    Name = group.Name,
                    Icon = "\ue7ef",
                    GroupId = group.Id
                });

                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Created contact list: {name}");
                Services.NotificationService.Instance.ShowSuccess($"Contact list '{name}' created.", "Contacts");
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to create contact list: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Deletes the currently selected contact group/list
    /// </summary>
    public async Task<bool> DeleteContactListAsync(string groupId)
    {
        try
        {
            var result = await _contactService.DeleteContactGroupAsync(groupId);
            if (result.Success)
            {
                // Remove from local collections
                var group = ContactGroups.FirstOrDefault(g => g.Id == groupId);
                if (group != null) ContactGroups.Remove(group);

                var listsFolder = Folders.FirstOrDefault(f => f.Name == "Your contact lists");
                var subFolder = listsFolder?.SubFolders.FirstOrDefault(sf => sf.GroupId == groupId);
                if (subFolder != null) listsFolder?.SubFolders.Remove(subFolder);

                // If we were viewing this group, go back to "Your contacts"
                if (SelectedFolder?.GroupId == groupId)
                {
                    SelectedFolder = Folders.FirstOrDefault();
                }

                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Deleted contact list: {groupId}");
                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete contact list: {ex.Message}");
            return false;
        }
    }

    /// <summary>
    /// Adds the selected contact(s) to a group
    /// </summary>
    public async Task<int> AddContactsToGroupAsync(string groupId, List<string> contactIds)
    {
        try
        {
            var result = await _contactService.AddContactsToGroupAsync(groupId, contactIds);
            if (result.Success)
            {
                // If we're currently viewing this group, refresh the member list
                if (SelectedFolder?.GroupId == groupId)
                {
                    await LoadGroupMembersAndFilterAsync(groupId);
                }

                // Update member count
                var group = ContactGroups.FirstOrDefault(g => g.Id == groupId);
                if (group != null) group.MemberCount += result.Data;

                return result.Data;
            }
            return 0;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to add contacts to group: {ex.Message}");
            return 0;
        }
    }

    /// <summary>
    /// Removes a contact from the currently selected group
    /// </summary>
    public async Task<bool> RemoveContactFromGroupAsync(string contactId)
    {
        if (SelectedFolder?.GroupId == null) return false;

        try
        {
            var groupId = SelectedFolder.GroupId;
            var result = await _contactService.RemoveContactFromGroupAsync(groupId, contactId);
            if (result.Success)
            {
                _selectedGroupMemberIds.Remove(contactId);
                FilterContacts();

                // Update member count
                var group = ContactGroups.FirstOrDefault(g => g.Id == groupId);
                if (group != null && group.MemberCount > 0) group.MemberCount--;

                return true;
            }
            return false;
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to remove contact from group: {ex.Message}");
            return false;
        }
    }

    [RelayCommand]
    private void CreateContactList()
    {
        CreateContactListRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void EmptyDeletedFolder()
    {
        var deletedCount = DeletedContactsCount;
        if (deletedCount == 0) return;

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Empty deleted folder requested, {deletedCount} contacts");
        EmptyDeletedFolderRequested?.Invoke(this, deletedCount);
    }

    /// <summary>
    /// Permanently deletes all contacts in the Deleted folder
    /// </summary>
    public async Task<int> EmptyDeletedFolderConfirmedAsync()
    {
        var deletedContacts = Contacts.Where(c => c.IsDeleted).ToList();
        int deletedCount = 0;

        foreach (var contact in deletedContacts)
        {
            try
            {
                // Hard delete via API
                await DeleteContactViaApiAsync(contact.Id);
                Contacts.Remove(contact);
                deletedCount++;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete {contact.DisplayName}: {ex.Message}");
            }
        }

        // Refresh the filtered view
        FilterContacts();

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Emptied deleted folder: {deletedCount} contacts removed");
        return deletedCount;
    }

    [RelayCommand]
    private void EmailContact()
    {
        if (SelectedContact == null || string.IsNullOrEmpty(SelectedContact.Email)) return;
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Email contact: {SelectedContact.Email}");
        EmailContactRequested?.Invoke(this, SelectedContact.Email);
    }

    [RelayCommand]
    private void CallContact()
    {
        if (SelectedContact == null) return;

        // Prefer mobile phone, fallback to regular phone
        var phoneNumber = !string.IsNullOrEmpty(SelectedContact.MobilePhone)
            ? SelectedContact.MobilePhone
            : SelectedContact.Phone;

        if (string.IsNullOrEmpty(phoneNumber)) return;

        try
        {
            // Clean the phone number (remove spaces, dashes, etc. but keep +)
            var cleanNumber = new string(phoneNumber.Where(c => char.IsDigit(c) || c == '+').ToArray());
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Call contact: {cleanNumber}");

            // Open tel: protocol which will launch the default calling app
            var psi = new System.Diagnostics.ProcessStartInfo
            {
                FileName = $"tel:{cleanNumber}",
                UseShellExecute = true
            };
            System.Diagnostics.Process.Start(psi);
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to initiate call: {ex.Message}");
        }
    }

    /// <summary>
    /// Event raised when chat feature is requested (not yet implemented)
    /// </summary>
    public event EventHandler<string>? ChatFeatureRequested;

    [RelayCommand]
    private void ChatContact()
    {
        if (SelectedContact == null) return;
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Chat with: {SelectedContact.DisplayName}");

        // Chat module is not yet implemented - notify the user
        ChatFeatureRequested?.Invoke(this, SelectedContact.DisplayName);
    }

    /// <summary>
    /// Event raised when vCard export is requested
    /// </summary>
    public event EventHandler<(Contact Contact, string VCardContent)>? ShareAsVCardRequested;

    [RelayCommand]
    private void ShareAsVCard()
    {
        if (SelectedContact == null) return;
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Share as vCard: {SelectedContact.DisplayName}");

        // Generate vCard content
        var vCardContent = GenerateVCard(SelectedContact);
        ShareAsVCardRequested?.Invoke(this, (SelectedContact, vCardContent));
    }

    /// <summary>
    /// Generates vCard 3.0 format content for a contact
    /// </summary>
    private string GenerateVCard(Contact contact)
    {
        var sb = new System.Text.StringBuilder();
        sb.AppendLine("BEGIN:VCARD");
        sb.AppendLine("VERSION:3.0");

        // Full name
        sb.AppendLine($"FN:{contact.DisplayName}");

        // Structured name (Last;First;Middle;Prefix;Suffix)
        sb.AppendLine($"N:{contact.LastName};{contact.FirstName};;;");

        // Organization and title
        if (!string.IsNullOrEmpty(contact.Company))
        {
            var org = contact.Company;
            if (!string.IsNullOrEmpty(contact.Department))
                org += ";" + contact.Department;
            sb.AppendLine($"ORG:{org}");
        }

        if (!string.IsNullOrEmpty(contact.JobTitle))
            sb.AppendLine($"TITLE:{contact.JobTitle}");

        // Email
        if (!string.IsNullOrEmpty(contact.Email))
            sb.AppendLine($"EMAIL;TYPE=INTERNET:{contact.Email}");

        // Phone numbers
        if (!string.IsNullOrEmpty(contact.Phone))
            sb.AppendLine($"TEL;TYPE=WORK,VOICE:{contact.Phone}");

        if (!string.IsNullOrEmpty(contact.MobilePhone))
            sb.AppendLine($"TEL;TYPE=CELL:{contact.MobilePhone}");

        // Address
        if (!string.IsNullOrEmpty(contact.Address) || !string.IsNullOrEmpty(contact.City) ||
            !string.IsNullOrEmpty(contact.State) || !string.IsNullOrEmpty(contact.PostalCode) ||
            !string.IsNullOrEmpty(contact.Country))
        {
            // ADR: PO Box;Extended;Street;City;Region;PostalCode;Country
            sb.AppendLine($"ADR;TYPE=WORK:;;{contact.Address};{contact.City};{contact.State};{contact.PostalCode};{contact.Country}");
        }

        // Website
        if (!string.IsNullOrEmpty(contact.Website))
            sb.AppendLine($"URL:{contact.Website}");

        // Birthday
        if (contact.Birthday.HasValue)
            sb.AppendLine($"BDAY:{contact.Birthday.Value:yyyy-MM-dd}");

        // Notes
        if (!string.IsNullOrEmpty(contact.Notes))
            sb.AppendLine($"NOTE:{contact.Notes.Replace("\n", "\\n")}");

        sb.AppendLine("END:VCARD");
        return sb.ToString();
    }

    [RelayCommand]
    private async Task AddToFavoritesAsync()
    {
        if (SelectedContact == null) return;

        try
        {
            // Toggle favorite status
            SelectedContact.IsFavorite = !SelectedContact.IsFavorite;
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Toggle favorite: {SelectedContact.DisplayName} = {SelectedContact.IsFavorite}");

            // Update via API
            await UpdateContactViaApiAsync(SelectedContact);

            // Refresh the filtered view
            FilterContacts();

            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Favorite status saved for: {SelectedContact.DisplayName}");
        }
        catch (Exception ex)
        {
            // Revert on error
            SelectedContact.IsFavorite = !SelectedContact.IsFavorite;
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to toggle favorite: {ex.Message}");
        }
    }

    /// <summary>
    /// Event raised when category assignment is requested
    /// </summary>
    public event EventHandler<Contact>? AddCategoryRequested;

    [RelayCommand]
    private void AddCategory()
    {
        if (SelectedContact == null) return;
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Add category requested");
        AddCategoryRequested?.Invoke(this, SelectedContact);
    }

    /// <summary>
    /// Updates the category of a contact
    /// </summary>
    public async Task UpdateContactCategoryAsync(Contact contact, string category)
    {
        try
        {
            contact.Category = category;
            await UpdateContactViaApiAsync(contact);
            FilterContacts();
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Category updated for {contact.DisplayName}: {category}");
        }
        catch (Exception ex)
        {
            System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to update category: {ex.Message}");
            throw;
        }
    }

    /// <summary>
    /// Event raised when import contacts is requested
    /// </summary>
    public event EventHandler? ImportContactsRequested;

    /// <summary>
    /// Event raised when export contacts is requested
    /// </summary>
    public event EventHandler<List<Contact>>? ExportContactsRequested;

    [RelayCommand]
    private void ImportContacts()
    {
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Import contacts requested");
        ImportContactsRequested?.Invoke(this, EventArgs.Empty);
    }

    [RelayCommand]
    private void ExportContacts()
    {
        System.Diagnostics.Debug.WriteLine("[PeopleViewModel] Export contacts requested");
        // Export all non-deleted contacts
        var contactsToExport = Contacts.Where(c => !c.IsDeleted).ToList();
        ExportContactsRequested?.Invoke(this, contactsToExport);
    }

    /// <summary>
    /// Imports contacts from vCard content
    /// </summary>
    public async Task ImportContactsFromVCardAsync(string vCardContent)
    {
        var contacts = ParseVCardContent(vCardContent);
        foreach (var contact in contacts)
        {
            try
            {
                await AddContactAsync(contact);
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to import contact {contact.DisplayName}: {ex.Message}");
            }
        }
    }

    /// <summary>
    /// Imports contacts from CSV content
    /// </summary>
    /// <returns>Number of contacts imported</returns>
    public async Task<int> ImportContactsFromCsvAsync(string csvContent)
    {
        var contacts = ParseCsvContent(csvContent);
        int importedCount = 0;

        foreach (var contact in contacts)
        {
            try
            {
                await AddContactAsync(contact);
                importedCount++;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to import CSV contact {contact.DisplayName}: {ex.Message}");
            }
        }

        return importedCount;
    }

    /// <summary>
    /// Parses CSV content and returns a list of contacts
    /// Supports common CSV formats from Outlook, Google Contacts, and generic formats
    /// </summary>
    private List<Contact> ParseCsvContent(string csvContent)
    {
        var contacts = new List<Contact>();
        var lines = csvContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.RemoveEmptyEntries);

        if (lines.Length < 2)
        {
            System.Diagnostics.Debug.WriteLine("[PeopleViewModel] CSV file has no data rows");
            return contacts;
        }

        // Parse header row to determine column mapping
        var headers = ParseCsvLine(lines[0]);
        var columnMap = MapCsvColumns(headers);

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] CSV headers: {string.Join(", ", headers)}");
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Mapped columns: {columnMap.Count}");

        // Parse data rows
        for (int i = 1; i < lines.Length; i++)
        {
            try
            {
                var values = ParseCsvLine(lines[i]);
                var contact = CreateContactFromCsvRow(values, columnMap);

                if (contact != null && !string.IsNullOrEmpty(contact.DisplayName))
                {
                    contacts.Add(contact);
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to parse CSV row {i}: {ex.Message}");
            }
        }

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Parsed {contacts.Count} contacts from CSV");
        return contacts;
    }

    /// <summary>
    /// Parses a single CSV line handling quoted fields with commas
    /// </summary>
    private static List<string> ParseCsvLine(string line)
    {
        var values = new List<string>();
        var currentValue = new System.Text.StringBuilder();
        bool inQuotes = false;

        for (int i = 0; i < line.Length; i++)
        {
            char c = line[i];

            if (c == '"')
            {
                // Handle escaped quotes ("")
                if (inQuotes && i + 1 < line.Length && line[i + 1] == '"')
                {
                    currentValue.Append('"');
                    i++; // Skip next quote
                }
                else
                {
                    inQuotes = !inQuotes;
                }
            }
            else if (c == ',' && !inQuotes)
            {
                values.Add(currentValue.ToString().Trim());
                currentValue.Clear();
            }
            else
            {
                currentValue.Append(c);
            }
        }

        values.Add(currentValue.ToString().Trim());
        return values;
    }

    /// <summary>
    /// Maps CSV column headers to Contact fields
    /// Supports various naming conventions from different export sources
    /// </summary>
    private static Dictionary<string, int> MapCsvColumns(List<string> headers)
    {
        var columnMap = new Dictionary<string, int>(StringComparer.OrdinalIgnoreCase);

        for (int i = 0; i < headers.Count; i++)
        {
            var header = headers[i].Trim().ToLowerInvariant();

            // First Name variations
            if (header.Contains("first") && header.Contains("name") || header == "firstname" || header == "given name" || header == "givenname")
                columnMap["FirstName"] = i;

            // Last Name variations
            else if (header.Contains("last") && header.Contains("name") || header == "lastname" || header == "surname" || header == "family name" || header == "familyname")
                columnMap["LastName"] = i;

            // Display Name / Full Name
            else if (header == "name" || header == "full name" || header == "fullname" || header == "display name" || header == "displayname")
                columnMap["DisplayName"] = i;

            // Email variations
            else if (header.Contains("email") || header.Contains("e-mail"))
            {
                if (!columnMap.ContainsKey("Email"))
                    columnMap["Email"] = i;
            }

            // Phone variations
            else if (header.Contains("phone") || header.Contains("telephone"))
            {
                if (header.Contains("mobile") || header.Contains("cell"))
                    columnMap["MobilePhone"] = i;
                else if (header.Contains("work") || header.Contains("business"))
                    columnMap["Phone"] = i;
                else if (!columnMap.ContainsKey("Phone"))
                    columnMap["Phone"] = i;
            }

            // Company / Organization
            else if (header == "company" || header == "organization" || header == "organisation" || header == "company name")
                columnMap["Company"] = i;

            // Job Title
            else if (header.Contains("title") || header.Contains("job") || header == "position")
                columnMap["JobTitle"] = i;

            // Department
            else if (header == "department" || header == "dept")
                columnMap["Department"] = i;

            // Address components
            else if (header.Contains("street") || header == "address" || header == "address 1")
                columnMap["Address"] = i;
            else if (header == "city" || header == "town")
                columnMap["City"] = i;
            else if (header == "state" || header == "province" || header == "region")
                columnMap["State"] = i;
            else if (header.Contains("zip") || header.Contains("postal") || header == "postcode")
                columnMap["PostalCode"] = i;
            else if (header == "country" || header == "country/region")
                columnMap["Country"] = i;

            // Website
            else if (header == "website" || header == "web page" || header == "url" || header == "homepage")
                columnMap["Website"] = i;

            // Notes
            else if (header == "notes" || header == "note" || header == "comments")
                columnMap["Notes"] = i;

            // Birthday
            else if (header == "birthday" || header == "birth date" || header == "birthdate" || header == "date of birth")
                columnMap["Birthday"] = i;
        }

        return columnMap;
    }

    /// <summary>
    /// Creates a Contact from a CSV row using the column mapping
    /// </summary>
    private static Contact? CreateContactFromCsvRow(List<string> values, Dictionary<string, int> columnMap)
    {
        var contact = new Contact
        {
            Id = Guid.NewGuid().ToString(),
            CreatedAt = DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        string GetValue(string key) =>
            columnMap.TryGetValue(key, out int index) && index < values.Count
                ? values[index].Trim()
                : string.Empty;

        contact.FirstName = GetValue("FirstName");
        contact.LastName = GetValue("LastName");
        contact.Email = GetValue("Email");
        contact.Phone = GetValue("Phone");
        contact.MobilePhone = GetValue("MobilePhone");
        contact.Company = GetValue("Company");
        contact.JobTitle = GetValue("JobTitle");
        contact.Department = GetValue("Department");
        contact.Address = GetValue("Address");
        contact.City = GetValue("City");
        contact.State = GetValue("State");
        contact.PostalCode = GetValue("PostalCode");
        contact.Country = GetValue("Country");
        contact.Website = GetValue("Website");
        contact.Notes = GetValue("Notes");

        // Try to parse birthday
        var birthdayStr = GetValue("Birthday");
        if (!string.IsNullOrEmpty(birthdayStr) && DateTime.TryParse(birthdayStr, out var birthday))
        {
            contact.Birthday = birthday;
        }

        // Build display name
        var displayName = GetValue("DisplayName");
        if (!string.IsNullOrEmpty(displayName))
        {
            contact.DisplayName = displayName;
        }
        else if (!string.IsNullOrEmpty(contact.FirstName) || !string.IsNullOrEmpty(contact.LastName))
        {
            contact.DisplayName = $"{contact.FirstName} {contact.LastName}".Trim();
        }
        else if (!string.IsNullOrEmpty(contact.Email))
        {
            contact.DisplayName = contact.Email;
        }
        else
        {
            return null; // No valid name or email
        }

        return contact;
    }

    /// <summary>
    /// Parses vCard content and returns a list of contacts
    /// </summary>
    private List<Contact> ParseVCardContent(string vCardContent)
    {
        var contacts = new List<Contact>();
        var lines = vCardContent.Split(new[] { "\r\n", "\r", "\n" }, StringSplitOptions.None);

        Contact? currentContact = null;

        foreach (var line in lines)
        {
            var trimmedLine = line.Trim();

            if (trimmedLine.Equals("BEGIN:VCARD", StringComparison.OrdinalIgnoreCase))
            {
                currentContact = new Contact { Id = Guid.NewGuid().ToString() };
            }
            else if (trimmedLine.Equals("END:VCARD", StringComparison.OrdinalIgnoreCase))
            {
                if (currentContact != null && !string.IsNullOrEmpty(currentContact.DisplayName))
                {
                    contacts.Add(currentContact);
                }
                currentContact = null;
            }
            else if (currentContact != null)
            {
                var colonIndex = trimmedLine.IndexOf(':');
                if (colonIndex > 0)
                {
                    var property = trimmedLine.Substring(0, colonIndex).ToUpperInvariant();
                    var value = trimmedLine.Substring(colonIndex + 1);

                    // Handle property with parameters (e.g., TEL;TYPE=CELL:123456)
                    var propertyBase = property.Split(';')[0];

                    switch (propertyBase)
                    {
                        case "FN":
                            currentContact.DisplayName = value;
                            break;
                        case "N":
                            var nameParts = value.Split(';');
                            if (nameParts.Length >= 2)
                            {
                                currentContact.LastName = nameParts[0];
                                currentContact.FirstName = nameParts[1];
                            }
                            break;
                        case "EMAIL":
                            currentContact.Email = value;
                            break;
                        case "TEL":
                            if (property.Contains("CELL"))
                                currentContact.MobilePhone = value;
                            else
                                currentContact.Phone = value;
                            break;
                        case "ORG":
                            var orgParts = value.Split(';');
                            currentContact.Company = orgParts[0];
                            if (orgParts.Length > 1)
                                currentContact.Department = orgParts[1];
                            break;
                        case "TITLE":
                            currentContact.JobTitle = value;
                            break;
                        case "ADR":
                            var adrParts = value.Split(';');
                            if (adrParts.Length >= 7)
                            {
                                currentContact.Address = adrParts[2];
                                currentContact.City = adrParts[3];
                                currentContact.State = adrParts[4];
                                currentContact.PostalCode = adrParts[5];
                                currentContact.Country = adrParts[6];
                            }
                            break;
                        case "URL":
                            currentContact.Website = value;
                            break;
                        case "BDAY":
                            if (DateTime.TryParse(value, out var birthday))
                                currentContact.Birthday = birthday;
                            break;
                        case "NOTE":
                            currentContact.Notes = value.Replace("\\n", "\n");
                            break;
                    }
                }
            }
        }

        return contacts;
    }

    /// <summary>
    /// Generates vCard content for multiple contacts
    /// </summary>
    public string GenerateMultipleVCards(List<Contact> contacts)
    {
        var sb = new System.Text.StringBuilder();
        foreach (var contact in contacts)
        {
            sb.Append(GenerateVCard(contact));
            sb.AppendLine();
        }
        return sb.ToString();
    }

    [RelayCommand]
    private void SelectFolder(ContactFolder folder)
    {
        SelectedFolder = folder;
    }

    /// <summary>
    /// Command to set the sort option
    /// </summary>
    [RelayCommand]
    private void SetSortOption(ContactSortOption option)
    {
        SelectedSortOption = option;
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Sort option changed to: {option}");
    }

    #region Bulk Operations

    /// <summary>
    /// Event raised when bulk delete is requested (needs confirmation)
    /// </summary>
    public event EventHandler<int>? BulkDeleteRequested;

    /// <summary>
    /// Event raised when bulk category assignment is requested
    /// </summary>
    public event EventHandler<List<Contact>>? BulkAddCategoryRequested;

    [RelayCommand]
    private void BulkDelete()
    {
        if (SelectedContacts.Count == 0) return;

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Bulk delete requested for {SelectedContacts.Count} contacts");
        BulkDeleteRequested?.Invoke(this, SelectedContacts.Count);
    }

    /// <summary>
    /// Performs bulk delete of selected contacts (soft delete or hard delete based on current folder)
    /// </summary>
    public async Task<int> BulkDeleteConfirmedAsync()
    {
        var contactsToDelete = SelectedContacts.ToList();
        int deletedCount = 0;
        var folderName = SelectedFolder?.Name ?? "Your contacts";

        foreach (var contact in contactsToDelete)
        {
            try
            {
                if (folderName == "Deleted")
                {
                    // Hard delete
                    await DeleteContactViaApiAsync(contact.Id);
                    Contacts.Remove(contact);
                }
                else
                {
                    // Soft delete
                    contact.IsDeleted = true;
                    contact.DeletedAt = DateTime.UtcNow;
                    await UpdateContactViaApiAsync(contact);
                }
                deletedCount++;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to delete {contact.DisplayName}: {ex.Message}");
            }
        }

        SelectedContacts.Clear();
        SelectedContact = null;
        FilterContacts();
        OnPropertyChanged(nameof(HasMultipleSelection));
        OnPropertyChanged(nameof(SelectedCount));

        return deletedCount;
    }

    [RelayCommand]
    private async Task BulkAddToFavoritesAsync()
    {
        if (SelectedContacts.Count == 0) return;

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Bulk add to favorites: {SelectedContacts.Count} contacts");

        int updatedCount = 0;
        foreach (var contact in SelectedContacts.ToList())
        {
            try
            {
                if (!contact.IsFavorite)
                {
                    contact.IsFavorite = true;
                    await UpdateContactViaApiAsync(contact);
                    updatedCount++;
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to add {contact.DisplayName} to favorites: {ex.Message}");
            }
        }

        FilterContacts();
        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Bulk favorites: {updatedCount} contacts updated");
    }

    [RelayCommand]
    private void BulkAddCategory()
    {
        if (SelectedContacts.Count == 0) return;

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Bulk add category requested for {SelectedContacts.Count} contacts");
        BulkAddCategoryRequested?.Invoke(this, SelectedContacts.ToList());
    }

    /// <summary>
    /// Updates category for multiple contacts
    /// </summary>
    public async Task<int> BulkUpdateCategoryAsync(string category)
    {
        int updatedCount = 0;
        foreach (var contact in SelectedContacts.ToList())
        {
            try
            {
                contact.Category = category;
                await UpdateContactViaApiAsync(contact);
                updatedCount++;
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Failed to update category for {contact.DisplayName}: {ex.Message}");
            }
        }

        FilterContacts();
        return updatedCount;
    }

    [RelayCommand]
    private void BulkExport()
    {
        if (SelectedContacts.Count == 0) return;

        System.Diagnostics.Debug.WriteLine($"[PeopleViewModel] Bulk export requested for {SelectedContacts.Count} contacts");
        ExportContactsRequested?.Invoke(this, SelectedContacts.ToList());
    }

    #endregion
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

    /// <summary>
    /// If set, this folder represents a contact group with this ID
    /// </summary>
    public string? GroupId { get; set; }

    public ObservableCollection<ContactFolder> SubFolders { get; } = new();
}

/// <summary>
/// Represents a contact group/distribution list
/// </summary>
public partial class ContactGroup : ObservableObject
{
    [ObservableProperty]
    private string _id = string.Empty;

    [ObservableProperty]
    private string _name = string.Empty;

    [ObservableProperty]
    private string _description = string.Empty;

    [ObservableProperty]
    private int _memberCount;
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
    private string _homePhone = string.Empty;

    [ObservableProperty]
    private string _personalEmail = string.Empty;

    [ObservableProperty]
    private string _otherEmail = string.Empty;

    [ObservableProperty]
    private string _title = string.Empty;

    [ObservableProperty]
    private string _middleName = string.Empty;

    [ObservableProperty]
    private string _suffix = string.Empty;

    [ObservableProperty]
    private string _nickname = string.Empty;

    [ObservableProperty]
    private string _company = string.Empty;

    [ObservableProperty]
    private string _jobTitle = string.Empty;

    [ObservableProperty]
    private string _department = string.Empty;

    [ObservableProperty]
    private string _office = string.Empty;

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
    private bool _isDeleted = false;

    [ObservableProperty]
    private DateTime? _deletedAt = null;

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
