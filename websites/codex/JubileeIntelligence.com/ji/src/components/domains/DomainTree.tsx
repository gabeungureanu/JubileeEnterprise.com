import { useMemo } from 'react';
import { RefreshCw } from 'lucide-react';
import { TreeNode } from './TreeNode';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { useSelectionStore } from '../../stores/selectionStore';
import { ROOT_DOMAINS, DOMAIN_ICONS, PERSONA_HIERARCHY, DomainNode } from '../../types/domain.types';

interface DomainTreeProps {
  onRefresh?: () => void;
  loading?: boolean;
}

export function DomainTree({ onRefresh, loading }: DomainTreeProps) {
  const { selectedDomainPath, setSelectedDomainPath } = useSelectionStore();

  // Build tree structure from domain configuration
  const treeData = useMemo<DomainNode[]>(() => {
    return ROOT_DOMAINS.map((domain) => {
      const icon = DOMAIN_ICONS[domain];
      const baseNode: DomainNode = {
        id: domain.toLowerCase(),
        label: domain,
        path: domain,
        icon,
        children: []
      };

      // Add _shared folder to each domain
      const sharedNode: DomainNode = {
        id: `${domain.toLowerCase()}-shared`,
        label: '_shared',
        path: `${domain}/_shared`,
        children: []
      };
      baseNode.children!.push(sharedNode);

      // Add specific children based on domain
      if (domain === 'Personas') {
        // Add persona hierarchy
        Object.entries(PERSONA_HIERARCHY).forEach(([persona, subPersonas]) => {
          const personaNode: DomainNode = {
            id: `persona-${persona.toLowerCase()}`,
            label: persona,
            path: `Personas/${persona}`,
            children: subPersonas.map((sub) => ({
              id: `persona-${persona.toLowerCase()}-${sub.toLowerCase()}`,
              label: sub,
              path: `Personas/${persona}/${sub}`
            }))
          };
          baseNode.children!.push(personaNode);
        });
      }

      return baseNode;
    });
  }, []);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200">
        <h2 className="font-semibold text-slate-900">Domains</h2>
        <Button
          variant="ghost"
          size="sm"
          onClick={onRefresh}
          loading={loading}
          className="p-1"
        >
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </Button>
      </div>

      {/* Tree */}
      <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
        {treeData.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            selectedPath={selectedDomainPath}
            onSelect={setSelectedDomainPath}
          />
        ))}
      </div>

      {/* Selected Path Info */}
      {selectedDomainPath && (
        <div className="px-4 py-2 border-t border-slate-200 bg-slate-50">
          <p className="text-xs text-slate-500">Selected</p>
          <p className="text-sm font-medium text-slate-700 truncate">
            {selectedDomainPath}
          </p>
        </div>
      )}
    </div>
  );
}
