/**
 * EventDetailScreen — Displays full details for a single calendar event.
 *
 * Shows subject, date/time range, location, description, attendees,
 * showAs status, recurrence, private badge, color category, timezone,
 * and attachments. A colour strip at the top reflects the event colour.
 * The header contains Edit and Delete actions.
 */
import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import type { RouteProp } from '@react-navigation/native';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';
import { LoadingSpinner, Avatar, EmptyState, AttachmentPreviewModal, RecurrenceActionDialog } from '../../components/common';
import type { PreviewAttachment, RecurrenceAction } from '../../components/common';
import { useAlert } from '../../hooks';
import { calendarService } from '../../services/calendar/calendarService';
import { reminderService } from '../../services/calendar/reminderService';
import {
  formatRecurrenceDescription,
  formatReminderLabel,
  getEventColor,
  SHOW_AS_OPTIONS,
  CATEGORY_OPTIONS,
} from '../../utils/calendarUtils';
import type { CalendarEvent } from '../../types/calendar';
import type { CalendarStackParamList } from '../../types/navigation';

type Nav = NativeStackNavigationProp<CalendarStackParamList, 'EventDetail'>;
type Route = RouteProp<CalendarStackParamList, 'EventDetail'>;

// ────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDateOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ────────────────────────────────────────────────────────────
// Component
// ────────────────────────────────────────────────────────────

const EventDetailScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const route = useRoute<Route>();
  const { alert, confirm, AlertComponent } = useAlert();
  const { eventId, event: routeEvent } = route.params;

  const [event, setEvent] = useState<CalendarEvent | null>(routeEvent || null);
  const [isLoading, setIsLoading] = useState(!routeEvent);
  const [error, setError] = useState<string | null>(null);

  // ── Fetch event ───────────────────────────────────────────
  const fetchEvent = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await calendarService.getEvent(eventId);
      setEvent(data);
    } catch (err: any) {
      setError(err?.message || 'Failed to load event');
    } finally {
      setIsLoading(false);
    }
  }, [eventId]);

  // Silent refetch (no loading spinner) — used on focus return
  const refetchEvent = useCallback(async () => {
    try {
      const data = await calendarService.getEvent(eventId);
      setEvent(data);
    } catch {
      // Silent — keep existing data on failure
    }
  }, [eventId]);

  useEffect(() => {
    if (!routeEvent) {
      fetchEvent();
    }
  }, [routeEvent, fetchEvent]);

  // Re-fetch when screen regains focus (e.g., after editing)
  useEffect(() => {
    const unsubscribe = navigation.addListener('focus', () => {
      refetchEvent();
    });
    return unsubscribe;
  }, [navigation, refetchEvent]);

  // ── Actions ───────────────────────────────────────────────
  const handleEdit = useCallback(() => {
    if (event) {
      navigation.navigate('NewEvent', { event });
    }
  }, [event, navigation]);

  const [previewAttachment, setPreviewAttachment] = useState<PreviewAttachment | null>(null);
  const [showRecurrenceDialog, setShowRecurrenceDialog] = useState(false);

  /** Strip _occ_N suffix from expanded occurrence IDs (matches web getBaseEventId) */
  const getBaseEventId = useCallback((id: string) => id.replace(/_occ_\d+$/, ''), []);

  const executeDelete = useCallback(
    async (scope: 'series' | 'occurrence' = 'series') => {
      try {
        const baseId = getBaseEventId(eventId);
        await reminderService.cancelReminder(baseId);

        if (scope === 'occurrence' && event) {
          const occDate = new Date(event.startDateTime).toISOString().split('T')[0];
          await calendarService.deleteEvent(baseId, 'occurrence', occDate);
        } else {
          await calendarService.deleteEvent(baseId, 'series');
        }

        navigation.goBack();
      } catch (err: any) {
        alert('Error', err?.message || 'Failed to delete event', 'error');
      }
    },
    [eventId, event, navigation, alert, getBaseEventId],
  );

  const handleRecurrenceAction = useCallback(
    (action: RecurrenceAction) => {
      setShowRecurrenceDialog(false);
      if (action === 'cancel') return;

      const msg =
        action === 'series'
          ? 'Are you sure you want to delete all events in this series?'
          : 'Are you sure you want to delete this occurrence?';

      confirm('Delete Event', msg, () => executeDelete(action), {
        confirmText: 'Delete',
        destructive: true,
      });
    },
    [executeDelete, confirm],
  );

  const handleDelete = useCallback(() => {
    if (event?.isRecurring) {
      // Show "this occurrence or entire series?" dialog
      setShowRecurrenceDialog(true);
      return;
    }
    // Non-recurring: simple confirm
    confirm(
      'Delete Event',
      'Are you sure you want to delete this event?',
      async () => {
        await executeDelete('series');
      },
      { confirmText: 'Delete', destructive: true },
    );
  }, [event, confirm, executeDelete]);

  // ── Header buttons ────────────────────────────────────────
  useEffect(() => {
    navigation.setOptions({
      headerRight: () => (
        <View style={styles.headerActions}>
          <TouchableOpacity
            onPress={handleEdit}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="edit" size={22} color={Colors.primary} />
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleDelete}
            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            style={styles.headerButton}
          >
            <Icon name="delete" size={22} color={Colors.error} />
          </TouchableOpacity>
        </View>
      ),
    });
  }, [event, navigation, handleEdit, handleDelete]);

  // ── Render ────────────────────────────────────────────────
  if (isLoading) {
    return (
      <View style={styles.centered}>
        <LoadingSpinner />
      </View>
    );
  }

  if (error || !event) {
    return (
      <View style={styles.centered}>
        <EmptyState
          icon="error-outline"
          title="Event not found"
          subtitle={error || 'Unable to load event details'}
        />
      </View>
    );
  }

  const eventColor = getEventColor(event.eventColor || event.category);
  const showAsOption = SHOW_AS_OPTIONS.find((o) => o.value === event.showAs);
  const colorOption = CATEGORY_OPTIONS.find((o) => o.value === (event.eventColor || event.category));
  const recurrenceDesc = formatRecurrenceDescription(event);

  return (
    <>
      <ScrollView style={styles.container} contentContainerStyle={styles.content}>
        {/* Colour strip */}
        <View style={[styles.colorStrip, { backgroundColor: eventColor }]} />

        {/* Subject */}
        <Text style={styles.subject}>{event.isPrivate ? 'Private' : event.title}</Text>

        {/* Date / time */}
        <View style={styles.detailRow}>
          <Icon name="access-time" size={20} color={Colors.textSecondary} />
          <View style={styles.detailContent}>
            {event.isAllDay ? (
              <>
                <Text style={styles.detailPrimary}>All Day</Text>
                <Text style={styles.detailSecondary}>
                  {formatDateOnly(event.startDateTime)}
                </Text>
              </>
            ) : (
              <>
                <Text style={styles.detailPrimary}>
                  {formatDateTime(event.startDateTime)}
                </Text>
                <Text style={styles.detailSecondary}>
                  to {formatDateTime(event.endDateTime)}
                </Text>
              </>
            )}
          </View>
        </View>

        {/* Location */}
        {!!event.location && (
          <View style={styles.detailRow}>
            <Icon name="place" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>{event.location}</Text>
              {event.isInPerson && (
                <Text style={styles.detailSecondary}>In Person</Text>
              )}
            </View>
          </View>
        )}

        {/* ShowAs status */}
        {showAsOption && (
          <View style={styles.detailRow}>
            <Icon name="event-busy" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <View style={styles.showAsRow}>
                <View style={[styles.showAsDot, { backgroundColor: showAsOption.color }]} />
                <Text style={styles.detailPrimary}>{showAsOption.label}</Text>
              </View>
            </View>
          </View>
        )}

        {/* Recurrence */}
        {!!recurrenceDesc && (
          <View style={styles.detailRow}>
            <Icon name="repeat" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>{recurrenceDesc}</Text>
            </View>
          </View>
        )}

        {/* Private */}
        {event.isPrivate && (
          <View style={styles.detailRow}>
            <Icon name="lock" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>Private event</Text>
            </View>
          </View>
        )}

        {/* Event Color / Category */}
        {colorOption && (
          <View style={styles.detailRow}>
            <View style={[styles.colorCircle, { backgroundColor: colorOption.color }]} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>{colorOption.label}</Text>
            </View>
          </View>
        )}

        {/* Description */}
        {!!event.description && (
          <View style={styles.detailRow}>
            <Icon name="notes" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>{event.description}</Text>
            </View>
          </View>
        )}

        {/* Reminder */}
        {event.reminderMinutes > 0 && (
          <View style={styles.detailRow}>
            <Icon name="notifications" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>
                {formatReminderLabel(event.reminderMinutes)}
              </Text>
            </View>
          </View>
        )}

        {/* Timezone */}
        {!!event.timezone && (
          <View style={styles.detailRow}>
            <Icon name="public" size={20} color={Colors.textSecondary} />
            <View style={styles.detailContent}>
              <Text style={styles.detailPrimary}>{event.timezone}</Text>
            </View>
          </View>
        )}

        {/* Attendees */}
        {event.attendees && event.attendees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attendees</Text>
            {event.attendees.map((attendee, idx) => (
              <View key={`attendee-${idx}`} style={styles.attendeeRow}>
                <Avatar name={attendee} size={36} />
                <View style={styles.attendeeInfo}>
                  <Text style={styles.attendeeName}>{attendee}</Text>
                </View>
              </View>
            ))}
          </View>
        )}

        {/* Attachments */}
        {event.attachments && event.attachments.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Attachments</Text>
            {event.attachments.map((att, idx) => (
              <TouchableOpacity
                key={`att-${idx}`}
                style={styles.attachmentRow}
                onPress={() =>
                  setPreviewAttachment({
                    fileName: att.fileName,
                    fileUrl: att.fileUrl,
                    fileSize: att.fileSize,
                  })
                }
                activeOpacity={0.7}
              >
                <Icon name="attach-file" size={20} color={Colors.textSecondary} />
                <View style={styles.attachmentInfo}>
                  <Text style={styles.attachmentName} numberOfLines={1}>
                    {att.fileName}
                  </Text>
                  <Text style={styles.attachmentSize}>
                    {formatFileSize(att.fileSize)}
                  </Text>
                </View>
                <Icon name="visibility" size={18} color={Colors.primary} />
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {AlertComponent}

      {/* Attachment preview modal */}
      <AttachmentPreviewModal
        attachment={previewAttachment}
        onClose={() => setPreviewAttachment(null)}
      />

      {/* Recurring event delete dialog */}
      <RecurrenceActionDialog
        visible={showRecurrenceDialog}
        mode="delete"
        onAction={handleRecurrenceAction}
      />
    </>
  );
};

// ────────────────────────────────────────────────────────────
// Styles
// ────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    paddingBottom: Spacing.xxxxl,
  },
  centered: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Header actions
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerButton: {
    marginLeft: Spacing.lg,
  },

  // Colour strip
  colorStrip: {
    height: 6,
    width: '100%',
  },

  // Subject
  subject: {
    ...Typography.h2,
    color: Colors.textPrimary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },

  // Detail rows
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  detailContent: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  detailPrimary: {
    ...Typography.body,
    color: Colors.textPrimary,
  },
  detailSecondary: {
    ...Typography.bodySmall,
    color: Colors.textSecondary,
    marginTop: 2,
  },

  // ShowAs
  showAsRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  showAsDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: Spacing.sm,
  },

  // Color circle
  colorCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },

  // Sections
  section: {
    marginTop: Spacing.xl,
    paddingHorizontal: Spacing.lg,
  },
  sectionTitle: {
    ...Typography.label,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  // Attendees
  attendeeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
  },
  attendeeInfo: {
    flex: 1,
    marginLeft: Spacing.md,
  },
  attendeeName: {
    ...Typography.body,
    color: Colors.textPrimary,
  },

  // Attachments
  attachmentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.divider,
    gap: Spacing.sm,
  },
  attachmentInfo: {
    flex: 1,
  },
  attachmentName: {
    ...Typography.body,
    color: Colors.primary,
    textDecorationLine: 'underline',
  },
  attachmentSize: {
    ...Typography.caption,
    color: Colors.textTertiary,
  },
});

export default EventDetailScreen;
