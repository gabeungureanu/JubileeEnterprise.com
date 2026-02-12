import React from 'react';

const PeopleRibbon: React.FC = () => {
  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button className="ribbon__button ribbon__button--primary" title="New Contact">
          <span className="material-symbols-outlined">person_add</span>
          <span className="ribbon__label">New Contact</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="New Group">
          <span className="material-symbols-outlined">group_add</span>
          <span className="ribbon__label">New Group</span>
        </button>
        <button className="ribbon__button" title="Find Duplicates">
          <span className="material-symbols-outlined">compare_arrows</span>
          <span className="ribbon__label">Duplicates</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Delete">
          <span className="material-symbols-outlined">delete</span>
          <span className="ribbon__label">Delete</span>
        </button>
      </div>
    </div>
  );
};

export default PeopleRibbon;
