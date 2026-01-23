/**
 * ImpossibleHarvest.com - Email Client Application
 * Full Outlook.com-style email client
 */

class EmailClient {
    constructor() {
        this.currentFolder = 'inbox';
        this.currentEmail = null;
        this.selectedEmails = new Set();
        this.composeMode = null; // 'new', 'reply', 'replyAll', 'forward'
        this.replyToEmail = null;
        this.folders = [];
        this.emails = [];

        this.init();
    }

    async init() {
        await this.loadFolders();
        await this.loadEmails('inbox');
        this.bindEvents();
        this.selectFolder('inbox');
    }

    // ============== API Calls ==============

    async loadFolders() {
        try {
            const response = await fetch('/api/folders');
            this.folders = await response.json();
            this.renderFolders();
        } catch (error) {
            console.error('Failed to load folders:', error);
            this.showToast('Failed to load folders', 'error');
        }
    }

    async loadEmails(folder, options = {}) {
        try {
            let url = `/api/emails/${folder}`;
            const params = new URLSearchParams();

            if (options.search) params.append('search', options.search);
            if (options.starred) params.append('starred', 'true');
            if (options.unread) params.append('unread', 'true');

            if (params.toString()) url += `?${params.toString()}`;

            const response = await fetch(url);
            this.emails = await response.json();
            this.renderEmailList();
            this.updateEmailCount();
        } catch (error) {
            console.error('Failed to load emails:', error);
            this.showToast('Failed to load emails', 'error');
        }
    }

    async loadEmail(id) {
        try {
            const response = await fetch(`/api/email/${id}`);
            this.currentEmail = await response.json();

            // Mark as read
            if (!this.currentEmail.read) {
                await fetch(`/api/email/${id}/read`, { method: 'PUT' });
                this.currentEmail.read = true;
                await this.loadFolders(); // Update counts
                this.updateEmailInList(id, { read: true });
            }

            this.renderEmailView();
        } catch (error) {
            console.error('Failed to load email:', error);
            this.showToast('Failed to load email', 'error');
        }
    }

    async toggleStar(id) {
        try {
            const response = await fetch(`/api/email/${id}/star`, { method: 'PUT' });
            const email = await response.json();
            this.updateEmailInList(id, { starred: email.starred });
            if (this.currentEmail?.id === id) {
                this.currentEmail.starred = email.starred;
            }
        } catch (error) {
            console.error('Failed to toggle star:', error);
        }
    }

