import React, { useCallback, useState } from 'react';
import { EmailMessage } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import './ReadingPane.css';

interface ReadingPaneProps {
  message: EmailMessage | null;
  onError?: (message: string) => void;
}

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ReadingPane: React.FC<ReadingPaneProps> = ({ message, onError }) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const handleDownloadAttachment = useCallback(async (attachmentId: string, fileName: string) => {
    if (!message) return;
    setDownloadingIds(prev => new Set(prev).add(attachmentId));
    try {
      await mailService.downloadAttachment(message.id, attachmentId, fileName);
    } catch {
      onError?.('Failed to download attachment');
    } finally {
      setDownloadingIds(prev => {
        const next = new Set(prev);
        next.delete(attachmentId);
        return next;
      });
    }
  }, [message, onError]);

  const handlePrint = useCallback(() => {
    if (!message) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const from = message.from.name ? `${message.from.name} &lt;${message.from.address}&gt;` : message.from.address;
    const to = message.to.map(r => r.name ? `${r.name} &lt;${r.address}&gt;` : r.address).join(', ');
    const date = new Date(message.receivedAt).toLocaleString();

    printWindow.document.write(`
      <!DOCTYPE html>
      <html><head><title>${message.subject}</title>
      <style>
        body { font-family: Segoe UI, Arial, sans-serif; padding: 24px; color: #333; max-width: 800px; margin: 0 auto; }
        .header { border-bottom: 2px solid #c5a05e; padding-bottom: 16px; margin-bottom: 16px; }
        .subject { font-size: 20px; font-weight: 600; margin-bottom: 12px; }
        .meta { font-size: 13px; color: #666; line-height: 1.6; }
        .body { font-size: 14px; line-height: 1.6; }
        @media print { body { padding: 0; } }
      </style></head><body>
      <div class="header">
        <div class="subject">${message.subject}</div>
        <div class="meta">
          <div><strong>From:</strong> ${from}</div>
          <div><strong>To:</strong> ${to}</div>
          <div><strong>Date:</strong> ${date}</div>
        </div>
      </div>
      <div class="body">${message.bodyHtml || message.bodyText || ''}</div>
      </body></html>
    `);
    printWindow.document.close();
    printWindow.print();
  }, [message]);

  if (!message) {
    return (
      <div className="reading-pane reading-pane--empty">
        <span className="material-symbols-outlined reading-pane__empty-icon">mail</span>
        <p className="reading-pane__empty-text">Select a message to read</p>
      </div>
    );
  }

  const formatDateTime = (dateStr: string): string => {
    return new Date(dateStr).toLocaleString([], {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="reading-pane">
      <div className="reading-pane__header">
        <div className="reading-pane__header-top">
          <h2 className="reading-pane__subject">{message.subject}</h2>
          <button className="reading-pane__print-btn" onClick={handlePrint} title="Print">
            <span className="material-symbols-outlined">print</span>
          </button>
        </div>
        <div className="reading-pane__meta">
          <div className="reading-pane__sender">
            <div className="reading-pane__avatar">
              {(message.from.name || message.from.address).charAt(0).toUpperCase()}
            </div>
            <div className="reading-pane__sender-info">
              <span className="reading-pane__sender-name">{message.from.name || message.from.address}</span>
              <span className="reading-pane__sender-email">{message.from.address}</span>
            </div>
          </div>
          <span className="reading-pane__date">{formatDateTime(message.receivedAt)}</span>
        </div>
        <div className="reading-pane__recipients">
          <span className="reading-pane__label">To:</span>
          <span className="reading-pane__addresses">
            {message.to.map((addr) => addr.name || addr.address).join(', ')}
          </span>
        </div>
      </div>
      <div className="reading-pane__body" dangerouslySetInnerHTML={{ __html: message.bodyHtml }} />
      {message.attachments.length > 0 && (
        <div className="reading-pane__attachments">
          <h4 className="reading-pane__attachments-title">
            <span className="material-symbols-outlined">attach_file</span>
            Attachments ({message.attachments.length})
          </h4>
          <div className="reading-pane__attachment-list">
            {message.attachments.map((att) => (
              <div
                key={att.id}
                className="reading-pane__attachment-card"
                onClick={() => handleDownloadAttachment(att.id, att.fileName)}
                title={`Download ${att.fileName}`}
              >
                <span className="material-symbols-outlined">description</span>
                <div className="reading-pane__attachment-info">
                  <span className="reading-pane__attachment-name text-ellipsis">{att.fileName}</span>
                  {att.fileSize > 0 && (
                    <span className="reading-pane__attachment-size">{formatFileSize(att.fileSize)}</span>
                  )}
                </div>
                <span className="material-symbols-outlined reading-pane__attachment-download">
                  {downloadingIds.has(att.id) ? 'hourglass_empty' : 'download'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ReadingPane;
