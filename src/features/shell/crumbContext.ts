import { createContext, useContext, useEffect } from 'react';

/** Routes name themselves with `handle: { crumb }`; a record page can replace its own crumb. */
export interface RouteHandle {
    crumb?: string;
}

export const CrumbContext = createContext<{
    label: string | null;
    setLabel: (label: string | null) => void;
}>({ label: null, setLabel: () => undefined });

/** The last crumb's label set by the page (e.g. an applicant's name). */
export function useCrumbOverride() {
    return useContext(CrumbContext).label;
}

/** Call from a record page to show the record's name as the last breadcrumb. */
export function usePageCrumb(label: string | undefined) {
    const { setLabel } = useContext(CrumbContext);
    useEffect(() => {
        if (!label) return;
        setLabel(label);
        return () => setLabel(null);
    }, [label, setLabel]);
}
