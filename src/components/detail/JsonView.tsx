import { useState, type ReactNode } from 'react';
import { Box, Button, ButtonBase, Tooltip } from '@mui/material';
import { ChevronDownIcon, ChevronRightIcon, CopyTextIcon } from '@/components/ui/icons';
import { color, font, hairline, radius } from '@/theme/tokens';

export interface JsonViewProps {
    value: unknown;
    /** Nodes deeper than this start collapsed. */
    expandDepth?: number;
    /** Strings longer than this are cut with a "show all" toggle (signed URLs, tokens). */
    truncateAt?: number;
    /** Keys whose values are replaced with "[hidden]" (secrets, hashes). */
    redact?: string[];
    label?: string;
}

const mono = 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace';

function Str({ value, limit }: { value: string; limit: number }) {
    const [all, setAll] = useState(false);
    const long = value.length > limit;
    return (
        <Box component="span" sx={{ color: color.green700, overflowWrap: 'anywhere' }}>
            "{long && !all ? `${value.slice(0, limit)}…` : value}"
            {long && (
                <ButtonBase
                    onClick={() => setAll((a) => !a)}
                    sx={{
                        ml: 0.75,
                        fontSize: 11,
                        fontWeight: 700,
                        color: color.ink500,
                        fontFamily: font.family,
                    }}
                >
                    {all ? 'Show less' : `Show all ${value.length} characters`}
                </ButtonBase>
            )}
        </Box>
    );
}

function Node({
    name,
    value,
    depth,
    props,
    last,
}: {
    name?: string;
    value: unknown;
    depth: number;
    props: Required<Pick<JsonViewProps, 'expandDepth' | 'truncateAt' | 'redact'>>;
    last: boolean;
}) {
    const [open, setOpen] = useState(depth < props.expandDepth);
    const comma = last ? '' : ',';
    const key =
        name !== undefined ? (
            <Box component="span" sx={{ color: color.ink700 }}>
                "{name}":{' '}
            </Box>
        ) : null;

    if (name && props.redact.includes(name)) {
        return (
            <Box sx={{ pl: 2 }}>
                {key}
                <Box component="span" sx={{ color: color.ink500 }}>
                    [hidden]
                </Box>
                {comma}
            </Box>
        );
    }

    if (value !== null && typeof value === 'object') {
        const isArray = Array.isArray(value);
        const entries = isArray
            ? (value as unknown[]).map((v, i) => [String(i), v] as const)
            : Object.entries(value as Record<string, unknown>);
        const [o, c] = isArray ? ['[', ']'] : ['{', '}'];
        return (
            <Box sx={{ pl: depth ? 2 : 0 }}>
                <ButtonBase
                    onClick={() => setOpen((x) => !x)}
                    aria-expanded={open}
                    sx={{
                        fontFamily: mono,
                        fontSize: 'inherit',
                        alignItems: 'center',
                        gap: 0.25,
                        ml: -2.25,
                    }}
                >
                    {open ? <ChevronDownIcon size={14} /> : <ChevronRightIcon size={14} />}
                    {key}
                    {o}
                </ButtonBase>
                {open ? (
                    <>
                        {entries.map(([k, v], i) => (
                            <Node
                                key={k}
                                name={isArray ? undefined : k}
                                value={v}
                                depth={depth + 1}
                                props={props}
                                last={i === entries.length - 1}
                            />
                        ))}
                        <Box>
                            {c}
                            {comma}
                        </Box>
                    </>
                ) : (
                    <Box component="span" sx={{ color: color.ink500 }}>
                        {' '}
                        {entries.length} {isArray ? 'items' : 'keys'} {c}
                        {comma}
                    </Box>
                )}
            </Box>
        );
    }

    let rendered: ReactNode;
    if (typeof value === 'string') rendered = <Str value={value} limit={props.truncateAt} />;
    else if (typeof value === 'number')
        rendered = (
            <Box component="span" sx={{ color: color.blue700 }}>
                {value}
            </Box>
        );
    else if (typeof value === 'boolean')
        rendered = (
            <Box component="span" sx={{ color: color.amber700 }}>
                {String(value)}
            </Box>
        );
    else
        rendered = (
            <Box component="span" sx={{ color: color.ink500 }}>
                null
            </Box>
        );
    return (
        <Box sx={{ pl: 2 }}>
            {key}
            {rendered}
            {comma}
        </Box>
    );
}

/** Collapsible, read-only JSON with long strings cut and chosen keys hidden. Copies as text. */
export default function JsonView({
    value,
    expandDepth = 2,
    truncateAt = 80,
    redact = [],
    label = 'Record as JSON',
}: JsonViewProps) {
    const [copied, setCopied] = useState(false);
    const copy = async () => {
        const replacer = (k: string, v: unknown) => (redact.includes(k) ? '[hidden]' : v);
        try {
            await navigator.clipboard.writeText(JSON.stringify(value, replacer, 2));
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
        } catch {
            // Clipboard blocked; nothing to do.
        }
    };
    return (
        <Box
            role="group"
            aria-label={label}
            sx={{
                position: 'relative',
                border: hairline,
                borderRadius: `${radius.md}px`,
                bgcolor: color.subtle,
                p: 1.5,
                pl: 3,
                fontFamily: mono,
                fontSize: 12.5,
                lineHeight: 1.7,
                overflowX: 'auto',
            }}
        >
            <Tooltip title={copied ? 'Copied' : 'Copy JSON'}>
                <Button
                    size="small"
                    variant="outlined"
                    onClick={copy}
                    startIcon={<CopyTextIcon />}
                    sx={{ position: 'absolute', top: 8, right: 8, fontFamily: font.family }}
                >
                    {copied ? 'Copied' : 'Copy'}
                </Button>
            </Tooltip>
            <Node value={value} depth={0} props={{ expandDepth, truncateAt, redact }} last />
        </Box>
    );
}
