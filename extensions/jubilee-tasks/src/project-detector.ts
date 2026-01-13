/**
 * Jubilee Tasks - Project Detector
 * Analyzes workspace folders to determine project information
 */

import * as vscode from 'vscode';
import { ProjectInfo } from './types';

export class ProjectDetector {
    /**
     * Detect project information from the current workspace
     */
    detectProject(): ProjectInfo {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return { name: 'unknown', category: 'unknown', type: 'unknown' };
        }

        // Use the first workspace folder
        const workspacePath = workspaceFolders[0].uri.fsPath;
        return this.detectProjectFromPath(workspacePath);
    }

    /**
     * Detect project info from a specific path
     */
    detectProjectFromPath(workspacePath: string): ProjectInfo {
        // Normalize path separators
        const normalizedPath = workspacePath.replace(/\\/g, '/');
        const parts = normalizedPath.split('/');

        // Check for applications/*.wpf
        const appIdx = parts.findIndex(p => p.toLowerCase() === 'applications');
        if (appIdx !== -1 && appIdx + 1 < parts.length) {
            const projectFolder = parts[appIdx + 1];
            const name = projectFolder.replace(/\.wpf$/i, '').toLowerCase();
            return {
                name,
                category: 'application',
                type: 'wpf'
            };
        }

        // Check for mobile/*.ios
        const mobileIdx = parts.findIndex(p => p.toLowerCase() === 'mobile');
        if (mobileIdx !== -1 && mobileIdx + 1 < parts.length) {
            const projectFolder = parts[mobileIdx + 1];
            const name = projectFolder.replace(/\.ios$/i, '').toLowerCase();
            return {
                name,
                category: 'mobile',
                type: 'ios'
            };
        }

        // Check for websites/codex|continuum|inspire/*
        const websitesIdx = parts.findIndex(p => p.toLowerCase() === 'websites');
        if (websitesIdx !== -1 && websitesIdx + 2 < parts.length) {
            const category = parts[websitesIdx + 1].toLowerCase();
            const projectFolder = parts[websitesIdx + 2];

            // Determine type based on category and project
            let type = 'website';
            if (projectFolder.toLowerCase().includes('codex') ||
                projectFolder.toLowerCase().includes('api')) {
                type = 'api';
            }

            return {
                name: projectFolder.toLowerCase(),
                category,
                type
            };
        }

        // Check for extensions/*
        const extIdx = parts.findIndex(p => p.toLowerCase() === 'extensions');
        if (extIdx !== -1 && extIdx + 1 < parts.length) {
            const projectFolder = parts[extIdx + 1];
            return {
                name: projectFolder.toLowerCase(),
                category: 'extension',
                type: 'vscode'
            };
        }

        // Check for packages/*
        const pkgIdx = parts.findIndex(p => p.toLowerCase() === 'packages');
        if (pkgIdx !== -1 && pkgIdx + 1 < parts.length) {
            const projectFolder = parts[pkgIdx + 1];
            return {
                name: projectFolder.toLowerCase(),
                category: 'package',
                type: 'npm'
            };
        }

        // Fallback: try to get project name from last folder
        const lastFolder = parts[parts.length - 1];
        if (lastFolder) {
            return {
                name: lastFolder.toLowerCase(),
                category: 'unknown',
                type: 'unknown'
            };
        }

        return { name: 'unknown', category: 'unknown', type: 'unknown' };
    }

    /**
     * Get the full workspace path
     */
    getWorkspacePath(): string | null {
        const workspaceFolders = vscode.workspace.workspaceFolders;

        if (!workspaceFolders || workspaceFolders.length === 0) {
            return null;
        }

        return workspaceFolders[0].uri.fsPath;
    }

    /**
     * Get machine hostname
     */
    getMachineName(): string {
        return require('os').hostname();
    }

    /**
     * Generate a unique session ID for this VS Code instance
     */
    generateSessionId(): string {
        const machineId = vscode.env.machineId;
        const sessionTimestamp = Date.now();
        const random = Math.random().toString(36).substring(2, 8);
        return `${machineId.substring(0, 8)}-${sessionTimestamp}-${random}`;
    }
}
