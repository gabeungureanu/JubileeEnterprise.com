import { X, Save, Trash2, History } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { useEffect } from 'react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { useUIStore } from '../../stores/uiStore';
import { useSelectionStore } from '../../stores/selectionStore';
import { ContentEntry, EntryFormData } from '../../types/entry.types';
import { formatRelativeTime } from '../../utils/formatters';

interface EditPanelProps {
  entry?: ContentEntry | null;
  onSave?: (data: EntryFormData) => void;
  onDelete?: (id: string) => void;
  loading?: boolean;
}

const statusOptions = [
  { value: 'draft', label: 'Draft' },
  { value: 'review', label: 'Review' },
  { value: 'approved', label: 'Approved' },
  { value: 'active', label: 'Active' },
  { value: 'deprecated', label: 'Deprecated' }
];

const guardrailOptions = [
  { value: 'low', label: 'Low' },
  { value: 'medium', label: 'Medium' },
  { value: 'high', label: 'High' }
];

export function EditPanel({ entry, onSave, onDelete, loading }: EditPanelProps) {
  const { editPanelOpen, setEditPanelOpen } = useUIStore();
  const { clearSelectedEntry } = useSelectionStore();

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty }
  } = useForm<EntryFormData>();

  useEffect(() => {
    if (entry) {
      reset({
        domain: entry.domain,
        persona: entry.persona || '',
        title: entry.title,
        content: entry.content,
        guardrailLevel: entry.guardrailLevel,
        status: entry.status,
        tags: entry.tags
      });
    }
  }, [entry, reset]);

  const handleClose = () => {
    setEditPanelOpen(false);
    clearSelectedEntry();
  };

  const onSubmit = (data: EntryFormData) => {
    onSave?.(data);
  };

  if (!editPanelOpen || !entry) return null;

  return (
    <aside
      className={cn(
        'fixed right-0 top-16 bottom-0 z-30',
        'w-[420px] bg-white border-l border-slate-200',
        'flex flex-col',
        'animate-in slide-in-from-right duration-300'
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <h2 className="font-semibold text-slate-900">Edit Entry</h2>
          {isDirty && (
            <Badge variant="warning" size="sm">
              Unsaved
            </Badge>
          )}
        </div>
        <button
          onClick={handleClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Form */}
      <form
        onSubmit={handleSubmit(onSubmit)}
        className="flex-1 overflow-y-auto custom-scrollbar p-4 space-y-4"
      >
        <Input
          label="Title"
          {...register('title', { required: 'Title is required' })}
          error={errors.title?.message}
        />

        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Domain"
            {...register('domain')}
            disabled
          />
          <Input
            label="Persona"
            {...register('persona')}
            disabled
          />
        </div>

        <Textarea
          label="Content"
          {...register('content', { required: 'Content is required' })}
          error={errors.content?.message}
          rows={8}
        />

        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Status"
            options={statusOptions}
            {...register('status')}
          />
          <Select
            label="Guardrail Level"
            options={guardrailOptions}
            {...register('guardrailLevel')}
          />
        </div>

        <Input
          label="Tags"
          {...register('tags')}
          helperText="Comma-separated tags"
        />

        {/* Metadata */}
        <div className="pt-4 border-t border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-2">Metadata</h3>
          <div className="space-y-2 text-sm text-slate-500">
            <div className="flex justify-between">
              <span>Created</span>
              <span>{entry.createdAt ? formatRelativeTime(entry.createdAt) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Updated</span>
              <span>{entry.updatedAt ? formatRelativeTime(entry.updatedAt) : 'N/A'}</span>
            </div>
            <div className="flex justify-between">
              <span>Version</span>
              <span>v{entry.majorVersion}.{entry.minorVersion}</span>
            </div>
            <div className="flex justify-between">
              <span>ID</span>
              <span className="font-mono text-xs">{entry.id.slice(0, 8)}...</span>
            </div>
          </div>
        </div>
      </form>

      {/* Actions */}
      <div className="flex items-center gap-2 px-4 py-3 border-t border-slate-200 bg-slate-50">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => {}}
          className="gap-1"
        >
          <History className="w-4 h-4" />
          History
        </Button>
        <div className="flex-1" />
        <Button
          type="button"
          variant="danger"
          size="sm"
          onClick={() => entry && onDelete?.(entry.id)}
          className="gap-1"
        >
          <Trash2 className="w-4 h-4" />
          Delete
        </Button>
        <Button
          type="submit"
          variant="primary"
          size="sm"
          loading={loading}
          onClick={handleSubmit(onSubmit)}
          className="gap-1"
        >
          <Save className="w-4 h-4" />
          Save
        </Button>
      </div>
    </aside>
  );
}
