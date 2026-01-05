import { useMemo, useState } from 'react';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  createColumnHelper,
  SortingState,
  ColumnFiltersState
} from '@tanstack/react-table';
import {
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  ChevronLeft,
  ChevronRight,
  Edit,
  Eye,
  MoreHorizontal
} from 'lucide-react';
import { ContentEntry } from '../../types/entry.types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { cn } from '../../utils/cn';
import { formatRelativeTime, truncate, getStatusColor, getGuardrailColor } from '../../utils/formatters';

interface EntryTableProps {
  entries: ContentEntry[];
  onEdit?: (entry: ContentEntry) => void;
  onView?: (entry: ContentEntry) => void;
  loading?: boolean;
}

const columnHelper = createColumnHelper<ContentEntry>();

export function EntryTable({ entries, onEdit, onView, loading }: EntryTableProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [rowSelection, setRowSelection] = useState({});

  const columns = useMemo(
    () => [
      columnHelper.display({
        id: 'select',
        header: ({ table }) => (
          <input
            type="checkbox"
            checked={table.getIsAllPageRowsSelected()}
            onChange={table.getToggleAllPageRowsSelectedHandler()}
            className="rounded border-slate-300"
          />
        ),
        cell: ({ row }) => (
          <input
            type="checkbox"
            checked={row.getIsSelected()}
            onChange={row.getToggleSelectedHandler()}
            className="rounded border-slate-300"
          />
        ),
        size: 40
      }),
      columnHelper.accessor('title', {
        header: 'Title',
        cell: (info) => (
          <div className="font-medium text-slate-900">
            {truncate(info.getValue(), 50)}
          </div>
        )
      }),
      columnHelper.accessor('domain', {
        header: 'Domain',
        cell: (info) => (
          <span className="text-slate-600">{info.getValue()}</span>
        )
      }),
      columnHelper.accessor('persona', {
        header: 'Persona',
        cell: (info) => (
          <span className="text-slate-600">{info.getValue() || '-'}</span>
        )
      }),
      columnHelper.accessor('status', {
        header: 'Status',
        cell: (info) => {
          const status = info.getValue();
          const colorClass = getStatusColor(status);
          return (
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
              {status}
            </span>
          );
        }
      }),
      columnHelper.accessor('guardrailLevel', {
        header: 'Guardrail',
        cell: (info) => {
          const level = info.getValue();
          const colorClass = getGuardrailColor(level);
          return (
            <span className={cn('px-2 py-0.5 rounded-full text-xs font-medium', colorClass)}>
              {level}
            </span>
          );
        }
      }),
      columnHelper.accessor('updatedAt', {
        header: 'Updated',
        cell: (info) => (
          <span className="text-sm text-slate-500">
            {info.getValue() ? formatRelativeTime(info.getValue()!) : '-'}
          </span>
        )
      }),
      columnHelper.display({
        id: 'actions',
        header: '',
        cell: ({ row }) => (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onView?.(row.original)}
              className="p-1"
            >
              <Eye className="w-4 h-4" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onEdit?.(row.original)}
              className="p-1"
            >
              <Edit className="w-4 h-4" />
            </Button>
            <Button variant="ghost" size="sm" className="p-1">
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
        ),
        size: 100
      })
    ],
    [onEdit, onView]
  );

  const table = useReactTable({
    data: entries,
    columns,
    state: {
      sorting,
      columnFilters,
      rowSelection
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onRowSelectionChange: setRowSelection,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel()
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Table */}
      <div className="overflow-x-auto border border-slate-200 rounded-lg">
        <table className="w-full">
          <thead className="bg-slate-50 border-b border-slate-200">
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={cn(
                      'px-4 py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider',
                      header.column.getCanSort() && 'cursor-pointer select-none'
                    )}
                    onClick={header.column.getToggleSortingHandler()}
                    style={{ width: header.getSize() }}
                  >
                    <div className="flex items-center gap-1">
                      {flexRender(header.column.columnDef.header, header.getContext())}
                      {header.column.getCanSort() && (
                        <span className="text-slate-400">
                          {header.column.getIsSorted() === 'asc' ? (
                            <ChevronUp className="w-4 h-4" />
                          ) : header.column.getIsSorted() === 'desc' ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronsUpDown className="w-4 h-4" />
                          )}
                        </span>
                      )}
                    </div>
                  </th>
                ))}
              </tr>
            ))}
          </thead>
          <tbody className="bg-white divide-y divide-slate-200">
            {table.getRowModel().rows.map((row) => (
              <tr
                key={row.id}
                className={cn(
                  'hover:bg-slate-50 transition-colors',
                  row.getIsSelected() && 'bg-indigo-50'
                )}
              >
                {row.getVisibleCells().map((cell) => (
                  <td key={cell.id} className="px-4 py-3 text-sm">
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200">
        <div className="text-sm text-slate-500">
          {table.getFilteredSelectedRowModel().rows.length} of{' '}
          {table.getFilteredRowModel().rows.length} row(s) selected
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.previousPage()}
            disabled={!table.getCanPreviousPage()}
          >
            <ChevronLeft className="w-4 h-4" />
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {table.getState().pagination.pageIndex + 1} of{' '}
            {table.getPageCount()}
          </span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => table.nextPage()}
            disabled={!table.getCanNextPage()}
          >
            Next
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
