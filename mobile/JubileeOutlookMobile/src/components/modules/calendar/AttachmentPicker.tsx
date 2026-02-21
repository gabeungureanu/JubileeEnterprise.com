/**
 * AttachmentPicker — Add/remove file attachments using expo-document-picker.
 *
 * Shows an "Add attachment" button and a list of picked files
 * with name, size, and a remove button.
 * Tapping a file name opens an in-app preview modal.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { useAlert } from '../../../hooks';
import { AttachmentPreviewModal } from '../../common';
import type { PreviewAttachment } from '../../common';

export interface PickedFile {
  name: string;
  size: number;
  uri: string;
  mimeType?: string;
}

interface AttachmentPickerProps {
  files: PickedFile[];
  onAdd: (file: PickedFile) => void;
  onRemove: (index: number) => void;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const AttachmentPicker: React.FC<AttachmentPickerProps> = ({
  files,
  onAdd,
  onRemove,
}) => {
  const { confirm, AlertComponent } = useAlert();
  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);

  const handleOpen = useCallback(
    (file: PickedFile) => {
      setPreviewAttachment({
        fileName: file.name,
        fileUrl: file.uri,
        fileSize: file.size,
      });
    },
    [],
  );

  const handleRemove = useCallback(
    (idx: number) => {
      const fileName = files[idx]?.name || 'this attachment';
      confirm(
        'Remove Attachment',
        `Are you sure you want to remove "${fileName}"?`,
        () => onRemove(idx),
        { confirmText: 'Remove', destructive: true },
      );
    },
    [files, onRemove, confirm],
  );

  const handlePick = useCallback(async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: '*/*',
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        onAdd({
          name: asset.name,
          size: asset.size || 0,
          uri: asset.uri,
          mimeType: asset.mimeType || undefined,
        });
      }
    } catch {
      // User cancelled or error
    }
  }, [onAdd]);

  return (
    <>
      <View style={styles.container}>
        {/* File list */}
        {files.map((file, idx) => (
          <View key={`${file.name}-${idx}`} style={styles.fileRow}>
            <Icon name="attach-file" size={20} color={Colors.textSecondary} />
            <TouchableOpacity
              style={styles.fileInfo}
              onPress={() => handleOpen(file)}
              activeOpacity={0.7}
            >
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleOpen(file)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
              style={styles.openButton}
            >
              <Icon name="visibility" size={18} color={Colors.primary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleRemove(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={20} color={Colors.error} />
            </TouchableOpacity>
          </View>
        ))}

        {/* Add button */}
        <TouchableOpacity style={styles.addButton} onPress={handlePick} activeOpacity={0.7}>
          <Icon name="add" size={20} color={Colors.primary} />
          <Text style={styles.addText}>Add attachment</Text>
        </TouchableOpacity>
      </View>

      {AlertComponent}

      {/* Preview modal */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    gap: Spacing.sm,
  },
  fileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    gap: Spacing.sm,
  },
  fileInfo: {
    flex: 1,
  },
  fileName: {
    ...Typography.body,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  openButton: {
    marginRight: Spacing.xs,
  },
  fileSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.md,
    gap: Spacing.xs,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    borderStyle: 'dashed',
  },
  addText: {
    ...Typography.button,
    color: Colors.primary,
  },
});
