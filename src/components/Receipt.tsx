import type { Transaction, TransactionItem, HospitalSettings } from '../lib/types'
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '../lib/types'
import { formatCurrency, formatDateTime } from '../lib/format'

interface ReceiptProps {
  transaction: Transaction
  items: TransactionItem[]
  settings: HospitalSettings | null
}

export function Receipt({ transaction, items, settings }: ReceiptProps) {
  const symbol = settings?.currency_symbol || '₦'
  const prefix = settings?.receipt_prefix || 'RCP'

  return (
    <div
      className="print-area bg-white text-black mx-auto"
      style={{
        width: '80mm',
        maxWidth: '80mm',
        padding: '2mm 3mm',
        fontFamily: '"JetBrains Mono", "Courier New", monospace',
        fontSize: '11px',
        lineHeight: '1.5',
        color: '#000',
      }}
    >
      {/* Hospital header */}
      <div style={{ textAlign: 'center', marginBottom: '2mm' }}>
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="logo" style={{ maxHeight: '40px', margin: '0 auto 2mm', display: 'block' }} />
        ) : null}
        <div style={{ fontSize: '14px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
          {settings?.name || 'City General Hospital'}
        </div>
        {settings?.address && <div style={{ fontSize: '10px', marginTop: '1px' }}>{settings.address}</div>}
        {settings?.phone && <div style={{ fontSize: '10px' }}>Tel: {settings.phone}</div>}
        {settings?.email && <div style={{ fontSize: '10px' }}>{settings.email}</div>}
        {settings?.website && <div style={{ fontSize: '10px' }}>{settings.website}</div>}
      </div>

      <DashedLine />

      <div style={{ textAlign: 'center', fontWeight: 700, fontSize: '12px', padding: '1mm 0' }}>
        PAYMENT RECEIPT
      </div>

      <DashedLine />

      {/* Receipt meta */}
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
        <tbody>
          <MetaRow label="Receipt No:" value={transaction.receipt_number} />
          <MetaRow label="Date:" value={formatDateTime(transaction.transaction_date)} />
          <MetaRow label="Customer:" value={transaction.customer_name} />
          {transaction.card_number && <MetaRow label="Card No:" value={transaction.card_number} />}
          {transaction.phone_number && <MetaRow label="Phone:" value={transaction.phone_number} />}
          <MetaRow label="Served By:" value={transaction.staff_name} />
        </tbody>
      </table>

      <DashedLine />

      {/* Items header */}
      <table style={{ width: '100%', fontSize: '10px', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ borderBottom: '1px dashed #000' }}>
            <th style={{ textAlign: 'left', padding: '1mm 0', fontWeight: 700 }}>Item</th>
            <th style={{ textAlign: 'center', padding: '1mm 0', fontWeight: 700, width: '8mm' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '1mm 0', fontWeight: 700, width: '22mm' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} style={{ verticalAlign: 'top' }}>
              <td style={{ padding: '1mm 0' }}>
                <div style={{ fontWeight: 600 }}>{it.service_name}</div>
                {it.description && <div style={{ fontSize: '9px', color: '#333' }}>{it.description}</div>}
                <div style={{ fontSize: '9px', color: '#333' }}>
                  {it.quantity} x {formatCurrency(it.unit_price, symbol)}
                </div>
              </td>
              <td style={{ padding: '1mm 0', textAlign: 'center' }}>{it.quantity}</td>
              <td style={{ padding: '1mm 0', textAlign: 'right', fontWeight: 600 }}>
                {formatCurrency(it.total_amount, symbol)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <DashedLine />

      {/* Totals */}
      <table style={{ width: '100%', fontSize: '11px', borderCollapse: 'collapse' }}>
        <tbody>
          <tr>
            <td style={{ padding: '0.5mm 0' }}>Subtotal:</td>
            <td style={{ padding: '0.5mm 0', textAlign: 'right' }}>{formatCurrency(transaction.subtotal, symbol)}</td>
          </tr>
          <tr style={{ fontWeight: 700, fontSize: '12px' }}>
            <td style={{ padding: '1mm 0', borderTop: '1px solid #000' }}>GRAND TOTAL:</td>
            <td style={{ padding: '1mm 0', textAlign: 'right', borderTop: '1px solid #000' }}>
              {formatCurrency(transaction.grand_total, symbol)}
            </td>
          </tr>
          <tr>
            <td style={{ padding: '0.5mm 0' }}>Amount Paid:</td>
            <td style={{ padding: '0.5mm 0', textAlign: 'right' }}>{formatCurrency(transaction.amount_paid, symbol)}</td>
          </tr>
          {transaction.outstanding_balance > 0 && (
            <tr style={{ fontWeight: 700 }}>
              <td style={{ padding: '0.5mm 0' }}>Outstanding:</td>
              <td style={{ padding: '0.5mm 0', textAlign: 'right' }}>
                {formatCurrency(transaction.outstanding_balance, symbol)}
              </td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '0.5mm 0' }}>Method:</td>
            <td style={{ padding: '0.5mm 0', textAlign: 'right' }}>{PAYMENT_METHOD_LABELS[transaction.payment_method]}</td>
          </tr>
          <tr>
            <td style={{ padding: '0.5mm 0' }}>Status:</td>
            <td style={{ padding: '0.5mm 0', textAlign: 'right' }}>{PAYMENT_STATUS_LABELS[transaction.payment_status]}</td>
          </tr>
        </tbody>
      </table>

      {transaction.notes && (
        <>
          <DashedLine />
          <div style={{ fontSize: '10px', padding: '1mm 0' }}>
            <strong>Notes:</strong> {transaction.notes}
          </div>
        </>
      )}

      <DashedLine />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '1mm' }}>
        <div style={{ fontWeight: 600 }}>{settings?.footer_message || 'Thank you for choosing our hospital.'}</div>
        {/* <div style={{ marginTop: '2mm', fontSize: '9px', color: '#333' }}>
          This is a computer-generated receipt from {prefix} system.
        </div>
        <div style={{ marginTop: '1mm', fontSize: '9px', color: '#333' }}>
          {formatDateTime(new Date())}
        </div> */}
      </div>

      {/* Cut line indicator */}
      <div style={{ textAlign: 'center', marginTop: '2mm', fontSize: '9px', color: '#999', letterSpacing: '2px' }}>
        - - - - - - - - - - - - - - -
      </div>
    </div>
  )
}

function MetaRow({ label, value }: { label: string; value: string }) {
  return (
    <tr>
      <td style={{ padding: '0.5mm 0', fontWeight: 600, whiteSpace: 'nowrap' }}>{label}</td>
      <td style={{ padding: '0.5mm 0', textAlign: 'right', paddingLeft: '2mm', wordBreak: 'break-word' }}>{value}</td>
    </tr>
  )
}

function DashedLine() {
  return (
    <div
      style={{
        borderTop: '1px dashed #000',
        margin: '1mm 0',
        height: 0,
      }}
    />
  )
}
