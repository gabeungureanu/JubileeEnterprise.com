import { useState } from 'react';
import { Check, X, Eye, ChevronRight } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { ContentEntry } from '../../types/entry.types';
import { useWorkflowStore } from '../../stores/workflowStore';
import { truncate, formatRelativeTime } from '../../utils/formatters';

interface ReviewPanelProps {
  entries: ContentEntry[];
  onApprove?: (ids: string[]) => void;
  onReject?: (ids: string[]) => void;
  onViewEntry?: (entry: ContentEntry) => void;
}

export function ReviewPanel({
  entries,
  onApprove,
  onReject,
  onViewEntry
}: ReviewPanelProps) {
  const { reviewQueue, addToReviewQueue, removeFromReviewQueue, clearReviewQueue } =
    useWorkflowStore();
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const reviewEntries = entries.filter((e) => e.status === 'review');
  const queuedEntries = entries.filter((e) => reviewQueue.includes(e.id));

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === reviewEntries.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(reviewEntries.map((e) => e.id));
    }
  };

  const handleApprove = () => {
    if (selectedIds.length > 0) {
      onApprove?.(selectedIds);
      setSelectedIds([]);
    }
  };

  const handleReject = () => {
    if (selectedIds.length > 0) {
      onReject?.(selectedIds);
      setSelectedIds([]);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Review Queue</h2>
          <p className="text-sm text-slate-500">
            {reviewEntries.length} entries awaiting review
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={selectAll}
          >
            {selectedIds.length === reviewEntries.length ? 'Deselect All' : 'Select All'}
          </Button>
          <Button
            variant="danger"
            size="sm"
            onClick={handleReject}
            disabled={selectedIds.length === 0}
          >
            <X className="w-4 h-4 mr-1" />
            Reject ({selectedIds.length})
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleApprove}
            disabled={selectedIds.length === 0}
          >
            <Check className="w-4 h-4 mr-1" />
            Approve ({selectedIds.length})
          </Button>
        </div>
      </div>

      {/* Entry List */}
      <div className="divide-y divide-slate-100 max-h-96 overflow-y-auto custom-scrollbar">
        {reviewEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-slate-500">
            <Check className="w-12 h-12 mb-3 text-slate-300" />
            <p className="text-sm">No entries awaiting review</p>
          </div>
        ) : (
          reviewEntries.map((entry) => (
            <div
              key={entry.id}
              className={cn(
                'flex items-center gap-4 px-6 py-3 hover:bg-slate-50 transition-colors',
                selectedIds.includes(entry.id) && 'bg-indigo-50'
              )}
            >
              <input
                type="checkbox"
                checked={selectedIds.includes(entry.id)}
                onChange={() => toggleSelection(entry.id)}
                className="rounded border-slate-300"
              />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-medium text-slate-900 truncate">
                    {entry.title}
                  </h4>
                  <Badge variant="warning" size="sm">
                    {entry.status}
                  </Badge>
                </div>
                <p className="text-xs text-slate-500 truncate">
                  {entry.domain}
                  {entry.persona && ` / ${entry.persona}`}
                  {' • '}
                  {entry.updatedAt ? formatRelativeTime(entry.updatedAt) : 'Recently'}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onViewEntry?.(entry)}
                className="flex-shrink-0"
              >
                <Eye className="w-4 h-4" />
              </Button>
            </div>
          ))
        )}
      </div>

      {/* Queued for Compile */}
      {queuedEntries.length > 0 && (
        <div className="px-6 py-4 bg-emerald-50 border-t border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-medium text-emerald-800">
                Ready to Compile
              </h3>
              <p className="text-xs text-emerald-600">
                {queuedEntries.length} entries approved and ready
              </p>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearReviewQueue}
              className="text-emerald-700 hover:text-emerald-900"
            >
              Clear Queue
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
