import React from 'react';
import { Contact } from '../../../types/contacts';
import './ContactDetail.css';

interface ContactDetailProps {
  contact: Contact | null;
}

const ContactDetail: React.FC<ContactDetailProps> = ({ contact }) => {
  if (!contact) {
    return (
      <div className="contact-detail contact-detail--empty">
        <span className="material-symbols-outlined contact-detail__empty-icon">contacts</span>
        <p className="contact-detail__empty-text">Select a contact to view details</p>
      </div>
    );
  }

  const getInitials = (): string => {
    const first = contact.firstName?.charAt(0) || '';
    const last = contact.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.displayName?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <div className="contact-detail">
      <div className="contact-detail__header">
        <div className="contact-detail__avatar-lg">
          {contact.photoUrl ? (
            <img src={contact.photoUrl} alt={contact.displayName} />
          ) : (
            <span>{getInitials()}</span>
          )}
        </div>
        <h2 className="contact-detail__name">{contact.displayName}</h2>
        {contact.jobTitle && <p className="contact-detail__title">{contact.jobTitle}</p>}
        {contact.company && <p className="contact-detail__org">{contact.company}</p>}
      </div>

      <div className="contact-detail__sections">
        {contact.emailAddresses.length > 0 && (
          <div className="contact-detail__section">
            <h4 className="contact-detail__section-title">
              <span className="material-symbols-outlined">email</span> Email
            </h4>
            {contact.emailAddresses.map((email, i) => (
              <div key={i} className="contact-detail__field">
                <a href={`mailto:${email}`} className="contact-detail__field-value">
                  {email}
                </a>
              </div>
            ))}
          </div>
        )}

        {contact.phoneNumbers.length > 0 && (
          <div className="contact-detail__section">
            <h4 className="contact-detail__section-title">
              <span className="material-symbols-outlined">phone</span> Phone
            </h4>
            {contact.phoneNumbers.map((phone, i) => (
              <div key={i} className="contact-detail__field">
                <span className="contact-detail__field-value">{phone}</span>
              </div>
            ))}
          </div>
        )}

        {contact.mobilePhone && (
          <div className="contact-detail__section">
            <h4 className="contact-detail__section-title">
              <span className="material-symbols-outlined">smartphone</span> Mobile
            </h4>
            <div className="contact-detail__field">
              <span className="contact-detail__field-value">{contact.mobilePhone}</span>
            </div>
          </div>
        )}

        {contact.notes && (
          <div className="contact-detail__section">
            <h4 className="contact-detail__section-title">
              <span className="material-symbols-outlined">notes</span> Notes
            </h4>
            <p className="contact-detail__notes">{contact.notes}</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ContactDetail;
