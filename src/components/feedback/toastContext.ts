import { createContext, useContext, type ReactNode } from 'react';

export type ToastTone = 'success' | 'error' | 'info' | 'warning';

export interface ToastOptions {
    tone?: ToastTone;
    /** Optional action, e.g. { label: 'View', onClick }. */
    action?: { label: string; onClick: () => void };
    /** Milliseconds before it hides; errors default to 8000, others 5000. 0 keeps it open. */
    duration?: number;
}

export interface ToastApi {
    show: (message: ReactNode, options?: ToastOptions) => void;
    success: (message: ReactNode, options?: Omit<ToastOptions, 'tone'>) => void;
    error: (message: ReactNode, options?: Omit<ToastOptions, 'tone'>) => void;
}

export const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
    const ctx = useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used inside ToastProvider');
    return ctx;
}
