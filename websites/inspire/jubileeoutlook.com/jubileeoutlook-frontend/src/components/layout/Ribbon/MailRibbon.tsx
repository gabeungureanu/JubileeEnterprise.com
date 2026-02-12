import React from 'react';
import { useMailContextSafe } from '../../../context/MailContext';
import './Ribbon.css';

const MailRibbon: React.FC = () => {
  const mail = useMailContextSafe();

  const hasMessage = !!mail?.selectedMessage;

  return (
    <div className="ribbon__content">
      <div className="ribbon__group">
        <button
          className="ribbon__button ribbon__button--primary"
          title="New Mail"
          onClick={() => mail?.openCompose('new')}
        >
          <span className="material-symbols-outlined">edit</span>
          <span className="ribbon__label">New Mail</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button
          className="ribbon__button"
          title="Delete"
          onClick={() => mail?.deleteMessage()}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">delete</span>
          <span className="ribbon__label">Delete</span>
        </button>
        <button
          className="ribbon__button"
          title="Archive"
          onClick={() => mail?.archiveMessage()}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">archive</span>
          <span className="ribbon__label">Archive</span>
        </button>
        <button
          className="ribbon__button"
          title={mail?.selectedMessage?.isRead ? 'Mark Unread' : 'Mark Read'}
          onClick={() => mail?.toggleRead()}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">
            {mail?.selectedMessage?.isRead ? 'mark_email_unread' : 'mark_email_read'}
          </span>
          <span className="ribbon__label">{mail?.selectedMessage?.isRead ? 'Unread' : 'Read'}</span>
        </button>
        <button
          className="ribbon__button"
          title={mail?.selectedMessage?.isFlagged ? 'Unflag' : 'Flag'}
          onClick={() => mail?.toggleFlag()}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">
            {mail?.selectedMessage?.isFlagged ? 'flag' : 'outlined_flag'}
          </span>
          <span className="ribbon__label">{mail?.selectedMessage?.isFlagged ? 'Unflag' : 'Flag'}</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button
          className="ribbon__button"
          title="Reply"
          onClick={() => mail?.openCompose('reply')}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">reply</span>
          <span className="ribbon__label">Reply</span>
        </button>
        <button
          className="ribbon__button"
          title="Reply All"
          onClick={() => mail?.openCompose('replyAll')}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">reply_all</span>
          <span className="ribbon__label">Reply All</span>
        </button>
        <button
          className="ribbon__button"
          title="Forward"
          onClick={() => mail?.openCompose('forward')}
          disabled={!hasMessage}
        >
          <span className="material-symbols-outlined">forward</span>
          <span className="ribbon__label">Forward</span>
        </button>
      </div>

      <div className="ribbon__separator" />

      <div className="ribbon__group">
        <button
          className="ribbon__button"
          title="Sync / Refresh"
          onClick={() => {
            mail?.refreshMessages();
            mail?.refreshFolders();
          }}
        >
          <span className="material-symbols-outlined">sync</span>
          <span className="ribbon__label">Sync</span>
        </button>
      </div>
    </div>
  );
};

export default MailRibbon;
