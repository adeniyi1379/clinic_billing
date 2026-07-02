import { Activity } from 'lucide-react'
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
    <div className="print-area bg-white text-slate-900 mx-auto" style={{ maxWidth: '80mm', padding: '8mm 6mm', fontFamily: 'JetBrains Mono, monospace', fontSize: '11px', lineHeight: '1.5' }}>
      {/* Header */}
      <div className="text-center mb-2">
        {settings?.logo_url ? (
          <img src={settings.logo_url} alt="logo" style={{ maxHeight: '40px', margin: '0 auto 4px' }} />
        ) : (
          <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '32px', height: '32px', borderRadius: '6px', background: '#186048', margin: '0 auto 4px' }}>
            <Activity size={18} color="white" />
          </div>
        )}
        <div style={{ fontSize: '14px', fontWeight: 700 }}>{settings?.name || 'City General Hospital'}</div>
        {settings?.address && <div style={{ fontSize: '10px' }}>{settings.address}</div>}
        {settings?.phone && <div style={{ fontSize: '10px' }}>Tel: {settings.phone}</div>}
        {settings?.email && <div style={{ fontSize: '10px' }}>{settings.email}</div>}
      </div>

      <div style={{ borderTop: '1px dashed #999', borderBottom: '1px dashed #999', padding: '4px 0', margin: '6px 0', textAlign: 'center', fontWeight: 700, fontSize: '12px' }}>
        PAYMENT RECEIPT
      </div>

      {/* Receipt meta */}
      <table style={{ width: '100%', fontSize: '11px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '1px 0' }}><strong>Receipt #:</strong></td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{transaction.receipt_number}</td>
          </tr>
          <tr>
            <td style={{ padding: '1px 0' }}><strong>Date:</strong></td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{formatDateTime(transaction.transaction_date)}</td>
          </tr>
          <tr>
            <td style={{ padding: '1px 0' }}><strong>Customer:</strong></td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{transaction.customer_name}</td>
          </tr>
          {transaction.card_number && (
            <tr>
              <td style={{ padding: '1px 0' }}><strong>Card No:</strong></td>
              <td style={{ padding: '1px 0', textAlign: 'right' }}>{transaction.card_number}</td>
            </tr>
          )}
          {transaction.phone_number && (
            <tr>
              <td style={{ padding: '1px 0' }}><strong>Phone:</strong></td>
              <td style={{ padding: '1px 0', textAlign: 'right' }}>{transaction.phone_number}</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '1px 0' }}><strong>Served by:</strong></td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{transaction.staff_name}</td>
          </tr>
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Items */}
      <table style={{ width: '100%', fontSize: '10px' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid #999' }}>
            <th style={{ textAlign: 'left', padding: '2px 0' }}>Service</th>
            <th style={{ textAlign: 'center', padding: '2px 0' }}>Qty</th>
            <th style={{ textAlign: 'right', padding: '2px 0' }}>Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it) => (
            <tr key={it.id} style={{ verticalAlign: 'top' }}>
              <td style={{ padding: '2px 0' }}>
                <div style={{ fontWeight: 600 }}>{it.service_name}</div>
                {it.description && <div style={{ fontSize: '9px', color: '#666' }}>{it.description}</div>}
                <div style={{ fontSize: '9px', color: '#666' }}>{formatCurrency(it.unit_price, symbol)} each</div>
              </td>
              <td style={{ padding: '2px 0', textAlign: 'center' }}>{it.quantity}</td>
              <td style={{ padding: '2px 0', textAlign: 'right' }}>{formatCurrency(it.total_amount, symbol)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Totals */}
      <table style={{ width: '100%', fontSize: '11px' }}>
        <tbody>
          <tr>
            <td style={{ padding: '1px 0' }}>Subtotal:</td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{formatCurrency(transaction.subtotal, symbol)}</td>
          </tr>
          <tr style={{ fontWeight: 700, fontSize: '12px' }}>
            <td style={{ padding: '2px 0', borderTop: '1px solid #999' }}>Grand Total:</td>
            <td style={{ padding: '2px 0', textAlign: 'right', borderTop: '1px solid #999' }}>{formatCurrency(transaction.grand_total, symbol)}</td>
          </tr>
          <tr>
            <td style={{ padding: '1px 0' }}>Amount Paid:</td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{formatCurrency(transaction.amount_paid, symbol)}</td>
          </tr>
          {transaction.outstanding_balance > 0 && (
            <tr style={{ fontWeight: 700 }}>
              <td style={{ padding: '1px 0' }}>Outstanding:</td>
              <td style={{ padding: '1px 0', textAlign: 'right' }}>{formatCurrency(transaction.outstanding_balance, symbol)}</td>
            </tr>
          )}
          <tr>
            <td style={{ padding: '1px 0' }}>Method:</td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{PAYMENT_METHOD_LABELS[transaction.payment_method]}</td>
          </tr>
          <tr>
            <td style={{ padding: '1px 0' }}>Status:</td>
            <td style={{ padding: '1px 0', textAlign: 'right' }}>{PAYMENT_STATUS_LABELS[transaction.payment_status]}</td>
          </tr>
        </tbody>
      </table>

      {transaction.notes && (
        <>
          <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />
          <div style={{ fontSize: '10px' }}><strong>Notes:</strong> {transaction.notes}</div>
        </>
      )}

      <div style={{ borderTop: '1px dashed #999', margin: '6px 0' }} />

      {/* Footer */}
      <div style={{ textAlign: 'center', fontSize: '10px', marginTop: '4px' }}>
        <div style={{ fontWeight: 600 }}>{settings?.footer_message || 'Thank you for choosing our hospital.'}</div>
        <div style={{ marginTop: '4px', fontSize: '9px', color: '#666' }}>
          This is a computer-generated receipt from {prefix} system.
        </div>
      </div>
    </div>
  )
}
