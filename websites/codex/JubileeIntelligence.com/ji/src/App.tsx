import { useState, useEffect } from 'react';

// Dark theme colors
const colors = {
  bg: '#0f172a',
  card: '#1e293b',
  cardHover: '#334155',
  border: '#eab308',
  borderMuted: '#854d0e',
  text: '#f8fafc',
  textMuted: '#94a3b8',
  accent: '#eab308',
  accentHover: '#facc15',
  success: '#22c55e',
  danger: '#ef4444',
  info: '#3b82f6'
};

// Entry type
interface Entry {
  id: string;
  title: string;
  domain: string;
  persona: string | null;
  status: 'draft' | 'review' | 'approved' | 'active' | 'deprecated';
  guardrailLevel: 'low' | 'medium' | 'high';
  content: string;
  tags: string[];
  createdAt: string;
  updatedAt: string;
}

// Initial sample data
const initialEntries: Entry[] = [
  { id: '1', title: 'Welcome Message', domain: 'Personas', persona: 'Jubilee', status: 'active', guardrailLevel: 'low', content: 'Welcome to Jubilee Intelligence! I am here to help you on your spiritual journey.', tags: ['greeting', 'welcome'], createdAt: '2024-01-15T10:00:00Z', updatedAt: '2024-01-15T10:00:00Z' },
  { id: '2', title: 'Prayer Response', domain: 'Personas', persona: 'Inspire', status: 'approved', guardrailLevel: 'medium', content: 'I would be honored to pray with you. Let us bring your concerns before the Lord together.', tags: ['prayer', 'spiritual'], createdAt: '2024-01-14T09:00:00Z', updatedAt: '2024-01-14T09:00:00Z' },
  { id: '3', title: 'Scripture Reference', domain: 'Scripture', persona: null, status: 'review', guardrailLevel: 'low', content: 'For I know the plans I have for you, declares the Lord, plans to prosper you and not to harm you. - Jeremiah 29:11', tags: ['scripture', 'hope'], createdAt: '2024-01-13T08:00:00Z', updatedAt: '2024-01-13T08:00:00Z' },
  { id: '4', title: 'Community Guidelines', domain: 'Communities', persona: null, status: 'draft', guardrailLevel: 'high', content: 'Our community is built on love, respect, and mutual encouragement. Please treat all members with kindness.', tags: ['guidelines', 'community'], createdAt: '2024-01-12T07:00:00Z', updatedAt: '2024-01-12T07:00:00Z' },
  { id: '5', title: 'User Greeting', domain: 'Personas', persona: 'Melody', status: 'active', guardrailLevel: 'low', content: 'Hello there! I am Melody, and I am here to bring joy and encouragement to your day through worship and song.', tags: ['greeting', 'worship'], createdAt: '2024-01-11T06:00:00Z', updatedAt: '2024-01-11T06:00:00Z' },
];

const navItems = [
  { id: 'domains', label: 'Domains', icon: '📁' },
  { id: 'entries', label: 'All Entries', icon: '📄' },
  { id: 'workflow', label: 'Workflow', icon: '▶️' },
  { id: 'qdrant', label: 'Qdrant', icon: '🔍' },
  { id: 'settings', label: 'Settings', icon: '⚙️' },
];

const domains = ['Personas', 'Abilities', 'Ministries', 'Models', 'Guardrails', 'Languages', 'Scripture', 'Campaigns', 'Communities', 'Objects', 'Users', 'System'];
const statuses = ['draft', 'review', 'approved', 'active', 'deprecated'];
const guardrailLevels = ['low', 'medium', 'high'];

