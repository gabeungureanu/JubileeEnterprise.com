import { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  FileText,
  Settings,
  Database,
  Play,
  History
} from 'lucide-react';
import { cn } from '../../utils/cn';
import { useUIStore } from '../../stores/uiStore';

interface NavItem {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const navItems: NavItem[] = [
  { id: 'domains', label: 'Domains', icon: <FolderTree className="w-5 h-5" /> },
  { id: 'entries', label: 'All Entries', icon: <FileText className="w-5 h-5" /> },
  { id: 'workflow', label: 'Workflow', icon: <Play className="w-5 h-5" /> },
  { id: 'history', label: 'History', icon: <History className="w-5 h-5" /> },
  { id: 'qdrant', label: 'Qdrant', icon: <Database className="w-5 h-5" /> },
  { id: 'settings', label: 'Settings', icon: <Settings className="w-5 h-5" /> }
];

export function Sidebar() {
  const { sidebarOpen, setSidebarOpen, activeTab, setActiveTab } = useUIStore();
  const [hoveredItem, setHoveredItem] = useState<string | null>(null);

  return (
    <aside
      className={cn(
        'fixed left-0 top-16 bottom-0 z-30',
        'bg-white border-r border-slate-200',
        'transition-all duration-300 ease-in-out',
        sidebarOpen ? 'w-64' : 'w-16'
      )}
    >
      {/* Toggle Button */}
      <button
        onClick={() => setSidebarOpen(!sidebarOpen)}
        className={cn(
          'absolute -right-3 top-6 z-10',
          'w-6 h-6 rounded-full bg-white border border-slate-200 shadow-sm',
          'flex items-center justify-center',
          'text-slate-400 hover:text-slate-600',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500'
        )}
      >
        {sidebarOpen ? (
          <ChevronLeft className="w-4 h-4" />
        ) : (
          <ChevronRight className="w-4 h-4" />
        )}
      </button>

      {/* Navigation */}
      <nav className="p-3 space-y-1">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveTab(item.id)}
            onMouseEnter={() => setHoveredItem(item.id)}
            onMouseLeave={() => setHoveredItem(null)}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg',
              'text-sm font-medium transition-colors duration-150',
              activeTab === item.id
                ? 'bg-indigo-50 text-indigo-700'
                : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            )}
          >
            <span className="flex-shrink-0">{item.icon}</span>
            {sidebarOpen && <span>{item.label}</span>}

            {/* Tooltip for collapsed state */}
            {!sidebarOpen && hoveredItem === item.id && (
              <div
                className={cn(
                  'absolute left-14 px-2 py-1 rounded',
                  'bg-slate-900 text-white text-xs',
                  'whitespace-nowrap'
                )}
              >
                {item.label}
              </div>
            )}
          </button>
        ))}
      </nav>

      {/* Version Info */}
      {sidebarOpen && (
        <div className="absolute bottom-4 left-4 right-4">
          <div className="px-3 py-2 rounded-lg bg-slate-50 border border-slate-200">
            <p className="text-xs text-slate-500">Version</p>
            <p className="text-sm font-medium text-slate-700">8.00.101</p>
          </div>
        </div>
      )}
    </aside>
  );
}
