import React from 'react';
import { Contact } from '../../../types/contacts';
import './ContactList.css';

interface ContactListProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onContactSelect: (contactId: string) => void;
}

const ContactList: React.FC<ContactListProps> = ({ contacts, selectedContactId, onContactSelect }) => {
  const getInitials = (contact: Contact): string => {
    const first = contact.firstName?.charAt(0) || '';
    const last = contact.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.displayName?.charAt(0)?.toUpperCase() || '?';
  };

  return (
    <div className="contact-list">
      <div className="contact-list__header">
        <div className="contact-list__search">
          <span className="material-symbols-outlined">search</span>
          <input type="text" placeholder="Search contacts..." className="contact-list__search-input" />
        </div>
      </div>
      <div className="contact-list__items">
        {contacts.map((contact) => (
          <div
            key={contact.id}
            className={`contact-list__item ${selectedContactId === contact.id ? 'contact-list__item--selected' : ''}`}
            onClick={() => onContactSelect(contact.id)}
          >
            <div className="contact-list__avatar">
              {contact.photoUrl ? (
                <img src={contact.photoUrl} alt={contact.displayName} />
              ) : (
                <span>{getInitials(contact)}</span>
              )}
            </div>
            <div className="contact-list__info">
              <span className="contact-list__name text-ellipsis">{contact.displayName}</span>
              {contact.emailAddresses.length > 0 && (
                <span className="contact-list__email text-ellipsis">
                  {contact.emailAddresses[0]}
                </span>
              )}
            </div>
            {contact.isFavorite && (
              <span className="material-symbols-outlined contact-list__favorite">star</span>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default ContactList;
