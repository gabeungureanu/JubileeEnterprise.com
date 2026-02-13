import React, { useState, useEffect, useCallback } from 'react';
import { useAppContext } from '../../context/AppContext';
import { emailSyncService, ProviderInfo } from '../../services/mail/emailSyncService';
import { tokenStore } from '../../services/apiClient';
import SettingsRibbon from '../../components/layout/Ribbon/SettingsRibbon';
import './SettingsPage.css';

type SettingsTab = 'accounts' | 'sync' | 'general';

interface AccountInfo {
  id: string;
  email_address: string;
  provider_type: string;
  connection_status: string;
}

const SettingsPage: React.FC = () => {
  const { isFolderPaneVisible } = useAppContext();
  const [activeTab, setActiveTab] = useState<SettingsTab>('accounts');

  // Account state
  const [accounts, setAccounts] = useState<AccountInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<string | null>(null);

  // Add account form
  const [showAddForm, setShowAddForm] = useState(false);
  const [addEmail, setAddEmail] = useState('');
  const [addPassword, setAddPassword] = useState('');
  const [providerInfo, setProviderInfo] = useState<ProviderInfo | null>(null);
  const [detectingProvider, setDetectingProvider] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [formError, setFormError] = useState('');

  // Confirm disconnect
  const [confirmDisconnect, setConfirmDisconnect] = useState<AccountInfo | null>(null);

  const loadAccounts = useCallback(async () => {
    const userId = tokenStore.getUserId();
    if (!userId) return;
    try {
      setLoading(true);
      const result = await emailSyncService.getAccounts(userId);
      setAccounts(result);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAccounts();
  }, [loadAccounts]);

  const handleDetectProvider = async () => {
    if (!addEmail.includes('@')) return;
    try {
      setDetectingProvider(true);
      setFormError('');
      const info = await emailSyncService.detectProvider(addEmail);
      setProviderInfo(info);
    } catch {
      setFormError('Could not detect email provider');
    } finally {
      setDetectingProvider(false);
    }
  };

  const handleConnect = async () => {
    const userId = tokenStore.getUserId();
    if (!userId || !addEmail || !addPassword) return;
    try {
      setConnecting(true);
      setFormError('');
      const result = await emailSyncService.connectAccount(addEmail, addPassword, userId);
      if (result.success) {
        setShowAddForm(false);
        setAddEmail('');
        setAddPassword('');
        setProviderInfo(null);
        await loadAccounts();
      } else {
        setFormError(result.error || 'Failed to connect account');
      }
    } catch {
      setFormError('Connection failed. Please check your credentials.');
    } finally {
      setConnecting(false);
    }
  };

  const handleSync = async (accountId: string) => {
    try {
      setSyncing(accountId);
      await emailSyncService.syncAccount(accountId);
      await loadAccounts();
    } catch {
      // silent
    } finally {
      setSyncing(null);
    }
  };

  const handleDisconnect = async (account: AccountInfo) => {
    try {
      await emailSyncService.disconnectAccount(account.id);
      setConfirmDisconnect(null);
      await loadAccounts();
    } catch {
      // silent
    }
  };

  const cancelAddForm = () => {
    setShowAddForm(false);
    setAddEmail('');
    setAddPassword('');
    setProviderInfo(null);
    setFormError('');
  };

  const tabs: { id: SettingsTab; icon: string; label: string }[] = [
    { id: 'accounts', icon: 'account_circle', label: 'Accounts' },
    { id: 'sync', icon: 'sync', label: 'Sync Options' },
    { id: 'general', icon: 'tune', label: 'General' },
  ];

  const renderAccounts = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">Email Accounts</h2>
      <p className="settings-page__section-desc">
        Manage your connected email accounts. Add new accounts or remove existing ones.
      </p>

      {loading ? (
        <div className="settings-page__empty">
          <span className="material-symbols-outlined">hourglass_top</span>
          <span className="settings-page__empty-text">Loading accounts...</span>
        </div>
      ) : accounts.length === 0 && !showAddForm ? (
        <div className="settings-page__empty">
          <span className="material-symbols-outlined">mail</span>
          <span className="settings-page__empty-text">No email accounts connected</span>
          <button className="settings-page__btn settings-page__btn--primary" onClick={() => setShowAddForm(true)}>
            Add Account
          </button>
        </div>
      ) : (
        <>
          <div className="settings-page__accounts">
            {accounts.map((account) => (
              <div key={account.id} className="settings-page__account-card">
                <div className="settings-page__account-icon">
                  <span className="material-symbols-outlined">mail</span>
                </div>
                <div className="settings-page__account-info">
                  <div className="settings-page__account-email">{account.email_address}</div>
                  <div className="settings-page__account-provider">{account.provider_type || 'Email'}</div>
                </div>
                <span
                  className={`settings-page__account-status settings-page__account-status--${
                    account.connection_status === 'connected' ? 'connected' : 'error'
                  }`}
                >
                  {account.connection_status === 'connected' ? 'Connected' : account.connection_status}
                </span>
                <div className="settings-page__account-actions">
                  <button
                    className="settings-page__icon-btn"
                    title="Sync account"
                    onClick={() => handleSync(account.id)}
                    disabled={syncing === account.id}
                  >
                    <span
                      className="material-symbols-outlined"
                      style={syncing === account.id ? { animation: 'spin 1s linear infinite' } : undefined}
                    >
                      sync
                    </span>
                  </button>
                  <button
                    className="settings-page__icon-btn settings-page__icon-btn--danger"
                    title="Disconnect account"
                    onClick={() => setConfirmDisconnect(account)}
                  >
                    <span className="material-symbols-outlined">link_off</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Add account form / button */}
      <div className="settings-page__add-account">
        {!showAddForm ? (
          <button className="settings-page__add-btn" onClick={() => setShowAddForm(true)}>
            <span className="material-symbols-outlined">add</span>
            Add email account
          </button>
        ) : (
          <div className="settings-page__form">
            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Email Address</label>
              <input
                type="email"
                className="settings-page__form-input"
                placeholder="you@example.com"
                value={addEmail}
                onChange={(e) => setAddEmail(e.target.value)}
                onBlur={handleDetectProvider}
              />
            </div>

            {detectingProvider && (
              <div className="settings-page__provider-info">
                <span className="material-symbols-outlined">hourglass_top</span>
                Detecting provider...
              </div>
            )}

            {providerInfo && !detectingProvider && (
              <div className="settings-page__provider-info">
                <span className="material-symbols-outlined">check_circle</span>
                {providerInfo.displayName} detected
                {providerInfo.isAppPassword && ' — App password required'}
              </div>
            )}

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">
                {providerInfo?.isAppPassword ? 'App Password' : 'Password'}
              </label>
              <input
                type="password"
                className="settings-page__form-input"
                placeholder={providerInfo?.isAppPassword ? 'Enter app password' : 'Enter password'}
                value={addPassword}
                onChange={(e) => setAddPassword(e.target.value)}
              />
            </div>

            {formError && (
              <div className="settings-page__error">
                <span className="material-symbols-outlined">error</span>
                {formError}
              </div>
            )}

            <div className="settings-page__form-actions">
              <button
                className="settings-page__btn settings-page__btn--primary"
                disabled={!addEmail || !addPassword || connecting}
                onClick={handleConnect}
              >
                {connecting ? 'Connecting...' : 'Connect Account'}
              </button>
              <button className="settings-page__btn settings-page__btn--secondary" onClick={cancelAddForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderSyncOptions = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">Sync Options</h2>
      <p className="settings-page__section-desc">
        Configure how your email accounts synchronize with the server.
      </p>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Auto-sync on startup</span>
          <span className="settings-page__option-desc">Automatically sync all accounts when you open the app</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" defaultChecked />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Sync interval</span>
          <span className="settings-page__option-desc">How often to check for new emails</span>
        </div>
        <select className="settings-page__select" defaultValue="5">
          <option value="1">Every 1 minute</option>
          <option value="5">Every 5 minutes</option>
          <option value="15">Every 15 minutes</option>
          <option value="30">Every 30 minutes</option>
          <option value="0">Manual only</option>
        </select>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Sync sent items</span>
          <span className="settings-page__option-desc">Include sent folder in synchronization</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" defaultChecked />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Sync deleted items</span>
          <span className="settings-page__option-desc">Include trash folder in synchronization</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Messages per sync</span>
          <span className="settings-page__option-desc">Number of messages to fetch per folder during sync</span>
        </div>
        <select className="settings-page__select" defaultValue="50">
          <option value="25">25 messages</option>
          <option value="50">50 messages</option>
          <option value="100">100 messages</option>
          <option value="200">200 messages</option>
        </select>
      </div>
    </div>
  );

  const renderGeneral = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">General</h2>
      <p className="settings-page__section-desc">
        General application preferences.
      </p>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Mark as read on select</span>
          <span className="settings-page__option-desc">Automatically mark emails as read when you click on them</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" defaultChecked />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Show preview text</span>
          <span className="settings-page__option-desc">Display message preview in the message list</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" defaultChecked />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Default font size</span>
          <span className="settings-page__option-desc">Font size for reading emails</span>
        </div>
        <select className="settings-page__select" defaultValue="14">
          <option value="12">Small (12px)</option>
          <option value="14">Medium (14px)</option>
          <option value="16">Large (16px)</option>
          <option value="18">Extra Large (18px)</option>
        </select>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Confirm before delete</span>
          <span className="settings-page__option-desc">Show confirmation dialog before deleting emails</span>
        </div>
        <label className="settings-page__toggle">
          <input type="checkbox" />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Reading pane position</span>
          <span className="settings-page__option-desc">Where to display the email reading pane</span>
        </div>
        <select className="settings-page__select" defaultValue="right">
          <option value="right">Right</option>
          <option value="bottom">Bottom</option>
          <option value="off">Off</option>
        </select>
      </div>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case 'accounts':
        return renderAccounts();
      case 'sync':
        return renderSyncOptions();
      case 'general':
        return renderGeneral();
      default:
        return renderAccounts();
    }
  };

  return (
    <div className="settings-page">
      <div className="ribbon">
        <SettingsRibbon />
      </div>
      <div className="settings-page__content">
        {isFolderPaneVisible && (
          <div className="settings-page__sidebar">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                className={`settings-page__nav-item ${activeTab === tab.id ? 'settings-page__nav-item--active' : ''}`}
                onClick={() => setActiveTab(tab.id)}
              >
                <span className="material-symbols-outlined">{tab.icon}</span>
                {tab.label}
              </button>
            ))}
          </div>
        )}
        <div className="settings-page__main">{renderContent()}</div>
      </div>

      {/* Disconnect confirmation dialog */}
      {confirmDisconnect && (
        <div className="settings-page__confirm-overlay" onClick={() => setConfirmDisconnect(null)}>
          <div className="settings-page__confirm-dialog" onClick={(e) => e.stopPropagation()}>
            <h3 className="settings-page__confirm-title">Disconnect Account</h3>
            <p className="settings-page__confirm-message">
              Are you sure you want to disconnect <strong>{confirmDisconnect.email_address}</strong>? This will remove
              all synced data for this account.
            </p>
            <div className="settings-page__confirm-actions">
              <button
                className="settings-page__btn settings-page__btn--secondary"
                onClick={() => setConfirmDisconnect(null)}
              >
                Cancel
              </button>
              <button
                className="settings-page__btn settings-page__btn--danger"
                onClick={() => handleDisconnect(confirmDisconnect)}
              >
                Disconnect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SettingsPage;
