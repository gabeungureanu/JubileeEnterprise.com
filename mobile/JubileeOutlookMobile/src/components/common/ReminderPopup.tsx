/**
 * ReminderPopup — In-app modal popup when a calendar reminder fires.
 *
 * Displays event title, time, location. Provides Dismiss and Snooze actions.
 * Snooze opens a list of duration options. Styled to match Outlook's
 * reminder overlay with the app's dark theme.
 */
import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  StyleSheet,
  ScrollView,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { SNOOZE_OPTIONS } from '../../services/calendar/reminderService';
import type { ActiveReminder } from '../../context/ReminderContext';

interface ReminderPopupProps {
  reminder: ActiveReminder | null;
  onDismiss: () => void;
  onSnooze: (minutes: number) => void;
  onOpen?: () => void;
}

function formatReminderTime(iso: string, isAllDay?: boolean): string {
  if (!iso) return '';
  if (isAllDay) return 'All Day';
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function getTimeUntilEvent(iso: string): string {
  if (!iso) return '';
  const diff = new Date(iso).getTime() - Date.now();
  if (diff <= 0) return 'Starting now';
  const minutes = Math.floor(diff / 60000);
  if (minutes < 60) return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
  const days = Math.floor(hours / 24);
  return `in ${days} day${days !== 1 ? 's' : ''}`;
}

export const ReminderPopup: React.FC<ReminderPopupProps> = ({
  reminder,
  onDismiss,
  onSnooze,
  onOpen,
}) => {
  const [showSnoozeOptions, setShowSnoozeOptions] = useState(false);

  if (!reminder) return null;

  const timeUntil = getTimeUntilEvent(reminder.eventStart);

  return (
    <Modal
      visible={!!reminder}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.overlay}>
        <View style={styles.popup}>
          {/* Header */}
          <View style={styles.header}>
            <View style={styles.headerIcon}>
              <Icon name="notifications-active" size={24} color={Colors.primary} />
            </View>
            <Text style={styles.headerTitle}>Reminder</Text>
            <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
              <Icon name="close" size={22} color={Colors.textTertiary} />
            </TouchableOpacity>
          </View>

          {/* Event info */}
          <View style={styles.eventInfo}>
            <Text style={styles.eventTitle} numberOfLines={2}>
              {reminder.eventTitle}
            </Text>

            {!!reminder.eventStart && (
              <View style={styles.eventRow}>
                <Icon name="schedule" size={16} color={Colors.textSecondary} />
                <Text style={styles.eventDetail}>
                  {formatReminderTime(reminder.eventStart, reminder.isAllDay)}
                </Text>
              </View>
            )}

            {!!timeUntil && (
              <View style={styles.eventRow}>
                <Icon name="hourglass-top" size={16} color={Colors.primary} />
                <Text style={[styles.eventDetail, styles.timeUntil]}>
                  {timeUntil}
                </Text>
              </View>
            )}

            {!!reminder.eventLocation && (
              <View style={styles.eventRow}>
                <Icon name="location-on" size={16} color={Colors.textSecondary} />
                <Text style={styles.eventDetail} numberOfLines={1}>
                  {reminder.eventLocation}
                </Text>
              </View>
            )}
          </View>

          {/* Snooze options (expanded) */}
          {showSnoozeOptions && (
            <ScrollView style={styles.snoozeList} bounces={false}>
              <Text style={styles.snoozeListTitle}>Snooze for...</Text>
              {SNOOZE_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt.minutes}
                  style={styles.snoozeOption}
                  onPress={() => {
                    setShowSnoozeOptions(false);
                    onSnooze(opt.minutes);
                  }}
                  activeOpacity={0.7}
                >
                  <Icon name="snooze" size={18} color={Colors.textSecondary} />
                  <Text style={styles.snoozeOptionText}>{opt.label}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}

          {/* Action buttons */}
          <View style={styles.actions}>
            {onOpen && (
              <TouchableOpacity
                style={styles.openButton}
                onPress={onOpen}
                activeOpacity={0.8}
              >
                <Icon name="open-in-new" size={18} color={Colors.primary} />
                <Text style={styles.openButtonText}>Open Event</Text>
              </TouchableOpacity>
            )}

            <View style={styles.actionRow}>
              <TouchableOpacity
                style={styles.dismissButton}
                onPress={onDismiss}
                activeOpacity={0.8}
              >
                <Text style={styles.dismissButtonText}>Dismiss</Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.snoozeButton}
                onPress={() => setShowSnoozeOptions(!showSnoozeOptions)}
                activeOpacity={0.8}
              >
                <Icon name="snooze" size={18} color={Colors.textInverse} />
                <Text style={styles.snoozeButtonText}>
                  {showSnoozeOptions ? 'Cancel' : 'Snooze'}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </View>
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
  popup: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.xl,
    width: '100%',
    maxWidth: 380,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  headerIcon: {
    marginRight: Spacing.sm,
  },
  headerTitle: {
    ...Typography.h3,
    color: Colors.textPrimary,
    flex: 1,
  },
  closeButton: {
    padding: Spacing.xs,
  },

  // Event info
  eventInfo: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.lg,
  },
  eventTitle: {
    ...Typography.h2,
    color: Colors.textPrimary,
    marginBottom: Spacing.md,
  },
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  eventDetail: {
    ...Typography.body,
    color: Colors.textSecondary,
    marginLeft: Spacing.sm,
    flex: 1,
  },
  timeUntil: {
    color: Colors.primary,
    fontWeight: '600',
  },

  // Snooze list
  snoozeList: {
    maxHeight: 220,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  snoozeListTitle: {
    ...Typography.label,
    color: Colors.textTertiary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xs,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  snoozeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  snoozeOptionText: {
    ...Typography.body,
    color: Colors.textPrimary,
    marginLeft: Spacing.md,
  },

  // Actions
  actions: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.divider,
  },
  openButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  openButtonText: {
    ...Typography.button,
    color: Colors.primary,
    marginLeft: Spacing.xs,
  },
  actionRow: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  dismissButton: {
    flex: 1,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  dismissButtonText: {
    ...Typography.button,
    color: Colors.textSecondary,
  },
  snoozeButton: {
    flex: 1,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
  },
  snoozeButtonText: {
    ...Typography.button,
    color: Colors.textInverse,
  },
});
