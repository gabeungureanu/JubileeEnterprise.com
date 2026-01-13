/**
 * Jubilee Tasks - InspireCodex API Client
 * Handles all communication with the InspireCodex API for task management
 */

import * as vscode from 'vscode';
import * as http from 'http';
import * as https from 'https';
import {
    DeveloperProject,
    DeveloperTask,
    TaskCreateRequest,
    TaskUpdateRequest,
    TaskCompleteRequest,
    TaskListFilters,
    ApiResponse,
    NextCodeResponse,
    TaskStats
} from './types';

interface HttpRequestOptions {
    method?: string;
    body?: string;
}

export class TaskService {
    private baseUrl: string;

    constructor() {
        const config = vscode.workspace.getConfiguration('jubileeTasks');
        this.baseUrl = config.get('apiBaseUrl', 'http://localhost:3100');
    }

    private makeRequest<T>(
        endpoint: string,
        options: HttpRequestOptions = {}
    ): Promise<ApiResponse<T>> {
        return new Promise((resolve) => {
            const fullUrl = `${this.baseUrl}${endpoint}`;
            const url = new URL(fullUrl);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const requestOptions: http.RequestOptions = {
                hostname: url.hostname,
                port: url.port || (isHttps ? 443 : 80),
                path: url.pathname + url.search,
                method: options.method || 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                }
            };

            if (options.body) {
                requestOptions.headers = {
                    ...requestOptions.headers,
                    'Content-Length': Buffer.byteLength(options.body)
                };
            }

            const req = httpModule.request(requestOptions, (res) => {
                let data = '';

                res.on('data', (chunk) => {
                    data += chunk;
                });

                res.on('end', () => {
                    try {
                        const parsed = JSON.parse(data);

                        if (res.statusCode && res.statusCode >= 200 && res.statusCode < 300) {
                            // Normalize response: API returns tasks/task/projects/project, we need data
                            const normalizedData = parsed.tasks || parsed.task || parsed.projects || parsed.project || parsed.stats || parsed.data;
                            resolve({
                                success: parsed.success !== false,
                                data: normalizedData,
                                error: parsed.error,
                                message: parsed.message
                            });
                        } else {
                            resolve({
                                success: false,
                                error: parsed.error || `HTTP ${res.statusCode}`
                            });
                        }
                    } catch (parseError) {
                        resolve({
                            success: false,
                            error: `Failed to parse response: ${data.substring(0, 100)}`
                        });
                    }
                });
            });

            req.on('error', (error) => {
                console.error(`TaskService request error: ${error.message}`);
                resolve({
                    success: false,
                    error: error.message
                });
            });

            req.on('timeout', () => {
                req.destroy();
                resolve({
                    success: false,
                    error: 'Request timed out'
                });
            });

            // Set timeout to 30 seconds
            req.setTimeout(30000);

            if (options.body) {
                req.write(options.body);
            }

            req.end();
        });
    }

    // ==================== Projects ====================

    async getProjects(): Promise<ApiResponse<DeveloperProject[]>> {
        return this.makeRequest<DeveloperProject[]>('/api/v1/developer/projects');
    }

    async createProject(project: Partial<DeveloperProject>): Promise<ApiResponse<DeveloperProject>> {
        return this.makeRequest<DeveloperProject>('/api/v1/developer/projects', {
            method: 'POST',
            body: JSON.stringify(project)
        });
    }

    // ==================== Tasks ====================

    async getTasks(filters?: TaskListFilters): Promise<ApiResponse<DeveloperTask[]>> {
        const params = new URLSearchParams();

        if (filters) {
            if (filters.date) params.append('date', filters.date);
            if (filters.developer) params.append('developer', filters.developer);
            if (filters.project) params.append('project', filters.project);
            if (filters.status) params.append('status', filters.status);
            if (filters.limit) params.append('limit', filters.limit.toString());
            if (filters.offset) params.append('offset', filters.offset.toString());
        }

        const queryString = params.toString();
        const endpoint = `/api/v1/developer/tasks${queryString ? '?' + queryString : ''}`;

        return this.makeRequest<DeveloperTask[]>(endpoint);
    }

    async getTask(id: string): Promise<ApiResponse<DeveloperTask>> {
        return this.makeRequest<DeveloperTask>(`/api/v1/developer/tasks/${id}`);
    }

    async getNextCode(): Promise<ApiResponse<NextCodeResponse>> {
        return this.makeRequest<NextCodeResponse>('/api/v1/developer/tasks/next-code');
    }

    async createTask(task: TaskCreateRequest): Promise<ApiResponse<DeveloperTask>> {
        return this.makeRequest<DeveloperTask>('/api/v1/developer/tasks', {
            method: 'POST',
            body: JSON.stringify(task)
        });
    }

    async updateTask(id: string, update: TaskUpdateRequest): Promise<ApiResponse<DeveloperTask>> {
        return this.makeRequest<DeveloperTask>(`/api/v1/developer/tasks/${id}`, {
            method: 'PUT',
            body: JSON.stringify(update)
        });
    }

    async updateActivity(id: string): Promise<ApiResponse<DeveloperTask>> {
        return this.makeRequest<DeveloperTask>(`/api/v1/developer/tasks/${id}/activity`, {
            method: 'PUT'
        });
    }

    async completeTask(id: string, data: TaskCompleteRequest): Promise<ApiResponse<DeveloperTask>> {
        return this.makeRequest<DeveloperTask>(`/api/v1/developer/tasks/${id}/complete`, {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    async getStats(filters?: { date?: string; developer?: string }): Promise<ApiResponse<TaskStats>> {
        const params = new URLSearchParams();

        if (filters) {
            if (filters.date) params.append('date', filters.date);
            if (filters.developer) params.append('developer', filters.developer);
        }

        const queryString = params.toString();
        const endpoint = `/api/v1/developer/tasks/stats${queryString ? '?' + queryString : ''}`;

        return this.makeRequest<TaskStats>(endpoint);
    }

    async getActiveTaskForSession(sessionId: string): Promise<ApiResponse<DeveloperTask | null>> {
        return this.makeRequest<DeveloperTask | null>(`/api/v1/developer/tasks/session/${sessionId}/active`);
    }

    // ==================== Health Check ====================

    async healthCheck(): Promise<boolean> {
        return new Promise((resolve) => {
            const url = new URL(`${this.baseUrl}/health`);
            const isHttps = url.protocol === 'https:';
            const httpModule = isHttps ? https : http;

            const req = httpModule.get(url, (res) => {
                resolve(res.statusCode === 200);
            });

            req.on('error', () => {
                resolve(false);
            });

            req.setTimeout(5000, () => {
                req.destroy();
                resolve(false);
            });
        });
    }
}

// Singleton instance
let serviceInstance: TaskService | null = null;

export function getTaskService(): TaskService {
    if (!serviceInstance) {
        serviceInstance = new TaskService();
    }
    return serviceInstance;
}

export function resetTaskService(): void {
    serviceInstance = null;
}