function App() {
  const [activeTab, setActiveTab] = useState('entries');
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [entries, setEntries] = useState<Entry[]>(initialEntries);
  const [selectedEntry, setSelectedEntry] = useState<Entry | null>(null);
  const [editPanelOpen, setEditPanelOpen] = useState(false);
  const [editForm, setEditForm] = useState<Entry | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return colors.success;
      case 'approved': return colors.info;
      case 'review': return colors.accent;
      case 'draft': return colors.textMuted;
      case 'deprecated': return colors.danger;
      default: return colors.textMuted;
    }
  };

  const getGuardrailColor = (level: string) => {
    switch (level) {
      case 'low': return colors.success;
      case 'medium': return colors.accent;
      case 'high': return colors.danger;
      default: return colors.textMuted;
    }
  };

  const handleDoubleClick = (entry: Entry) => {
    setSelectedEntry(entry);
    setEditForm({ ...entry });
    setEditPanelOpen(true);
    setSaveStatus('idle');
  };

  const handleClosePanel = () => {
    setEditPanelOpen(false);
    setSelectedEntry(null);
    setEditForm(null);
  };

  const handleFormChange = (field: keyof Entry, value: string | string[]) => {
    if (editForm) {
      setEditForm({ ...editForm, [field]: value });
    }
  };

  const handleSave = async () => {
    if (!editForm) return;

    setSaveStatus('saving');

    try {
      const updatedEntry = {
        ...editForm,
        updatedAt: new Date().toISOString()
      };

      // Call backend API to save YAML file
      const response = await fetch('http://localhost:3001/api/entries/' + editForm.id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedEntry)
      });

      if (response.ok) {
        setEntries(entries.map(e => e.id === editForm.id ? updatedEntry : e));
        setSelectedEntry(updatedEntry);
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } else {
        throw new Error('Failed to save');
      }
    } catch (error) {
      // For now, save locally if backend is not available
      const updatedEntry = {
        ...editForm,
        updatedAt: new Date().toISOString()
      };
      setEntries(entries.map(e => e.id === editForm.id ? updatedEntry : e));
      setSelectedEntry(updatedEntry);
      setSaveStatus('saved');
      setTimeout(() => setSaveStatus('idle'), 2000);
    }
  };

  const handleDelete = async () => {
    if (!editForm || !confirm('Are you sure you want to delete this entry?')) return;

    try {
      await fetch('http://localhost:3001/api/entries/' + editForm.id, {
        method: 'DELETE'
      });
    } catch (error) {
      // Continue even if backend fails
    }

    setEntries(entries.filter(e => e.id !== editForm.id));
    handleClosePanel();
  };

  const handleCreateNew = () => {
    const newEntry: Entry = {
      id: Date.now().toString(),
      title: 'New Entry',
      domain: 'Personas',
      persona: null,
      status: 'draft',
      guardrailLevel: 'medium',
      content: '',
      tags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    setEntries([newEntry, ...entries]);
    handleDoubleClick(newEntry);
  };

  const inputStyle = {
    width: '100%',
    padding: '0.625rem 0.75rem',
    borderRadius: '8px',
    border: `1px solid ${colors.borderMuted}`,
    backgroundColor: colors.bg,
    color: colors.text,
    fontSize: '0.875rem',
    outline: 'none'
  };

  const labelStyle = {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 600,
    color: colors.textMuted,
    marginBottom: '0.375rem',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em'
  };

  return (
    <div style={{
      minHeight: '100vh',
      backgroundColor: colors.bg,
      color: colors.text,
      fontFamily: "'Inter', system-ui, sans-serif"
    }}>
      {/* Header */}
      <header style={{
        height: '64px',
        backgroundColor: colors.card,
        borderBottom: `1px solid ${colors.borderMuted}`,
        display: 'flex',
        alignItems: 'center',
        padding: '0 1.5rem',
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 40
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: `linear-gradient(135deg, ${colors.accent}, #f59e0b)`,
            borderRadius: '8px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontWeight: 'bold',
            fontSize: '1.25rem'
          }}>
            J
          </div>
          <span style={{ fontWeight: 600, fontSize: '1.25rem', color: colors.accent }}>
            Jubilee Intelligence
          </span>
        </div>

        <div style={{ flex: 1, maxWidth: '500px', margin: '0 2rem' }}>
          <input
            type="text"
            placeholder="Search entries, domains, personas..."
            style={{
              width: '100%',
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${colors.borderMuted}`,
              backgroundColor: colors.bg,
              color: colors.text,
              fontSize: '0.875rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ color: colors.textMuted, fontSize: '0.875rem' }}>v8.00.101</span>
        </div>
      </header>

      {/* Sidebar */}
      <aside style={{
        position: 'fixed',
        left: 0,
        top: '64px',
        bottom: 0,
        width: sidebarOpen ? '240px' : '64px',
        backgroundColor: colors.card,
        borderRight: `1px solid ${colors.borderMuted}`,
        transition: 'width 0.3s ease',
        zIndex: 30,
        padding: '1rem 0.5rem'
      }}>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.75rem',
                padding: '0.75rem 1rem',
                borderRadius: '8px',
                border: 'none',
                backgroundColor: activeTab === item.id ? colors.borderMuted : 'transparent',
                color: activeTab === item.id ? colors.accent : colors.textMuted,
                cursor: 'pointer',
                fontSize: '0.875rem',
                fontWeight: 500,
                textAlign: 'left',
                transition: 'all 0.15s ease'
              }}
            >
              <span>{item.icon}</span>
              {sidebarOpen && <span>{item.label}</span>}
            </button>
          ))}
        </nav>

        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          style={{
            position: 'absolute',
            right: '-12px',
            top: '24px',
            width: '24px',
            height: '24px',
            borderRadius: '50%',
            border: `1px solid ${colors.borderMuted}`,
            backgroundColor: colors.card,
            color: colors.textMuted,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '0.75rem'
          }}
        >
          {sidebarOpen ? '◀' : '▶'}
        </button>
      </aside>

      {/* Main Content */}
      <main style={{
        marginLeft: sidebarOpen ? '240px' : '64px',
        marginRight: editPanelOpen ? '420px' : '0',
        marginTop: '64px',
        padding: '1.5rem',
        transition: 'all 0.3s ease'
      }}>
        {/* Page Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '1.5rem'
        }}>
          <div>
            <h1 style={{ fontSize: '1.5rem', fontWeight: 600, margin: 0, color: colors.text }}>
              {navItems.find(n => n.id === activeTab)?.label || 'Dashboard'}
            </h1>
            <p style={{ color: colors.textMuted, margin: '0.25rem 0 0', fontSize: '0.875rem' }}>
              {entries.length} entries • Double-click to edit
            </p>
          </div>
          <button
            onClick={handleCreateNew}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '8px',
              border: `2px solid ${colors.accent}`,
              backgroundColor: colors.accent,
              color: colors.bg,
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}
          >
            + New Entry
          </button>
        </div>

        {/* Entries Table */}
        <div style={{
          backgroundColor: colors.card,
          borderRadius: '12px',
          border: `1px solid ${colors.borderMuted}`,
          overflow: 'hidden'
        }}>
          {/* Table Header */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
            padding: '0.75rem 1rem',
            backgroundColor: colors.bg,
            borderBottom: `1px solid ${colors.borderMuted}`,
            fontSize: '0.75rem',
            fontWeight: 600,
            textTransform: 'uppercase',
            color: colors.textMuted,
            letterSpacing: '0.05em'
          }}>
            <div>Title</div>
            <div>Domain</div>
            <div>Persona</div>
            <div>Status</div>
            <div>Guardrail</div>
          </div>

          {/* Table Body */}
          {entries.map((entry) => (
            <div
              key={entry.id}
              onDoubleClick={() => handleDoubleClick(entry)}
              style={{
                display: 'grid',
                gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr',
                padding: '1rem',
                borderBottom: `1px solid ${colors.borderMuted}`,
                cursor: 'pointer',
                backgroundColor: selectedEntry?.id === entry.id ? colors.borderMuted : 'transparent',
                transition: 'background-color 0.15s ease'
              }}
            >
              <div style={{ fontWeight: 500 }}>{entry.title}</div>
              <div style={{ color: colors.textMuted }}>{entry.domain}</div>
              <div style={{ color: colors.textMuted }}>{entry.persona || '-'}</div>
              <div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: `${getStatusColor(entry.status)}20`,
                  color: getStatusColor(entry.status),
                  border: `1px solid ${getStatusColor(entry.status)}40`
                }}>
                  {entry.status}
                </span>
              </div>
              <div>
                <span style={{
                  padding: '0.25rem 0.75rem',
                  borderRadius: '9999px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: `${getGuardrailColor(entry.guardrailLevel)}20`,
                  color: getGuardrailColor(entry.guardrailLevel),
                  border: `1px solid ${getGuardrailColor(entry.guardrailLevel)}40`
                }}>
                  {entry.guardrailLevel}
                </span>
              </div>
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: '1rem',
          marginTop: '1.5rem'
        }}>
          {[
            { label: 'Total Entries', value: entries.length.toString(), color: colors.accent },
            { label: 'Active', value: entries.filter(e => e.status === 'active').length.toString(), color: colors.success },
            { label: 'In Review', value: entries.filter(e => e.status === 'review').length.toString(), color: colors.info },
            { label: 'Drafts', value: entries.filter(e => e.status === 'draft').length.toString(), color: colors.textMuted }
          ].map((stat) => (
            <div
              key={stat.label}
              style={{
                backgroundColor: colors.card,
                padding: '1.5rem',
                borderRadius: '12px',
                border: `1px solid ${colors.borderMuted}`
              }}
            >
              <p style={{ color: colors.textMuted, margin: 0, fontSize: '0.875rem' }}>
                {stat.label}
              </p>
              <p style={{
                fontSize: '2rem',
                fontWeight: 700,
                margin: '0.5rem 0 0',
                color: stat.color
              }}>
                {stat.value}
              </p>
            </div>
          ))}
        </div>
      </main>

      {/* Right Edit Panel */}
      <aside style={{
        position: 'fixed',
        right: editPanelOpen ? '0' : '-420px',
        top: '64px',
        bottom: 0,
        width: '420px',
        backgroundColor: colors.card,
        borderLeft: `2px solid ${colors.accent}`,
        transition: 'right 0.3s ease',
        zIndex: 35,
        display: 'flex',
        flexDirection: 'column',
        boxShadow: editPanelOpen ? '-4px 0 20px rgba(0,0,0,0.3)' : 'none'
      }}>
        {/* Panel Header */}
        <div style={{
          padding: '1rem 1.5rem',
          borderBottom: `1px solid ${colors.borderMuted}`,
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <h2 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 600, color: colors.accent }}>
            Edit Entry
          </h2>
          <button
            onClick={handleClosePanel}
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              border: `1px solid ${colors.borderMuted}`,
              backgroundColor: 'transparent',
              color: colors.textMuted,
              cursor: 'pointer',
              fontSize: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            ×
          </button>
        </div>

        {/* Panel Body */}
        {editForm && (
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '1.5rem'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Title */}
              <div>
                <label style={labelStyle}>Title</label>
                <input
                  type="text"
                  value={editForm.title}
                  onChange={(e) => handleFormChange('title', e.target.value)}
                  style={inputStyle}
                />
              </div>

              {/* Domain & Persona Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Domain</label>
                  <select
                    value={editForm.domain}
                    onChange={(e) => handleFormChange('domain', e.target.value)}
                    style={inputStyle}
                  >
                    {domains.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Persona</label>
                  <input
                    type="text"
                    value={editForm.persona || ''}
                    onChange={(e) => handleFormChange('persona', e.target.value || null as any)}
                    placeholder="Optional"
                    style={inputStyle}
                  />
                </div>
              </div>

              {/* Status & Guardrail Row */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                <div>
                  <label style={labelStyle}>Status</label>
                  <select
                    value={editForm.status}
                    onChange={(e) => handleFormChange('status', e.target.value)}
                    style={inputStyle}
                  >
                    {statuses.map(s => (
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Guardrail Level</label>
                  <select
                    value={editForm.guardrailLevel}
                    onChange={(e) => handleFormChange('guardrailLevel', e.target.value)}
                    style={inputStyle}
                  >
                    {guardrailLevels.map(g => (
                      <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Content */}
              <div>
                <label style={labelStyle}>Content</label>
                <textarea
                  value={editForm.content}
                  onChange={(e) => handleFormChange('content', e.target.value)}
                  rows={8}
                  style={{
                    ...inputStyle,
                    resize: 'vertical',
                    minHeight: '150px'
                  }}
                />
              </div>

              {/* Tags */}
              <div>
                <label style={labelStyle}>Tags (comma-separated)</label>
                <input
                  type="text"
                  value={editForm.tags.join(', ')}
                  onChange={(e) => handleFormChange('tags', e.target.value.split(',').map(t => t.trim()).filter(Boolean))}
                  placeholder="tag1, tag2, tag3"
                  style={inputStyle}
                />
              </div>

              {/* Metadata */}
              <div style={{
                padding: '1rem',
                backgroundColor: colors.bg,
                borderRadius: '8px',
                border: `1px solid ${colors.borderMuted}`
              }}>
                <p style={{ ...labelStyle, marginBottom: '0.75rem' }}>Metadata</p>
                <div style={{ fontSize: '0.8125rem', color: colors.textMuted }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>ID:</span>
                    <span style={{ fontFamily: 'monospace' }}>{editForm.id}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <span>Created:</span>
                    <span>{new Date(editForm.createdAt).toLocaleDateString()}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span>Updated:</span>
                    <span>{new Date(editForm.updatedAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Panel Footer */}
        <div style={{
          padding: '1rem 1.5rem',
          borderTop: `1px solid ${colors.borderMuted}`,
          display: 'flex',
          justifyContent: 'space-between',
          gap: '0.75rem'
        }}>
          <button
            onClick={handleDelete}
            style={{
              padding: '0.625rem 1rem',
              borderRadius: '8px',
              border: `1px solid ${colors.danger}`,
              backgroundColor: 'transparent',
              color: colors.danger,
              fontWeight: 500,
              cursor: 'pointer',
              fontSize: '0.875rem'
            }}
          >
            Delete
          </button>
          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              onClick={handleClosePanel}
              style={{
                padding: '0.625rem 1rem',
                borderRadius: '8px',
                border: `1px solid ${colors.borderMuted}`,
                backgroundColor: 'transparent',
                color: colors.textMuted,
                fontWeight: 500,
                cursor: 'pointer',
                fontSize: '0.875rem'
              }}
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saveStatus === 'saving'}
              style={{
                padding: '0.625rem 1.5rem',
                borderRadius: '8px',
                border: `2px solid ${colors.accent}`,
                backgroundColor: colors.accent,
                color: colors.bg,
                fontWeight: 600,
                cursor: saveStatus === 'saving' ? 'wait' : 'pointer',
                fontSize: '0.875rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              {saveStatus === 'saving' ? 'Saving...' : saveStatus === 'saved' ? '✓ Saved' : 'Save'}
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}

export default App;
