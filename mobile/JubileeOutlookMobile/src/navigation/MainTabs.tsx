/**
 * MainTabs — Bottom tab navigator for authenticated users.
 *
 * Contains four tabs: Mail, Calendar, People, and Settings.
 * Each tab wraps its own stack navigator so that in-tab navigation
 * (e.g. opening a message detail) keeps the tab bar visible.
 */
import React from 'react';
import { Platform, StyleSheet } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { MaterialIcons as Icon } from '@expo/vector-icons';

import type { MainTabParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import MailStack from './MailStack';
import CalendarStack from './CalendarStack';
import PeopleStack from './PeopleStack';
import SettingsStack from './SettingsStack';

const Tab = createBottomTabNavigator<MainTabParamList>();

/** Icon size for all tab bar icons. */
const TAB_ICON_SIZE = 24;

/** Height of the bottom tab bar. */
const TAB_BAR_HEIGHT = 60;

/**
 * Maps each tab route name to its MaterialIcons icon name.
 */
const TAB_ICONS: Record<keyof MainTabParamList, string> = {
  MailTab: 'mail',
  CalendarTab: 'calendar-today',
  PeopleTab: 'people',
  SettingsTab: 'settings',
};

/**
 * Maps each tab route name to its display label.
 */
const TAB_LABELS: Record<keyof MainTabParamList, string> = {
  MailTab: 'Mail',
  CalendarTab: 'Calendar',
  PeopleTab: 'People',
  SettingsTab: 'Settings',
};

/**
 * MainTabs renders the bottom tab navigator with four tabs.
 * The tab bar uses a dark surface background with gold active tint
 * and gray inactive tint.
 */
const MainTabs: React.FC = () => {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarIcon: ({ color, size }) => (
          <Icon
            name={TAB_ICONS[route.name] as any}
            size={size || TAB_ICON_SIZE}
            color={color}
          />
        ),
        tabBarLabel: TAB_LABELS[route.name],
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: '#808080',
        tabBarStyle: styles.tabBar,
        tabBarLabelStyle: styles.tabBarLabel,
      })}
    >
      <Tab.Screen name="MailTab" component={MailStack} />
      <Tab.Screen name="CalendarTab" component={CalendarStack} />
      <Tab.Screen name="PeopleTab" component={PeopleStack} />
      <Tab.Screen name="SettingsTab" component={SettingsStack} />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    height: TAB_BAR_HEIGHT,
    paddingBottom: Platform.OS === 'ios' ? 8 : 4,
    paddingTop: 4,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
});

export default MainTabs;
