import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';

export class WebsitesTreeProvider implements vscode.TreeDataProvider<FileItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<FileItem | undefined | null | void> = new vscode.EventEmitter<FileItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<FileItem | undefined | null | void> = this._onDidChangeTreeData.event;

    private rootPath: string;

    constructor() {
        // Set the root path to /websites/ in the workspace
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (workspaceFolders && workspaceFolders.length > 0) {
            this.rootPath = path.join(workspaceFolders[0].uri.fsPath, 'websites');
        } else {
            this.rootPath = 'c:/data/JubileeEnterprise.com/websites';
        }
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: FileItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: FileItem): Thenable<FileItem[]> {
        if (!this.rootPath) {
            vscode.window.showInformationMessage('No websites folder found');
            return Promise.resolve([]);
        }

        if (element) {
            return Promise.resolve(this.getFilesInDirectory(element.resourceUri.fsPath));
        } else {
            // Root level - show contents of /websites/
            if (fs.existsSync(this.rootPath)) {
                return Promise.resolve(this.getFilesInDirectory(this.rootPath));
            } else {
                vscode.window.showInformationMessage('Websites folder not found');
                return Promise.resolve([]);
            }
        }
    }

    private getFilesInDirectory(dirPath: string): FileItem[] {
        if (!fs.existsSync(dirPath)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(dirPath, { withFileTypes: true });

            // Sort: directories first, then files, both alphabetically
            entries.sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            });

            return entries.map(entry => {
                const fullPath = path.join(dirPath, entry.name);
                const isDirectory = entry.isDirectory();

                return new FileItem(
                    entry.name,
                    isDirectory
                        ? vscode.TreeItemCollapsibleState.Collapsed
                        : vscode.TreeItemCollapsibleState.None,
                    vscode.Uri.file(fullPath),
                    isDirectory
                );
            });
        } catch (error) {
            console.error('Error reading directory:', error);
            return [];
        }
    }

    getParent(element: FileItem): vscode.ProviderResult<FileItem> {
        const parentPath = path.dirname(element.resourceUri.fsPath);

        // Don't go above the root
        if (parentPath === this.rootPath || !parentPath.startsWith(this.rootPath)) {
            return null;
        }

        return new FileItem(
            path.basename(parentPath),
            vscode.TreeItemCollapsibleState.Collapsed,
            vscode.Uri.file(parentPath),
            true
        );
    }
}

export class FileItem extends vscode.TreeItem {
    constructor(
        public readonly label: string,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState,
        public readonly resourceUri: vscode.Uri,
        public readonly isDirectory: boolean
    ) {
        super(label, collapsibleState);

        this.tooltip = this.resourceUri.fsPath;
        this.resourceUri = resourceUri;

        if (isDirectory) {
            this.contextValue = 'folder';
            this.iconPath = new vscode.ThemeIcon('folder');
        } else {
            this.contextValue = 'file';
            this.iconPath = this.getFileIcon(label);

            // Make files openable on click
            this.command = {
                command: 'vscode.open',
                title: 'Open File',
                arguments: [this.resourceUri]
            };
        }
    }

    private getFileIcon(filename: string): vscode.ThemeIcon {
        const ext = path.extname(filename).toLowerCase();

        switch (ext) {
            case '.html':
            case '.htm':
                return new vscode.ThemeIcon('file-code');
            case '.css':
            case '.scss':
            case '.sass':
            case '.less':
                return new vscode.ThemeIcon('file-code');
            case '.js':
            case '.ts':
            case '.jsx':
            case '.tsx':
                return new vscode.ThemeIcon('file-code');
            case '.json':
                return new vscode.ThemeIcon('json');
            case '.md':
            case '.markdown':
                return new vscode.ThemeIcon('markdown');
            case '.png':
            case '.jpg':
            case '.jpeg':
            case '.gif':
            case '.svg':
            case '.ico':
            case '.webp':
                return new vscode.ThemeIcon('file-media');
            case '.pdf':
                return new vscode.ThemeIcon('file-pdf');
            case '.xml':
                return new vscode.ThemeIcon('file-code');
            case '.php':
                return new vscode.ThemeIcon('file-code');
            default:
                return new vscode.ThemeIcon('file');
        }
    }
}