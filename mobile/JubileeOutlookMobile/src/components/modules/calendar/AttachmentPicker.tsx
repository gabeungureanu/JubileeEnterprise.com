/**
 * AttachmentPicker — Add/remove file attachments using expo-document-picker.
 *
 * Shows an "Add attachment" button and a list of picked files
 * with name, size, and a remove button.
 */
import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as Sharing from 'expo-sharing';

import { Colors } from '../../../constants/colors';
import { Typography } from '../../../constants/typography';
import { Spacing, BorderRadius } from '../../../constants/spacing';
import { useAlert } from '../../../hooks';

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
  const { alert, confirm, AlertComponent } = useAlert();

  const handleOpen = useCallback(
    async (file: PickedFile) => {
      try {
        const isLocal = file.uri.startsWith('file://') || file.uri.startsWith('content://');
        if (isLocal) {
          // Local file — share via OS share sheet
          const canShare = await Sharing.isAvailableAsync();
          if (canShare) {
            await Sharing.shareAsync(file.uri, {
              mimeType: file.mimeType || 'application/octet-stream',
              dialogTitle: file.name,
            });
          } else {
            alert('Cannot Open', 'Sharing is not available on this device.', 'warning');
          }
        } else {
          // Server URL — open in browser/viewer
          const supported = await Linking.canOpenURL(file.uri);
          if (supported) {
            await Linking.openURL(file.uri);
          } else {
            alert('Cannot Open', 'Unable to open this file.', 'warning');
          }
        }
      } catch {
        alert('Error', 'Could not open attachment.', 'error');
      }
    },
    [alert],
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
          <TouchableOpacity
            key={`${file.name}-${idx}`}
            style={styles.fileRow}
            onPress={() => handleOpen(file)}
            activeOpacity={0.7}
          >
            <Icon name="attach-file" size={20} color={Colors.textSecondary} />
            <View style={styles.fileInfo}>
              <Text style={styles.fileName} numberOfLines={1}>
                {file.name}
              </Text>
              <Text style={styles.fileSize}>{formatFileSize(file.size)}</Text>
            </View>
            <TouchableOpacity
              onPress={() => handleRemove(idx)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Icon name="close" size={20} color={Colors.error} />
            </TouchableOpacity>
          </TouchableOpacity>
        ))}

        {/* Add button */}
        <TouchableOpacity style={styles.addButton} onPress={handlePick} activeOpacity={0.7}>
          <Icon name="add" size={20} color={Colors.primary} />
          <Text style={styles.addText}>Add attachment</Text>
        </TouchableOpacity>
      </View>
      {AlertComponent}
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
    color: Colors.textPrimary,
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
