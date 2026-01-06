import * as ToastPrimitive from '@radix-ui/react-toast';
import { X, CheckCircle, AlertCircle, Info } from 'lucide-react';
import { cn } from '../../utils/cn';

interface ToastProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  variant?: 'default' | 'success' | 'error' | 'info';
  duration?: number;
}

export function Toast({
  open,
  onOpenChange,
  title,
  description,
  variant = 'default',
  duration = 5000
}: ToastProps) {
  const icons = {
    default: null,
    success: <CheckCircle className="w-5 h-5 text-emerald-500" />,
    error: <AlertCircle className="w-5 h-5 text-red-500" />,
    info: <Info className="w-5 h-5 text-blue-500" />
  };

  const variants = {
    default: 'border-slate-200',
    success: 'border-emerald-200 bg-emerald-50',
    error: 'border-red-200 bg-red-50',
    info: 'border-blue-200 bg-blue-50'
  };

  return (
    <ToastPrimitive.Root
      open={open}
      onOpenChange={onOpenChange}
      duration={duration}
      className={cn(
        'fixed bottom-4 right-4 z-50',
        'flex items-start gap-3 p-4 rounded-lg border shadow-lg bg-white',
        'data-[state=open]:animate-in data-[state=closed]:animate-out',
        'data-[swipe=end]:animate-out data-[state=closed]:fade-out-80',
        'data-[state=open]:slide-in-from-bottom-full',
        'data-[state=closed]:slide-out-to-right-full',
        variants[variant]
      )}
    >
      {icons[variant]}
      <div className="flex-1">
        <ToastPrimitive.Title className="text-sm font-medium text-slate-900">
          {title}
        </ToastPrimitive.Title>
        {description && (
          <ToastPrimitive.Description className="mt-1 text-sm text-slate-500">
            {description}
          </ToastPrimitive.Description>
        )}
      </div>
      <ToastPrimitive.Close
        className={cn(
          'p-1 rounded-lg',
          'text-slate-400 hover:text-slate-600 hover:bg-slate-100',
          'focus:outline-none focus:ring-2 focus:ring-indigo-500'
        )}
      >
        <X className="w-4 h-4" />
      </ToastPrimitive.Close>
    </ToastPrimitive.Root>
  );
}

export function ToastProvider({ children }: { children: React.ReactNode }) {
  return (
    <ToastPrimitive.Provider>
      {children}
      <ToastPrimitive.Viewport className="fixed bottom-0 right-0 p-4 w-96 max-w-full z-50" />
    </ToastPrimitive.Provider>
  );
}
