import React, { useCallback, useMemo, useState } from 'react';
import { EmailMessage, AttachmentDto } from '../../../types/mail';
import { mailService } from '../../../services/mail/mailService';
import AttachmentPreview, { isPreviewable, getPreviewIcon } from '../AttachmentPreview/AttachmentPreview';
import './ReadingPane.css';

interface ReadingPaneProps {
  message: EmailMessage | null;
  onError?: (message: string) => void;
}

/**
 * Check if a color (r, g, b values 0-255) is "dark" (close to black).
 * Returns true if the perceived brightness is below threshold.
 */
const isDarkColor = (r: number, g: number, b: number): boolean => {
  // Perceived brightness formula (ITU-R BT.709)
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 128;
};

/**
 * Check if a color is "light" (close to white).
 */
const isLightColor = (r: number, g: number, b: number): boolean => {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness >= 200;
};

/**
 * Invert a dark color to its light equivalent.
 * Maps dark colors → light colors (e.g., #000 → #FFF, #333 → #CCC).
 */
const invertDarkToLight = (r: number, g: number, b: number): string => {
  return `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
};

/**
 * Parse a CSS color value and return [r, g, b, a] or null if not parseable.
 */
const parseColor = (color: string): [number, number, number, number] | null => {
  const c = color.trim().toLowerCase();

  // Named colors that are dark
  if (c === 'black') return [0, 0, 0, 1];
  if (c === 'white') return [255, 255, 255, 1];

  // #RGB
  const hex3 = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3) {
    return [parseInt(hex3[1] + hex3[1], 16), parseInt(hex3[2] + hex3[2], 16), parseInt(hex3[3] + hex3[3], 16), 1];
  }

  // #RRGGBB
  const hex6 = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16), 1];
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/);
  if (rgbMatch) {
    return [parseInt(rgbMatch[1]), parseInt(rgbMatch[2]), parseInt(rgbMatch[3]), parseFloat(rgbMatch[4] ?? '1')];
  }

  return null;
};

/**
 * Adapt email HTML for dark theme by converting dark text colors to light
 * while preserving white/light text as-is.
 */
const adaptEmailForDarkTheme = (html: string): string => {
  let result = html;

  // Replace inline color styles: color: <value>
  result = result.replace(
    /(\bcolor\s*:\s*)(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|black|white)(\s*[;!"])/gi,
    (match, prefix, colorVal, suffix) => {
      const parsed = parseColor(colorVal);
      if (!parsed) return match;
      const [r, g, b] = parsed;
      if (isDarkColor(r, g, b)) {
        return prefix + invertDarkToLight(r, g, b) + suffix;
      }
      return match; // Leave light/white/colored text alone
    }
  );

  // Replace background-color dark values with transparent, white/light backgrounds with dark
  result = result.replace(
    /(\bbackground(?:-color)?\s*:\s*)(#[0-9a-fA-F]{3,6}|rgba?\([^)]+\)|white|black)(\s*[;!"])/gi,
    (match, prefix, colorVal, suffix) => {
      const parsed = parseColor(colorVal);
      if (!parsed) return match;
      const [r, g, b] = parsed;
      if (isLightColor(r, g, b)) {
        return prefix + 'transparent' + suffix;
      }
      return match;
    }
  );

  // Handle bgcolor attribute on elements (common in email HTML)
  result = result.replace(
    /(\bbgcolor\s*=\s*["'])(#[0-9a-fA-F]{3,6}|white)(["'])/gi,
    (match, prefix, colorVal, suffix) => {
      const parsed = parseColor(colorVal);
      if (!parsed) return match;
      const [r, g, b] = parsed;
      if (isLightColor(r, g, b)) {
        return prefix + 'transparent' + suffix;
      }
      return match;
    }
  );

  // Handle <font color="..."> tags (legacy email HTML)
  result = result.replace(
    /(<font[^>]*\bcolor\s*=\s*["'])(#[0-9a-fA-F]{3,6}|black)(["'])/gi,
    (match, prefix, colorVal, suffix) => {
      const parsed = parseColor(colorVal);
      if (!parsed) return match;
      const [r, g, b] = parsed;
      if (isDarkColor(r, g, b)) {
        return prefix + invertDarkToLight(r, g, b) + suffix;
      }
      return match;
    }
  );

  return result;
};

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const ReadingPane: React.FC<ReadingPaneProps> = ({ message, onError }) => {
  const [downloadingIds, setDownloadingIds] = useState<Set<string>>(new Set());
  const [previewAttachment, setPreviewAttachment] = useState<AttachmentDto | null>(null);

  const adaptedBodyHtml = useMemo(() => {
    if (!message?.bodyHtml) return '';
    return adaptEmailForDarkTheme(message.bodyHtml);
  }, [message?.bodyHtml]);

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

  const handleAttachmentClick = useCallback((att: AttachmentDto) => {
    if (isPreviewable(att.mimeType)) {
      setPreviewAttachment(att);
    } else {
      handleDownloadAttachment(att.id, att.fileName);
    }
  }, [handleDownloadAttachment]);

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
      {message.bodyHtml ? (
        <div className="reading-pane__body" dangerouslySetInnerHTML={{ __html: adaptedBodyHtml }} />
      ) : (
        <div className="reading-pane__body reading-pane__body--plain">
          {message.bodyText || message.bodyPreview || '(No content)'}
        </div>
      )}
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
                className={`reading-pane__attachment-card ${isPreviewable(att.mimeType) ? 'reading-pane__attachment-card--previewable' : ''}`}
                onClick={() => handleAttachmentClick(att)}
                title={isPreviewable(att.mimeType) ? `Preview ${att.fileName}` : `Download ${att.fileName}`}
              >
                <span className="material-symbols-outlined">{getPreviewIcon(att.mimeType)}</span>
                <div className="reading-pane__attachment-info">
                  <span className="reading-pane__attachment-name text-ellipsis">{att.fileName}</span>
                  {att.fileSize > 0 && (
                    <span className="reading-pane__attachment-size">{formatFileSize(att.fileSize)}</span>
                  )}
                </div>
                <span className="material-symbols-outlined reading-pane__attachment-download">
                  {downloadingIds.has(att.id)
                    ? 'hourglass_empty'
                    : isPreviewable(att.mimeType) ? 'visibility' : 'download'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {previewAttachment && (
        <AttachmentPreview
          messageId={message.id}
          attachment={previewAttachment}
          onClose={() => setPreviewAttachment(null)}
          onDownload={handleDownloadAttachment}
        />
      )}
    </div>
  );
};

export default ReadingPane;
