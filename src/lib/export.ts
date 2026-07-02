import jsPDF from 'jspdf'
import autoTable from 'jspdf-autotable'
import * as XLSX from 'xlsx'
import { formatCurrency, formatDateTime } from './format'
import type { HospitalSettings, PaymentMethod } from './types'
import { PAYMENT_METHOD_LABELS } from './types'

interface ReportRow {
  [key: string]: string | number
}

export function exportToPDF(
  title: string,
  subtitle: string,
  columns: string[],
  rows: ReportRow[],
  settings: HospitalSettings | null,
  summary?: { label: string; value: string }[],
) {
  const doc = new jsPDF()
  const symbol = settings?.currency_symbol || '₦'

  // Header
  doc.setFontSize(16)
  doc.setFont('helvetica', 'bold')
  doc.text(settings?.name || 'Hospital', 14, 18)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(settings?.address || '', 14, 24)
  doc.text(`Tel: ${settings?.phone || ''}`, 14, 29)

  doc.setFontSize(14)
  doc.setFont('helvetica', 'bold')
  doc.text(title, 14, 40)

  doc.setFontSize(10)
  doc.setFont('helvetica', 'normal')
  doc.text(subtitle, 14, 46)

  // Table
  autoTable(doc, {
    startY: summary ? 58 : 52,
    head: [columns],
    body: rows.map((r) => columns.map((c) => String(r[c] ?? ''))),
    headStyles: { fillColor: [24, 96, 72], textColor: 255 },
    styles: { fontSize: 9, cellPadding: 3 },
    alternateRowStyles: { fillColor: [245, 250, 247] },
  })

  // Summary after table
  if (summary && summary.length > 0) {
    const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY
    let y = finalY + 10
    doc.setFontSize(11)
    doc.setFont('helvetica', 'bold')
    doc.text('Summary', 14, y)
    y += 6
    doc.setFont('helvetica', 'normal')
    doc.setFontSize(10)
    summary.forEach((s) => {
      doc.text(`${s.label}:`, 14, y)
      doc.text(s.value, 80, y)
      y += 6
    })
  }

  // Footer
  const pageHeight = doc.internal.pageSize.height
  doc.setFontSize(8)
  doc.setTextColor(120)
  doc.text(
    `Generated on ${formatDateTime(new Date())} by MediBill`,
    14,
    pageHeight - 10,
  )

  doc.save(`${title.replace(/\s+/g, '_').toLowerCase()}.pdf`)
}

export function exportToExcel(
  filename: string,
  sheets: { name: string; columns: string[]; rows: ReportRow[] }[],
) {
  const wb = XLSX.utils.book_new()
  sheets.forEach((sheet) => {
    const data = [sheet.columns, ...sheet.rows.map((r) => sheet.columns.map((c) => r[c] ?? ''))]
    const ws = XLSX.utils.aoa_to_sheet(data as (string | number)[][])
    XLSX.utils.book_append_sheet(wb, ws, sheet.name.slice(0, 31))
  })
  XLSX.writeFile(wb, `${filename.replace(/\s+/g, '_').toLowerCase()}.xlsx`)
}

export function buildTransactionRows(
  transactions: { receipt_number: string; customer_name: string; transaction_date: string; payment_method: PaymentMethod; grand_total: number; amount_paid: number; outstanding_balance: number; payment_status: string; staff_name: string }[],
  symbol: string,
): ReportRow[] {
  return transactions.map((t) => ({
    'Receipt #': t.receipt_number,
    'Customer': t.customer_name,
    'Date': formatDateTime(t.transaction_date),
    'Method': PAYMENT_METHOD_LABELS[t.payment_method],
    'Grand Total': formatCurrency(t.grand_total, symbol),
    'Amount Paid': formatCurrency(t.amount_paid, symbol),
    'Outstanding': formatCurrency(t.outstanding_balance, symbol),
    'Status': t.payment_status,
    'Staff': t.staff_name,
  }))
}
