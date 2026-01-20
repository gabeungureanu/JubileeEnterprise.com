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
import { useTheme } from '../contexts/ThemeContext';
import { useDrawer } from '../contexts/DrawerContext';

// Screens
import ChatScreen from '../screens/ChatScreen';
import ImagesScreen from '../screens/ImagesScreen';
import SettingsScreen from '../screens/SettingsScreen';
import AppearanceScreen from '../screens/AppearanceScreen';
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
        name="Images"
        component={ImagesScreen}
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
        name="Appearance"
        component={AppearanceScreen}
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
  const { colors } = useTheme();
  const { isCollapsed, isMobileView } = useDrawer();

  // Drawer width: 56px when collapsed, 300px when expanded (desktop only)
  // On mobile view, always use 300px width for the sliding drawer
  const drawerWidth = isMobileView ? 300 : (isCollapsed ? 56 : 300);

  // Determine drawer type based on platform and screen size
  const getDrawerType = () => {
    if (Platform.OS === 'web') {
      // On web: permanent for desktop, front for mobile view
      return isMobileView ? 'front' : 'permanent';
    }
    // On native: slide for iOS, front for Android
    return Platform.OS === 'ios' ? 'slide' : 'front';
  };

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <NavigationContainer>
        <Drawer.Navigator
          initialRouteName="HomeStack"
          drawerContent={props => <DrawerContent {...props} />}
          screenOptions={{
            headerShown: false,
            drawerType: getDrawerType(),
            drawerStyle: {
              width: drawerWidth,
              backgroundColor: '#000000',
              borderRightWidth: 1,
              borderRightColor: '#3f3f3f',
            },
            overlayColor: 'rgba(0, 0, 0, 0.5)',
            swipeEnabled: isMobileView || Platform.OS !== 'web',
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
