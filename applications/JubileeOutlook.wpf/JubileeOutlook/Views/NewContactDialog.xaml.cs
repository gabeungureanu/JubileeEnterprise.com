using Microsoft.Win32;
using System.IO;
using System.Windows;
using System.Windows.Controls;
using System.Windows.Input;
using System.Windows.Media.Imaging;
using JubileeOutlook.Services;
using JubileeOutlook.ViewModels;

namespace JubileeOutlook.Views;

/// <summary>
/// Dialog for creating a new contact matching Microsoft Outlook design
/// </summary>
public partial class NewContactDialog : Window
{
    private string? _selectedImagePath;
    private string? _existingContactId;
    private bool _isEditMode;
    private bool _isFavorite;
    private bool _isDeleted;
    private DateTime? _deletedAt;
    private DateTime _createdAt;
    private string _category = string.Empty;

    /// <summary>
    /// The contact created by this dialog (set when Save is clicked)
    /// </summary>
    public Contact? CreatedContact { get; private set; }

    public NewContactDialog()
    {
        InitializeComponent();

        // Focus first name field when loaded
        Loaded += (s, e) => FirstNameTextBox.Focus();
    }

    /// <summary>
    /// Constructor for editing an existing contact
    /// </summary>
    public NewContactDialog(Contact contact) : this()
    {
        Title = "Edit contact";
        _isEditMode = true;
        _existingContactId = contact.Id;
        _isFavorite = contact.IsFavorite;
        _isDeleted = contact.IsDeleted;
        _deletedAt = contact.DeletedAt;
        _createdAt = contact.CreatedAt;
        _category = contact.Category ?? string.Empty;

        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Edit mode - Id: {contact.Id}");
        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] DisplayName: '{contact.DisplayName}'");
        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] FirstName: '{contact.FirstName}', LastName: '{contact.LastName}'");
        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Email: '{contact.Email}', Phone: '{contact.Phone}'");
        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Company: '{contact.Company}', JobTitle: '{contact.JobTitle}'");
        System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Category: '{contact.Category}'");

        // Update the title text in the dialog
        if (DialogTitleText != null)
        {
            DialogTitleText.Text = "Edit contact";
        }

        // Populate fields with existing contact data
        FirstNameTextBox.Text = contact.FirstName;
        LastNameTextBox.Text = contact.LastName;
        WorkEmailTextBox.Text = contact.Email;
        WorkPhoneTextBox.Text = contact.Phone;
        MobilePhoneTextBox.Text = contact.MobilePhone;
        CompanyTextBox.Text = contact.Company;
        JobTitleTextBox.Text = contact.JobTitle;
        DepartmentTextBox.Text = contact.Department;
        OfficeTextBox.Text = contact.Office;
        StreetTextBox.Text = contact.Address;
        CityTextBox.Text = contact.City;
        StateTextBox.Text = contact.State;
        ZipTextBox.Text = contact.PostalCode;
        CountryTextBox.Text = contact.Country;
        NotesTextBox.Text = contact.Notes;
        BirthdayDatePicker.SelectedDate = contact.Birthday;
        AnniversaryDatePicker.SelectedDate = contact.Anniversary;
        SpouseTextBox.Text = contact.Spouse;
        WebsiteTextBox.Text = contact.Website;

        // Load existing avatar if present
        if (!string.IsNullOrEmpty(contact.AvatarPath))
        {
            try
            {
                var bitmap = new BitmapImage(new Uri(contact.AvatarPath));
                ContactPictureImage.Source = bitmap;
                ContactPictureImage.Visibility = Visibility.Visible;
                ContactPictureIcon.Visibility = Visibility.Collapsed;
                _selectedImagePath = contact.AvatarPath;

                // Show remove link for existing photo
                RemovePhotoLink.Visibility = Visibility.Visible;
                AddPhotoText.Text = "Change photo";
                ClickToUploadText.Visibility = Visibility.Collapsed;
            }
            catch
            {
                // Ignore image load errors
            }
        }
    }

    private void TitleBar_MouseDown(object sender, MouseButtonEventArgs e)
    {
        if (e.LeftButton == MouseButtonState.Pressed)
        {
            DragMove();
        }
    }

    private void CloseButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private void CancelButton_Click(object sender, RoutedEventArgs e)
    {
        DialogResult = false;
        Close();
    }

    private async void SaveButton_Click(object sender, RoutedEventArgs e)
    {
        // Validate required fields
        if (string.IsNullOrWhiteSpace(FirstNameTextBox.Text) && string.IsNullOrWhiteSpace(LastNameTextBox.Text))
        {
            ThemedMessageBox.Show(this, "Please enter at least a first or last name.", "Name Required", MessageBoxButton.OK, MessageBoxImage.Warning);
            FirstNameTextBox.Focus();
            return;
        }

        // Upload photo if a local file is selected
        string? avatarUrl = _selectedImagePath;
        if (!string.IsNullOrEmpty(_selectedImagePath) && IsLocalFilePath(_selectedImagePath))
        {
            try
            {
                // Show saving indicator
                SaveButton.IsEnabled = false;
                SaveButton.Content = "Uploading...";

                var uploadedUrl = await ImageService.Instance.UploadContactPhotoAsync(_selectedImagePath);
                if (!string.IsNullOrEmpty(uploadedUrl))
                {
                    avatarUrl = uploadedUrl;
                    System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Photo uploaded: {uploadedUrl}");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Photo upload failed, keeping local path");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Photo upload error: {ex.Message}");
            }
            finally
            {
                SaveButton.IsEnabled = true;
                SaveButton.Content = "Save";
            }
        }

        // Create the contact object
        CreatedContact = new Contact
        {
            // Preserve the existing ID when editing, generate new ID for new contacts
            Id = _isEditMode && !string.IsNullOrEmpty(_existingContactId)
                ? _existingContactId
                : Guid.NewGuid().ToString(),
            FirstName = FirstNameTextBox.Text.Trim(),
            LastName = LastNameTextBox.Text.Trim(),
            DisplayName = BuildDisplayName(),
            Email = WorkEmailTextBox.Text.Trim(),
            Phone = WorkPhoneTextBox.Text.Trim(),
            MobilePhone = MobilePhoneTextBox.Text.Trim(),
            Company = CompanyTextBox.Text.Trim(),
            JobTitle = JobTitleTextBox.Text.Trim(),
            Department = DepartmentTextBox.Text.Trim(),
            Office = OfficeTextBox.Text.Trim(),
            Address = StreetTextBox.Text.Trim(),
            City = CityTextBox.Text.Trim(),
            State = StateTextBox.Text.Trim(),
            PostalCode = ZipTextBox.Text.Trim(),
            Country = CountryTextBox.Text.Trim(),
            Notes = NotesTextBox.Text.Trim(),
            Birthday = BirthdayDatePicker.SelectedDate,
            Anniversary = AnniversaryDatePicker.SelectedDate,
            Spouse = SpouseTextBox.Text.Trim(),
            Website = WebsiteTextBox.Text.Trim(),
            AvatarPath = avatarUrl,
            // Preserve IsFavorite, IsDeleted, Category, and timestamps when editing
            IsFavorite = _isEditMode ? _isFavorite : false,
            IsDeleted = _isEditMode ? _isDeleted : false,
            DeletedAt = _isEditMode ? _deletedAt : null,
            Category = _isEditMode ? _category : string.Empty,
            CreatedAt = _isEditMode ? _createdAt : DateTime.UtcNow,
            ModifiedAt = DateTime.UtcNow
        };

        DialogResult = true;
        Close();
    }

    /// <summary>
    /// Checks if the path is a local file path (not a URL)
    /// </summary>
    private static bool IsLocalFilePath(string path)
    {
        if (string.IsNullOrEmpty(path))
            return false;

        // If it starts with http:// or https://, it's a URL
        if (path.StartsWith("http://", StringComparison.OrdinalIgnoreCase) ||
            path.StartsWith("https://", StringComparison.OrdinalIgnoreCase))
            return false;

        // Check if the file exists locally
        return File.Exists(path);
    }

    private string BuildDisplayName()
    {
        var firstName = FirstNameTextBox.Text.Trim();
        var lastName = LastNameTextBox.Text.Trim();

        if (!string.IsNullOrEmpty(firstName) && !string.IsNullOrEmpty(lastName))
        {
            return $"{firstName} {lastName}";
        }
        if (!string.IsNullOrEmpty(firstName))
        {
            return firstName;
        }
        if (!string.IsNullOrEmpty(lastName))
        {
            return lastName;
        }
        return "Unknown";
    }

    private void Tab_Checked(object sender, RoutedEventArgs e)
    {
        if (sender is RadioButton radioButton && radioButton.Tag is string tabName)
        {
            // Hide all panels
            if (ContactInfoPanel != null) ContactInfoPanel.Visibility = Visibility.Collapsed;
            if (WorkPanel != null) WorkPanel.Visibility = Visibility.Collapsed;
            if (AddressPanel != null) AddressPanel.Visibility = Visibility.Collapsed;
            if (OtherPanel != null) OtherPanel.Visibility = Visibility.Collapsed;
            if (NotesPanel != null) NotesPanel.Visibility = Visibility.Collapsed;

            // Show selected panel
            switch (tabName)
            {
                case "ContactInfo":
                    if (ContactInfoPanel != null) ContactInfoPanel.Visibility = Visibility.Visible;
                    break;
                case "Work":
                    if (WorkPanel != null) WorkPanel.Visibility = Visibility.Visible;
                    break;
                case "Address":
                    if (AddressPanel != null) AddressPanel.Visibility = Visibility.Visible;
                    break;
                case "Other":
                    if (OtherPanel != null) OtherPanel.Visibility = Visibility.Visible;
                    break;
                case "Notes":
                    if (NotesPanel != null) NotesPanel.Visibility = Visibility.Visible;
                    break;
            }
        }
    }

    private void ContactPicture_Click(object sender, MouseButtonEventArgs e)
    {
        var openFileDialog = new OpenFileDialog
        {
            Title = "Select Contact Photo",
            Filter = "Image Files|*.jpg;*.jpeg;*.png;*.bmp;*.gif|All Files|*.*",
            Multiselect = false
        };

        if (openFileDialog.ShowDialog() == true)
        {
            try
            {
                var bitmap = new BitmapImage(new Uri(openFileDialog.FileName));
                ContactPictureImage.Source = bitmap;
                ContactPictureImage.Visibility = Visibility.Visible;
                ContactPictureIcon.Visibility = Visibility.Collapsed;
                _selectedImagePath = openFileDialog.FileName;

                // Show remove link, hide upload text
                RemovePhotoLink.Visibility = Visibility.Visible;
                AddPhotoText.Text = "Change photo";
                ClickToUploadText.Visibility = Visibility.Collapsed;
            }
            catch (Exception ex)
            {
                ThemedMessageBox.Show(this, $"Failed to load image: {ex.Message}", "Error", MessageBoxButton.OK, MessageBoxImage.Error);
            }
        }
    }

    private async void RemovePhoto_Click(object sender, MouseButtonEventArgs e)
    {
        // If the current image is a server URL, delete it from the server
        if (!string.IsNullOrEmpty(_selectedImagePath) && !IsLocalFilePath(_selectedImagePath))
        {
            try
            {
                System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Deleting photo from server: {_selectedImagePath}");
                var deleted = await ImageService.Instance.DeleteContactPhotoAsync(_selectedImagePath);
                if (deleted)
                {
                    System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Photo deleted from server successfully");
                }
                else
                {
                    System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Failed to delete photo from server (may not exist)");
                }
            }
            catch (Exception ex)
            {
                System.Diagnostics.Debug.WriteLine($"[NewContactDialog] Error deleting photo from server: {ex.Message}");
            }
        }

        // Clear the image
        ContactPictureImage.Source = null;
        ContactPictureImage.Visibility = Visibility.Collapsed;
        ContactPictureIcon.Visibility = Visibility.Visible;
        _selectedImagePath = null;

        // Reset UI text
        RemovePhotoLink.Visibility = Visibility.Collapsed;
        AddPhotoText.Text = "Add a photo";
        ClickToUploadText.Visibility = Visibility.Visible;
    }

    private void AddName_Click(object sender, RoutedEventArgs e)
    {
        AdditionalNameFields.Visibility = AdditionalNameFields.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void AddEmail_Click(object sender, RoutedEventArgs e)
    {
        AdditionalEmailFields.Visibility = AdditionalEmailFields.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }

    private void AddPhone_Click(object sender, RoutedEventArgs e)
    {
        AdditionalPhoneFields.Visibility = AdditionalPhoneFields.Visibility == Visibility.Visible
            ? Visibility.Collapsed
            : Visibility.Visible;
    }
}
