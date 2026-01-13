/**
 * Jubilee Tasks - TypeScript Type Definitions
 */

export interface DeveloperProject {
    id: string;
    project_name: string;
    project_category: string;
    project_type: string | null;
    folder_path: string | null;
    description: string | null;
    is_active: boolean;
    created_at: string;
    updated_at: string;
}

export interface DeveloperTask {
    id: string;
    task_code: string;
    task_number: number;
    project_id: string | null;
    project_name: string;
    developer_initials: string;
    task_name: string;
    original_prompt: string | null;
    status: 'in_progress' | 'complete';
    start_time: string;
    end_time: string | null;
    active_duration_ms: number;
    ehh_minutes: number | null;  // Estimated Human Hours in minutes
    last_activity_at: string;
    session_id: string | null;
    machine_name: string | null;
    workspace_path: string | null;
    created_at: string;
    updated_at: string;
    // View fields
    duration_formatted?: string;
    ehh_formatted?: string;  // EHH formatted as HH:MM
    task_date?: string;
    project_category?: string;
    project_type?: string;
}

export interface ProjectInfo {
    name: string;
    category: string;
    type: string;
}

export interface TaskCreateRequest {
    project_name: string;
    developer_initials: string;
    task_name: string;
    original_prompt?: string;
    session_id?: string;
    machine_name?: string;
    workspace_path?: string;
}

export interface TaskUpdateRequest {
    task_name?: string;
    status?: 'in_progress' | 'complete';
    end_time?: string;
    active_duration_ms?: number;
}

export interface TaskCompleteRequest {
    active_duration_ms: number;
    ehh_minutes?: number;
}

export interface TaskListFilters {
    date?: string;
    developer?: string;
    project?: string;
    status?: 'in_progress' | 'complete';
    limit?: number;
    offset?: number;
}

export interface ApiResponse<T> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export interface NextCodeResponse {
    next_code: string;
    next_number: number;
}

export interface TaskStats {
    total_tasks: number;
    completed_tasks: number;
    in_progress_tasks: number;
    total_duration_ms: number;
    total_duration_formatted: string;
    tasks_today: number;
    duration_today_ms: number;
    duration_today_formatted: string;
}

export interface InitialsData {
    initials: string;
    timestamp: number;
}

export interface ActivityState {
    lastActivity: Date;
    accumulatedInactivity: number;
    taskStartTime: Date | null;
}
