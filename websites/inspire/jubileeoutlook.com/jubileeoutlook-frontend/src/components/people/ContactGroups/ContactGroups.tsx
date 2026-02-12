import React from 'react';
import { ContactGroup } from '../../../types/contacts';
import './ContactGroups.css';

interface ContactGroupsProps {
  groups: ContactGroup[];
  selectedGroupId: string | null;
  onGroupSelect: (groupId: string | null) => void;
}

const ContactGroups: React.FC<ContactGroupsProps> = ({ groups, selectedGroupId, onGroupSelect }) => {
  return (
    <div className="contact-groups">
      <div
        className={`contact-groups__item ${selectedGroupId === null ? 'contact-groups__item--selected' : ''}`}
        onClick={() => onGroupSelect(null)}
      >
        <span className="material-symbols-outlined">people</span>
        <span className="contact-groups__name">All Contacts</span>
      </div>
      <div
        className={`contact-groups__item ${selectedGroupId === 'favorites' ? 'contact-groups__item--selected' : ''}`}
        onClick={() => onGroupSelect('favorites')}
      >
        <span className="material-symbols-outlined">star</span>
        <span className="contact-groups__name">Favorites</span>
      </div>
      {groups.length > 0 && (
        <>
          <div className="contact-groups__divider" />
          <div className="contact-groups__section-title">Groups</div>
          {groups.map((group) => (
            <div
              key={group.id}
              className={`contact-groups__item ${selectedGroupId === group.id ? 'contact-groups__item--selected' : ''}`}
              onClick={() => onGroupSelect(group.id)}
            >
              <span className="material-symbols-outlined">group</span>
              <span className="contact-groups__name">{group.name}</span>
              <span className="contact-groups__count">{group.memberCount}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
};

export default ContactGroups;
