/**
 * FormSection — Collapsible card section for organizing form fields.
 *
 * Displays a header with title + chevron. Tapping toggles content visibility.
 * Used in NewEventScreen to prevent visual overload on mobile.
 */
import React, { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, LayoutAnimation, Platform, UIManager } from 'react-native';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import { Colors } from '../../constants/colors';
import { Typography } from '../../constants/typography';
import { Spacing, BorderRadius } from '../../constants/spacing';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface FormSectionProps {
  title: string;
  icon?: keyof typeof Icon.glyphMap;
  initiallyExpanded?: boolean;
  collapsible?: boolean;
  children: React.ReactNode;
}

export const FormSection: React.FC<FormSectionProps> = ({
  title,
  icon,
  initiallyExpanded = false,
  collapsible = true,
  children,
}) => {
  const [expanded, setExpanded] = useState(initiallyExpanded);

  const toggle = useCallback(() => {
    if (!collapsible) return;
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setExpanded((prev) => !prev);
  }, [collapsible]);

  const isVisible = !collapsible || expanded;

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={styles.header}
        onPress={toggle}
        activeOpacity={collapsible ? 0.7 : 1}
        disabled={!collapsible}
      >
        <View style={styles.headerLeft}>
          {icon && (
            <Icon
              name={icon}
              size={20}
              color={Colors.textSecondary}
              style={styles.headerIcon}
            />
          )}
          <Text style={styles.headerTitle}>{title}</Text>
        </View>
        {collapsible && (
          <Icon
            name={expanded ? 'expand-less' : 'expand-more'}
            size={24}
            color={Colors.textTertiary}
          />
        )}
      </TouchableOpacity>
      {isVisible && <View style={styles.content}>{children}</View>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    minHeight: 48,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  headerIcon: {
    marginRight: Spacing.sm,
  },
  headerTitle: {
    ...Typography.label,
    color: Colors.textPrimary,
  },
  content: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.lg,
  },
});
