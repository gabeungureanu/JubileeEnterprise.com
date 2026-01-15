namespace JubileeOutlook.Models;

/// <summary>
/// Represents a contact in the address book
/// </summary>
public class Contact
{
    public string Id { get; set; } = Guid.NewGuid().ToString();
    public string DisplayName { get; set; } = string.Empty;
    public string? FirstName { get; set; }
    public string? LastName { get; set; }
    public List<string> EmailAddresses { get; set; } = new();
    public List<string> PhoneNumbers { get; set; } = new();
    public string? Company { get; set; }
    public string? JobTitle { get; set; }
    public string? Department { get; set; }
    public string? Notes { get; set; }
    public string? PhotoUrl { get; set; }
    public DateTime CreatedDate { get; set; } = DateTime.Now;
    public DateTime ModifiedDate { get; set; } = DateTime.Now;

    /// <summary>
    /// Gets the primary email address if available
    /// </summary>
    public string? PrimaryEmail => EmailAddresses.FirstOrDefault();

    /// <summary>
    /// Gets the primary phone number if available
    /// </summary>
    public string? PrimaryPhone => PhoneNumbers.FirstOrDefault();

    /// <summary>
    /// Gets the full name combining first and last name
    /// </summary>
    public string FullName
    {
        get
        {
            if (!string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName))
                return $"{FirstName} {LastName}";
            if (!string.IsNullOrEmpty(FirstName))
                return FirstName;
            if (!string.IsNullOrEmpty(LastName))
                return LastName;
            return DisplayName;
        }
    }

    /// <summary>
    /// Gets the initials for avatar display
    /// </summary>
    public string Initials
    {
        get
        {
            if (!string.IsNullOrEmpty(FirstName) && !string.IsNullOrEmpty(LastName))
                return $"{FirstName[0]}{LastName[0]}".ToUpper();
            if (!string.IsNullOrEmpty(DisplayName) && DisplayName.Length >= 2)
                return DisplayName.Substring(0, 2).ToUpper();
            if (!string.IsNullOrEmpty(DisplayName))
                return DisplayName.Substring(0, 1).ToUpper();
            return "?";
        }
    }
}
