import React, { useState, useRef, useEffect } from 'react';
import { Contact, ContactGroup } from '../../../types/contacts';
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
  // Row hover action handlers
  onEditContact?: (contact: Contact) => void;
  onDeleteContact?: (contactId: string) => void;
  onFavoriteToggle?: (contactId: string, isFavorite: boolean) => void;
  onEmailContact?: (contact: Contact) => void;
  onCallContact?: (contact: Contact) => void;
  onShareVCard?: (contact: Contact) => void;
  onCategoryContact?: (contact: Contact) => void;
  onAddToGroup?: (contactId: string, groupId: string) => void;
  groups?: ContactGroup[];
}

const SORT_OPTIONS: { value: ContactSortOption; label: string; shortLabel: string; icon: string }[] = [
  { value: 'name-asc', label: 'First Name', shortLabel: 'First Name', icon: 'sort_by_alpha' },
  { value: 'name-desc', label: 'First Name (Z-A)', shortLabel: 'First Name', icon: 'sort_by_alpha' },
  { value: 'company-asc', label: 'Company', shortLabel: 'Company', icon: 'business' },
  { value: 'company-desc', label: 'Company (Z-A)', shortLabel: 'Company', icon: 'business' },
  { value: 'date-newest', label: 'Date Added (Newest)', shortLabel: 'Date Added', icon: 'schedule' },
  { value: 'date-oldest', label: 'Date Added (Oldest)', shortLabel: 'Date Added', icon: 'schedule' },
];

