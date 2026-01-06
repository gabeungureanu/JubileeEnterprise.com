import { Edit, Eye, MoreHorizontal, Clock } from 'lucide-react';
import { ContentEntry } from '../../types/entry.types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { formatRelativeTime, truncate, getStatusColor, getGuardrailColor } from '../../utils/formatters';

interface EntryCardProps {
  entry: ContentEntry;
  onEdit?: (entry: ContentEntry) => void;
  onView?: (entry: ContentEntry) => void;
  selected?: boolean;
  onClick?: () => void;
}

export function EntryCard({ entry, onEdit, onView, selected, onClick }: EntryCardProps) {
  const statusColor = getStatusColor(entry.status);
  const guardrailColor = getGuardrailColor(entry.guardrailLevel);

  return (
    <div
      onClick={onClick}
      className={cn(
        'bg-white rounded-lg border p-4 cursor-pointer',
        'transition-all duration-200',
        selected
          ? 'border-indigo-500 ring-2 ring-indigo-500/20'
          : 'border-slate-200 hover:border-slate-300 hover:shadow-sm'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <h3 className="font-medium text-slate-900 line-clamp-1">
          {entry.title}
        </h3>
        <div className="flex items-center gap-1 flex-shrink-0">
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onView?.(entry);
            }}
            className="p-1"
          >
            <Eye className="w-4 h-4" />
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={(e) => {
              e.stopPropagation();
              onEdit?.(entry);
            }}
            className="p-1"
          >
            <Edit className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Content Preview */}
      <p className="text-sm text-slate-500 line-clamp-2 mb-3">
        {truncate(entry.content, 120)}
      </p>

      {/* Badges */}
      <div className="flex items-center gap-2 mb-3">
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', statusColor)}>
          {entry.status}
        </span>
        <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', guardrailColor)}>
          {entry.guardrailLevel}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-slate-400">
        <div className="flex items-center gap-1">
          <span className="font-medium text-slate-600">{entry.domain}</span>
          {entry.persona && (
            <>
              <span>/</span>
              <span>{entry.persona}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Clock className="w-3 h-3" />
          <span>{entry.updatedAt ? formatRelativeTime(entry.updatedAt) : 'N/A'}</span>
        </div>
      </div>

      {/* Tags */}
      {entry.tags && entry.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2 pt-2 border-t border-slate-100">
          {entry.tags.slice(0, 3).map((tag) => (
            <Badge key={tag} variant="default" size="sm">
              {tag}
            </Badge>
          ))}
          {entry.tags.length > 3 && (
            <Badge variant="default" size="sm">
              +{entry.tags.length - 3}
            </Badge>
          )}
        </div>
      )}
    </div>
  );
}
