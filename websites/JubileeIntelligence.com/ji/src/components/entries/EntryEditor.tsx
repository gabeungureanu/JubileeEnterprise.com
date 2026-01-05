import { useForm, Controller } from 'react-hook-form';
import { useEffect } from 'react';
import { Save, X, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Select } from '../ui/Select';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { ContentEntry, EntryFormData } from '../../types/entry.types';
import { ROOT_DOMAINS } from '../../types/domain.types';

interface EntryEditorProps {
  entry?: ContentEntry | null;
  onSave: (data: EntryFormData) => void;
  onCancel: () => void;
  loading?: boolean;
  mode?: 'create' | 'edit';
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

const domainOptions = ROOT_DOMAINS.map((d) => ({ value: d, label: d }));

export function EntryEditor({
  entry,
  onSave,
  onCancel,
  loading,
  mode = 'edit'
}: EntryEditorProps) {
  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    setValue,
    formState: { errors, isDirty }
  } = useForm<EntryFormData>({
    defaultValues: {
      domain: 'Personas',
      persona: '',
      title: '',
      content: '',
      guardrailLevel: 'medium',
      status: 'draft',
      tags: []
    }
  });

  const tags = watch('tags') || [];

  useEffect(() => {
    if (entry && mode === 'edit') {
      reset({
        domain: entry.domain,
        persona: entry.persona || '',
        title: entry.title,
        content: entry.content,
        guardrailLevel: entry.guardrailLevel,
        status: entry.status,
        tags: entry.tags || []
      });
    }
  }, [entry, mode, reset]);

  const addTag = (tag: string) => {
    if (tag && !tags.includes(tag)) {
      setValue('tags', [...tags, tag], { shouldDirty: true });
    }
  };

  const removeTag = (tag: string) => {
    setValue(
      'tags',
      tags.filter((t) => t !== tag),
      { shouldDirty: true }
    );
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200">
        <h2 className="text-lg font-semibold text-slate-900">
          {mode === 'create' ? 'Create New Entry' : 'Edit Entry'}
        </h2>
        <div className="flex items-center gap-2">
          {isDirty && (
            <Badge variant="warning" size="sm">
              Unsaved Changes
            </Badge>
          )}
          <Button variant="ghost" size="sm" onClick={onCancel}>
            <X className="w-4 h-4 mr-1" />
            Cancel
          </Button>
          <Button
            variant="primary"
            size="sm"
            loading={loading}
            onClick={handleSubmit(onSave)}
          >
            <Save className="w-4 h-4 mr-1" />
            Save
          </Button>
        </div>
      </div>

      {/* Form */}
      <form className="p-6 space-y-6">
        {/* Title */}
        <Input
          label="Title"
          placeholder="Enter entry title..."
          {...register('title', { required: 'Title is required' })}
          error={errors.title?.message}
        />

        {/* Domain and Persona */}
        <div className="grid grid-cols-2 gap-4">
          <Select
            label="Domain"
            options={domainOptions}
            {...register('domain', { required: 'Domain is required' })}
          />
          <Input
            label="Persona (optional)"
            placeholder="e.g., Inspire, Jubilee"
            {...register('persona')}
          />
        </div>

        {/* Content */}
        <Textarea
          label="Content"
          placeholder="Enter the content for this entry..."
          rows={12}
          {...register('content', { required: 'Content is required' })}
          error={errors.content?.message}
        />

        {/* Status and Guardrail */}
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

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-2">
            {tags.map((tag) => (
              <Badge key={tag} variant="info" size="md" className="gap-1">
                {tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="ml-1 hover:text-red-600"
                >
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
          </div>
          <div className="flex gap-2">
            <Input
              placeholder="Add a tag..."
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  const input = e.currentTarget;
                  addTag(input.value.trim());
                  input.value = '';
                }
              }}
            />
            <Button
              type="button"
              variant="secondary"
              size="md"
              onClick={(e) => {
                const input = (e.currentTarget.previousSibling as HTMLInputElement);
                addTag(input.value.trim());
                input.value = '';
              }}
            >
              <Plus className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
