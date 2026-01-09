/**
 * Jubilee Inspire - App Navigator
 *
 * Main navigation structure with drawer and stack navigation.
 * Similar to ChatGPT mobile app layout.
 */

import React from 'react';
import { Platform } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createDrawerNavigator } from '@react-navigation/drawer';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootStackParamList, DrawerParamList } from '../types';
import { colors } from '../config';

// Screens
import ChatScreen from '../screens/ChatScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AuthScreen from '../screens/AuthScreen';

// Components
import { DrawerContent } from '../components';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Drawer = createDrawerNavigator<DrawerParamList>();

// Main stack navigator (inside drawer)
const MainStack: React.FC = () => {
  return (
    <Stack.Navigator
      initialRouteName="Chat"
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen
        name="Chat"
        component={ChatScreen}
        options={{
          headerShown: false,
        }}
      />
      <Stack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
      <Stack.Screen
        name="Auth"
        component={AuthScreen}
        options={{
          headerShown: false,
          presentation: 'modal',
        }}
      />
    </Stack.Navigator>
  );
};

// App navigator with drawer
const AppNavigator: React.FC = () => {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="HomeStack"
          drawerContent={props => <DrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerType: Platform.OS === 'ios' ? 'slide' : 'front',
            drawerStyle: {
              width: 300,
              backgroundColor: colors.surface,
            },
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            swipeEnabled: true,
            swipeEdgeWidth: 50,
          }}
        >
          <Drawer.Screen name="HomeStack" component={MainStack} />
        </Drawer.Navigator>
      </NavigationContainer>
    </GestureHandlerRootView>
  );
};

export default AppNavigator;
