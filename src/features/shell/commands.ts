import type { ReactNode } from 'react';

/** One entry in the command palette. Give `to` to navigate, or `run` for anything else. */
export interface Command {
    id: string;
    group: string;
    label: string;
    /** Muted text after the label (a description, an email, a status). */
    hint?: string;
    icon?: ReactNode;
    keywords?: string[];
    to?: string;
    run?: () => void;
}

/** Commands matching every word of the query, best first: label prefix, label, then the rest. */
export function filterCommands(commands: Command[], query: string): Command[] {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (!words.length) return commands;
    const scored: { c: Command; score: number }[] = [];
    for (const c of commands) {
        const label = c.label.toLowerCase();
        const hay = [label, c.hint ?? '', ...(c.keywords ?? [])].join(' ').toLowerCase();
        if (!words.every((w) => hay.includes(w))) continue;
        const score = label.startsWith(words[0]) ? 0 : label.includes(words[0]) ? 1 : 2;
        scored.push({ c, score });
    }
    return scored.sort((a, b) => a.score - b.score).map((s) => s.c);
}
