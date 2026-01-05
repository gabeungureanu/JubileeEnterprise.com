import { create } from 'zustand';
import { CompileResult, TestResult } from '../types/workflow.types';

interface WorkflowState {
  reviewQueue: string[];

  isCompiling: boolean;
  lastCompileResult: CompileResult | null;

  testResults: Map<string, TestResult>;
  isRunningTests: boolean;

  addToReviewQueue: (ids: string[]) => void;
  removeFromReviewQueue: (id: string) => void;
  clearReviewQueue: () => void;

  setCompiling: (compiling: boolean) => void;
  setCompileResult: (result: CompileResult) => void;

  addTestResult: (id: string, result: TestResult) => void;
  clearTestResults: () => void;
  setRunningTests: (running: boolean) => void;
}

export const useWorkflowStore = create<WorkflowState>((set) => ({
  reviewQueue: [],
  isCompiling: false,
  lastCompileResult: null,
  testResults: new Map(),
  isRunningTests: false,

  addToReviewQueue: (ids) => set((state) => ({
    reviewQueue: [...new Set([...state.reviewQueue, ...ids])]
  })),

  removeFromReviewQueue: (id) => set((state) => ({
    reviewQueue: state.reviewQueue.filter(i => i !== id)
  })),

  clearReviewQueue: () => set({ reviewQueue: [] }),

  setCompiling: (compiling) => set({ isCompiling: compiling }),
  setCompileResult: (result) => set({ lastCompileResult: result }),

  addTestResult: (id, result) => set((state) => {
    const newResults = new Map(state.testResults);
    newResults.set(id, result);
    return { testResults: newResults };
  }),

  clearTestResults: () => set({ testResults: new Map() }),
  setRunningTests: (running) => set({ isRunningTests: running })
}));
