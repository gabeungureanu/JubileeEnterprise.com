import React, { useEffect, useState, useCallback } from 'react';
import { AttachmentDto } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import './AttachmentPreview.css';

interface AttachmentPreviewProps {
  messageId: string;
  attachment: AttachmentDto;
  onClose: () => void;
  onDownload: (attachmentId: string, fileName: string) => void;
}

const IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp', 'image/svg+xml', 'image/bmp'];
const PDF_TYPE = 'application/pdf';

export function isPreviewable(mimeType: string): boolean {
  const mt = mimeType.toLowerCase();
  return IMAGE_TYPES.includes(mt) || mt === PDF_TYPE;
}

export function getPreviewIcon(mimeType: string): string {
  const mt = mimeType.toLowerCase();
  if (IMAGE_TYPES.includes(mt)) return 'image';
  if (mt === PDF_TYPE) return 'picture_as_pdf';
  return 'description';
}

const AttachmentPreview: React.FC<AttachmentPreviewProps> = ({ messageId, attachment, onClose, onDownload }) => {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mimeType = attachment.mimeType.toLowerCase();
  const isImage = IMAGE_TYPES.includes(mimeType);
  const isPdf = mimeType === PDF_TYPE;

  useEffect(() => {
    let revoke: string | null = null;

    const fetchBlob = async () => {
      setLoading(true);
      setError(null);
      try {
        const blob = await mailService.fetchAttachmentBlob(messageId, attachment.id, attachment.mimeType);
        const url = URL.createObjectURL(blob);
        revoke = url;
        setBlobUrl(url);
      } catch {
        setError('Failed to load attachment preview');
      } finally {
        setLoading(false);
      }
    };

    fetchBlob();

    return () => {
      if (revoke) URL.revokeObjectURL(revoke);
    };
  }, [messageId, attachment.id, attachment.mimeType]);

  const handleOverlayClick = useCallback((e: React.MouseEvent) => {
    if (e.target === e.currentTarget) onClose();
  }, [onClose]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose]);

  return (
    <div className="attachment-preview__overlay" onClick={handleOverlayClick}>
      <div className="attachment-preview__modal">
        <div className="attachment-preview__header">
          <div className="attachment-preview__title">
            <span className="material-symbols-outlined">{getPreviewIcon(attachment.mimeType)}</span>
            <span className="attachment-preview__filename text-ellipsis">{attachment.fileName}</span>
          </div>
          <div className="attachment-preview__actions">
            <button
              className="attachment-preview__action-btn"
              onClick={() => onDownload(attachment.id, attachment.fileName)}
              title="Download"
            >
              <span className="material-symbols-outlined">download</span>
            </button>
            <button className="attachment-preview__action-btn" onClick={onClose} title="Close">
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        </div>

        <div className="attachment-preview__content">
          {loading && (
            <div className="attachment-preview__loading">
              <span className="material-symbols-outlined attachment-preview__spinner">progress_activity</span>
              <span>Loading preview...</span>
            </div>
          )}

          {error && (
            <div className="attachment-preview__error">
              <span className="material-symbols-outlined">error</span>
              <span>{error}</span>
            </div>
          )}

          {!loading && !error && blobUrl && isImage && (
            <img
              src={blobUrl}
              alt={attachment.fileName}
              className="attachment-preview__image"
            />
          )}

          {!loading && !error && blobUrl && isPdf && (
            <iframe
              src={blobUrl}
              title={attachment.fileName}
              className="attachment-preview__pdf"
            />
          )}
        </div>
      </div>
    </div>
  );
};

export default AttachmentPreview;
