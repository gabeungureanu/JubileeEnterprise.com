import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import ContactGroups from '../../components/people/ContactGroups';
import ContactList from '../../components/people/ContactList';
import ContactDetail from '../../components/people/ContactDetail';
import { Contact, ContactGroup } from '../../types/contacts';
import './PeoplePage.css';

const PeoplePage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
  const [selectedContactId, setSelectedContactId] = useState<string | null>(null);
  const [contacts] = useState<Contact[]>([]);
  const [groups] = useState<ContactGroup[]>([]);

  const selectedContact = contacts.find((c) => c.id === selectedContactId) || null;

  return (
    <div className="people-page">
      {isFolderPaneVisible && (
        <ContactGroups
          groups={groups}
          selectedGroupId={selectedGroupId}
          onGroupSelect={setSelectedGroupId}
        />
      )}
      <ContactList
        contacts={contacts}
        selectedContactId={selectedContactId}
        onContactSelect={setSelectedContactId}
      />
      <ContactDetail contact={selectedContact} />
    </div>
  );
};

export default PeoplePage;
