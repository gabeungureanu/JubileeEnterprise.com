/**
 * Email HTML Processor — Preprocesses email body HTML for mobile rendering.
 *
 * Handles:
 * - Dark theme color adaptation (regex-based, matching web frontend)
 * - CID (Content-ID) inline image replacement with base64 data URIs
 * - localhost URL rewriting for mobile device access
 */
import { API } from '../constants/api';
import { tokenStore } from '../services/apiClient';
import type { AttachmentDto } from '../types/mail';

// ── Color Parsing (ported from web frontend ReadingPane.tsx) ──

/** Perceived brightness formula (ITU-R BT.709). */
function colorBrightness(r: number, g: number, b: number): number {
  return (r * 299 + g * 587 + b * 114) / 1000;
}

/** Check if a color is dark (close to black). */
function isDarkColor(r: number, g: number, b: number): boolean {
  return colorBrightness(r, g, b) < 128;
}

/** Check if a color is light (close to white). */
function isLightColor(r: number, g: number, b: number): boolean {
  return colorBrightness(r, g, b) >= 200;
}

/** Invert a dark color to its light equivalent. */
function invertDarkToLight(r: number, g: number, b: number): string {
  return `rgb(${255 - r}, ${255 - g}, ${255 - b})`;
}

/**
 * Parse a CSS color value and return [r, g, b, a] or null if not parseable.
 */
function parseColor(color: string): [number, number, number, number] | null {
  const c = color.trim().toLowerCase();

  if (c === 'black') return [0, 0, 0, 1];
  if (c === 'white') return [255, 255, 255, 1];

  // #RGB
  const hex3 = c.match(/^#([0-9a-f])([0-9a-f])([0-9a-f])$/i);
  if (hex3) {
    return [
      parseInt(hex3[1] + hex3[1], 16),
      parseInt(hex3[2] + hex3[2], 16),
      parseInt(hex3[3] + hex3[3], 16),
      1,
    ];
  }

  // #RRGGBB
  const hex6 = c.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  if (hex6) {
    return [parseInt(hex6[1], 16), parseInt(hex6[2], 16), parseInt(hex6[3], 16), 1];
  }

  // rgb(r, g, b) or rgba(r, g, b, a)
  const rgbMatch = c.match(
    /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*(?:,\s*([\d.]+))?\s*\)$/,
  );
  if (rgbMatch) {
    return [
      parseInt(rgbMatch[1]),
      parseInt(rgbMatch[2]),
      parseInt(rgbMatch[3]),
      parseFloat(rgbMatch[4] ?? '1'),
    ];
  }

  return null;
}

/**
 * Adapt email HTML for dark theme by converting dark text colors to light
 * and light backgrounds to transparent. Matches the web frontend logic exactly.
 *
 * This approach modifies only color values in the HTML — images are left untouched,
 * avoiding the cross-origin taint issues caused by CSS filter inversion.
 */
export function adaptEmailForDarkTheme(html: string): string {
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
      return match;
    },
  );

  // Replace background-color: light values with transparent
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
    },
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
    },
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
    },
  );

  return result;
}

// ── Helpers ───────────────────────────────────────────────

/** Build an authenticated attachment download URL. */
export function buildAttachmentDownloadUrl(
  messageId: string,
  attachmentId: string,
): string {
  return `${API.CONTINUUM_BASE_URL}/v1/outlook/messages/${encodeURIComponent(messageId)}/attachments/${encodeURIComponent(attachmentId)}/download`;
}

/**
 * Check whether a URL points to our own API and needs auth headers.
 */
