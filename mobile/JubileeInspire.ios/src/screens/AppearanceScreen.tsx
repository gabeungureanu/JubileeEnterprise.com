/**
 * Jubilee Inspire - Appearance Screen
 *
 * Theme selection screen for choosing between System, Light, and Dark modes.
 */

import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamList } from '../types';
import { spacing, typography } from '../config';
import { useTheme } from '../contexts/ThemeContext';
import { ThemeMode } from '../config/theme';

type Props = NativeStackScreenProps<RootStackParamList, 'Appearance'>;

interface ThemeOption {
  mode: ThemeMode;
  title: string;
  description: string;
  icon: keyof typeof Ionicons.glyphMap;
}

const themeOptions: ThemeOption[] = [
  {
    mode: 'system',
    title: 'System',
    description: 'Automatically switch between light and dark themes based on your device settings',
    icon: 'phone-portrait-outline',
  },
  {
    mode: 'dark',
    title: 'Dark',
    description: 'Use dark theme across the entire application',
    icon: 'moon-outline',
  },
  {
    mode: 'light',
    title: 'Light',
    description: 'Use light theme across the entire application',
    icon: 'sunny-outline',
  },
];

const AppearanceScreen: React.FC<Props> = ({ navigation }) => {
  const { themeMode, colors, setThemeMode } = useTheme();

  const handleThemeSelect = async (mode: ThemeMode) => {
    await setThemeMode(mode);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.surface }]}>
      <View style={[styles.header, { backgroundColor: colors.background, borderBottomColor: colors.border }]}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Ionicons name="chevron-back" size={28} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>Appearance</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView style={styles.content}>
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
            Theme
          </Text>
          <View style={[styles.sectionContent, { backgroundColor: colors.background, borderColor: colors.border }]}>
            {themeOptions.map((option, index) => (
              <TouchableOpacity
                key={option.mode}
                style={[
                  styles.themeOption,
                  { borderBottomColor: colors.border },
                  index === themeOptions.length - 1 && styles.lastOption,
                ]}
                onPress={() => handleThemeSelect(option.mode)}
                activeOpacity={0.7}
              >
                <View style={[styles.iconContainer, { backgroundColor: `${colors.primary}15` }]}>
                  <Ionicons
                    name={option.icon}
                    size={22}
                    color={colors.primary}
                  />
                </View>
                <View style={styles.themeInfo}>
                  <Text style={[styles.themeTitle, { color: colors.text }]}>
                    {option.title}
                  </Text>
                  <Text style={[styles.themeDescription, { color: colors.textSecondary }]}>
                    {option.description}
                  </Text>
                </View>
                {themeMode === option.mode && (
                  <Ionicons name="checkmark-circle" size={24} color={colors.primary} />
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.infoSection}>
          <View style={[styles.infoBox, { backgroundColor: colors.background, borderColor: colors.border }]}>
            <Ionicons name="information-circle-outline" size={20} color={colors.primary} />
            <Text style={[styles.infoText, { color: colors.textSecondary }]}>
              Theme changes apply immediately and will be remembered across sessions.
            </Text>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: spacing.xs,
  },
  headerTitle: {
    flex: 1,
    fontSize: 17,
    fontWeight: '600',
    textAlign: 'center',
  },
  placeholder: {
    width: 36,
  },
  content: {
    flex: 1,
  },
  section: {
    marginTop: spacing.lg,
  },
  sectionTitle: {
    fontSize: typography.fontSize.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    paddingHorizontal: spacing.lg,
    marginBottom: spacing.sm,
  },
  sectionContent: {
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  themeOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: spacing.md,
  },
  themeInfo: {
    flex: 1,
    marginRight: spacing.sm,
  },
  themeTitle: {
    fontSize: typography.fontSize.base,
    fontWeight: '500',
    marginBottom: 4,
  },
  themeDescription: {
    fontSize: typography.fontSize.sm,
    lineHeight: 18,
  },
  infoSection: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.xl,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: spacing.md,
    borderRadius: 12,
    borderWidth: 1,
  },
  infoText: {
    flex: 1,
    fontSize: typography.fontSize.sm,
    lineHeight: 20,
    marginLeft: spacing.sm,
  },
});

export default AppearanceScreen;
