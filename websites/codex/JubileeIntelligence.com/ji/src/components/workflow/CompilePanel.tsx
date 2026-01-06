import { useState } from 'react';
import { Play, Eye, RefreshCw, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { cn } from '../../utils/cn';
import { CompileResult } from '../../types/workflow.types';
import { compileApi } from '../../api/compile.api';
import { useWorkflowStore } from '../../stores/workflowStore';

interface CompilePanelProps {
  onCompileComplete?: (result: CompileResult) => void;
}

export function CompilePanel({ onCompileComplete }: CompilePanelProps) {
  const { isCompiling, setCompiling, lastCompileResult, setCompileResult } = useWorkflowStore();
  const [preview, setPreview] = useState<{
    wouldProcess: number;
    wouldCreate: number;
    wouldUpdateMetadata: number;
    wouldReEmbed: number;
    wouldSoftDelete: number;
    unchanged: number;
    errors: string[];
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const handlePreview = async () => {
    setPreviewLoading(true);
    try {
      const result = await compileApi.previewCompile();
      setPreview(result);
    } catch (error) {
      console.error('Preview failed:', error);
    } finally {
      setPreviewLoading(false);
    }
  };

  const handleCompile = async (dryRun = false) => {
    setCompiling(true);
    try {
      const result = await compileApi.compile({ dryRun, verbose: true });
      setCompileResult(result);
      onCompileComplete?.(result);
    } catch (error) {
      console.error('Compile failed:', error);
    } finally {
      setCompiling(false);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-slate-200 p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Compile to Qdrant</h2>
          <p className="text-sm text-slate-500 mt-1">
            Compile approved entries to the vector database
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePreview}
            loading={previewLoading}
          >
            <Eye className="w-4 h-4 mr-1" />
            Preview
          </Button>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => handleCompile(true)}
            loading={isCompiling}
          >
            <RefreshCw className="w-4 h-4 mr-1" />
            Dry Run
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => handleCompile(false)}
            loading={isCompiling}
          >
            <Play className="w-4 h-4 mr-1" />
            Compile
          </Button>
        </div>
      </div>

      {/* Preview Results */}
      {preview && (
        <div className="mb-6 p-4 bg-slate-50 rounded-lg border border-slate-200">
          <h3 className="text-sm font-medium text-slate-700 mb-3">Preview Summary</h3>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-indigo-600">{preview.wouldProcess}</p>
              <p className="text-xs text-slate-500">Total to Process</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-emerald-600">{preview.wouldCreate}</p>
              <p className="text-xs text-slate-500">New Entries</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-amber-600">{preview.wouldUpdateMetadata}</p>
              <p className="text-xs text-slate-500">Metadata Updates</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-blue-600">{preview.wouldReEmbed}</p>
              <p className="text-xs text-slate-500">Re-Embeddings</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-red-600">{preview.wouldSoftDelete}</p>
              <p className="text-xs text-slate-500">Soft Deletes</p>
            </div>
            <div className="text-center p-3 bg-white rounded-lg">
              <p className="text-2xl font-bold text-slate-600">{preview.unchanged}</p>
              <p className="text-xs text-slate-500">Unchanged</p>
            </div>
          </div>
          {preview.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-700 mb-2">Errors</p>
              <ul className="text-xs text-red-600 space-y-1">
                {preview.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Compile Results */}
      {lastCompileResult && (
        <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
          <div className="flex items-center gap-2 mb-3">
            {lastCompileResult.success ? (
              <CheckCircle className="w-5 h-5 text-emerald-500" />
            ) : (
              <XCircle className="w-5 h-5 text-red-500" />
            )}
            <h3 className="text-sm font-medium text-slate-700">
              Last Compile {lastCompileResult.success ? 'Successful' : 'Failed'}
            </h3>
            {lastCompileResult.version && (
              <Badge variant="info" size="sm">
                v{lastCompileResult.version}
              </Badge>
            )}
          </div>
          <div className="grid grid-cols-4 gap-4">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">{lastCompileResult.processed}</p>
              <p className="text-xs text-slate-500">Processed</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-emerald-600">{lastCompileResult.created}</p>
              <p className="text-xs text-slate-500">Created</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-amber-600">{lastCompileResult.updated}</p>
              <p className="text-xs text-slate-500">Updated</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-red-600">{lastCompileResult.deleted}</p>
              <p className="text-xs text-slate-500">Deleted</p>
            </div>
          </div>
          {lastCompileResult.errors.length > 0 && (
            <div className="mt-4 p-3 bg-red-50 rounded-lg border border-red-200">
              <p className="text-sm font-medium text-red-700 mb-2">
                {lastCompileResult.errors.length} Error(s)
              </p>
              <ul className="text-xs text-red-600 space-y-1 max-h-32 overflow-y-auto">
                {lastCompileResult.errors.map((error, i) => (
                  <li key={i}>{error}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
