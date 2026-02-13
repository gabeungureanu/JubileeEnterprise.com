import React, { useState, useCallback, useRef, createContext, useContext } from 'react';
import './Toast.css';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastMessage {
  id: number;
  type: ToastType;
  message: string;
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

export const useToast = (): ToastContextValue => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const counterRef = useRef(0);

  const showToast = useCallback((message: string, type: ToastType = 'error') => {
    const id = ++counterRef.current;
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 5000);
  }, []);

  const dismissToast = useCallback((id: number) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  const iconMap: Record<ToastType, string> = {
    success: 'check_circle',
    error: 'error',
    info: 'info',
    warning: 'warning',
  };

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      <div className="toast-container">
        {toasts.map(toast => (
          <div key={toast.id} className={`toast toast--${toast.type}`}>
            <span className="material-symbols-outlined toast__icon">{iconMap[toast.type]}</span>
            <span className="toast__message">{toast.message}</span>
            <button className="toast__dismiss" onClick={() => dismissToast(toast.id)}>
              <span className="material-symbols-outlined">close</span>
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};
