import React, { useState } from 'react';
import { useAppContext } from '../../context/AppContext';
import FolderPane from '../../components/mail/FolderPane';
import MessageList from '../../components/mail/MessageList';
import ReadingPane from '../../components/mail/ReadingPane';
import { MailFolder, EmailMessage } from '../../types/mail';
import './MailPage.css';

const defaultFolders: MailFolder[] = [
  { id: 'inbox', displayName: 'Inbox', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'inbox', childFolders: [] },
  { id: 'sent', displayName: 'Sent Items', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'sent', childFolders: [] },
  { id: 'drafts', displayName: 'Drafts', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'drafts', childFolders: [] },
  { id: 'archive', displayName: 'Archive', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'archive', childFolders: [] },
  { id: 'trash', displayName: 'Deleted Items', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'trash', childFolders: [] },
  { id: 'spam', displayName: 'Junk Email', parentFolderId: null, unreadItemCount: 0, totalItemCount: 0, folderType: 'spam', childFolders: [] },
];

const MailPage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();
  const [selectedFolderId, setSelectedFolderId] = useState<string>('inbox');
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [messages] = useState<EmailMessage[]>([]);

  const selectedMessage = messages.find((m) => m.id === selectedMessageId) || null;

  return (
    <div className="mail-page">
      {isFolderPaneVisible && (
        <FolderPane
          folders={defaultFolders}
          selectedFolderId={selectedFolderId}
          onFolderSelect={setSelectedFolderId}
        />
      )}
      <MessageList
        messages={messages}
        selectedMessageId={selectedMessageId}
        onMessageSelect={setSelectedMessageId}
      />
      <ReadingPane message={selectedMessage} />
    </div>
  );
};

export default MailPage;
