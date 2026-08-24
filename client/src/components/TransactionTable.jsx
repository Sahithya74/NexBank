import DataTable from './DataTable';
import StatusBadge from './StatusBadge';
import Icon from './Icon';
import { EmptyState } from './States';
import { formatDate, formatMoney, humanise } from '../utils/format';

const TYPE_ICON = {
  transfer_in: 'arrowDown',
  transfer_out: 'arrowUp',
  self_transfer: 'swap',
  conversion: 'swap',
  bill_payment: 'bills',
  card_payment: 'cards',
  loan_disbursement: 'loans',
  loan_repayment: 'loans',
  deposit: 'arrowDown',
  withdrawal: 'arrowUp',
  fee: 'info',
};

/**
 * The shared ledger view. `showCustomer` turns it into the staff-wide monitor;
 * without it, it renders a customer's own history.
 */
export default function TransactionTable({
  transactions,
  loading,
  error,
  onRetry,
  pagination,
  onPageChange,
  sort,
  onSortChange,
  showCustomer = false,
  showBalance = true,
  onSelect,
  emptyTitle = 'No transactions yet',
  emptyText = 'Transactions will appear here as soon as money moves.',
}) {
  const columns = [
    {
      key: 'description',
      header: 'Transaction',
      render: (row) => (
        <div className="row" style={{ gap: 10, flexWrap: 'nowrap' }}>
          <span
            className={`stat__icon ${row.direction === 'credit' ? 'stat__icon--success' : 'stat__icon--navy'}`}
            style={{ width: 30, height: 30 }}
            aria-hidden="true"
          >
            <Icon name={TYPE_ICON[row.type] || 'transactions'} size={15} />
          </span>
          <span style={{ minWidth: 0 }}>
            <div className="cell-title">{row.description}</div>
            <div className="cell-sub">
              {humanise(row.type)}
              {row.counterparty ? ` · ${row.counterparty}` : ''}
            </div>
          </span>
        </div>
      ),
    },
    ...(showCustomer
      ? [
          {
            key: 'customer',
            header: 'Customer',
            render: (row) => (
              <>
                <div className="cell-title">{row.customer}</div>
                <div className="cell-sub">{row.customerEmail}</div>
              </>
            ),
          },
        ]
      : []),
    {
      key: 'reference',
      header: 'Reference',
      render: (row) => <span className="mono">{row.reference}</span>,
    },
    {
      key: 'date',
      header: 'Date',
      sortKey: 'created_at',
      render: (row) => formatDate(row.date, { withTime: true }),
    },
    {
      key: 'amount',
      header: 'Amount',
      align: 'right',
      sortKey: 'amount',
      render: (row) => (
        <span className={row.direction === 'credit' ? 'amount--credit' : 'amount--debit'}>
          {row.direction === 'credit' ? '+' : '−'}
          {formatMoney(row.amount, row.currency)}
        </span>
      ),
    },
    ...(showBalance
      ? [
          {
            key: 'balanceAfter',
            header: 'Balance',
            align: 'right',
            render: (row) =>
              row.balanceAfter === null ? (
                <span style={{ color: 'var(--faint)' }}>—</span>
              ) : (
                formatMoney(row.balanceAfter, row.currency)
              ),
          },
        ]
      : []),
    {
      key: 'status',
      header: 'Status',
      sortKey: 'status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <DataTable
      columns={columns}
      rows={transactions}
      loading={loading}
      error={error}
      onRetry={onRetry}
      pagination={pagination}
      onPageChange={onPageChange}
      sort={sort}
      onSortChange={onSortChange}
      onRowClick={onSelect}
      caption="Transaction history"
      empty={<EmptyState icon="transactions" title={emptyTitle} text={emptyText} />}
    />
  );
}
