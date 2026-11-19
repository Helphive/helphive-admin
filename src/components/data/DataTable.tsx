import {
    useEffect,
    useMemo,
    useRef,
    useState,
    type KeyboardEvent,
    type ReactNode,
    type CSSProperties,
} from 'react';
import {
    flexRender,
    getCoreRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
    type ColumnDef,
    type PaginationState,
    type Row,
    type RowData,
    type RowSelectionState,
    type SortingState,
    type VisibilityState,
} from '@tanstack/react-table';
import {
    Box,
    Checkbox,
    FormControlLabel,
    IconButton,
    Menu,
    MenuItem,
    Skeleton,
    Table,
    TableBody,
    TableCell,
    TableContainer,
    TableHead,
    TablePagination,
    TableRow,
    TableSortLabel,
    ToggleButton,
    ToggleButtonGroup,
    Tooltip,
    Typography,
} from '@mui/material';
import { ErrorState } from '@/components/ui';
import {
    ColumnsSettingIcon,
    DensityIcon,
    ExportCsvIcon,
    SortAscIcon,
    SortDescIcon,
    SortNoneIcon,
} from '@/components/ui/icons';
import { downloadText, toCsv } from '@/lib/csv';
import { getErrorMessage } from '@/lib/api';
import { color, font, hairline, radius } from '@/theme/tokens';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    interface ColumnMeta<TData extends RowData, TValue> {
        /** Plain-text name for the column menu and CSV header when `header` is not a string. */
        label?: string;
        align?: 'left' | 'right' | 'center';
        /** Fixed or minimum width, e.g. 120 or '30%'. */
        width?: number | string;
        /** Value written to CSV. Defaults to the accessor value; return undefined to skip. */
        csv?: (row: TData) => unknown;
        /** Leave the column out of the CSV file. */
        noCsv?: boolean;
        /** The column cannot be hidden from the column menu. */
        alwaysVisible?: boolean;
    }
}

export type Density = 'compact' | 'comfortable';

export type DataTablePagination =
    /** The table pages through `data` itself. */
    | { mode: 'client'; pageSize?: number; pageSizeOptions?: number[] }
    /** The server pages; `data` is the current page and `rowCount` the total. */
    | {
          mode: 'server';
          pageIndex: number;
          pageSize: number;
          rowCount: number;
          onChange: (next: { pageIndex: number; pageSize: number }) => void;
          pageSizeOptions?: number[];
      }
    | { mode: 'none' };

export interface DataTableProps<T> {
    /** Accessible name of the table. */
    label: string;
    data: T[];
    // Column value types vary per column, so `any` is the honest type here (TanStack's own docs do this).
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    columns: ColumnDef<T, any>[];
    getRowId: (row: T) => string;
    /** Remembers column visibility and density in this browser under this id. */
    tableId?: string;

    loading?: boolean;
    error?: unknown;
    onRetry?: () => void;
    /** Shown when there are no rows (an EmptyState with `bare`). */
    empty?: ReactNode;

    /** Controlled sorting; leave unset to let the table sort on its own. */
    sorting?: SortingState;
    onSortingChange?: (sorting: SortingState) => void;
    initialSorting?: SortingState;
    /** The server sorts: the table only reports the requested order. */
    manualSorting?: boolean;

    pagination?: DataTablePagination;
    initialColumnVisibility?: VisibilityState;

    /** Adds a checkbox column. Selected rows go to `selectionActions`. */
    enableSelection?: boolean;
    selectionActions?: (rows: T[], clear: () => void) => ReactNode;

    /** Row activation by click, Enter, or tap. */
    onRowActivate?: (row: T) => void;
    /** File name for the CSV export (without extension). Omit to hide the export button. */
    csvFilename?: string;

    /** Content on the left of the toolbar (filters, tabs). */
    toolbar?: ReactNode;
    /** Max height of the scroll area; the header sticks inside it. */
    maxHeight?: number | string;
}

const DENSITY_PAD: Record<Density, string> = { compact: '6px 12px', comfortable: '11px 12px' };

