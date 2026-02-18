/**
 * JubileeOutlook Mobile — Root Application Component
 * Mirrors web frontend App.tsx structure:
 * ThemeProvider → AuthProvider → AppProvider → ToastProvider → Navigation
 */
import React, { useEffect, useState } from 'react';
import { StatusBar, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { NavigationContainer, DefaultTheme } from '@react-navigation/native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import { ToastProvider } from './src/context/ToastContext';
import { RootNavigator } from './src/navigation';
import { tokenStore } from './src/services/apiClient';
import { Colors } from './src/constants/colors';
import { LoadingSpinner } from './src/components/common';

const DarkNavigationTheme = {
  ...DefaultTheme,
  dark: true,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.textPrimary,
    border: Colors.border,
    notification: Colors.accent,
  },
};

export default function App() {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    async function initialize() {
      // Load cached tokens from storage before rendering
      await tokenStore.init();
      setIsReady(true);
    }
    initialize();
  }, []);

  if (!isReady) {
    return (
      <View style={styles.loading}>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} />
        <LoadingSpinner fullScreen message="Loading..." />
      </View>
    );
  }

  return (
    <GestureHandlerRootView style={styles.root}>
      <SafeAreaProvider>
        <StatusBar barStyle="light-content" backgroundColor={Colors.background} translucent />
        <NavigationContainer theme={DarkNavigationTheme}>
          <AuthProvider>
            <AppProvider>
              <ToastProvider>
                <RootNavigator />
              </ToastProvider>
            </AppProvider>
          </AuthProvider>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loading: {
    flex: 1,
    backgroundColor: Colors.background,
  },
});
