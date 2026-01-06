import { useState } from 'react';
import { ChevronRight, ChevronDown, Folder, FolderOpen, File } from 'lucide-react';
import { cn } from '../../utils/cn';
import { DomainNode } from '../../types/domain.types';

interface TreeNodeProps {
  node: DomainNode;
  level?: number;
  selectedPath?: string;
  onSelect?: (path: string) => void;
}

export function TreeNode({ node, level = 0, selectedPath, onSelect }: TreeNodeProps) {
  const [expanded, setExpanded] = useState(level < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = selectedPath === node.path;

  const handleToggle = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (hasChildren) {
      setExpanded(!expanded);
    }
  };

  const handleSelect = () => {
    onSelect?.(node.path);
  };

  return (
    <div>
      <div
        onClick={handleSelect}
        className={cn(
          'flex items-center gap-1 px-2 py-1.5 rounded-lg cursor-pointer',
          'text-sm transition-colors duration-150',
          isSelected
            ? 'bg-indigo-100 text-indigo-900'
            : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
        )}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
      >
        {/* Expand/Collapse Toggle */}
        <button
          onClick={handleToggle}
          className={cn(
            'p-0.5 rounded hover:bg-slate-200',
            !hasChildren && 'invisible'
          )}
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4" />
          ) : (
            <ChevronRight className="w-4 h-4" />
          )}
        </button>

        {/* Icon */}
        {hasChildren ? (
          expanded ? (
            <FolderOpen className="w-4 h-4 text-amber-500" />
          ) : (
            <Folder className="w-4 h-4 text-amber-500" />
          )
        ) : (
          <File className="w-4 h-4 text-slate-400" />
        )}

        {/* Label */}
        <span className="flex-1 truncate">{node.label}</span>

        {/* Entry Count */}
        {node.entryCount !== undefined && node.entryCount > 0 && (
          <span className="text-xs text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded">
            {node.entryCount}
          </span>
        )}
      </div>

      {/* Children */}
      {hasChildren && expanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              level={level + 1}
              selectedPath={selectedPath}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}
