/**
 * RecurrenceActionDialog — Modal asking "this occurrence or entire series?"
 *
 * Mirrors web frontend's RecurrenceEditDialog component.
 * Used for both edit and delete actions on recurring events.
 */
import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

export type RecurrenceAction = 'series' | 'occurrence' | 'cancel';

interface RecurrenceActionDialogProps {
  visible: boolean;
  mode: 'edit' | 'delete';
  onAction: (action: RecurrenceAction) => void;
}

export const RecurrenceActionDialog: React.FC<RecurrenceActionDialogProps> = ({
  visible,
  mode,
  onAction,
}) => {
  if (!visible) return null;

  const isDelete = mode === 'delete';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => onAction('cancel')}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={() => onAction('cancel')}
      >
        <View style={styles.dialog} onStartShouldSetResponder={() => true}>
          {/* Icon */}
          <View style={styles.iconContainer}>
            <Icon
              name={isDelete ? 'delete' : 'edit'}
              size={32}
              color={isDelete ? Colors.error : Colors.primary}
            />
          </View>

          {/* Title */}
          <Text style={styles.title}>This is a recurring event</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {isDelete
              ? 'Would you like to delete just this occurrence or the entire series?'
              : 'Would you like to edit just this occurrence or the entire series?'}
          </Text>

          {/* Action buttons */}
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.secondaryButton}
              onPress={() => onAction('occurrence')}
              activeOpacity={0.8}
            >
              <Text style={styles.secondaryButtonText}>This event</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.primaryButton,
                isDelete && styles.primaryButtonDestructive,
              ]}
              onPress={() => onAction('series')}
              activeOpacity={0.8}
            >
              <Text style={styles.primaryButtonText}>All events in series</Text>
            </TouchableOpacity>
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.cancelButton}
            onPress={() => onAction('cancel')}
            activeOpacity={0.7}
          >
            <Text style={styles.cancelButtonText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: Colors.overlay,
    justifyContent: 'center',
    alignItems: 'center',
    padding: Spacing.xl,
  },
  dialog: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 380,
    padding: Spacing.xl,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  title: {
    ...Typography.h3,
    color: Colors.textPrimary,
    textAlign: 'center',
    marginBottom: Spacing.sm,
  },
  subtitle: {
    ...Typography.body,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  actions: {
    width: '100%',
    gap: Spacing.md,
  },
  secondaryButton: {
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  secondaryButtonText: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
  primaryButton: {
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonDestructive: {
    backgroundColor: Colors.error,
  },
  primaryButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
  cancelButton: {
    marginTop: Spacing.lg,
    paddingVertical: Spacing.sm,
  },
  cancelButtonText: {
    ...Typography.body,
    color: Colors.textTertiary,
  },
});
