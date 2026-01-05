import { apiClient } from './client';
import { CompileResult, TestResult } from '../types/workflow.types';

export const compileApi = {
  // Compile approved entries to Qdrant
  compile: async (options?: { dryRun?: boolean; verbose?: boolean }): Promise<CompileResult> => {
    const response = await apiClient.post('/compile/submit', options || {});
    return response.data;
  },

  // Preview what would be compiled
  previewCompile: async (): Promise<{
    wouldProcess: number;
    wouldCreate: number;
    wouldUpdateMetadata: number;
    wouldReEmbed: number;
    wouldSoftDelete: number;
    unchanged: number;
    errors: string[];
  }> => {
    const response = await apiClient.post('/compile/preview');
    return response.data;
  },

  // Compile specific entries
  compileEntries: async (overlayIds: string[], options?: { dryRun?: boolean }): Promise<CompileResult> => {
    const response = await apiClient.post('/compile/entries', {
      overlayIds,
      ...options
    });
    return response.data;
  },

  // Get sync status
  getStatus: async (): Promise<{
    version: string;
    overlayCount: number;
    qdrantCount: number;
    pendingChanges: number;
  }> => {
    const response = await apiClient.get('/compile/status');
    return response.data;
  },

  // Search in Qdrant
  search: async (query: string, filters?: {
    domain?: string;
    persona?: string;
    guardrailLevel?: string;
  }, limit?: number): Promise<Array<{
    id: string;
    score: number;
    payload: Record<string, unknown>;
  }>> => {
    const response = await apiClient.post('/search/search', {
      query,
      filters,
      limit: limit || 10
    });
    return response.data.results;
  }
};
