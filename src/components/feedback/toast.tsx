import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { ToastContext, type ToastApi, type ToastOptions } from './toastContext';
import { Alert, Box, Button, Slide } from '@mui/material';

interface Toast extends ToastOptions {
    id: number;
    message: ReactNode;
}

let nextId = 1;

/** Stacked ink toasts in the bottom-left corner. Wrap the app once; call `useToast()` anywhere. */
export function ToastProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<Toast[]>([]);

    const dismiss = useCallback((id: number) => {
        setToasts((all) => all.filter((t) => t.id !== id));
    }, []);

    const show = useCallback(
        (message: ReactNode, options: ToastOptions = {}) => {
            const id = nextId++;
            const tone = options.tone ?? 'info';
            setToasts((all) => [...all.slice(-3), { id, message, ...options, tone }]);
            const duration = options.duration ?? (tone === 'error' ? 8000 : 5000);
            if (duration > 0) window.setTimeout(() => dismiss(id), duration);
        },
        [dismiss]
    );

    const api = useMemo<ToastApi>(
        () => ({
            show,
            success: (m, o) => show(m, { ...o, tone: 'success' }),
            error: (m, o) => show(m, { ...o, tone: 'error' }),
        }),
        [show]
    );

    return (
        <ToastContext.Provider value={api}>
            {children}
            <Box
                aria-live="polite"
                sx={{
                    position: 'fixed',
                    left: { xs: 16, sm: 24 },
                    right: { xs: 16, sm: 'auto' },
                    bottom: { xs: 16, sm: 24 },
                    zIndex: (t) => t.zIndex.snackbar,
                    display: 'grid',
                    gap: 1,
                    width: { sm: 400 },
                }}
            >
                {toasts.map((t) => (
                    <Slide key={t.id} in direction="up">
                        <Alert
                            variant="filled"
                            severity={t.tone}
                            role={t.tone === 'error' ? 'alert' : 'status'}
                            onClose={() => dismiss(t.id)}
                            action={
                                t.action ? (
                                    <Button
                                        size="small"
                                        color="inherit"
                                        onClick={() => {
                                            t.action?.onClick();
                                            dismiss(t.id);
                                        }}
                                    >
                                        {t.action.label}
                                    </Button>
                                ) : undefined
                            }
                        >
                            {t.message}
                        </Alert>
                    </Slide>
                ))}
            </Box>
        </ToastContext.Provider>
    );
}
