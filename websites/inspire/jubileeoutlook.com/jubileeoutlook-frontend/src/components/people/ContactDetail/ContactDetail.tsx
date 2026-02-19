import React, { useState } from 'react';
import { Contact, ContactGroup } from '../../../types/contacts';
import './ContactDetail.css';

interface ContactDetailProps {
  contact: Contact;
  groups?: ContactGroup[];
  memberGroups?: ContactGroup[];
  isInDeletedFolder?: boolean;
  onFavoriteToggle?: (contactId: string, isFavorite: boolean) => void;
  onEdit?: (contact: Contact) => void;
  onDelete?: (contactId: string) => void;
  onRestore?: (contactId: string) => void;
  onAddToGroup?: (contactId: string, groupId: string) => void;
  onRemoveFromGroup?: (contactId: string, groupId: string) => void;
  onEmail?: (contact: Contact) => void;
  onClose?: () => void;
}

const ContactDetail: React.FC<ContactDetailProps> = ({
  contact, groups, memberGroups, isInDeletedFolder, onFavoriteToggle, onEdit, onDelete, onRestore, onAddToGroup, onRemoveFromGroup, onEmail, onClose,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showGroupMenu, setShowGroupMenu] = useState(false);

  const getInitials = (): string => {
    const first = contact.firstName?.charAt(0) || '';
    const last = contact.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.displayName?.charAt(0)?.toUpperCase() || '?';
  };

  // Build "Job Title at Company" subtitle
  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' at ');

  const hasAddress = contact.address || contact.city || contact.state || contact.postalCode || contact.country;

  const buildAddressLines = () => {
    const lines: string[] = [];
    if (contact.address) lines.push(contact.address);
    const parts = [contact.city, contact.state, contact.postalCode].filter(Boolean);
    if (parts.length > 0) {
      lines.push(`${contact.city || ''}${contact.city && contact.state ? ', ' : ''}${contact.state || ''} ${contact.postalCode || ''}`.trim());
    }
    if (contact.country) lines.push(contact.country);
    return lines;
  };

  const handleDeleteClick = () => setShowDeleteConfirm(true);
  const confirmDelete = () => {
    setShowDeleteConfirm(false);
    if (onDelete) onDelete(contact.id);
  };

  const handleMapClick = () => {
    const query = [contact.address, contact.city, contact.state, contact.postalCode, contact.country]
      .filter(Boolean).join(', ');
    window.open(`https://maps.google.com/maps?q=${encodeURIComponent(query)}`, '_blank');
  };

  return (
    <div className="contact-detail">
      {/* Close button */}
      {onClose && (
        <button className="contact-detail__close" onClick={onClose} title="Close">
          <span className="material-symbols-outlined">close</span>
        </button>
      )}
      {/* Header with avatar + name */}
      <div className="contact-detail__header">
        <div className="contact-detail__avatar-lg">
          {contact.photoUrl ? (
            <img src={contact.photoUrl} alt={contact.displayName} />
          ) : (
            <span>{getInitials()}</span>
          )}
        </div>
        <h2 className="contact-detail__name">{contact.displayName}</h2>
        {subtitle && <p className="contact-detail__subtitle">{subtitle}</p>}
        {contact.category && (
          <span className="contact-detail__category-badge">{contact.category}</span>
        )}
        {contact.isFavorite && (
          <span className="material-symbols-outlined contact-detail__fav-star">star</span>
        )}

        {/* Group membership badges */}
        <div className="contact-detail__groups-row">
          {memberGroups && memberGroups.length > 0 ? (
            memberGroups.map((g) => (
              <span key={g.id} className="contact-detail__group-badge">
                <span className="material-symbols-outlined">group</span>
                {g.name}
                {onRemoveFromGroup && (
                  <button
                    className="contact-detail__group-badge-remove"
                    onClick={() => onRemoveFromGroup(contact.id, g.id)}
                    title={`Remove from ${g.name}`}
                  >
                    <span className="material-symbols-outlined">close</span>
                  </button>
                )}
              </span>
            ))
          ) : (
            <span className="contact-detail__groups-empty">No groups assigned</span>
          )}
        </div>

        {/* Quick action buttons */}
        <div className="contact-detail__actions">
          {!contact.isDeleted && onFavoriteToggle && (
            <button
              className="contact-detail__quick-btn"
              onClick={() => onFavoriteToggle(contact.id, !contact.isFavorite)}
              title={contact.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
            >
              <span className="material-symbols-outlined">
                {contact.isFavorite ? 'star' : 'star_border'}
              </span>
              <span>{contact.isFavorite ? 'Unfavorite' : 'Favorite'}</span>
            </button>
          )}
          {contact.isDeleted && onRestore && (
            <button
              className="contact-detail__quick-btn contact-detail__quick-btn--restore"
              onClick={() => onRestore(contact.id)}
              title="Restore Contact"
            >
              <span className="material-symbols-outlined">restore_from_trash</span>
              <span>Restore</span>
            </button>
          )}
          {!contact.isDeleted && contact.emailAddresses.length > 0 && onEmail && (
            <button
              className="contact-detail__quick-btn"
              onClick={() => onEmail(contact)}
              title="Send email"
            >
              <span className="material-symbols-outlined">mail</span>
              <span>Email</span>
            </button>
          )}
          {!contact.isDeleted && onEdit && (
            <button
              className="contact-detail__quick-btn"
              onClick={() => onEdit(contact)}
              title="Edit contact"
            >
              <span className="material-symbols-outlined">edit</span>
              <span>Edit</span>
            </button>
          )}
          {!contact.isDeleted && onAddToGroup && groups && groups.length > 0 && (
            <div className="contact-detail__group-wrapper">
              <button
                className="contact-detail__quick-btn"
                onClick={() => setShowGroupMenu(!showGroupMenu)}
                title="Add to Group"
              >
                <span className="material-symbols-outlined">group_add</span>
                <span>Group</span>
              </button>
              {showGroupMenu && (
                <div className="contact-detail__group-menu">
                  {groups.map((g) => (
                    <button
                      key={g.id}
                      onClick={() => { onAddToGroup(contact.id, g.id); setShowGroupMenu(false); }}
                    >
                      <span className="material-symbols-outlined">group</span>
                      {g.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {!contact.isDeleted && onDelete && (
            <button
              className="contact-detail__quick-btn contact-detail__quick-btn--danger"
              onClick={handleDeleteClick}
              title="Delete Contact"
            >
              <span className="material-symbols-outlined">delete</span>
              <span>Delete</span>
            </button>
          )}
        </div>
      </div>

      {/* Information sections */}
      <div className="contact-detail__sections">
        {/* Email section */}
        {contact.emailAddresses.length > 0 && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">EMAIL</div>
            {contact.emailAddresses.map((email, i) => (
              <div key={i} className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">mail</span>
                <div className="contact-detail__field-content">
                  <a href={`mailto:${email}`} className="contact-detail__field-value contact-detail__field-value--link">
                    {email}
                  </a>
                  <span className="contact-detail__field-sublabel">{i === 0 ? 'Work' : 'Personal'}</span>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Phone section */}
        {(contact.phoneNumbers.length > 0 || contact.mobilePhone) && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">PHONE</div>
            {contact.phoneNumbers.map((phone, i) => (
              <div key={i} className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">phone</span>
                <div className="contact-detail__field-content">
                  <span className="contact-detail__field-value contact-detail__field-value--link">{phone}</span>
                  <span className="contact-detail__field-sublabel">{i === 0 ? 'Work' : 'Home'}</span>
                </div>
              </div>
            ))}
            {contact.mobilePhone && (
              <div className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">smartphone</span>
                <div className="contact-detail__field-content">
                  <span className="contact-detail__field-value contact-detail__field-value--link">{contact.mobilePhone}</span>
                  <span className="contact-detail__field-sublabel">Mobile</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Work section */}
        {(contact.company || contact.department || contact.office) && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">WORK</div>
            {contact.company && (
              <div className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">business</span>
                <div className="contact-detail__field-content">
                  <span className="contact-detail__field-value">{contact.company}</span>
                  <span className="contact-detail__field-sublabel">Company</span>
                </div>
              </div>
            )}
            {contact.department && (
              <div className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">groups</span>
                <div className="contact-detail__field-content">
                  <span className="contact-detail__field-value">{contact.department}</span>
                  <span className="contact-detail__field-sublabel">Department</span>
                </div>
              </div>
            )}
            {contact.office && (
              <div className="contact-detail__field-row">
                <span className="material-symbols-outlined contact-detail__field-icon">location_city</span>
                <div className="contact-detail__field-content">
                  <span className="contact-detail__field-value">{contact.office}</span>
                  <span className="contact-detail__field-sublabel">Office</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Address section */}
        {hasAddress && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">ADDRESS</div>
            <div className="contact-detail__field-row">
              <span className="material-symbols-outlined contact-detail__field-icon">location_on</span>
              <div className="contact-detail__field-content">
                {buildAddressLines().map((line, i) => (
                  <span key={i} className="contact-detail__field-value">{line}</span>
                ))}
              </div>
            </div>
            <div className="contact-detail__map-link" onClick={handleMapClick}>
              <span className="material-symbols-outlined">map</span>
              <span>View on Map</span>
            </div>
          </div>
        )}

        {/* Website section */}
        {contact.website && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">WEBSITE</div>
            <div className="contact-detail__field-row">
              <span className="material-symbols-outlined contact-detail__field-icon">language</span>
              <div className="contact-detail__field-content">
                <a
                  href={contact.website.startsWith('http') ? contact.website : `https://${contact.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="contact-detail__field-value contact-detail__field-value--link"
                >
                  {contact.website}
                </a>
              </div>
            </div>
          </div>
        )}

        {/* Birthday section */}
        {contact.birthday && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">BIRTHDAY</div>
            <div className="contact-detail__field-row">
              <span className="material-symbols-outlined contact-detail__field-icon">cake</span>
              <div className="contact-detail__field-content">
                <span className="contact-detail__field-value">
                  {new Date(contact.birthday).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Anniversary section */}
        {contact.anniversary && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">ANNIVERSARY</div>
            <div className="contact-detail__field-row">
              <span className="material-symbols-outlined contact-detail__field-icon">cake</span>
              <div className="contact-detail__field-content">
                <span className="contact-detail__field-value">
                  {new Date(contact.anniversary).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Spouse section */}
        {contact.spouse && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">SPOUSE / PARTNER</div>
            <div className="contact-detail__field-row">
              <span className="material-symbols-outlined contact-detail__field-icon">favorite</span>
              <div className="contact-detail__field-content">
                <span className="contact-detail__field-value">{contact.spouse}</span>
              </div>
            </div>
          </div>
        )}

        {/* Notes section */}
        {contact.notes && (
          <div className="contact-detail__section">
            <div className="contact-detail__section-title">NOTES</div>
            <div className="contact-detail__notes-card">
              <p className="contact-detail__notes-text">{contact.notes}</p>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="contact-delete-confirm__overlay" onClick={() => setShowDeleteConfirm(false)}>
          <div className="contact-delete-confirm" onClick={(e) => e.stopPropagation()}>
            <span className="material-symbols-outlined contact-delete-confirm__icon">delete_forever</span>
            <h4 className="contact-delete-confirm__title">
              {isInDeletedFolder ? 'Permanently Delete Contact' : 'Delete Contact'}
            </h4>
            <p className="contact-delete-confirm__message">
              {isInDeletedFolder
                ? <>This will permanently delete <strong>{contact.displayName}</strong>. This action cannot be undone.</>
                : <>Are you sure you want to delete <strong>{contact.displayName}</strong>? The contact will be moved to the Deleted folder.</>
              }
            </p>
            <div className="contact-delete-confirm__actions">
              <button
                className="contact-delete-confirm__btn contact-delete-confirm__btn--cancel"
                onClick={() => setShowDeleteConfirm(false)}
              >
                Cancel
              </button>
              <button
                className="contact-delete-confirm__btn contact-delete-confirm__btn--confirm"
                onClick={confirmDelete}
              >
                {isInDeletedFolder ? 'Delete Forever' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContactDetail;
