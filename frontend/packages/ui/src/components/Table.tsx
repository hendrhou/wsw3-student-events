import { useState, type ReactNode } from "react";
import { cn } from "../utils/cn";
import { Skeleton } from "./Skeleton";

export interface TableColumn<Row> {
  key: string;
  header: string;
  sortable?: boolean;
  numeric?: boolean;
  render: (row: Row) => ReactNode;
}

export interface TableProps<Row> {
  columns: Array<TableColumn<Row>>;
  rows: Row[];
  rowKey: (row: Row) => string;
  loading?: boolean;
  emptyState?: ReactNode;
  onRowClick?: (row: Row) => void;
  /** Footer pagination summary, e.g. "1–12 of 183". */
  footerSummary?: string;
  defaultSortKey?: string;
}

type SortDirection = "ascending" | "descending";

/**
 * Data table (components.md §7): sortable headers with aria-sort, 48px rows,
 * tabular numerics, collapses to stacked label:value cards ≤767px.
 */
export function Table<Row>({ columns, rows, rowKey, loading, emptyState, onRowClick, footerSummary, defaultSortKey }: TableProps<Row>) {
  const [sort, setSort] = useState<{ key: string; direction: SortDirection } | null>(
    defaultSortKey ? { key: defaultSortKey, direction: "ascending" } : null,
  );

  function toggleSort(key: string) {
    setSort((prev) =>
      prev?.key === key
        ? { key, direction: prev.direction === "ascending" ? "descending" : "ascending" }
        : { key, direction: "ascending" },
    );
  }

  return (
    <div className="cp-table-wrap">
      <table className="cp-table">
        <thead>
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className={cn(col.sortable && "cp-table__th-sortable")}
                aria-sort={sort?.key === col.key ? sort.direction : undefined}
                scope="col"
              >
                {col.sortable ? (
                  <button type="button" onClick={() => toggleSort(col.key)}>
                    {col.header}
                    <span aria-hidden="true">{sort?.key === col.key ? (sort.direction === "ascending" ? "▲" : "▼") : "↕"}</span>
                  </button>
                ) : (
                  col.header
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {loading
            ? Array.from({ length: 5 }, (_, i) => (
                <tr key={`skeleton-${i}`}>
                  {columns.map((col) => (
                    <td key={col.key} data-label={col.header}>
                      <Skeleton height={14} />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => (
                <tr
                  key={rowKey(row)}
                  className={cn(onRowClick && "cp-table__row--clickable")}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                >
                  {columns.map((col) => (
                    <td key={col.key} data-label={col.header} className={cn(col.numeric && "cp-table__cell--numeric")}>
                      {col.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
        </tbody>
      </table>
      {!loading && rows.length === 0 && emptyState ? emptyState : null}
      {footerSummary ? <div className="cp-table__footer">{footerSummary}</div> : null}
    </div>
  );
}
