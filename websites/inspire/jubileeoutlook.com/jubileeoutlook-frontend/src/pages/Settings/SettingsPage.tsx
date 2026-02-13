import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useAppContext } from '../../context/AppContext';
import { emailSyncService, ProviderInfo } from '../../services/mail/emailSyncService';
import { tokenStore } from '../../services/apiClient';
import { signatureService, EmailSignature } from '../../services/mail/signatureService';
import { notificationService } from '../../services/mail/notificationService';
import { rulesService, EmailRule, RuleCondition, RuleAction, RuleConditionField, RuleConditionOp, RuleActionType } from '../../services/mail/rulesService';
import { templateService, EmailTemplate } from '../../services/mail/templateService';
import SettingsRibbon from '../../components/layout/Ribbon/SettingsRibbon';
import './SettingsPage.css';

type SettingsTab = 'accounts' | 'signatures' | 'rules' | 'templates' | 'sync' | 'general';

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

  // Signature state
  const [signatures, setSignatures] = useState<EmailSignature[]>([]);
  const [editingSig, setEditingSig] = useState<EmailSignature | null>(null);
  const [sigName, setSigName] = useState('');
  const [showSigForm, setShowSigForm] = useState(false);
  const sigEditorRef = useRef<HTMLDivElement>(null);

  // Notification state
  const [notificationsEnabled, setNotificationsEnabled] = useState(notificationService.isEnabled());

  // Rules state
  const [rules, setRules] = useState<EmailRule[]>([]);
  const [showRuleForm, setShowRuleForm] = useState(false);
  const [editingRule, setEditingRule] = useState<EmailRule | null>(null);
  const [ruleName, setRuleName] = useState('');
  const [ruleMatchAll, setRuleMatchAll] = useState(true);
  const [ruleConditions, setRuleConditions] = useState<RuleCondition[]>([{ field: 'from', operator: 'contains', value: '' }]);
  const [ruleActions, setRuleActions] = useState<RuleAction[]>([{ type: 'markAsRead' }]);

  // Template state
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [showTplForm, setShowTplForm] = useState(false);
  const [editingTpl, setEditingTpl] = useState<EmailTemplate | null>(null);
  const [tplName, setTplName] = useState('');
  const [tplSubject, setTplSubject] = useState('');
  const tplEditorRef = useRef<HTMLDivElement>(null);

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
    setSignatures(signatureService.getAll());
    setRules(rulesService.getAll());
    setTemplates(templateService.getAll());
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

  // Signature handlers
  const openSigForm = (sig?: EmailSignature) => {
    if (sig) {
      setEditingSig(sig);
      setSigName(sig.name);
      setShowSigForm(true);
      setTimeout(() => {
        if (sigEditorRef.current) sigEditorRef.current.innerHTML = sig.html;
      }, 0);
    } else {
      setEditingSig(null);
      setSigName('');
      setShowSigForm(true);
      setTimeout(() => {
        if (sigEditorRef.current) sigEditorRef.current.innerHTML = '';
      }, 0);
    }
  };

  const closeSigForm = () => {
    setShowSigForm(false);
    setEditingSig(null);
    setSigName('');
  };

  const handleSaveSig = () => {
    const html = sigEditorRef.current?.innerHTML || '';
    if (!sigName.trim()) return;
    if (editingSig) {
      signatureService.update(editingSig.id, sigName.trim(), html);
    } else {
      signatureService.create(sigName.trim(), html);
    }
    setSignatures(signatureService.getAll());
    closeSigForm();
  };

  const handleDeleteSig = (id: string) => {
    signatureService.remove(id);
    setSignatures(signatureService.getAll());
  };

  const handleSetDefaultSig = (id: string) => {
    signatureService.setDefault(id);
    setSignatures(signatureService.getAll());
  };

  // Rule handlers
  const openRuleForm = (rule?: EmailRule) => {
    if (rule) {
      setEditingRule(rule);
      setRuleName(rule.name);
      setRuleMatchAll(rule.matchAll);
      setRuleConditions([...rule.conditions]);
      setRuleActions([...rule.actions]);
    } else {
      setEditingRule(null);
      setRuleName('');
      setRuleMatchAll(true);
      setRuleConditions([{ field: 'from', operator: 'contains', value: '' }]);
      setRuleActions([{ type: 'markAsRead' }]);
    }
    setShowRuleForm(true);
  };

  const closeRuleForm = () => {
    setShowRuleForm(false);
    setEditingRule(null);
  };

  const handleSaveRule = () => {
    if (!ruleName.trim() || ruleConditions.length === 0) return;
    if (editingRule) {
      rulesService.update(editingRule.id, { name: ruleName.trim(), matchAll: ruleMatchAll, conditions: ruleConditions, actions: ruleActions });
    } else {
      rulesService.create({ name: ruleName.trim(), enabled: true, matchAll: ruleMatchAll, conditions: ruleConditions, actions: ruleActions });
    }
    setRules(rulesService.getAll());
    closeRuleForm();
  };

  const handleDeleteRule = (id: string) => {
    rulesService.remove(id);
    setRules(rulesService.getAll());
  };

  const handleToggleRule = (id: string) => {
    rulesService.toggleEnabled(id);
    setRules(rulesService.getAll());
  };

  const updateCondition = (index: number, updates: Partial<RuleCondition>) => {
    setRuleConditions((prev) => prev.map((c, i) => (i === index ? { ...c, ...updates } : c)));
  };

  const addCondition = () => {
    setRuleConditions((prev) => [...prev, { field: 'from' as RuleConditionField, operator: 'contains' as RuleConditionOp, value: '' }]);
  };

  const removeCondition = (index: number) => {
    setRuleConditions((prev) => prev.filter((_, i) => i !== index));
  };

  const updateAction = (index: number, updates: Partial<RuleAction>) => {
    setRuleActions((prev) => prev.map((a, i) => (i === index ? { ...a, ...updates } : a)));
  };

  const addAction = () => {
    setRuleActions((prev) => [...prev, { type: 'markAsRead' as RuleActionType }]);
  };

  const removeAction = (index: number) => {
    setRuleActions((prev) => prev.filter((_, i) => i !== index));
  };

  // Template handlers
  const openTplForm = (tpl?: EmailTemplate) => {
    if (tpl) {
      setEditingTpl(tpl);
      setTplName(tpl.name);
      setTplSubject(tpl.subject);
      setShowTplForm(true);
      setTimeout(() => { if (tplEditorRef.current) tplEditorRef.current.innerHTML = tpl.bodyHtml; }, 0);
    } else {
      setEditingTpl(null);
      setTplName('');
      setTplSubject('');
      setShowTplForm(true);
      setTimeout(() => { if (tplEditorRef.current) tplEditorRef.current.innerHTML = ''; }, 0);
    }
  };

  const closeTplForm = () => {
    setShowTplForm(false);
    setEditingTpl(null);
  };

  const handleSaveTpl = () => {
    const html = tplEditorRef.current?.innerHTML || '';
    if (!tplName.trim()) return;
    if (editingTpl) {
      templateService.update(editingTpl.id, tplName.trim(), tplSubject.trim(), html);
    } else {
      templateService.create(tplName.trim(), tplSubject.trim(), html);
    }
    setTemplates(templateService.getAll());
    closeTplForm();
  };

  const handleDeleteTpl = (id: string) => {
    templateService.remove(id);
    setTemplates(templateService.getAll());
  };

  const tabs: { id: SettingsTab; icon: string; label: string }[] = [
    { id: 'accounts', icon: 'account_circle', label: 'Accounts' },
    { id: 'signatures', icon: 'draw', label: 'Signatures' },
    { id: 'rules', icon: 'filter_alt', label: 'Rules' },
    { id: 'templates', icon: 'quick_reply', label: 'Templates' },
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

  const renderSignatures = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">Email Signatures</h2>
      <p className="settings-page__section-desc">
        Create and manage email signatures. The default signature is automatically inserted into new messages.
      </p>

      {signatures.length === 0 && !showSigForm ? (
        <div className="settings-page__empty">
          <span className="material-symbols-outlined">draw</span>
          <span className="settings-page__empty-text">No signatures created yet</span>
          <button className="settings-page__btn settings-page__btn--primary" onClick={() => openSigForm()}>
            Create Signature
          </button>
        </div>
      ) : (
        <>
          <div className="settings-page__accounts">
            {signatures.map((sig) => (
              <div key={sig.id} className="settings-page__account-card">
                <div className="settings-page__account-icon" style={{ background: sig.isDefault ? 'var(--gold-primary)' : 'var(--bg-hover)' }}>
                  <span className="material-symbols-outlined" style={{ color: sig.isDefault ? 'var(--text-inverse)' : 'var(--text-secondary)' }}>
                    {sig.isDefault ? 'star' : 'draw'}
                  </span>
                </div>
                <div className="settings-page__account-info">
                  <div className="settings-page__account-email">{sig.name}</div>
                  <div className="settings-page__account-provider">
                    {sig.isDefault ? 'Default signature' : 'Click star to set as default'}
                  </div>
                </div>
                <div className="settings-page__account-actions">
                  {!sig.isDefault && (
                    <button
                      className="settings-page__icon-btn"
                      title="Set as default"
                      onClick={() => handleSetDefaultSig(sig.id)}
                    >
                      <span className="material-symbols-outlined">star_outline</span>
                    </button>
                  )}
                  <button
                    className="settings-page__icon-btn"
                    title="Edit signature"
                    onClick={() => openSigForm(sig)}
                  >
                    <span className="material-symbols-outlined">edit</span>
                  </button>
                  <button
                    className="settings-page__icon-btn settings-page__icon-btn--danger"
                    title="Delete signature"
                    onClick={() => handleDeleteSig(sig.id)}
                  >
                    <span className="material-symbols-outlined">delete</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="settings-page__add-account">
        {!showSigForm ? (
          <button className="settings-page__add-btn" onClick={() => openSigForm()}>
            <span className="material-symbols-outlined">add</span>
            Create new signature
          </button>
        ) : (
          <div className="settings-page__form">
            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Signature Name</label>
              <input
                type="text"
                className="settings-page__form-input"
                placeholder="e.g. Work, Personal"
                value={sigName}
                onChange={(e) => setSigName(e.target.value)}
              />
            </div>

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Signature Content</label>
              <div className="settings-page__sig-toolbar">
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('bold'); sigEditorRef.current?.focus(); }} title="Bold">
                  <span className="material-symbols-outlined">format_bold</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('italic'); sigEditorRef.current?.focus(); }} title="Italic">
                  <span className="material-symbols-outlined">format_italic</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('underline'); sigEditorRef.current?.focus(); }} title="Underline">
                  <span className="material-symbols-outlined">format_underlined</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { const url = window.prompt('Enter URL:'); if (url) document.execCommand('createLink', false, url.startsWith('http') ? url : `https://${url}`); sigEditorRef.current?.focus(); }} title="Insert link">
                  <span className="material-symbols-outlined">link</span>
                </button>
              </div>
              <div
                ref={sigEditorRef}
                className="settings-page__sig-editor"
                contentEditable
                data-placeholder="Type your signature here..."
                suppressContentEditableWarning
              />
            </div>

            <div className="settings-page__form-actions">
              <button
                className="settings-page__btn settings-page__btn--primary"
                disabled={!sigName.trim()}
                onClick={handleSaveSig}
              >
                {editingSig ? 'Update Signature' : 'Save Signature'}
              </button>
              <button className="settings-page__btn settings-page__btn--secondary" onClick={closeSigForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderRules = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">Email Rules</h2>
      <p className="settings-page__section-desc">
        Create rules to automatically organize incoming emails based on conditions.
      </p>

      {rules.length === 0 && !showRuleForm ? (
        <div className="settings-page__empty">
          <span className="material-symbols-outlined">filter_alt</span>
          <span className="settings-page__empty-text">No rules created yet</span>
          <button className="settings-page__btn settings-page__btn--primary" onClick={() => openRuleForm()}>
            Create Rule
          </button>
        </div>
      ) : (
        <div className="settings-page__accounts">
          {rules.map((rule) => (
            <div key={rule.id} className="settings-page__account-card">
              <div className="settings-page__account-icon" style={{ background: rule.enabled ? 'var(--accent-blue)' : 'var(--bg-hover)' }}>
                <span className="material-symbols-outlined" style={{ color: rule.enabled ? '#fff' : 'var(--text-secondary)' }}>filter_alt</span>
              </div>
              <div className="settings-page__account-info">
                <div className="settings-page__account-email">{rule.name}</div>
                <div className="settings-page__account-provider">
                  {rule.conditions.length} condition{rule.conditions.length !== 1 ? 's' : ''}, {rule.actions.length} action{rule.actions.length !== 1 ? 's' : ''}
                  {' '}&middot; {rule.enabled ? 'Active' : 'Disabled'}
                </div>
              </div>
              <div className="settings-page__account-actions">
                <label className="settings-page__toggle" style={{ marginRight: 4 }}>
                  <input type="checkbox" checked={rule.enabled} onChange={() => handleToggleRule(rule.id)} />
                  <span className="settings-page__toggle-slider" />
                </label>
                <button className="settings-page__icon-btn" title="Edit rule" onClick={() => openRuleForm(rule)}>
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button className="settings-page__icon-btn settings-page__icon-btn--danger" title="Delete rule" onClick={() => handleDeleteRule(rule.id)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="settings-page__add-account">
        {!showRuleForm ? (
          <button className="settings-page__add-btn" onClick={() => openRuleForm()}>
            <span className="material-symbols-outlined">add</span>
            Create new rule
          </button>
        ) : (
          <div className="settings-page__form">
            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Rule Name</label>
              <input
                type="text"
                className="settings-page__form-input"
                placeholder="e.g. Move newsletters to folder"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
              />
            </div>

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">
                Match {' '}
                <select
                  className="settings-page__select"
                  value={ruleMatchAll ? 'all' : 'any'}
                  onChange={(e) => setRuleMatchAll(e.target.value === 'all')}
                  style={{ display: 'inline', width: 'auto' }}
                >
                  <option value="all">all</option>
                  <option value="any">any</option>
                </select>
                {' '} of the following conditions:
              </label>
              {ruleConditions.map((cond, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <select className="settings-page__select" value={cond.field} onChange={(e) => updateCondition(idx, { field: e.target.value as RuleConditionField })}>
                    <option value="from">From</option>
                    <option value="to">To</option>
                    <option value="subject">Subject</option>
                    <option value="hasAttachment">Has Attachment</option>
                  </select>
                  {cond.field !== 'hasAttachment' && (
                    <>
                      <select className="settings-page__select" value={cond.operator} onChange={(e) => updateCondition(idx, { operator: e.target.value as RuleConditionOp })}>
                        <option value="contains">contains</option>
                        <option value="equals">equals</option>
                        <option value="startsWith">starts with</option>
                        <option value="endsWith">ends with</option>
                      </select>
                      <input
                        type="text"
                        className="settings-page__form-input"
                        placeholder="Value"
                        value={cond.value}
                        onChange={(e) => updateCondition(idx, { value: e.target.value })}
                        style={{ flex: 1 }}
                      />
                    </>
                  )}
                  {ruleConditions.length > 1 && (
                    <button className="settings-page__icon-btn settings-page__icon-btn--danger" onClick={() => removeCondition(idx)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              ))}
              <button className="settings-page__add-btn" onClick={addCondition} style={{ marginTop: 4 }}>
                <span className="material-symbols-outlined">add</span> Add condition
              </button>
            </div>

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Actions:</label>
              {ruleActions.map((action, idx) => (
                <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}>
                  <select className="settings-page__select" value={action.type} onChange={(e) => updateAction(idx, { type: e.target.value as RuleActionType })}>
                    <option value="markAsRead">Mark as Read</option>
                    <option value="flag">Flag message</option>
                    <option value="delete">Delete message</option>
                    <option value="moveToFolder">Move to folder</option>
                  </select>
                  {action.type === 'moveToFolder' && (
                    <input
                      type="text"
                      className="settings-page__form-input"
                      placeholder="Folder ID"
                      value={action.folderId || ''}
                      onChange={(e) => updateAction(idx, { folderId: e.target.value })}
                      style={{ flex: 1 }}
                    />
                  )}
                  {ruleActions.length > 1 && (
                    <button className="settings-page__icon-btn settings-page__icon-btn--danger" onClick={() => removeAction(idx)}>
                      <span className="material-symbols-outlined">close</span>
                    </button>
                  )}
                </div>
              ))}
              <button className="settings-page__add-btn" onClick={addAction} style={{ marginTop: 4 }}>
                <span className="material-symbols-outlined">add</span> Add action
              </button>
            </div>

            <div className="settings-page__form-actions">
              <button
                className="settings-page__btn settings-page__btn--primary"
                disabled={!ruleName.trim() || ruleConditions.some((c) => c.field !== 'hasAttachment' && !c.value.trim())}
                onClick={handleSaveRule}
              >
                {editingRule ? 'Update Rule' : 'Save Rule'}
              </button>
              <button className="settings-page__btn settings-page__btn--secondary" onClick={closeRuleForm}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  const renderTemplates = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">Email Templates</h2>
      <p className="settings-page__section-desc">
        Create reusable templates for quick replies and common messages. Use them when composing emails.
      </p>

      {templates.length === 0 && !showTplForm ? (
        <div className="settings-page__empty">
          <span className="material-symbols-outlined">quick_reply</span>
          <span className="settings-page__empty-text">No templates created yet</span>
          <button className="settings-page__btn settings-page__btn--primary" onClick={() => openTplForm()}>
            Create Template
          </button>
        </div>
      ) : (
        <div className="settings-page__accounts">
          {templates.map((tpl) => (
            <div key={tpl.id} className="settings-page__account-card">
              <div className="settings-page__account-icon" style={{ background: 'var(--gold-primary)' }}>
                <span className="material-symbols-outlined" style={{ color: 'var(--text-inverse)' }}>quick_reply</span>
              </div>
              <div className="settings-page__account-info">
                <div className="settings-page__account-email">{tpl.name}</div>
                <div className="settings-page__account-provider">
                  {tpl.subject ? `Subject: ${tpl.subject}` : 'No subject'}
                </div>
              </div>
              <div className="settings-page__account-actions">
                <button className="settings-page__icon-btn" title="Edit template" onClick={() => openTplForm(tpl)}>
                  <span className="material-symbols-outlined">edit</span>
                </button>
                <button className="settings-page__icon-btn settings-page__icon-btn--danger" title="Delete template" onClick={() => handleDeleteTpl(tpl.id)}>
                  <span className="material-symbols-outlined">delete</span>
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="settings-page__add-account">
        {!showTplForm ? (
          <button className="settings-page__add-btn" onClick={() => openTplForm()}>
            <span className="material-symbols-outlined">add</span>
            Create new template
          </button>
        ) : (
          <div className="settings-page__form">
            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Template Name</label>
              <input
                type="text"
                className="settings-page__form-input"
                placeholder="e.g. Meeting Follow-up, Thank You"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
              />
            </div>

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Subject Line (optional)</label>
              <input
                type="text"
                className="settings-page__form-input"
                placeholder="e.g. Following up on our meeting"
                value={tplSubject}
                onChange={(e) => setTplSubject(e.target.value)}
              />
            </div>

            <div className="settings-page__form-row">
              <label className="settings-page__form-label">Template Body</label>
              <div className="settings-page__sig-toolbar">
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('bold'); tplEditorRef.current?.focus(); }} title="Bold">
                  <span className="material-symbols-outlined">format_bold</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('italic'); tplEditorRef.current?.focus(); }} title="Italic">
                  <span className="material-symbols-outlined">format_italic</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { document.execCommand('underline'); tplEditorRef.current?.focus(); }} title="Underline">
                  <span className="material-symbols-outlined">format_underlined</span>
                </button>
                <button className="compose-mail__format-btn" onClick={() => { const url = window.prompt('Enter URL:'); if (url) document.execCommand('createLink', false, url.startsWith('http') ? url : `https://${url}`); tplEditorRef.current?.focus(); }} title="Insert link">
                  <span className="material-symbols-outlined">link</span>
                </button>
              </div>
              <div
                ref={tplEditorRef}
                className="settings-page__sig-editor"
                contentEditable
                data-placeholder="Type your template content here..."
                suppressContentEditableWarning
              />
            </div>

            <div className="settings-page__form-actions">
              <button
                className="settings-page__btn settings-page__btn--primary"
                disabled={!tplName.trim()}
                onClick={handleSaveTpl}
              >
                {editingTpl ? 'Update Template' : 'Save Template'}
              </button>
              <button className="settings-page__btn settings-page__btn--secondary" onClick={closeTplForm}>
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

  const handleNotificationToggle = async (checked: boolean) => {
    if (checked && notificationService.getPermission() !== 'granted') {
      const perm = await notificationService.requestPermission();
      if (perm !== 'granted') {
        setNotificationsEnabled(false);
        notificationService.setEnabled(false);
        return;
      }
    }
    setNotificationsEnabled(checked);
    notificationService.setEnabled(checked);
  };

  const renderGeneral = () => (
    <div className="settings-page__section">
      <h2 className="settings-page__section-title">General</h2>
      <p className="settings-page__section-desc">
        General application preferences.
      </p>

      <div className="settings-page__option">
        <div className="settings-page__option-info">
          <span className="settings-page__option-label">Desktop notifications</span>
          <span className="settings-page__option-desc">
            Show desktop notifications when new emails arrive
            {notificationService.isSupported() && notificationService.getPermission() === 'denied' && (
              <> — notifications are blocked in your browser settings</>
            )}
          </span>
        </div>
        <label className="settings-page__toggle">
          <input
            type="checkbox"
            checked={notificationsEnabled}
            onChange={(e) => handleNotificationToggle(e.target.checked)}
            disabled={!notificationService.isSupported() || notificationService.getPermission() === 'denied'}
          />
          <span className="settings-page__toggle-slider" />
        </label>
      </div>

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
      case 'signatures':
        return renderSignatures();
      case 'rules':
        return renderRules();
      case 'templates':
        return renderTemplates();
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
