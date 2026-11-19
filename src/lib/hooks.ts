import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';

const APP_NAME = 'HelpHive Console';

/** Sets document.title to "<title> - HelpHive Console" while the component is mounted. */
export function useDocumentTitle(title: string | undefined) {
    useEffect(() => {
        if (!title) return;
        const previous = document.title;
        document.title = `${title} - ${APP_NAME}`;
        return () => {
            document.title = previous;
        };
    }, [title]);
}

/** The value, updated only after it has stopped changing for `delay` ms. */
export function useDebouncedValue<T>(value: T, delay = 250): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const id = window.setTimeout(() => setDebounced(value), delay);
        return () => window.clearTimeout(id);
    }, [value, delay]);
    return debounced;
}

/** Re-renders every `ms` so relative times ("waiting 3 h") stay current. */
export function useNow(ms = 60_000): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        const id = window.setInterval(() => setNow(Date.now()), ms);
        return () => window.clearInterval(id);
    }, [ms]);
    return now;
}

export type UrlStateSchema = Record<string, string>;

/**
 * Typed state kept in the URL query string, so filters survive reloads and can be shared.
 * `defaults` lists every key with its default; defaults are left out of the URL.
 * Updates replace the history entry instead of pushing a new one.
 */
export function useUrlState<S extends UrlStateSchema>(defaults: S) {
    const [params, setParams] = useSearchParams();
    const defaultsRef = useRef(defaults);

    const state = useMemo(() => {
        const out = { ...defaultsRef.current };
        for (const key of Object.keys(out) as (keyof S)[]) {
            const v = params.get(key as string);
            if (v !== null) out[key] = v as S[keyof S];
        }
        return out;
    }, [params]);

    const update = useCallback(
        (patch: Partial<S>) => {
            setParams(
                (prev) => {
                    const next = new URLSearchParams(prev);
                    for (const [k, v] of Object.entries(patch)) {
                        if (v === undefined || v === '' || v === defaultsRef.current[k])
                            next.delete(k);
                        else next.set(k, v);
                    }
                    return next;
                },
                { replace: true }
            );
        },
        [setParams]
    );

    const reset = useCallback(() => {
        setParams(
            (prev) => {
                const next = new URLSearchParams(prev);
                Object.keys(defaultsRef.current).forEach((k) => next.delete(k));
                return next;
            },
            { replace: true }
        );
    }, [setParams]);

    return [state, update, reset] as const;
}
