export type WorkflowAction = 'submit_review' | 'approve' | 'reject' | 'publish' | 'deprecate';

export interface WorkflowTransition {
  from: string;
  to: string;
  action: WorkflowAction;
  requiredRole?: string;
}

export const WORKFLOW_TRANSITIONS: WorkflowTransition[] = [
  { from: 'draft', to: 'review', action: 'submit_review' },
  { from: 'review', to: 'approved', action: 'approve' },
  { from: 'review', to: 'draft', action: 'reject' },
  { from: 'approved', to: 'active', action: 'publish' },
  { from: 'active', to: 'deprecated', action: 'deprecate' }
];

export interface CompileResult {
  processed: number;
  newEntries: number;
  updatedMetadata: number;
  reEmbedded: number;
  softDeleted: number;
  unchanged: number;
  errors: string[];
  duration: number;
  version: string;
  previousVersion: string;
}

export interface TestResult {
  overlay_id: string;
  query: string;
  retrieved: boolean;
  rank: number;
  score: number;
  snippet: string;
}
