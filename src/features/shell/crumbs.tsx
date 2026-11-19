import { useState, type ReactNode } from 'react';
import { CrumbContext } from './crumbContext';

export function CrumbProvider({ children }: { children: ReactNode }) {
    const [label, setLabel] = useState<string | null>(null);
    return <CrumbContext.Provider value={{ label, setLabel }}>{children}</CrumbContext.Provider>;
}
