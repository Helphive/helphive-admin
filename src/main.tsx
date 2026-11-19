import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { Provider } from 'react-redux';
import { RouterProvider } from 'react-router-dom';
import { CssBaseline, ThemeProvider } from '@mui/material';
import { store } from '@/app/store';
import { router } from '@/app/router';
import { ToastProvider } from '@/components/feedback/toast';
import { appTheme } from '@/theme';
import './index.css';

createRoot(document.getElementById('root')!).render(
    <StrictMode>
        <Provider store={store}>
            <ThemeProvider theme={appTheme}>
                <CssBaseline />
                <ToastProvider>
                    <RouterProvider router={router} />
                </ToastProvider>
            </ThemeProvider>
        </Provider>
    </StrictMode>
);
