import { Search, Settings, Bell, User } from 'lucide-react';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';

interface HeaderProps {
  onSearch?: (query: string) => void;
}

export function Header({ onSearch }: HeaderProps) {
  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-40',
        'h-16 bg-white border-b border-slate-200',
        'flex items-center px-6'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center">
          <span className="text-white font-bold text-sm">J</span>
        </div>
        <span className="font-semibold text-slate-900 text-lg">
          Jubilee Intelligence
        </span>
      </div>

      {/* Search */}
      <div className="flex-1 max-w-xl mx-8">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search entries, domains, personas..."
            className={cn(
              'w-full pl-10 pr-4 py-2 rounded-lg',
              'bg-slate-100 border border-transparent',
              'text-sm text-slate-900 placeholder:text-slate-400',
              'focus:outline-none focus:bg-white focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20',
              'transition-all duration-200'
            )}
            onChange={(e) => onSearch?.(e.target.value)}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" className="p-2">
          <Bell className="w-5 h-5" />
        </Button>
        <Button variant="ghost" size="sm" className="p-2">
          <Settings className="w-5 h-5" />
        </Button>
        <div className="w-px h-6 bg-slate-200 mx-2" />
        <Button variant="ghost" size="sm" className="p-2">
          <User className="w-5 h-5" />
        </Button>
      </div>
    </header>
  );
}