function readPref<T>(key: string | undefined, fallback: T): T {
    if (!key) return fallback;
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as T) : fallback;
    } catch {
        return fallback;
    }
}

function writePref(key: string | undefined, value: unknown) {
    if (!key) return;
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Preferences are a convenience; ignore blocked storage.
    }
}

function columnLabel(def: { header?: unknown; meta?: { label?: string }; id?: string }) {
    return def.meta?.label ?? (typeof def.header === 'string' ? def.header : (def.id ?? ''));
}

/**
 * Typed, sortable, pageable table with column visibility, density, row selection, a sticky
 * header, CSV export, keyboard row navigation and loading, empty and error states.
 */
export default function DataTable<T>({
    label,
    data,
    columns,
    getRowId,
    tableId,
    loading,
    error,
    onRetry,
    empty,
    sorting: sortingProp,
    onSortingChange,
    initialSorting = [],
    manualSorting,
    pagination = { mode: 'client' },
    initialColumnVisibility = {},
    enableSelection,
    selectionActions,
    onRowActivate,
    csvFilename,
    toolbar,
    maxHeight = '72vh',
}: DataTableProps<T>) {
    const prefKey = tableId ? `helphive-admin.table.${tableId}` : undefined;
    const [sortingState, setSortingState] = useState<SortingState>(initialSorting);
    const sorting = sortingProp ?? sortingState;
    const [visibility, setVisibility] = useState<VisibilityState>(() =>
        readPref(prefKey && `${prefKey}.columns`, initialColumnVisibility)
    );
    const [density, setDensity] = useState<Density>(() =>
        readPref(prefKey && `${prefKey}.density`, 'compact')
    );
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({});
    const clientPageSize = pagination.mode === 'client' ? (pagination.pageSize ?? 25) : 25;
    const [clientPaging, setClientPaging] = useState<PaginationState>({
        pageIndex: 0,
        pageSize: clientPageSize,
    });
    const [columnsAnchor, setColumnsAnchor] = useState<HTMLElement | null>(null);
    const [focusIndex, setFocusIndex] = useState(0);
    const bodyRef = useRef<HTMLTableSectionElement>(null);

    useEffect(() => writePref(prefKey && `${prefKey}.columns`, visibility), [prefKey, visibility]);
    useEffect(() => writePref(prefKey && `${prefKey}.density`, density), [prefKey, density]);
    // New data (a filter changed) starts at the first page with nothing selected.
    useEffect(() => {
        setClientPaging((p) => ({ ...p, pageIndex: 0 }));
        setRowSelection({});
        setFocusIndex(0);
    }, [data]);

    const selectColumn = useMemo<ColumnDef<T>>(
        () => ({
            id: '_select',
            enableSorting: false,
            meta: { width: 44, noCsv: true, alwaysVisible: true, label: 'Select' },
            header: ({ table }) => (
                <Checkbox
                    size="small"
                    checked={table.getIsAllRowsSelected()}
                    indeterminate={table.getIsSomeRowsSelected()}
                    onChange={table.getToggleAllRowsSelectedHandler()}
                    inputProps={{ 'aria-label': 'Select all rows' }}
                    sx={{ p: 0.5 }}
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    size="small"
                    checked={row.getIsSelected()}
                    onChange={row.getToggleSelectedHandler()}
                    onClick={(e) => e.stopPropagation()}
                    inputProps={{ 'aria-label': 'Select row', tabIndex: -1 }}
                    sx={{ p: 0.5 }}
                />
            ),
        }),
        []
    );

    const allColumns = useMemo(
        () => (enableSelection ? [selectColumn, ...columns] : columns),
        [enableSelection, selectColumn, columns]
    );

    const server = pagination.mode === 'server' ? pagination : null;
    const table = useReactTable({
        data,
        columns: allColumns,
        getRowId: (row) => getRowId(row),
        state: {
            sorting,
            columnVisibility: visibility,
            rowSelection,
            pagination: server
                ? { pageIndex: server.pageIndex, pageSize: server.pageSize }
                : clientPaging,
        },
        enableRowSelection: Boolean(enableSelection),
        onRowSelectionChange: setRowSelection,
        onColumnVisibilityChange: setVisibility,
        onSortingChange: (updater) => {
            const next = typeof updater === 'function' ? updater(sorting) : updater;
            if (onSortingChange) onSortingChange(next);
            if (!sortingProp) setSortingState(next);
        },
        onPaginationChange: (updater) => {
            const current = server
                ? { pageIndex: server.pageIndex, pageSize: server.pageSize }
                : clientPaging;
            const next = typeof updater === 'function' ? updater(current) : updater;
            if (server) server.onChange(next);
            else setClientPaging(next);
        },
        manualSorting,
        manualPagination: Boolean(server),
        rowCount: server?.rowCount,
        getCoreRowModel: getCoreRowModel(),
        getSortedRowModel: manualSorting ? undefined : getSortedRowModel(),
        getPaginationRowModel: pagination.mode === 'client' ? getPaginationRowModel() : undefined,
    });

    const rows = table.getRowModel().rows;
    const selected = table.getSelectedRowModel().rows.map((r) => r.original);
    const visibleLeafs = table.getVisibleLeafColumns();

    const exportCsv = () => {
        const cols = visibleLeafs.filter((c) => !c.columnDef.meta?.noCsv);
        // Every row that passed the filters, in the current order, not only this page.
        const source = table.getSortedRowModel().rows;
        const headers = cols.map((c) => columnLabel({ ...c.columnDef, id: c.id }));
        const body = source.map((r) =>
            cols.map((c) => {
                const custom = c.columnDef.meta?.csv;
                return custom ? custom(r.original) : r.getValue(c.id);
            })
        );
        const stamp = new Date().toISOString().slice(0, 10);
        downloadText(`${csvFilename}-${stamp}.csv`, toCsv(headers, body));
    };

    const focusRow = (index: number) => {
        const clamped = Math.max(0, Math.min(rows.length - 1, index));
        setFocusIndex(clamped);
        bodyRef.current
            ?.querySelector<HTMLTableRowElement>(`tr[data-row-index="${clamped}"]`)
            ?.focus();
    };

    const onRowKeyDown = (e: KeyboardEvent<HTMLTableRowElement>, row: Row<T>, index: number) => {
        if (e.target !== e.currentTarget) return;
        const keys: Record<string, () => void> = {
            ArrowDown: () => focusRow(index + 1),
            ArrowUp: () => focusRow(index - 1),
            Home: () => focusRow(0),
            End: () => focusRow(rows.length - 1),
            PageDown: () => table.getCanNextPage() && table.nextPage(),
            PageUp: () => table.getCanPreviousPage() && table.previousPage(),
            Enter: () => onRowActivate?.(row.original),
            ' ': () => enableSelection && row.toggleSelected(),
        };
        const action = keys[e.key];
        if (action) {
            e.preventDefault();
            action();
        }
    };

    const cellStyle = (meta?: { align?: string; width?: number | string }): CSSProperties => ({
        textAlign: (meta?.align as CSSProperties['textAlign']) ?? 'left',
        width: meta?.width,
    });

    const showSkeleton = loading && !data.length;
    const showError = Boolean(error) && !data.length && !loading;
    const showEmpty = !loading && !error && rows.length === 0;
    const total = server ? server.rowCount : table.getPrePaginationRowModel().rows.length;
    const pageSizeOptions =
        pagination.mode === 'none' ? [] : (pagination.pageSizeOptions ?? [10, 25, 50, 100]);

    return (
        <Box
            sx={{
                bgcolor: color.surface,
                border: hairline,
                borderRadius: `${radius.md}px`,
                minWidth: 0,
            }}
        >
            <Box
                sx={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                    gap: 1,
                    px: 1.5,
                    py: 1.25,
                    borderBottom: hairline,
                }}
            >
                <Box sx={{ flex: 1, minWidth: 0 }}>{toolbar}</Box>
                {selected.length > 0 && selectionActions && (
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            {selected.length} selected
                        </Typography>
                        {selectionActions(selected, () => setRowSelection({}))}
                    </Box>
                )}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <ToggleButtonGroup
                        size="small"
                        exclusive
                        value={density}
                        onChange={(_, v: Density | null) => v && setDensity(v)}
                        aria-label="Row density"
                        sx={{ display: { xs: 'none', md: 'flex' }, gap: 0.5 }}
                    >
                        <Tooltip title="Compact rows">
                            <ToggleButton value="compact" aria-label="Compact rows" sx={{ px: 1 }}>
                                <DensityIcon size={16} />
                            </ToggleButton>
                        </Tooltip>
                        <Tooltip title="Comfortable rows">
                            <ToggleButton
                                value="comfortable"
                                aria-label="Comfortable rows"
                                sx={{ px: 1 }}
                            >
                                <DensityIcon size={16} weight="bold" />
                            </ToggleButton>
                        </Tooltip>
                    </ToggleButtonGroup>
                    <Tooltip title="Columns">
                        <IconButton
                            size="small"
                            aria-label="Choose columns"
                            aria-haspopup="menu"
                            onClick={(e) => setColumnsAnchor(e.currentTarget)}
                        >
                            <ColumnsSettingIcon size={18} />
                        </IconButton>
                    </Tooltip>
                    {csvFilename && (
                        <Tooltip title={`Export ${total} rows as CSV`}>
                            <span>
                                <IconButton
                                    size="small"
                                    aria-label={`Export ${total} rows as CSV`}
                                    onClick={exportCsv}
                                    disabled={!total}
                                >
                                    <ExportCsvIcon size={18} />
                                </IconButton>
                            </span>
                        </Tooltip>
                    )}
                </Box>
                <Menu
                    anchorEl={columnsAnchor}
                    open={Boolean(columnsAnchor)}
                    onClose={() => setColumnsAnchor(null)}
                >
                    {table
                        .getAllLeafColumns()
                        .filter((c) => !c.columnDef.meta?.alwaysVisible)
                        .map((c) => (
                            <MenuItem
                                key={c.id}
                                onClick={() => c.toggleVisibility()}
                                role="menuitemcheckbox"
                                aria-checked={c.getIsVisible()}
                                sx={{ py: 0 }}
                            >
                                <FormControlLabel
                                    sx={{ m: 0, pointerEvents: 'none' }}
                                    control={
                                        <Checkbox
                                            size="small"
                                            checked={c.getIsVisible()}
                                            tabIndex={-1}
                                        />
                                    }
                                    label={columnLabel({ ...c.columnDef, id: c.id })}
                                />
                            </MenuItem>
                        ))}
                </Menu>
            </Box>

            <TableContainer sx={{ maxHeight, borderRadius: 0, position: 'relative' }}>
                <Table
                    stickyHeader
                    aria-label={label}
                    aria-busy={loading || undefined}
                    size="small"
                >
                    <TableHead>
                        {table.getHeaderGroups().map((group) => (
                            <TableRow key={group.id}>
                                {group.headers.map((header) => {
                                    const meta = header.column.columnDef.meta;
                                    const sorted = header.column.getIsSorted();
                                    const content = header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext()
                                          );
                                    return (
                                        <TableCell
                                            key={header.id}
                                            style={cellStyle(meta)}
                                            sortDirection={sorted || false}
                                            aria-sort={
                                                sorted === 'asc'
                                                    ? 'ascending'
                                                    : sorted === 'desc'
                                                      ? 'descending'
                                                      : undefined
                                            }
                                            sx={{ whiteSpace: 'nowrap', bgcolor: color.subtle }}
                                        >
                                            {header.column.getCanSort() ? (
                                                <TableSortLabel
                                                    active={Boolean(sorted)}
                                                    direction={sorted || 'asc'}
                                                    onClick={header.column.getToggleSortingHandler()}
                                                    IconComponent={() =>
                                                        sorted === 'asc' ? (
                                                            <SortAscIcon size={12} weight="bold" />
                                                        ) : sorted === 'desc' ? (
                                                            <SortDescIcon size={12} weight="bold" />
                                                        ) : (
                                                            <SortNoneIcon size={12} />
                                                        )
                                                    }
                                                    sx={{
                                                        gap: 0.5,
                                                        color: 'inherit',
                                                        '&.Mui-active': { color: color.ink900 },
                                                        '& svg': { opacity: sorted ? 1 : 0.6 },
                                                        flexDirection:
                                                            meta?.align === 'right'
                                                                ? 'row-reverse'
                                                                : 'row',
                                                    }}
                                                >
                                                    {content}
                                                </TableSortLabel>
                                            ) : (
                                                content
                                            )}
                                        </TableCell>
                                    );
                                })}
                            </TableRow>
                        ))}
                    </TableHead>
                    <TableBody ref={bodyRef}>
                        {showSkeleton &&
                            Array.from({ length: 6 }, (_, i) => (
                                <TableRow key={`s${i}`}>
                                    {visibleLeafs.map((c) => (
                                        <TableCell key={c.id} sx={{ p: DENSITY_PAD[density] }}>
                                            <Skeleton width={c.id === '_select' ? 18 : '70%'} />
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                        {showError && (
                            <TableRow>
                                <TableCell colSpan={visibleLeafs.length} sx={{ border: 0 }}>
                                    <ErrorState
                                        bare
                                        title={`Could not load ${label.toLowerCase()}`}
                                        message={getErrorMessage(error, 'The API did not answer.')}
                                        onRetry={onRetry}
                                    />
                                </TableCell>
                            </TableRow>
                        )}
                        {showEmpty && (
                            <TableRow>
                                <TableCell colSpan={visibleLeafs.length} sx={{ border: 0 }}>
                                    {empty ?? (
                                        <Typography
                                            variant="body2"
                                            color="text.secondary"
                                            sx={{ py: 4, textAlign: 'center' }}
                                        >
                                            No rows.
                                        </Typography>
                                    )}
                                </TableCell>
                            </TableRow>
                        )}
                        {!showSkeleton &&
                            rows.map((row, index) => (
                                <TableRow
                                    key={row.id}
                                    hover
                                    selected={row.getIsSelected()}
                                    data-row-index={index}
                                    tabIndex={
                                        index === Math.min(focusIndex, rows.length - 1) ? 0 : -1
                                    }
                                    onFocus={() => setFocusIndex(index)}
                                    onKeyDown={(e) => onRowKeyDown(e, row, index)}
                                    onClick={
                                        onRowActivate
                                            ? () => onRowActivate(row.original)
                                            : undefined
                                    }
                                    aria-selected={
                                        enableSelection ? row.getIsSelected() : undefined
                                    }
                                    sx={{
                                        cursor: onRowActivate ? 'pointer' : 'default',
                                        '&:focus-visible': {
                                            outline: `2px solid ${color.coral600}`,
                                            outlineOffset: -2,
                                        },
                                        '&.Mui-selected, &.Mui-selected:hover': {
                                            bgcolor: color.canvas,
                                        },
                                    }}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell
                                            key={cell.id}
                                            style={cellStyle(cell.column.columnDef.meta)}
                                            sx={{ p: DENSITY_PAD[density], fontSize: font.size.sm }}
                                        >
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext()
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            ))}
                    </TableBody>
                </Table>
            </TableContainer>

            {pagination.mode !== 'none' && total > 0 && (
                <TablePagination
                    component="div"
                    count={total}
                    page={table.getState().pagination.pageIndex}
                    rowsPerPage={table.getState().pagination.pageSize}
                    rowsPerPageOptions={pageSizeOptions}
                    onPageChange={(_, page) => table.setPageIndex(page)}
                    onRowsPerPageChange={(e) => table.setPageSize(Number(e.target.value))}
                    labelRowsPerPage="Rows"
                />
            )}
        </Box>
    );
}
