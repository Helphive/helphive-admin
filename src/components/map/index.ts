import { lazy } from 'react';

export type { MapArea, AreaMapProps } from './AreaMap';

/** The area map, loaded on first use (Leaflet and its CSS are a separate chunk). Wrap in Suspense. */
export const LazyAreaMap = lazy(() => import('./AreaMap'));
