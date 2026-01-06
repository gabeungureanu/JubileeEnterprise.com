import { create } from 'zustand';

interface UIState {
  sidebarOpen: boolean;
  editPanelOpen: boolean;
  activeTab: 'entries' | 'review' | 'compile';

  toggleSidebar: () => void;
  openEditPanel: () => void;
  closeEditPanel: () => void;
  setActiveTab: (tab: 'entries' | 'review' | 'compile') => void;
}

export const useUIStore = create<UIState>((set) => ({
  sidebarOpen: true,
  editPanelOpen: false,
  activeTab: 'entries',

  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  openEditPanel: () => set({ editPanelOpen: true }),
  closeEditPanel: () => set({ editPanelOpen: false }),
  setActiveTab: (tab) => set({ activeTab: tab })
}));
