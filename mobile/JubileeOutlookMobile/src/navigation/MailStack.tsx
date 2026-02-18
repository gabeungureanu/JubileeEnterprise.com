/**
 * MailStack — Stack navigator for the Mail module.
 *
 * Contains screens for the inbox, message detail, compose, folder
 * messages, and search. The Compose screen opens as a modal overlay.
 */
import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import type { MailStackParamList } from '../types/navigation';
import { Colors } from '../constants/colors';
import MailScreen from '../screens/mail/MailScreen';
import MessageDetailScreen from '../screens/mail/MessageDetailScreen';
import ComposeScreen from '../screens/mail/ComposeScreen';
import FolderMessagesScreen from '../screens/mail/FolderMessagesScreen';
import SearchScreen from '../screens/mail/SearchScreen';

const Stack = createNativeStackNavigator<MailStackParamList>();

/**
 * Shared dark header options used across all mail screens.
 */
const darkScreenOptions = {
  headerStyle: { backgroundColor: Colors.surface },
  headerTintColor: Colors.primary,
  headerTitleStyle: { color: Colors.textPrimary },
  contentStyle: { backgroundColor: Colors.background },
} as const;

/**
 * MailStack renders the mail navigation flow with dark headers,
 * gold tint, and white title text.
 */
const MailStack: React.FC = () => {
  return (
    <Stack.Navigator screenOptions={darkScreenOptions}>
      <Stack.Screen
        name="MailInbox"
        component={MailScreen}
        options={{ title: 'Inbox' }}
      />
      <Stack.Screen
        name="MessageDetail"
        component={MessageDetailScreen}
        options={{ title: 'Message' }}
      />
      <Stack.Screen
        name="Compose"
        component={ComposeScreen}
        options={{
          title: 'New Message',
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      <Stack.Screen
        name="FolderMessages"
        component={FolderMessagesScreen}
        options={({ route }) => ({
          title: route.params.folderName,
        })}
      />
      <Stack.Screen
        name="Search"
        component={SearchScreen}
        options={{
          title: 'Search',
          animation: 'fade',
        }}
      />
    </Stack.Navigator>
  );
};

export default MailStack;
