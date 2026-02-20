import React, { useState, useEffect, useRef } from 'react';
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

type TabId = 'overview' | 'contact' | 'files';

const ContactDetail: React.FC<ContactDetailProps> = ({
  contact, groups, memberGroups, isInDeletedFolder,
  onFavoriteToggle, onEdit, onDelete, onRestore,
  onAddToGroup, onRemoveFromGroup, onEmail, onClose,
}) => {
  const [activeTab, setActiveTab] = useState<TabId>('contact');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (showDeleteConfirm) setShowDeleteConfirm(false);
        else if (showMoreMenu) setShowMoreMenu(false);
        else if (onClose) onClose();
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, showDeleteConfirm, showMoreMenu]);

  // Close more menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setShowMoreMenu(false);
      }
    };
    if (showMoreMenu) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [showMoreMenu]);

  const getInitials = (): string => {
    const first = contact.firstName?.charAt(0) || '';
    const last = contact.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.displayName?.charAt(0)?.toUpperCase() || '?';
  };

  const subtitle = [contact.jobTitle, contact.company].filter(Boolean).join(' at ');

  const primaryPhone = contact.mobilePhone || contact.phoneNumbers[0] || '';

  const handleCall = () => {
    if (primaryPhone) {
      const cleaned = primaryPhone.replace(/[^\d+]/g, '');
      window.location.href = `tel:${cleaned}`;
    }
  };

  const hasAddress = contact.address || contact.city || contact.state || contact.postalCode || contact.country;

  const buildAddressLines = () => {
    const lines: string[] = [];
    if (contact.address) lines.push(contact.address);
    if (contact.city || contact.state || contact.postalCode) {
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

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget && onClose) onClose();
  };

  return (
    <div className="contact-detail__overlay" onClick={handleOverlayClick}>
      <div className="contact-detail">
        {/* Close button */}
        {onClose && (
          <button className="contact-detail__close" onClick={onClose} title="Close">
            <span className="material-symbols-outlined">close</span>
          </button>
        )}

        {/* Header: horizontal — avatar left, info right */}
        <div className="contact-detail__header">
          <div className="contact-detail__avatar-wrapper">
            <div className="contact-detail__avatar-lg">
              {contact.photoUrl ? (
                <img src={contact.photoUrl} alt={contact.displayName} />
              ) : (
                <span>{getInitials()}</span>
              )}
            </div>
            <div className="contact-detail__presence-dot" />
          </div>
          <div className="contact-detail__header-info">
            <h2 className="contact-detail__name">{contact.displayName}</h2>
            {subtitle && <p className="contact-detail__subtitle">{subtitle}</p>}

            {/* Action icons — left-aligned */}
            <div className="contact-detail__action-icons">
              {/* Call compound button */}
              {!contact.isDeleted && primaryPhone && (
                <button className="contact-detail__call-btn" onClick={handleCall} title="Call">
                  <span className="material-symbols-outlined">call</span>
                  <span>Call</span>
                </button>
              )}
              {/* Mail flat icon */}
              {!contact.isDeleted && contact.emailAddresses.length > 0 && onEmail && (
                <button
                  className="contact-detail__flat-icon"
                  onClick={() => onEmail(contact)}
                  title="Send email"
                >
                  <span className="material-symbols-outlined">mail</span>
                </button>
              )}
              {/* Restore button for deleted */}
              {contact.isDeleted && onRestore && (
                <button
                  className="contact-detail__call-btn contact-detail__call-btn--restore"
                  onClick={() => onRestore(contact.id)}
                  title="Restore Contact"
                >
                  <span className="material-symbols-outlined">restore_from_trash</span>
                  <span>Restore</span>
                </button>
              )}
              {/* More options "..." */}
              <div className="contact-detail__more-wrapper" ref={moreMenuRef}>
                <button
                  className="contact-detail__flat-icon"
                  onClick={() => setShowMoreMenu(!showMoreMenu)}
                  title="More options"
                >
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
                {showMoreMenu && (
                  <div className="contact-detail__more-menu">
                    {!contact.isDeleted && onFavoriteToggle && (
                      <button onClick={() => { onFavoriteToggle(contact.id, !contact.isFavorite); setShowMoreMenu(false); }}>
                        <span className="material-symbols-outlined">
                          {contact.isFavorite ? 'star' : 'star_border'}
                        </span>
                        {contact.isFavorite ? 'Remove from Favorites' : 'Add to Favorites'}
                      </button>
                    )}
                    {!contact.isDeleted && onAddToGroup && groups && groups.length > 0 && (
                      <>
                        <div className="contact-detail__more-divider" />
                        <div className="contact-detail__more-menu-label">Add to group</div>
                        {groups.map((g) => (
                          <button key={g.id} onClick={() => { onAddToGroup(contact.id, g.id); setShowMoreMenu(false); }}>
                            <span className="material-symbols-outlined">group</span>
                            {g.name}
                          </button>
                        ))}
                      </>
                    )}
                    {!contact.isDeleted && onDelete && (
                      <>
                        <div className="contact-detail__more-divider" />
                        <button className="contact-detail__more-danger" onClick={() => { setShowMoreMenu(false); handleDeleteClick(); }}>
                          <span className="material-symbols-outlined">delete</span>
                          Delete contact
                        </button>
                      </>
                    )}
                    {contact.isDeleted && onRestore && (
                      <button onClick={() => { onRestore(contact.id); setShowMoreMenu(false); }}>
                        <span className="material-symbols-outlined">restore_from_trash</span>
                        Restore contact
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="contact-detail__tabs">
          <button
            className={`contact-detail__tab ${activeTab === 'overview' ? 'contact-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('overview')}
          >
            Overview
          </button>
          <button
            className={`contact-detail__tab ${activeTab === 'contact' ? 'contact-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('contact')}
          >
            Contact
          </button>
          <button
            className={`contact-detail__tab ${activeTab === 'files' ? 'contact-detail__tab--active' : ''}`}
            onClick={() => setActiveTab('files')}
          >
            Files
          </button>
        </div>

        {/* Tab content */}
        <div className="contact-detail__tab-content">
          {/* Overview Tab */}
          {activeTab === 'overview' && (
            <div className="contact-detail__overview">
              {memberGroups && memberGroups.length > 0 && (
                <div className="contact-detail__groups-row">
                  {memberGroups.map((g) => (
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
                  ))}
                </div>
              )}

              {contact.category && (
                <span className="contact-detail__category-badge">{contact.category}</span>
              )}

              {contact.emailAddresses.length > 0 && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-title">Contact information</div>
                  {contact.emailAddresses.map((email, i) => (
                    <div key={i} className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">mail</span>
                      <div className="contact-detail__field-content">
                        <a href={`mailto:${email}`} className="contact-detail__field-value contact-detail__field-value--link">
                          {email}
                        </a>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {(contact.phoneNumbers.length > 0 || contact.mobilePhone) && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-title">Phone</div>
                  {contact.phoneNumbers.map((phone, i) => (
                    <div key={i} className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">phone</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-value contact-detail__field-value--link">{phone}</span>
                      </div>
                    </div>
                  ))}
                  {contact.mobilePhone && (
                    <div className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">smartphone</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-value contact-detail__field-value--link">{contact.mobilePhone}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {contact.notes && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-title">Notes</div>
                  <div className="contact-detail__notes-card">
                    <p className="contact-detail__notes-text">{contact.notes}</p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Contact Tab — restructured to match reference */}
          {activeTab === 'contact' && (
            <div className="contact-detail__sections">
              {/* Contact information umbrella section */}
              {(contact.emailAddresses.length > 0 || contact.phoneNumbers.length > 0 || contact.mobilePhone) && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Contact information</div>
                  {contact.emailAddresses.map((email, i) => (
                    <div key={`email-${i}`} className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">mail</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">Email</span>
                        <a href={`mailto:${email}`} className="contact-detail__field-value contact-detail__field-value--link">
                          {email}
                        </a>
                      </div>
                    </div>
                  ))}
                  {contact.phoneNumbers.map((phone, i) => (
                    <div key={`phone-${i}`} className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">phone</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">{i === 0 ? 'Work' : 'Home'}</span>
                        <span className="contact-detail__field-value contact-detail__field-value--link">{phone}</span>
                      </div>
                    </div>
                  ))}
                  {contact.mobilePhone && (
                    <div className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">smartphone</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">Mobile</span>
                        <span className="contact-detail__field-value contact-detail__field-value--link">{contact.mobilePhone}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Work section */}
              {(contact.company || contact.department || contact.office) && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Work</div>
                  {contact.company && (
                    <div className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">business</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">Company</span>
                        <span className="contact-detail__field-value">{contact.company}</span>
                      </div>
                    </div>
                  )}
                  {contact.department && (
                    <div className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">groups</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">Department</span>
                        <span className="contact-detail__field-value">{contact.department}</span>
                      </div>
                    </div>
                  )}
                  {contact.office && (
                    <div className="contact-detail__field-row">
                      <span className="material-symbols-outlined contact-detail__field-icon">location_city</span>
                      <div className="contact-detail__field-content">
                        <span className="contact-detail__field-label">Office</span>
                        <span className="contact-detail__field-value">{contact.office}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Address section */}
              {hasAddress && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Address</div>
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

              {/* Website */}
              {contact.website && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Website</div>
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

              {/* Birthday */}
              {contact.birthday && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Birthday</div>
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

              {/* Anniversary */}
              {contact.anniversary && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Anniversary</div>
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

              {/* Spouse */}
              {contact.spouse && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Spouse / Partner</div>
                  <div className="contact-detail__field-row">
                    <span className="material-symbols-outlined contact-detail__field-icon">favorite</span>
                    <div className="contact-detail__field-content">
                      <span className="contact-detail__field-value">{contact.spouse}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Notes */}
              {contact.notes && (
                <div className="contact-detail__section">
                  <div className="contact-detail__section-heading">Notes</div>
                  <div className="contact-detail__notes-card">
                    <p className="contact-detail__notes-text">{contact.notes}</p>
                  </div>
                </div>
              )}

              {/* Edit contact — inline centered with icon */}
              {!contact.isDeleted && onEdit && (
                <div className="contact-detail__edit-inline">
                  <button className="contact-detail__edit-btn" onClick={() => onEdit(contact)}>
                    <span className="material-symbols-outlined">edit</span>
                    Edit contact
                  </button>
                </div>
              )}
              {contact.isDeleted && onRestore && (
                <div className="contact-detail__edit-inline">
                  <button className="contact-detail__edit-btn" onClick={() => onRestore(contact.id)}>
                    <span className="material-symbols-outlined">restore_from_trash</span>
                    Restore contact
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Files Tab */}
          {activeTab === 'files' && (
            <div className="contact-detail__files-empty">
              <span className="material-symbols-outlined">folder_open</span>
              <p>No shared files</p>
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
    </div>
  );
};

export default ContactDetail;
