import type { ListPage } from './listQuery';

/** Most rows a CSV export collects; the API answers at most 100 per page. */
export const EXPORT_ROW_CAP = 5000;

/**
 * Every row of a server list, page by page (100 at a time), for a CSV export. Stops at
 * `EXPORT_ROW_CAP` rows. `fetchPage` takes a 1-based page number.
 */
export async function fetchAllPages<T>(
    fetchPage: (page: number, pageSize: number) => Promise<ListPage<T>>
): Promise<T[]> {
    const pageSize = 100;
    const rows: T[] = [];
    for (let page = 1; rows.length < EXPORT_ROW_CAP; page++) {
        const res = await fetchPage(page, pageSize);
        rows.push(...res.items);
        if (res.items.length < pageSize || rows.length >= res.total) break;
    }
    return rows.slice(0, EXPORT_ROW_CAP);
}
