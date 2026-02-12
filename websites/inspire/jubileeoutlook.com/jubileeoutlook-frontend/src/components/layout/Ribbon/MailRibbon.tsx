import React from 'react';

const MailRibbon: React.FC = () => {
  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button className="ribbon__button ribbon__button--primary" title="New Mail">
          <span className="material-symbols-outlined">edit</span>
          <span className="ribbon__label">New Mail</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Delete">
          <span className="material-symbols-outlined">delete</span>
          <span className="ribbon__label">Delete</span>
        </button>
        <button className="ribbon__button" title="Archive">
          <span className="material-symbols-outlined">archive</span>
          <span className="ribbon__label">Archive</span>
        </button>
        <button className="ribbon__button" title="Block">
          <span className="material-symbols-outlined">block</span>
          <span className="ribbon__label">Block</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button className="ribbon__button" title="Reply">
          <span className="material-symbols-outlined">reply</span>
          <span className="ribbon__label">Reply</span>
        </button>
        <button className="ribbon__button" title="Reply All">
          <span className="material-symbols-outlined">reply_all</span>
          <span className="ribbon__label">Reply All</span>
        </button>
        <button className="ribbon__button" title="Forward">
          <span className="material-symbols-outlined">forward</span>
          <span className="ribbon__label">Forward</span>
        </button>
      </div>
    </div>
  );
};

export default MailRibbon;
