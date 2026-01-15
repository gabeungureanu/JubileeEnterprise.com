/**
 * Jubilee Inspire - Drawer Context
 *
 * Global drawer state management for sidebar collapse functionality
 * and responsive behavior for mobile/desktop views.
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Dimensions, Platform } from 'react-native';

const MOBILE_BREAKPOINT = 768;

interface DrawerContextType {
  isCollapsed: boolean;
  setIsCollapsed: (collapsed: boolean) => void;
  toggleCollapse: () => void;
  isMobileView: boolean;
  isDrawerOpen: boolean;
  setIsDrawerOpen: (open: boolean) => void;
  toggleDrawer: () => void;
}

const DrawerContext = createContext<DrawerContextType | undefined>(undefined);

interface DrawerProviderProps {
  children: ReactNode;
}

export const DrawerProvider: React.FC<DrawerProviderProps> = ({ children }) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() => {
    if (Platform.OS === 'web') {
      return typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false;
    }
    return Dimensions.get('window').width < MOBILE_BREAKPOINT;
  });

  // Listen for screen size changes (web only)
  useEffect(() => {
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      const handleResize = () => {
        const newIsMobile = window.innerWidth < MOBILE_BREAKPOINT;
        setIsMobileView(newIsMobile);
        // Close drawer when switching to desktop view
        if (!newIsMobile) {
          setIsDrawerOpen(false);
        }
      };

      window.addEventListener('resize', handleResize);
      return () => window.removeEventListener('resize', handleResize);
    }
  }, []);

  // Listen for dimension changes (React Native)
  useEffect(() => {
    if (Platform.OS !== 'web') {
      const subscription = Dimensions.addEventListener('change', ({ window }) => {
        const newIsMobile = window.width < MOBILE_BREAKPOINT;
        setIsMobileView(newIsMobile);
        if (!newIsMobile) {
          setIsDrawerOpen(false);
        }
      });

      return () => subscription?.remove();
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => !prev);
  };

  const toggleDrawer = () => {
    setIsDrawerOpen(prev => !prev);
  };

  const value: DrawerContextType = {
    isCollapsed,
    setIsCollapsed,
    toggleCollapse,
    isMobileView,
    isDrawerOpen,
    setIsDrawerOpen,
    toggleDrawer,
  };

  return <DrawerContext.Provider value={value}>{children}</DrawerContext.Provider>;
};

export const useDrawer = (): DrawerContextType => {
  const context = useContext(DrawerContext);
  if (context === undefined) {
    throw new Error('useDrawer must be used within a DrawerProvider');
  }
  return context;
};
