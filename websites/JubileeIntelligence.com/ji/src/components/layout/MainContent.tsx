import { cn } from '../../utils/cn';
import { useUIStore } from '../../stores/uiStore';

interface MainContentProps {
  children: React.ReactNode;
}

export function MainContent({ children }: MainContentProps) {
  const { sidebarOpen, editPanelOpen } = useUIStore();

  return (
    <main
      className={cn(
        'pt-16 min-h-screen transition-all duration-300',
        sidebarOpen ? 'pl-64' : 'pl-16',
        editPanelOpen ? 'pr-[420px]' : 'pr-0'
      )}
    >
      <div className="p-6">{children}</div>
    </main>
  );
}
