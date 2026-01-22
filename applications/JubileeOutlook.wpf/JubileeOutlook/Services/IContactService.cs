using JubileeOutlook.Models;

namespace JubileeOutlook.Services;

/// <summary>
/// Interface for contact operations
/// </summary>
public interface IContactService
{
    /// <summary>
    /// Gets all contacts
    /// </summary>
    Task<List<Contact>> GetContactsAsync();

    /// <summary>
    /// Gets a contact by ID
    /// </summary>
    Task<Contact?> GetContactByIdAsync(string contactId);

    /// <summary>
    /// Creates a new contact
    /// </summary>
    Task<Contact> CreateContactAsync(Contact contact);

    /// <summary>
    /// Updates an existing contact
    /// </summary>
    Task<Contact> UpdateContactAsync(Contact contact);

    /// <summary>
    /// Deletes a contact
    /// </summary>
    Task DeleteContactAsync(string contactId);

    /// <summary>
    /// Searches contacts by query
    /// </summary>
    Task<List<Contact>> SearchContactsAsync(string query);
}
