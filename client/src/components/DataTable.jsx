import Icon from './Icon';
import Button from './Button';
import { QueryState } from './States';

/**
 * Table shell used by every listing screen. Columns declare their own cell
 * renderer and mobile label; below 720px rows re-flow into stacked records so
 * the data stays readable rather than being squeezed sideways.
 */
export default function DataTable({
  columns,
  rows,
  keyField = 'id',
  loading,
  error,
  onRetry,
  empty,
  sort,
  onSortChange,
  pagination,
  onPageChange,
  caption,
  onRowClick,
}) {
  const isEmpty = !loading && !error && (!rows || rows.length === 0);

  return (
    <>
      <QueryState
        loading={loading}
        error={error}
        isEmpty={isEmpty}
        onRetry={onRetry}
        empty={empty}
        rows={5}
      >
        <div className="table-wrap">
          <table className="table table--stack">
            {caption ? <caption className="visually-hidden">{caption}</caption> : null}
            <thead>
              <tr>
                {columns.map((column) => {
                  const sortable = Boolean(column.sortKey && onSortChange);
                  const isSorted = sortable && sort?.sortBy === column.sortKey;
                  return (
                    <th
                      key={column.key}
                      className={[column.align === 'right' ? 'num' : '', sortable ? 'is-sortable' : '']
                        .filter(Boolean)
                        .join(' ')}
                      aria-sort={isSorted ? (sort.sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
                      onClick={
                        sortable
                          ? () =>
                              onSortChange({
                                sortBy: column.sortKey,
                                sortDir: isSorted && sort.sortDir === 'desc' ? 'asc' : 'desc',
                              })
                          : undefined
                      }
                    >
                      {sortable ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          {column.header}
                          {isSorted ? (
                            <Icon name={sort.sortDir === 'asc' ? 'arrowUp' : 'arrowDown'} size={12} />
                          ) : null}
                        </span>
                      ) : (
                        column.header
                      )}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {(rows || []).map((row) => (
                <tr
                  key={row[keyField]}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  style={onRowClick ? { cursor: 'pointer' } : undefined}
                >
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={column.align === 'right' ? 'num' : ''}
                      data-label={column.header}
                    >
                      {column.render ? column.render(row) : row[column.key]}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </QueryState>

      {pagination && pagination.total > 0 && !error ? (
        <Pagination pagination={pagination} onPageChange={onPageChange} />
      ) : null}
    </>
  );
}

export function Pagination({ pagination, onPageChange }) {
  const { page, limit, total } = pagination;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="pagination">
      <span className="pagination__info">
        Showing <strong>{from}</strong>–<strong>{to}</strong> of <strong>{total}</strong>
      </span>
      <div className="pagination__controls">
        <Button
          variant="secondary"
          size="sm"
          icon="chevronLeft"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label="Previous page"
        >
          Previous
        </Button>
        <span className="pagination__info" style={{ padding: '0 6px' }}>
          Page {page} of {totalPages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          iconRight="chevronRight"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          aria-label="Next page"
        >
          Next
        </Button>
      </div>
    </div>
  );
}
