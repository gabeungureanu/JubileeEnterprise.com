const PREF_KEY = 'jubilee_notifications_enabled';

export const notificationService = {
  isSupported(): boolean {
    return 'Notification' in window;
  },

  isEnabled(): boolean {
    return localStorage.getItem(PREF_KEY) !== 'false';
  },

  setEnabled(enabled: boolean): void {
    localStorage.setItem(PREF_KEY, String(enabled));
  },

  getPermission(): NotificationPermission {
    if (!this.isSupported()) return 'denied';
    return Notification.permission;
  },

  async requestPermission(): Promise<NotificationPermission> {
    if (!this.isSupported()) return 'denied';
    if (Notification.permission === 'granted') return 'granted';
    return Notification.requestPermission();
  },

  show(title: string, options?: { body?: string; icon?: string; tag?: string; onClick?: () => void }): void {
    if (!this.isSupported() || !this.isEnabled()) return;
    if (Notification.permission !== 'granted') return;

    const notification = new Notification(title, {
      body: options?.body,
      icon: options?.icon || '/favicon.ico',
      tag: options?.tag,
    });

    if (options?.onClick) {
      notification.onclick = () => {
        window.focus();
        options.onClick!();
        notification.close();
      };
    }

    // Auto-close after 8 seconds
    setTimeout(() => notification.close(), 8000);
  },

  showNewMailNotification(count: number, senderName?: string, subject?: string): void {
    if (count === 1 && senderName) {
      this.show('New Email', {
        body: `${senderName}: ${subject || '(No subject)'}`,
        tag: 'jubilee-new-mail',
        onClick: () => window.focus(),
      });
    } else if (count > 1) {
      this.show('New Emails', {
        body: `You have ${count} new messages`,
        tag: 'jubilee-new-mail',
        onClick: () => window.focus(),
      });
    }
  },
};