    async moveEmail(id, folder) {
        try {
            await fetch(`/api/email/${id}/move`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ folder })
            });
            await this.loadEmails(this.currentFolder);
            await this.loadFolders();
            if (this.currentEmail?.id === id) {
                this.currentEmail = null;
                this.renderEmailView();
            }
            this.showToast(`Email moved to ${folder}`, 'success');
        } catch (error) {
            console.error('Failed to move email:', error);
            this.showToast('Failed to move email', 'error');
        }
    }

    async deleteEmail(id) {
        try {
            await fetch(`/api/email/${id}`, { method: 'DELETE' });
            await this.loadEmails(this.currentFolder);
            await this.loadFolders();
            if (this.currentEmail?.id === id) {
                this.currentEmail = null;
                this.renderEmailView();
            }
            this.showToast('Email deleted', 'success');
        } catch (error) {
            console.error('Failed to delete email:', error);
            this.showToast('Failed to delete email', 'error');
        }
    }

    async sendEmail(isDraft = false) {
        const to = document.getElementById('composeTo').value;
        const subject = document.getElementById('composeSubject').value;
        const body = document.getElementById('composeEditor').innerHTML;

        if (!isDraft && !to) {
            this.showToast('Please enter a recipient', 'error');
            return;
        }

        try {
            const payload = {
                to,
                subject,
                body,
                isDraft,
                replyTo: this.replyToEmail?.id || null
            };

            const response = await fetch('/api/email', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            await response.json();
            this.closeCompose();
            await this.loadFolders();

            if (isDraft) {
                this.showToast('Draft saved', 'success');
            } else {
                this.showToast('Email sent', 'success');
            }
        } catch (error) {
            console.error('Failed to send email:', error);
            this.showToast('Failed to send email', 'error');
        }
    }

    async bulkAction(action, folder = null) {
        if (this.selectedEmails.size === 0) return;

        try {
            await fetch('/api/emails/bulk', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    ids: Array.from(this.selectedEmails),
                    action,
                    folder
                })
            });

            this.selectedEmails.clear();
            await this.loadEmails(this.currentFolder);
            await this.loadFolders();
            document.getElementById('selectAll').checked = false;
            this.updateBulkActionsVisibility();

            const actionMessages = {
                read: 'Marked as read',
                unread: 'Marked as unread',
                delete: 'Deleted',
                archive: 'Archived',
                star: 'Starred',
                move: `Moved to ${folder}`
            };

            this.showToast(actionMessages[action] || 'Action completed', 'success');
        } catch (error) {
            console.error('Bulk action failed:', error);
            this.showToast('Action failed', 'error');
        }
    }

    async searchEmails(query) {
        if (!query) {
            await this.loadEmails(this.currentFolder);
            return;
        }

        try {
            const response = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
            this.emails = await response.json();
            this.renderEmailList();
            this.updateEmailCount();
        } catch (error) {
            console.error('Search failed:', error);
        }
    }

    // ============== Rendering ==============

    renderFolders() {
        const folderList = document.getElementById('folderList');
        folderList.innerHTML = this.folders.map(folder => `
            <div class="folder-item ${folder.id === this.currentFolder ? 'active' : ''}"
                 data-folder="${folder.id}">
                <i class="bi bi-${folder.icon}"></i>
                <span class="folder-name">${folder.name}</span>
                ${folder.count > 0 ? `<span class="folder-count">${folder.count}</span>` : ''}
            </div>
        `).join('');
    }

    renderEmailList() {
        const emailList = document.getElementById('emailList');

        if (this.emails.length === 0) {
            emailList.innerHTML = `
                <div class="empty-state">
                    <i class="bi bi-inbox"></i>
                    <h3>No messages</h3>
                    <p>This folder is empty</p>
                </div>
            `;
            return;
        }

        emailList.innerHTML = this.emails.map(email => `
            <div class="email-item ${email.read ? '' : 'unread'} ${this.currentEmail?.id === email.id ? 'selected' : ''}"
                 data-id="${email.id}">
                <div class="email-item-checkbox">
                    <label class="checkbox-container">
                        <input type="checkbox" ${this.selectedEmails.has(email.id) ? 'checked' : ''}>
                        <span class="checkmark"></span>
                    </label>
                </div>
                <div class="email-item-content">
                    <div class="email-item-header">
                        <span class="email-sender">${this.escapeHtml(email.from.name || email.from.email)}</span>
                        <span class="email-date">${this.formatDate(email.date)}</span>
                    </div>
                    <div class="email-subject">${this.escapeHtml(email.subject)}</div>
                    <div class="email-preview">${this.stripHtml(email.body).substring(0, 100)}...</div>
                    <div class="email-indicators">
                        ${email.starred ? '<i class="bi bi-star-fill indicator starred"></i>' : ''}
                        ${email.importance === 'high' ? '<i class="bi bi-exclamation-circle-fill indicator important"></i>' : ''}
                        ${email.hasAttachment ? '<i class="bi bi-paperclip indicator"></i>' : ''}
                    </div>
                </div>
                <div class="email-item-actions">
                    <button class="email-action-btn" data-action="delete" title="Delete">
                        <i class="bi bi-trash"></i>
                    </button>
                    <button class="email-action-btn" data-action="archive" title="Archive">
                        <i class="bi bi-archive"></i>
                    </button>
                    <button class="email-action-btn" data-action="star" title="Star">
                        <i class="bi bi-${email.starred ? 'star-fill' : 'star'}"></i>
                    </button>
                </div>
            </div>
        `).join('');
    }

    renderEmailView() {
        const placeholder = document.querySelector('.reading-placeholder');
        const emailView = document.getElementById('emailView');

        if (!this.currentEmail) {
            placeholder.style.display = 'flex';
            emailView.style.display = 'none';
            return;
        }

        placeholder.style.display = 'none';
        emailView.style.display = 'flex';

        document.getElementById('viewSubject').textContent = this.currentEmail.subject;
        document.getElementById('viewSenderName').textContent = this.currentEmail.from.name || this.currentEmail.from.email;
        document.getElementById('viewSenderEmail').textContent = `<${this.currentEmail.from.email}>`;
        document.getElementById('viewDate').textContent = this.formatDateFull(this.currentEmail.date);
        document.getElementById('viewRecipients').textContent = this.currentEmail.to
            .map(r => r.name || r.email)
            .join(', ');
        document.getElementById('viewBody').innerHTML = this.currentEmail.body;
        document.getElementById('senderAvatar').textContent = (this.currentEmail.from.name || this.currentEmail.from.email)[0].toUpperCase();

        // Update email list selection
        document.querySelectorAll('.email-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id === this.currentEmail.id);
        });
    }

    updateEmailInList(id, updates) {
        const emailItem = document.querySelector(`.email-item[data-id="${id}"]`);
        if (!emailItem) return;

        if ('read' in updates) {
            emailItem.classList.toggle('unread', !updates.read);
        }

        if ('starred' in updates) {
            const starIcon = emailItem.querySelector('.email-indicators');
            const hasStarred = starIcon.querySelector('.starred');
            if (updates.starred && !hasStarred) {
                starIcon.insertAdjacentHTML('afterbegin', '<i class="bi bi-star-fill indicator starred"></i>');
            } else if (!updates.starred && hasStarred) {
                hasStarred.remove();
            }
        }
    }

    updateEmailCount() {
        const count = this.emails.length;
        document.getElementById('emailCount').textContent =
            `${count} message${count !== 1 ? 's' : ''}`;
    }

    updateBulkActionsVisibility() {
        const bulkActions = document.getElementById('bulkActions');
        bulkActions.style.display = this.selectedEmails.size > 0 ? 'flex' : 'none';
    }

    // ============== Compose ==============

    openCompose(mode = 'new', email = null) {
        this.composeMode = mode;
        this.replyToEmail = email;

        const modal = document.getElementById('composeModal');
        const toField = document.getElementById('composeTo');
        const subjectField = document.getElementById('composeSubject');
        const editor = document.getElementById('composeEditor');

        // Reset fields
        toField.value = '';
        subjectField.value = '';
        editor.innerHTML = '';

        if (mode === 'reply' || mode === 'replyAll') {
            toField.value = email.from.email;
            subjectField.value = `Re: ${email.subject.replace(/^Re:\s*/i, '')}`;
            editor.innerHTML = `<br><br><div style="border-left: 2px solid #0078d4; padding-left: 12px; margin-top: 12px; color: #605e5c;">
                <p><strong>From:</strong> ${this.escapeHtml(email.from.name)} &lt;${email.from.email}&gt;<br>
                <strong>Date:</strong> ${this.formatDateFull(email.date)}<br>
                <strong>Subject:</strong> ${this.escapeHtml(email.subject)}</p>
                ${email.body}
            </div>`;
        } else if (mode === 'forward') {
            subjectField.value = `Fwd: ${email.subject.replace(/^Fwd:\s*/i, '')}`;
            editor.innerHTML = `<br><br><div style="border-left: 2px solid #0078d4; padding-left: 12px; margin-top: 12px; color: #605e5c;">
                <p><strong>---------- Forwarded message ----------</strong><br>
                <strong>From:</strong> ${this.escapeHtml(email.from.name)} &lt;${email.from.email}&gt;<br>
                <strong>Date:</strong> ${this.formatDateFull(email.date)}<br>
                <strong>Subject:</strong> ${this.escapeHtml(email.subject)}</p>
                ${email.body}
            </div>`;
        }

        modal.classList.add('show');
        toField.focus();
    }

    closeCompose() {
        document.getElementById('composeModal').classList.remove('show');
        this.composeMode = null;
        this.replyToEmail = null;
    }

    // ============== Event Binding ==============

    bindEvents() {
        // Folder selection
        document.getElementById('folderList').addEventListener('click', (e) => {
            const folderItem = e.target.closest('.folder-item');
            if (folderItem) {
                this.selectFolder(folderItem.dataset.folder);
            }
        });

        // Email selection
        document.getElementById('emailList').addEventListener('click', (e) => {
            const checkbox = e.target.closest('.checkbox-container');
            const actionBtn = e.target.closest('.email-action-btn');
            const emailItem = e.target.closest('.email-item');

            if (checkbox) {
                e.stopPropagation();
                const emailId = emailItem.dataset.id;
                const input = checkbox.querySelector('input');

                if (input.checked) {
                    this.selectedEmails.add(emailId);
                } else {
                    this.selectedEmails.delete(emailId);
                }
                this.updateBulkActionsVisibility();
                return;
            }

            if (actionBtn) {
                e.stopPropagation();
                const emailId = emailItem.dataset.id;
                const action = actionBtn.dataset.action;

                if (action === 'delete') this.deleteEmail(emailId);
                else if (action === 'archive') this.moveEmail(emailId, 'archive');
                else if (action === 'star') this.toggleStar(emailId);
                return;
            }

            if (emailItem) {
                this.loadEmail(emailItem.dataset.id);
            }
        });

        // Select all checkbox
        document.getElementById('selectAll').addEventListener('change', (e) => {
            const checkboxes = document.querySelectorAll('.email-item .checkbox-container input');
            checkboxes.forEach(cb => {
                cb.checked = e.target.checked;
                const emailId = cb.closest('.email-item').dataset.id;
                if (e.target.checked) {
                    this.selectedEmails.add(emailId);
                } else {
                    this.selectedEmails.delete(emailId);
                }
            });
            this.updateBulkActionsVisibility();
        });

        // Bulk actions
        document.querySelectorAll('.toolbar-actions .toolbar-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const action = btn.dataset.action;
                if (action === 'archive') {
                    this.bulkAction('move', 'archive');
                } else if (action === 'spam') {
                    this.bulkAction('move', 'spam');
                } else {
                    this.bulkAction(action);
                }
            });
        });

        // Filter toggle
        document.getElementById('filterBtn').addEventListener('click', () => {
            document.getElementById('filterDropdown').classList.toggle('show');
        });

        // Filter options
        document.querySelectorAll('.filter-option').forEach(btn => {
            btn.addEventListener('click', async () => {
                document.querySelectorAll('.filter-option').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                const filter = btn.dataset.filter;
                const options = {};

                if (filter === 'unread') options.unread = true;
                else if (filter === 'starred') options.starred = true;
                else if (filter === 'attachments') options.attachments = true;

                await this.loadEmails(this.currentFolder, options);
            });
        });

        // Search
        let searchTimeout;
        document.getElementById('globalSearch').addEventListener('input', (e) => {
            clearTimeout(searchTimeout);
            searchTimeout = setTimeout(() => {
                this.searchEmails(e.target.value);
            }, 300);
        });

        // Compose button
        document.getElementById('composeBtn').addEventListener('click', () => {
            this.openCompose('new');
        });

        // Close compose
        document.getElementById('closeCompose').addEventListener('click', () => {
            this.closeCompose();
        });

        document.getElementById('discardBtn').addEventListener('click', () => {
            this.closeCompose();
        });

        // Send email
        document.getElementById('sendBtn').addEventListener('click', () => {
            this.sendEmail(false);
        });

        // Save draft
        document.getElementById('saveDraftBtn').addEventListener('click', () => {
            this.sendEmail(true);
        });

        // Reply/Forward buttons
        document.getElementById('replyBtn').addEventListener('click', () => {
            if (this.currentEmail) this.openCompose('reply', this.currentEmail);
        });

        document.getElementById('replyAllBtn').addEventListener('click', () => {
            if (this.currentEmail) this.openCompose('replyAll', this.currentEmail);
        });

        document.getElementById('forwardBtn').addEventListener('click', () => {
            if (this.currentEmail) this.openCompose('forward', this.currentEmail);
        });

        // Email view actions
        document.getElementById('deleteEmailBtn').addEventListener('click', () => {
            if (this.currentEmail) this.deleteEmail(this.currentEmail.id);
        });

        document.getElementById('archiveEmailBtn').addEventListener('click', () => {
            if (this.currentEmail) this.moveEmail(this.currentEmail.id, 'archive');
        });

        document.getElementById('spamEmailBtn').addEventListener('click', () => {
            if (this.currentEmail) this.moveEmail(this.currentEmail.id, 'spam');
        });

        // Sidebar toggle (mobile)
        document.getElementById('toggleSidebar').addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
        });

        // Close modal on overlay click
        document.getElementById('composeModal').addEventListener('click', (e) => {
            if (e.target === document.getElementById('composeModal')) {
                this.closeCompose();
            }
        });

        // Format buttons
        document.querySelectorAll('.format-btn[data-format]').forEach(btn => {
            btn.addEventListener('click', () => {
                const format = btn.dataset.format;
                this.applyFormat(format);
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Escape to close compose
            if (e.key === 'Escape') {
                this.closeCompose();
            }

            // Ctrl+Enter to send
            if (e.ctrlKey && e.key === 'Enter') {
                const modal = document.getElementById('composeModal');
                if (modal.classList.contains('show')) {
                    this.sendEmail(false);
                }
            }
        });
    }

    selectFolder(folderId) {
        this.currentFolder = folderId;
        this.currentEmail = null;
        this.selectedEmails.clear();

        // Update folder UI
        document.querySelectorAll('.folder-item').forEach(item => {
            item.classList.toggle('active', item.dataset.folder === folderId);
        });

        // Reset select all
        document.getElementById('selectAll').checked = false;
        this.updateBulkActionsVisibility();

        // Load emails
        this.loadEmails(folderId);

        // Reset reading pane
        this.renderEmailView();

        // Close mobile sidebar
        document.getElementById('sidebar').classList.remove('open');
    }

    applyFormat(format) {
        const editor = document.getElementById('composeEditor');
        editor.focus();

        switch (format) {
            case 'bold':
                document.execCommand('bold');
                break;
            case 'italic':
                document.execCommand('italic');
                break;
            case 'underline':
                document.execCommand('underline');
                break;
            case 'list-ul':
                document.execCommand('insertUnorderedList');
                break;
            case 'list-ol':
                document.execCommand('insertOrderedList');
                break;
            case 'link':
                const url = prompt('Enter URL:');
                if (url) document.execCommand('createLink', false, url);
                break;
        }
    }

    // ============== Utilities ==============

    formatDate(dateString) {
        const date = new Date(dateString);
        const now = new Date();
        const diff = now - date;

        // Today
        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
        }

        // Yesterday
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.toDateString() === yesterday.toDateString()) {
            return 'Yesterday';
        }

        // This week
        if (diff < 7 * 24 * 60 * 60 * 1000) {
            return date.toLocaleDateString('en-US', { weekday: 'short' });
        }

        // Older
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    formatDateFull(dateString) {
        return new Date(dateString).toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit'
        });
    }

    stripHtml(html) {
        const tmp = document.createElement('div');
        tmp.innerHTML = html;
        return tmp.textContent || tmp.innerText || '';
    }

    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showToast(message, type = 'info') {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.innerHTML = `
            <i class="bi bi-${type === 'success' ? 'check-circle' : type === 'error' ? 'x-circle' : 'info-circle'}"></i>
            <span>${message}</span>
        `;
        container.appendChild(toast);

        setTimeout(() => {
            toast.style.opacity = '0';
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.emailClient = new EmailClient();
});
