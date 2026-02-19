import React, { useState, useRef, useEffect } from 'react';
import { Contact } from '../../../types/contacts';
import { ContactSortOption, FolderFilter } from '../../../pages/People/PeoplePage';
import './ContactList.css';

interface ContactListProps {
  contacts: Contact[];
  selectedContactId: string | null;
  onContactSelect: (contactId: string) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortOption: ContactSortOption;
  onSortChange: (option: ContactSortOption) => void;
  isLoading: boolean;
  activeFolder: FolderFilter;
  selectedIds: Set<string>;
  onToggleSelect: (contactId: string) => void;
  onSelectAll: () => void;
  onRefresh?: () => void;
  onNewContact?: () => void;
}

const SORT_OPTIONS: { value: ContactSortOption; label: string; icon: string }[] = [
  { value: 'name-asc', label: 'Name (A-Z)', icon: 'sort_by_alpha' },
  { value: 'name-desc', label: 'Name (Z-A)', icon: 'sort_by_alpha' },
  { value: 'company-asc', label: 'Company (A-Z)', icon: 'business' },
  { value: 'company-desc', label: 'Company (Z-A)', icon: 'business' },
  { value: 'date-newest', label: 'Date Added (Newest)', icon: 'schedule' },
  { value: 'date-oldest', label: 'Date Added (Oldest)', icon: 'schedule' },
];

const ContactList: React.FC<ContactListProps> = ({
  contacts, selectedContactId, onContactSelect,
  searchQuery, onSearchChange,
  sortOption, onSortChange,
  isLoading, activeFolder,
  selectedIds, onToggleSelect, onSelectAll,
  onRefresh, onNewContact,
}) => {
  const [sortOpen, setSortOpen] = useState(false);
  const sortRef = useRef<HTMLDivElement>(null);

  // Close sort popup on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (sortRef.current && !sortRef.current.contains(e.target as Node)) {
        setSortOpen(false);
      }
    };
    if (sortOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [sortOpen]);

  const getInitials = (contact: Contact): string => {
    const first = contact.firstName?.charAt(0) || '';
    const last = contact.lastName?.charAt(0) || '';
    return (first + last).toUpperCase() || contact.displayName?.charAt(0)?.toUpperCase() || '?';
  };

  const getHeaderTitle = (): string => {
    switch (activeFolder) {
      case 'all': return 'Your contacts';
      case 'favorites': return 'Favorites';
      case 'deleted': return 'Deleted contacts';
      case 'lists': return 'Your contact lists';
      default: return 'Contact list';
    }
  };

  const currentSort = SORT_OPTIONS.find(o => o.value === sortOption);
  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;

  return (
    <div className="contact-list">
      {/* Content header with title + sync + sort */}
      <div className="contact-list__content-header">
        <span className="contact-list__content-title">{getHeaderTitle()}</span>
        <div className="contact-list__content-right">
          <div className="contact-list__sync-badge">
            <span className="contact-list__sync-dot" />
            <span>Synced</span>
          </div>
          {onRefresh && (
            <span
              className="material-symbols-outlined contact-list__sync-icon"
              title="Refresh"
              onClick={onRefresh}
            >
              sync
            </span>
          )}
          <div className="contact-list__sort-wrapper" ref={sortRef}>
            <button
              className="contact-list__sort-trigger"
              onClick={() => setSortOpen(!sortOpen)}
            >
              <span className="material-symbols-outlined">sort</span>
              <span>{currentSort?.label || 'Sort'}</span>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>expand_more</span>
            </button>
            {sortOpen && (
              <div className="contact-list__sort-popup">
                {SORT_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    className={`contact-list__sort-option ${sortOption === opt.value ? 'contact-list__sort-option--active' : ''}`}
                    onClick={() => { onSortChange(opt.value); setSortOpen(false); }}
                  >
                    {sortOption === opt.value && (
                      <span className="material-symbols-outlined">check</span>
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      <div className="contact-list__header">
        <div className="contact-list__search">
          <span className="material-symbols-outlined">search</span>
          <input
            type="text"
            placeholder="Search contacts..."
            className="contact-list__search-input"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
          />
          {searchQuery && (
            <button className="contact-list__search-clear" onClick={() => onSearchChange('')}>
              <span className="material-symbols-outlined">close</span>
            </button>
          )}
        </div>
      </div>

      {/* Toolbar: select-all + count */}
      <div className="contact-list__toolbar">
        <div className="contact-list__toolbar-left">
          <input
            type="checkbox"
            className="contact-list__select-all"
            checked={allSelected}
            onChange={onSelectAll}
            title="Select all"
          />
          <span className="contact-list__count">
            {selectedIds.size > 0
              ? `${selectedIds.size} selected`
              : `${contacts.length} contacts`
            }
          </span>
        </div>
      </div>

      {/* Contact items */}
      <div className="contact-list__items">
        {isLoading && (
          <div className="contact-list__empty">
            <div className="contact-list__spinner" />
            <p>Loading contacts...</p>
          </div>
        )}

        {!isLoading && contacts.length === 0 && (
          <div className="contact-list__empty">
            <span className="material-symbols-outlined contact-list__empty-icon">
              {searchQuery ? 'search_off' : activeFolder === 'lists' ? 'contacts' : 'person_off'}
            </span>
            <p>
              {searchQuery
                ? 'No contacts match your search'
                : activeFolder === 'lists'
                  ? "You haven't added any contacts yet"
                  : 'No contacts in this folder'
              }
            </p>
            {activeFolder === 'lists' && !searchQuery && onNewContact && (
              <span className="contact-list__empty-action" onClick={onNewContact}>New contact</span>
            )}
          </div>
        )}

        {contacts.map((contact) => (
          <div
            key={contact.id}
            className={`contact-list__item ${selectedContactId === contact.id ? 'contact-list__item--selected' : ''} ${selectedIds.has(contact.id) ? 'contact-list__item--checked' : ''}`}
            onClick={() => onContactSelect(contact.id)}
          >
            <input
              type="checkbox"
              className="contact-list__checkbox"
              checked={selectedIds.has(contact.id)}
              onChange={(e) => { e.stopPropagation(); onToggleSelect(contact.id); }}
              onClick={(e) => e.stopPropagation()}
            />
            <div className="contact-list__avatar">
              {contact.photoUrl ? (
                <img src={contact.photoUrl} alt={contact.displayName} />
              ) : (
                <span>{getInitials(contact)}</span>
              )}
            </div>
            <div className="contact-list__info">
              <div className="contact-list__name-row">
                <span className="contact-list__name text-ellipsis">{contact.displayName}</span>
                {contact.category && (
                  <span className="contact-list__category-badge">{contact.category}</span>
                )}
              </div>
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