const ContactList: React.FC<ContactListProps> = ({
  contacts, selectedContactId, onContactSelect,
  searchQuery, onSearchChange,
  sortOption, onSortChange,
  isLoading, activeFolder,
  selectedIds, onToggleSelect, onSelectAll,
  onRefresh, onNewContact,
  onEditContact, onDeleteContact, onFavoriteToggle,
  onEmailContact, onCallContact, onShareVCard,
  onCategoryContact,
  onAddToGroup, groups,
}) => {
  const [sortOpen, setSortOpen] = useState(false);
  const [columnMenuOpen, setColumnMenuOpen] = useState(false);
  const [columnVisibility, setColumnVisibility] = useState({
    categories: false,
    company: false,
    officeLocation: false,
  });
  const [openRowMenuId, setOpenRowMenuId] = useState<string | null>(null);
  const [menuPos, setMenuPos] = useState<{ top: number; left: number } | null>(null);
  const [showListSubmenu, setShowListSubmenu] = useState(false);

  const sortRef = useRef<HTMLDivElement>(null);
  const columnMenuRef = useRef<HTMLDivElement>(null);
  const rowMenuRef = useRef<HTMLDivElement>(null);

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

  // Close column menu on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (columnMenuRef.current && !columnMenuRef.current.contains(e.target as Node)) {
        setColumnMenuOpen(false);
      }
    };
    if (columnMenuOpen) document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [columnMenuOpen]);

  // Close row context menu on outside click, Escape, or scroll
  useEffect(() => {
    if (!openRowMenuId) return;
    const close = () => { setOpenRowMenuId(null); setMenuPos(null); setShowListSubmenu(false); };
    const handleClick = (e: MouseEvent) => {
      if (rowMenuRef.current && !rowMenuRef.current.contains(e.target as Node)) close();
    };
    const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') close(); };
    const handleScroll = () => close();

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    window.addEventListener('scroll', handleScroll, true);

    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('scroll', handleScroll, true);
    };
  }, [openRowMenuId]);

  const toggleColumn = (col: keyof typeof columnVisibility) => {
    setColumnVisibility(prev => ({ ...prev, [col]: !prev[col] }));
  };

  // Build dynamic grid template based on visible columns
  // Columns: checkbox | name (includes hover actions) | contact info | [optional...]
  const gridCols = ['40px', '1fr', '1fr'];
  if (columnVisibility.categories) gridCols.push('1fr');
  if (columnVisibility.company) gridCols.push('1fr');
  if (columnVisibility.officeLocation) gridCols.push('1fr');
  const gridStyle = { gridTemplateColumns: gridCols.join(' ') };

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

  const handleOpenRowMenu = (e: React.MouseEvent, contactId: string) => {
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const menuHeight = 380;
    let top = rect.bottom + 4;
    let left = rect.right - 220;
    if (top + menuHeight > window.innerHeight) top = rect.top - menuHeight - 4;
    if (left < 8) left = 8;
    setOpenRowMenuId(contactId);
    setMenuPos({ top, left });
    setShowListSubmenu(false);
  };

  const closeRowMenu = () => {
    setOpenRowMenuId(null);
    setMenuPos(null);
    setShowListSubmenu(false);
  };

  const currentSort = SORT_OPTIONS.find(o => o.value === sortOption);
  const allSelected = contacts.length > 0 && selectedIds.size === contacts.length;
  const menuContact = openRowMenuId ? contacts.find(c => c.id === openRowMenuId) || null : null;

  return (
    <div className="contact-list">
      {/* Content header with title + sort */}
      <div className="contact-list__content-header">
        <span className="contact-list__content-title">{getHeaderTitle()}</span>
        <div className="contact-list__content-right">
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
              <span className="material-symbols-outlined">swap_vert</span>
              <span>{currentSort?.shortLabel || 'Sort'}</span>
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

      {/* Table column headers */}
      <div className="contact-list__table-header" style={gridStyle}>
        <div className="contact-list__col-check">
          <input
            type="checkbox"
            className="contact-list__select-all"
            checked={allSelected}
            onChange={onSelectAll}
            title="Select all"
          />
        </div>
        <div className="contact-list__header-label">
          <span>Name</span>
          <span className="material-symbols-outlined contact-list__sort-arrow">
            {sortOption.startsWith('name') && sortOption.endsWith('desc') ? 'arrow_downward' : 'arrow_upward'}
          </span>
        </div>
        <div className="contact-list__header-label">Contact info</div>
        {columnVisibility.categories && (
          <div className="contact-list__header-label">Categories</div>
        )}
        {columnVisibility.company && (
          <div className="contact-list__header-label">Company</div>
        )}
        {columnVisibility.officeLocation && (
          <div className="contact-list__header-label">Office location</div>
        )}
        {/* "Show columns" dropdown — pinned to header row end */}
        <div className="contact-list__column-menu-anchor" ref={columnMenuRef}>
          <span
            className="material-symbols-outlined contact-list__column-menu-trigger"
            onClick={() => setColumnMenuOpen(!columnMenuOpen)}
            title="Show columns"
          >
            more_horiz
          </span>
          {columnMenuOpen && (
            <div className="contact-list__column-menu">
              <div className="contact-list__column-menu-title">Show columns</div>
              <label className="contact-list__column-menu-item contact-list__column-menu-item--disabled">
                <input type="checkbox" checked disabled />
                <span>Name</span>
              </label>
              <label className="contact-list__column-menu-item contact-list__column-menu-item--disabled">
                <input type="checkbox" checked disabled />
                <span>Contact info</span>
              </label>
              <label className="contact-list__column-menu-item">
                <input
                  type="checkbox"
                  checked={columnVisibility.categories}
                  onChange={() => toggleColumn('categories')}
                />
                <span>Categories</span>
              </label>
              <label className="contact-list__column-menu-item">
                <input
                  type="checkbox"
                  checked={columnVisibility.company}
                  onChange={() => toggleColumn('company')}
                />
                <span>Company</span>
              </label>
              <label className="contact-list__column-menu-item">
                <input
                  type="checkbox"
                  checked={columnVisibility.officeLocation}
                  onChange={() => toggleColumn('officeLocation')}
                />
                <span>Office location</span>
              </label>
            </div>
          )}
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
            className={`contact-list__item ${selectedContactId === contact.id ? 'contact-list__item--selected' : ''} ${selectedIds.has(contact.id) ? 'contact-list__item--checked' : ''} ${openRowMenuId === contact.id ? 'contact-list__item--menu-open' : ''}`}
            style={gridStyle}
            onClick={() => onContactSelect(contact.id)}
          >
            <div className="contact-list__col-check">
              <input
                type="checkbox"
                className="contact-list__checkbox"
                checked={selectedIds.has(contact.id)}
                onChange={(e) => { e.stopPropagation(); onToggleSelect(contact.id); }}
                onClick={(e) => e.stopPropagation()}
              />
            </div>
            <div className="contact-list__col-name">
              <div className="contact-list__avatar">
                {contact.photoUrl ? (
                  <img src={contact.photoUrl} alt={contact.displayName} />
                ) : (
                  <span>{getInitials(contact)}</span>
                )}
              </div>
              <span className="contact-list__name text-ellipsis">{contact.displayName}</span>
              {contact.isFavorite && (
                <span className="material-symbols-outlined contact-list__favorite">star</span>
              )}
              {/* Action buttons — right edge of Name column, between Name and Contact info */}
              <div className={`contact-list__col-actions ${openRowMenuId === contact.id ? 'contact-list__col-actions--visible' : ''}`}>
                <button
                  className="contact-list__row-action-btn"
                  title="Email"
                  onClick={(e) => { e.stopPropagation(); onEmailContact?.(contact); }}
                >
                  <span className="material-symbols-outlined">mail</span>
                </button>
                <button
                  className="contact-list__row-action-btn"
                  title="More actions"
                  onClick={(e) => handleOpenRowMenu(e, contact.id)}
                >
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
              </div>
            </div>
            <div className="contact-list__col-email">
              {contact.emailAddresses.length > 0 && (
                <span className="contact-list__email text-ellipsis">
                  {contact.emailAddresses[0]}
                </span>
              )}
            </div>
            {columnVisibility.categories && (
              <div className="contact-list__col-data">
                <span className="text-ellipsis">{contact.category || ''}</span>
              </div>
            )}
            {columnVisibility.company && (
              <div className="contact-list__col-data">
                <span className="text-ellipsis">{contact.company || ''}</span>
              </div>
            )}
            {columnVisibility.officeLocation && (
              <div className="contact-list__col-data">
                <span className="text-ellipsis">{contact.office || ''}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Row context menu — fixed positioning to avoid scroll clipping */}
      {openRowMenuId && menuPos && menuContact && (
        <div
          className="contact-list__row-menu"
          ref={rowMenuRef}
          style={{ position: 'fixed', top: menuPos.top, left: menuPos.left }}
        >
          <button onClick={(e) => { e.stopPropagation(); onEditContact?.(menuContact); closeRowMenu(); }}>
            <span className="material-symbols-outlined">edit</span>
            Edit
          </button>
          <button onClick={(e) => { e.stopPropagation(); onFavoriteToggle?.(menuContact.id, !menuContact.isFavorite); closeRowMenu(); }}>
            <span className="material-symbols-outlined">{menuContact.isFavorite ? 'star' : 'star_outline'}</span>
            {menuContact.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
          </button>
          <div className="contact-list__row-menu-divider" />
          <div
            className="contact-list__row-menu-submenu-wrapper"
            onMouseEnter={() => setShowListSubmenu(true)}
            onMouseLeave={() => setShowListSubmenu(false)}
          >
            <button onClick={(e) => { e.stopPropagation(); setShowListSubmenu(prev => !prev); }}>
              <span className="material-symbols-outlined">group_add</span>
              Add to list
              <span className="material-symbols-outlined contact-list__row-menu-arrow">chevron_right</span>
            </button>
            {showListSubmenu && (
              <div className="contact-list__row-submenu">
                {groups && groups.length > 0 ? (
                  groups.map(g => (
                    <button key={g.id} onClick={(e) => { e.stopPropagation(); onAddToGroup?.(menuContact.id, g.id); closeRowMenu(); }}>
                      <span className="material-symbols-outlined">group</span>
                      {g.name}
                    </button>
                  ))
                ) : (
                  <div className="contact-list__row-submenu-empty">No lists available</div>
                )}
              </div>
            )}
          </div>
          <button onClick={(e) => { e.stopPropagation(); onCategoryContact?.(menuContact); closeRowMenu(); }}>
            <span className="material-symbols-outlined">label</span>
            Add category
          </button>
          <div className="contact-list__row-menu-divider" />
          <button onClick={(e) => { e.stopPropagation(); onShareVCard?.(menuContact); closeRowMenu(); }}>
            <span className="material-symbols-outlined">share</span>
            Share as vCard
          </button>
          <div className="contact-list__row-menu-divider" />
          <button onClick={(e) => { e.stopPropagation(); onEmailContact?.(menuContact); closeRowMenu(); }}>
            <span className="material-symbols-outlined">mail</span>
            Email
          </button>
          <button onClick={(e) => { e.stopPropagation(); onCallContact?.(menuContact); closeRowMenu(); }}>
            <span className="material-symbols-outlined">call</span>
            Call
          </button>
          <div className="contact-list__row-menu-divider" />
          <button className="contact-list__row-menu-danger" onClick={(e) => { e.stopPropagation(); onDeleteContact?.(menuContact.id); closeRowMenu(); }}>
            <span className="material-symbols-outlined">delete</span>
            Delete
          </button>
        </div>
      )}
    </div>
  );
};

export default ContactList;
