import { create } from 'zustand';
import { ContentEntry } from '../types/entry.types';

interface SelectionState {
  selectedDomain: string | null;
  selectedPath: string | null;
  expandedNodes: Set<string>;

  selectedEntry: ContentEntry | null;
  selectedEntries: string[];

  selectDomain: (domain: string) => void;
  selectPath: (path: string) => void;
  toggleNode: (nodeId: string) => void;
  expandNode: (nodeId: string) => void;
  collapseNode: (nodeId: string) => void;

  selectEntry: (entry: ContentEntry | null) => void;
  toggleEntrySelection: (id: string) => void;
  selectAllEntries: (ids: string[]) => void;
  clearEntrySelection: () => void;
}

export const useSelectionStore = create<SelectionState>((set) => ({
  selectedDomain: null,
  selectedPath: null,
  expandedNodes: new Set(),
  selectedEntry: null,
  selectedEntries: [],

  selectDomain: (domain) => set({
    selectedDomain: domain,
    selectedPath: domain
  }),

  selectPath: (path) => set({ selectedPath: path }),

  toggleNode: (nodeId) => set((state) => {
    const newExpanded = new Set(state.expandedNodes);
    if (newExpanded.has(nodeId)) {
      newExpanded.delete(nodeId);
    } else {
      newExpanded.add(nodeId);
    }
    return { expandedNodes: newExpanded };
  }),

  expandNode: (nodeId) => set((state) => {
    const newExpanded = new Set(state.expandedNodes);
    newExpanded.add(nodeId);
    return { expandedNodes: newExpanded };
  }),

  collapseNode: (nodeId) => set((state) => {
    const newExpanded = new Set(state.expandedNodes);
    newExpanded.delete(nodeId);
    return { expandedNodes: newExpanded };
  }),

  selectEntry: (entry) => set({ selectedEntry: entry }),

  toggleEntrySelection: (id) => set((state) => {
    const index = state.selectedEntries.indexOf(id);
    if (index === -1) {
      return { selectedEntries: [...state.selectedEntries, id] };
    } else {
      return { selectedEntries: state.selectedEntries.filter(e => e !== id) };
    }
  }),

  selectAllEntries: (ids) => set({ selectedEntries: ids }),
  clearEntrySelection: () => set({ selectedEntries: [] })
}));