export function isOurApiUrl(url: string): boolean {
  if (!url) return false;
  const baseHost = API.CONTINUUM_BASE_URL.replace(/^https?:\/\//, '')
    .replace(/\/api\/?$/, '');
  return (
    url.includes(baseHost) ||
    url.includes('inspirecontinuum.com') ||
    url.includes('inspirecodex.com')
  );
}

// ── Main Processor ────────────────────────────────────────

/**
 * Process email body HTML before rendering (synchronous).
 *
 * 1. Replaces `cid:xxx` image references with actual API download URLs
 * 2. Rewrites localhost URLs to the actual server host (for mobile access)
 * 3. Adapts colors for dark theme (regex-based, no CSS filter needed)
 */
export function processEmailHtml(
  html: string,
  messageId: string,
  attachments: AttachmentDto[],
): string {
  if (!html) return html;

  let processed = html;

  // ── Step 1: Replace CID references with attachment download URLs ──

  const inlineAttachments = attachments.filter((a) => a.isInline);

  if (inlineAttachments.length > 0) {
    const cidRegex = /src=["']cid:([^"']+)["']/gi;
    let match: RegExpExecArray | null;
    const cidRefs: { full: string; cidValue: string }[] = [];

    while ((match = cidRegex.exec(processed)) !== null) {
      cidRefs.push({ full: match[0], cidValue: match[1] });
    }

    for (const ref of cidRefs) {
      const matchedAtt = matchCidToAttachment(ref.cidValue, inlineAttachments);
      if (matchedAtt) {
        const downloadUrl = buildAttachmentDownloadUrl(messageId, matchedAtt.id);
        processed = processed.replace(ref.full, `src="${downloadUrl}"`);
      }
    }
  }

  // ── Step 2: Rewrite localhost URLs for mobile access ──

  const serverHost = API.CONTINUUM_BASE_URL.replace(/\/api\/?$/, '')
    .replace(/^https?:\/\//, '');

  processed = processed
    .replace(/src=["'](https?:\/\/localhost)(:\d+)?/gi, `src="http://${serverHost}`)
    .replace(/src=["'](https?:\/\/127\.0\.0\.1)(:\d+)?/gi, `src="http://${serverHost}`);

  // ── Step 3: Dark theme color adaptation ──

  processed = adaptEmailForDarkTheme(processed);

  return processed;
}

/**
 * Match a CID reference string to an inline attachment.
 */
function matchCidToAttachment(
  cidValue: string,
  attachments: AttachmentDto[],
): AttachmentDto | null {
  const cidLower = cidValue.toLowerCase();

  // Strategy 1: CID contains the exact filename
  for (const att of attachments) {
    const nameLower = att.fileName.toLowerCase();
    if (cidLower.includes(nameLower) || nameLower.includes(cidLower)) {
      return att;
    }
  }

  // Strategy 2: CID contains filename without extension
  for (const att of attachments) {
    const nameNoExt = att.fileName.replace(/\.[^.]+$/, '').toLowerCase();
    if (nameNoExt && cidLower.includes(nameNoExt)) {
      return att;
    }
  }

  // Strategy 3: CID prefix (before @) matches filename prefix
  const cidPrefix = cidLower.split('@')[0];
  if (cidPrefix) {
    for (const att of attachments) {
      const nameNoExt = att.fileName.replace(/\.[^.]+$/, '').toLowerCase();
      if (nameNoExt && cidPrefix.includes(nameNoExt)) {
        return att;
      }
    }
  }

  return null;
}

/**
 * Get auth headers for image requests to our API.
 */
export function getImageAuthHeaders(
  token: string | null,
  userId: string | null,
): Record<string, string> {
  const headers: Record<string, string> = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  if (userId) headers['X-User-Id'] = userId;
  return headers;
}

/**
 * Async version of processEmailHtml — pre-downloads only CID inline
 * attachment images as base64 data URIs (they need auth headers).
 *
 * External images are left as-is for the WebView to load natively,
 * keeping email rendering fast.
 */
export async function processEmailHtmlAsync(
  html: string,
  messageId: string,
  attachments: AttachmentDto[],
): Promise<string> {
  if (!html) return html;

  // Apply synchronous processing (CID → download URLs, localhost rewrite, dark theme)
  let processed = processEmailHtml(html, messageId, attachments);

  const token = tokenStore.getAccessToken();
  const userId = tokenStore.getUserId();
  const authHeaders: Record<string, string> = { Accept: '*/*' };
  if (token) authHeaders.Authorization = `Bearer ${token}`;
  if (userId) authHeaders['X-User-Id'] = userId;

  // ── Embed CID inline attachment images as base64 ──
  // These need auth headers that the WebView can't send on <img src> requests.
  const inlineAttachments = attachments.filter((a) => a.isInline);

  for (const att of inlineAttachments) {
    const downloadUrl = buildAttachmentDownloadUrl(messageId, att.id);
    if (!processed.includes(downloadUrl)) continue;

    try {
      const response = await fetch(downloadUrl, { headers: authHeaders });
      if (!response.ok) continue;

      const blob = await response.blob();
      const base64 = await blobToBase64(blob);
      const mimeType = att.mimeType || 'image/png';
      const dataUri = `data:${mimeType};base64,${base64}`;
      processed = processed.split(downloadUrl).join(dataUri);
    } catch {
      // Leave the download URL as-is if fetch fails
    }
  }

  return processed;
}

/** Convert a Blob to a base64 string (without the data: prefix). */
function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Separate inline attachments from regular attachments for display.
 * Inline attachments are shown in the email body, not in the attachment list.
 */
export function getRegularAttachments(attachments: AttachmentDto[]): AttachmentDto[] {
  return attachments.filter((a) => !a.isInline);
}
