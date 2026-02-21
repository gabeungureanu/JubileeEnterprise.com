/**
 * AttachmentPreviewModal — Full-screen modal for previewing attachments.
 *
 * Matches web frontend's attachment preview overlay:
 * - Images: rendered inline via <Image>
 * - PDFs: rendered via WebView
 * - Other files: generic icon with "preview not available"
 * - Header: file name, size, download button, close button
 */
import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  SafeAreaView,
  Alert,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { File, Directory, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { API } from '../../constants';

export interface PreviewAttachment {
  fileName: string;
  fileUrl: string;
  fileSize: number;
}

interface AttachmentPreviewModalProps {
  attachment: PreviewAttachment | null;
  onClose: () => void;
}

// ── Helpers ──────────────────────────────────────────────────

function isImageFile(fileName: string): boolean {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp'].includes(ext);
}

function isPdfFile(fileName: string): boolean {
  return fileName.toLowerCase().endsWith('.pdf');
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function resolveFileUrl(uri: string): string {
  if (!uri) return '';
  // Local file — return as-is
  if (uri.startsWith('file://') || uri.startsWith('content://')) return uri;

  // The API stores URLs with localhost which is unreachable from mobile.
  // Replace localhost with the actual server host from CONTINUUM_BASE_URL.
  const serverHost = API.CONTINUUM_BASE_URL.replace(/\/api\/?$/, '')
    .replace(/^https?:\/\//, ''); // e.g. "192.168.1.52:4003"

  let resolved = uri;
  if (resolved.startsWith('http://') || resolved.startsWith('https://')) {
    // Replace localhost / 127.0.0.1 with actual server host
    resolved = resolved
      .replace(/\/\/localhost(:\d+)?/, `//${serverHost}`)
      .replace(/\/\/127\.0\.0\.1(:\d+)?/, `//${serverHost}`);
    return resolved;
  }

  // Relative path — prepend Continuum base URL
  const base = API.CONTINUUM_BASE_URL.replace(/\/api\/?$/, '');
  return `${base}${resolved.startsWith('/') ? '' : '/'}${resolved}`;
}

function getFileIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  const icons: Record<string, string> = {
    pdf: 'picture-as-pdf',
    doc: 'description', docx: 'description',
    xls: 'table-chart', xlsx: 'table-chart',
    ppt: 'slideshow', pptx: 'slideshow',
    txt: 'article', csv: 'article',
    zip: 'folder', rar: 'folder',
  };
  return icons[ext] || 'insert-drive-file';
}

// ── Component ────────────────────────────────────────────────

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  attachment,
  onClose,
}) => {
  const [imageError, setImageError] = useState(false);
  const [imageLoading, setImageLoading] = useState(true);
  const [downloading, setDownloading] = useState(false);

  // Reset states whenever the attachment changes
  useEffect(() => {
    setImageError(false);
    setImageLoading(true);
  }, [attachment?.fileUrl, attachment?.fileName]);

  const handleDownload = useCallback(async () => {
    if (!attachment) return;

    const url = resolveFileUrl(attachment.fileUrl);
    if (!url) return;

    setDownloading(true);
    try {
      const destDir = new Directory(Paths.cache, 'attachments');
      destDir.create();
      const downloaded = await File.downloadFileAsync(url, destDir);

      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(downloaded.uri, {
          dialogTitle: `Save ${attachment.fileName}`,
        });
      }
    } catch (err: any) {
      Alert.alert('Download Failed', err?.message || 'Could not download the file.');
    } finally {
      setDownloading(false);
    }
  }, [attachment]);

  if (!attachment) return null;

  const url = resolveFileUrl(attachment.fileUrl);
  const isImage = isImageFile(attachment.fileName);
  const isPdf = isPdfFile(attachment.fileName);

  return (
    <Modal
      visible={!!attachment}
      animationType="slide"
      presentationStyle="fullScreen"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity onPress={onClose} style={styles.closeButton}>
            <Icon name="close" size={24} color={Colors.textPrimary} />
          </TouchableOpacity>

          <View style={styles.headerInfo}>
            <Text style={styles.headerTitle} numberOfLines={1}>
              {attachment.fileName}
            </Text>
            <Text style={styles.headerSize}>
              {formatFileSize(attachment.fileSize)}
            </Text>
          </View>

          <TouchableOpacity
            onPress={handleDownload}
            style={styles.downloadButton}
            disabled={downloading}
          >
            {downloading ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <Icon name="download" size={24} color={Colors.primary} />
            )}
          </TouchableOpacity>
        </View>

        {/* Preview body */}
        <View style={styles.body}>
          {!url ? (
            <View style={styles.genericPreview}>
              <Icon name="error-outline" size={64} color={Colors.textTertiary} />
              <Text style={styles.genericText}>No file URL available.</Text>
            </View>
          ) : isImage && !imageError ? (
            <View style={styles.imageContainer}>
              {imageLoading && (
                <View style={styles.loading}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>Loading image...</Text>
                </View>
              )}
              <Image
                source={{ uri: url }}
                style={styles.image}
                resizeMode="contain"
                onLoad={() => setImageLoading(false)}
                onError={() => setImageError(true)}
              />
            </View>
          ) : isImage || isPdf ? (
            <WebView
              source={
                isImage
                  ? { html: `<html><body style="margin:0;background:#000;display:flex;align-items:center;justify-content:center;height:100vh"><img src="${url}" style="max-width:100%;max-height:100%;object-fit:contain"/></body></html>` }
                  : { uri: url }
              }
              style={styles.webview}
              startInLoadingState
              renderLoading={() => (
                <View style={styles.loading}>
                  <ActivityIndicator size="large" color={Colors.primary} />
                  <Text style={styles.loadingText}>
                    {isImage ? 'Loading image...' : 'Loading PDF...'}
                  </Text>
                </View>
              )}
            />
          ) : (
            <View style={styles.genericPreview}>
              <Icon
                name={getFileIcon(attachment.fileName) as any}
                size={80}
                color={Colors.textTertiary}
              />
              <Text style={styles.genericTitle}>{attachment.fileName}</Text>
              <Text style={styles.genericText}>
                Preview not available for this file type.
              </Text>
              <TouchableOpacity
                style={styles.downloadAction}
                onPress={handleDownload}
                disabled={downloading}
              >
                <Icon name="download" size={20} color={Colors.textInverse} />
                <Text style={styles.downloadActionText}>
                  {downloading ? 'Downloading...' : 'Download to view'}
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </SafeAreaView>
    </Modal>
  );
};

// ── Styles ───────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  closeButton: {
    padding: Spacing.xs,
  },
  headerInfo: {
    flex: 1,
  },
  headerTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '600',
  },
  headerSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  downloadButton: {
    padding: Spacing.xs,
  },
  body: {
    flex: 1,
  },
  imageContainer: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
  },
  image: {
    flex: 1,
    width: '100%',
  },
  webview: {
    flex: 1,
  },
  loading: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: Spacing.sm,
  },
  genericPreview: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xxl,
    gap: Spacing.md,
  },
  genericTitle: {
    ...Typography.body,
    color: Colors.textPrimary,
    fontWeight: '500',
    textAlign: 'center',
  },
  genericText: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    textAlign: 'center',
  },
  downloadAction: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
    marginTop: Spacing.lg,
  },
  downloadActionText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
