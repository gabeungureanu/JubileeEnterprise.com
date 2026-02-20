import React, { useState } from 'react';
import { ContactGroup } from '../../../types/contacts';
import './ContactGroups.css';

interface ContactGroupsProps {
  groups: ContactGroup[];
  selectedGroupId: string;
  onGroupSelect: (groupId: string) => void;
  contactCounts: { all: number; favorites: number; deleted: number };
  onEditGroup?: (group: ContactGroup) => void;
  onDeleteGroup?: (groupId: string) => void;
  onEmptyTrash?: () => void;
  onNewGroup?: () => void;
  userEmail?: string;
  categories?: string[];
  categoryCounts?: Record<string, number>;
  selectedCategory?: string | null;
  onCategorySelect?: (category: string) => void;
}

const ContactGroups: React.FC<ContactGroupsProps> = ({
  groups, selectedGroupId, onGroupSelect, contactCounts,
  onEditGroup, onDeleteGroup, onEmptyTrash, onNewGroup,
  userEmail = '',
  categories = [], categoryCounts = {}, selectedCategory, onCategorySelect,
}) => {
  const [accountExpanded, setAccountExpanded] = useState(true);
  const [categoriesExpanded, setCategoriesExpanded] = useState(true);
  const [contextMenu, setContextMenu] = useState<{ groupId: string; x: number; y: number } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, group: ContactGroup) => {
    e.preventDefault();
    setContextMenu({ groupId: group.id, x: e.clientX, y: e.clientY });
  };

  const closeContextMenu = () => setContextMenu(null);
  const contextGroup = groups.find(g => g.id === contextMenu?.groupId);

  return (
    <div className="contact-groups" onClick={closeContextMenu}>
      {/* Account email header (collapsible) */}
      <div
        className="contact-groups__account-header"
        onClick={() => setAccountExpanded(!accountExpanded)}
      >
        <span className="material-symbols-outlined contact-groups__expand-icon" style={{ transform: accountExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          expand_more
        </span>
        <span className="contact-groups__account-email">{userEmail || 'My Contacts'}</span>
      </div>

      {accountExpanded && (
        <>
          {/* Folder items */}
          <div
            className={`contact-groups__item ${selectedGroupId === 'all' ? 'contact-groups__item--selected' : ''}`}
            onClick={() => onGroupSelect('all')}
          >
            <span className="material-symbols-outlined">people</span>
            <span className="contact-groups__name">Your contacts</span>
            {contactCounts.all > 0 && (
              <span className="contact-groups__folder-count">{contactCounts.all}</span>
            )}
          </div>
          <div
            className={`contact-groups__item ${selectedGroupId === 'favorites' ? 'contact-groups__item--selected' : ''}`}
            onClick={() => onGroupSelect('favorites')}
          >
            <span className="material-symbols-outlined">star</span>
            <span className="contact-groups__name">Favorites</span>
          </div>

          {/* Your contact lists (folder) */}
          <div
            className={`contact-groups__item ${selectedGroupId === 'lists' ? 'contact-groups__item--selected' : ''}`}
            onClick={() => onGroupSelect('lists')}
          >
            <span className="material-symbols-outlined">contacts</span>
            <span className="contact-groups__name">Your contact lists</span>
          </div>

          {/* Sub-folders (groups) indented */}
          {groups.map((group) => (
            <div
              key={group.id}
              className={`contact-groups__subitem ${selectedGroupId === group.id ? 'contact-groups__subitem--selected' : ''}`}
              onClick={() => onGroupSelect(group.id)}
              onContextMenu={(e) => handleContextMenu(e, group)}
            >
              <span className="material-symbols-outlined">group</span>
              <span className="contact-groups__name">{group.name}</span>
            </div>
          ))}

          {/* Deleted folder */}
          <div
            className={`contact-groups__item ${selectedGroupId === 'deleted' ? 'contact-groups__item--selected' : ''}`}
            onClick={() => onGroupSelect('deleted')}
          >
            <span className="material-symbols-outlined">delete</span>
            <span className="contact-groups__name">Deleted</span>
          </div>

          {selectedGroupId === 'deleted' && contactCounts.deleted > 0 && onEmptyTrash && (
            <button className="contact-groups__empty-trash" onClick={onEmptyTrash}>
              <span className="material-symbols-outlined">delete_sweep</span>
              Empty Trash
            </button>
          )}

          {/* New list button (always visible) */}
          {onNewGroup && (
            <div className="contact-groups__new-list" onClick={onNewGroup}>
              <span className="contact-groups__new-list-icon">+</span>
              <span className="contact-groups__new-list-text">New list</span>
            </div>
          )}
        </>
      )}

      {/* Categories section */}
      <div className="contact-groups__divider" />
      <div
        className="contact-groups__categories-header"
        onClick={() => setCategoriesExpanded(!categoriesExpanded)}
      >
        <span className="material-symbols-outlined contact-groups__expand-icon" style={{ transform: categoriesExpanded ? 'rotate(0deg)' : 'rotate(-90deg)' }}>
          expand_more
        </span>
        <span className="contact-groups__categories-title">Categories</span>
      </div>

      {categoriesExpanded && (
        categories.length > 0 ? (
          <div className="contact-groups__categories-list">
            {categories.map((cat) => (
              <div
                key={cat}
                className={`contact-groups__category-item ${selectedCategory === cat ? 'contact-groups__category-item--selected' : ''}`}
                onClick={() => onCategorySelect?.(cat)}
              >
                <span className="material-symbols-outlined contact-groups__category-icon">label</span>
                <span className="contact-groups__category-name">{cat}</span>
                {categoryCounts[cat] != null && (
                  <span className="contact-groups__category-count">{categoryCounts[cat]}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <div className="contact-groups__categories-empty">
            When you create categories, they will appear here.
          </div>
        )
      )}

      {/* Context menu for groups */}
      {contextMenu && contextGroup && (
        <div
          className="contact-groups__context-menu"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {onEditGroup && (
            <button onClick={() => { onEditGroup(contextGroup); closeContextMenu(); }}>
              <span className="material-symbols-outlined">edit</span> Rename list
            </button>
          )}
          {onDeleteGroup && (
            <button className="contact-groups__context-danger" onClick={() => { onDeleteGroup(contextGroup.id); closeContextMenu(); }}>
              <span className="material-symbols-outlined">delete</span> Delete list
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default ContactGroups;
