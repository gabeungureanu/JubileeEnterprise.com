/**
 * MainTabs — Bottom tab navigator for authenticated users.
 *
 * Contains three visible tabs: Mail, Calendar, and People.
 * Settings is registered but hidden from the tab bar (accessible via sidebar gear icon).
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
 * MainTabs renders the bottom tab navigator with three visible tabs.
 * The tab bar uses a dark surface background with gold active tint
 * and gray inactive tint. Settings is hidden but navigable from sidebar.
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
        tabBarItemStyle: styles.tabBarItem,
      })}
    >
      <Tab.Screen name="MailTab" component={MailStack} />
      <Tab.Screen name="CalendarTab" component={CalendarStack} />
      <Tab.Screen name="PeopleTab" component={PeopleStack} />
      <Tab.Screen
        name="SettingsTab"
        component={SettingsStack}
        options={{ tabBarButton: () => null, tabBarItemStyle: { display: 'none' } }}
      />
    </Tab.Navigator>
  );
};

const styles = StyleSheet.create({
  tabBar: {
    backgroundColor: Colors.surface,
    borderTopColor: Colors.border,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 4,
    paddingBottom: Platform.OS === 'web' ? 8 : undefined,
  },
  tabBarLabel: {
    fontSize: 11,
    fontWeight: '600',
  },
  tabBarItem: {
    flex: 1,
  },
});

export default MainTabs;
