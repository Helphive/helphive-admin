// Leaflet with OpenStreetMap tiles. Loaded only through `LazyAreaMap` (components/map), so Leaflet
// and its stylesheet stay out of every page that has no map.
import { useEffect, useMemo, type ReactNode } from 'react';
import { Circle, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';
import { latLngBounds } from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Box } from '@mui/material';
import { color } from '@/theme/tokens';

export interface MapArea {
    id: string;
    latitude: number;
    longitude: number;
    /** Radius of the drawn area: the position's uncertainty, never smaller. */
    radiusKm: number;
    tone: 'blue' | 'coral' | 'green' | 'amber';
    /** Short text on hover. */
    label: string;
    /** Content of the click popup. */
    popup?: ReactNode;
}

export interface AreaMapProps {
    areas: MapArea[];
    /** The area to move to and highlight. */
    focusId?: string | null;
    /** Pixels, a CSS length, or per breakpoint ({ xs: 360, md: 560 }). */
    height?: number | string | Partial<Record<'xs' | 'sm' | 'md' | 'lg', number | string>>;
    /** Accessible name; the map itself is not usable without a pointer, so keep a list beside it. */
    label: string;
    onSelect?: (id: string) => void;
}

const TONE: Record<MapArea['tone'], string> = {
    blue: color.blue700,
    coral: color.coral600,
    green: color.green700,
    amber: color.amber700,
};

function Fit({ areas, focusId }: { areas: MapArea[]; focusId?: string | null }) {
    const map = useMap();
    const key = areas.map((a) => a.id).join();
    useEffect(() => {
        if (!areas.length) return;
        const bounds = latLngBounds(
            areas.map((a) => [a.latitude, a.longitude] as [number, number])
        );
        map.fitBounds(bounds.pad(0.3), { maxZoom: 12, animate: false });
        // Refit only when the set of areas changes, not on every poll.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, map]);
    useEffect(() => {
        const a = areas.find((x) => x.id === focusId);
        if (a) map.flyTo([a.latitude, a.longitude], Math.max(map.getZoom(), 12), { duration: 0.6 });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [focusId, map]);
    return null;
}

/**
 * Coarse positions drawn as areas, not pins: each circle is as wide as the position is uncertain,
 * so the map never suggests more precision than the API gives.
 */
export default function AreaMap({ areas, focusId, height = 520, label, onSelect }: AreaMapProps) {
    const center = useMemo<[number, number]>(
        () => (areas[0] ? [areas[0].latitude, areas[0].longitude] : [53.48, -2.24]),
        // The first centre only; Fit takes over afterwards.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        []
    );
    return (
        <Box
            role="region"
            aria-label={label}
            sx={{
                height,
                borderRadius: '8px',
                overflow: 'hidden',
                '& .leaflet-container': { height: '100%', width: '100%', fontFamily: 'inherit' },
                '& .leaflet-popup-content': { m: '10px 12px', fontSize: 13, lineHeight: 1.45 },
            }}
        >
            <MapContainer center={center} zoom={areas.length ? 11 : 6} scrollWheelZoom>
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                    // The site sends no referrer by default; OpenStreetMap asks for one on tile requests.
                    referrerPolicy="strict-origin-when-cross-origin"
                />
                <Fit areas={areas} focusId={focusId} />
                {areas.map((a) => {
                    const focused = a.id === focusId;
                    return (
                        <Circle
                            key={a.id}
                            center={[a.latitude, a.longitude]}
                            radius={a.radiusKm * 1000}
                            pathOptions={{
                                color: TONE[a.tone],
                                weight: focused ? 3 : 1.5,
                                fillColor: TONE[a.tone],
                                fillOpacity: focused ? 0.35 : 0.18,
                            }}
                            eventHandlers={onSelect ? { click: () => onSelect(a.id) } : undefined}
                        >
                            <Tooltip direction="top" sticky>
                                {a.label}
                            </Tooltip>
                            {a.popup && <Popup>{a.popup}</Popup>}
                        </Circle>
                    );
                })}
            </MapContainer>
        </Box>
    );
}
