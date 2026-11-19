/** Quote a CSV cell when needed and neutralise spreadsheet formulas. */
function cell(value: unknown): string {
    if (value === null || value === undefined) return '';
    let s = value instanceof Date ? value.toISOString() : String(value);
    // A leading = + - @ would run as a formula when the file is opened in a spreadsheet.
    if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(headers: string[], rows: unknown[][]): string {
    return [headers, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}

/** Save text as a file through a temporary object URL. */
export function downloadText(filename: string, text: string, type = 'text/csv;charset=utf-8') {
    const blob = new Blob(['﻿', text], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
