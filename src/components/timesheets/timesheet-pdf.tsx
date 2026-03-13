import React from 'react'
import { Document, Page, View, Text, StyleSheet } from '@react-pdf/renderer'

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Helvetica',
    fontSize: 9,
    color: '#1e293b',
    padding: 40,
    backgroundColor: '#ffffff',
  },
  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 24,
    paddingBottom: 16,
    borderBottom: '1.5px solid #0f172a',
  },
  brandName: { fontSize: 18, fontFamily: 'Helvetica-Bold', color: '#0f172a', letterSpacing: 1 },
  brandSub: { fontSize: 7, color: '#64748b', marginTop: 2, letterSpacing: 0.5 },
  docTitle: { fontSize: 11, fontFamily: 'Helvetica-Bold', color: '#0f172a', textAlign: 'right' },
  docStatus: { fontSize: 8, color: '#64748b', textAlign: 'right', marginTop: 3 },
  // ── Two-column operative block ───────────────────────────────────────────────
  metaRow: { flexDirection: 'row', gap: 20, marginBottom: 20 },
  metaCol: { flex: 1 },
  sectionLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  metaItem: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 3 },
  metaKey: { color: '#64748b' },
  metaVal: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  // ── Table ───────────────────────────────────────────────────────────────────
  tableLabel: {
    fontSize: 7,
    fontFamily: 'Helvetica-Bold',
    color: '#94a3b8',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 6,
  },
  thead: {
    flexDirection: 'row',
    backgroundColor: '#f1f5f9',
    borderRadius: 3,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginBottom: 1,
  },
  tbody: {},
  trow: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderBottom: '0.5px solid #e2e8f0',
  },
  tfooter: {
    flexDirection: 'row',
    paddingHorizontal: 8,
    paddingVertical: 7,
    backgroundColor: '#f8fafc',
    borderTop: '1.5px solid #cbd5e1',
    marginTop: 1,
  },
  th: { fontFamily: 'Helvetica-Bold', color: '#475569', fontSize: 8 },
  td: { color: '#334155', fontSize: 9 },
  tdMuted: { color: '#94a3b8', fontSize: 9 },
  tdBold: { fontFamily: 'Helvetica-Bold', color: '#0f172a', fontSize: 9 },
  // column widths
  colDate: { width: '22%' },
  colHours: { width: '14%', textAlign: 'right' },
  colOT: { width: '14%', textAlign: 'right' },
  colRate: { width: '16%', textAlign: 'right' },
  colPay: { width: '16%', textAlign: 'right' },
  colNotes: { width: '18%' },
  // ── Summary box ─────────────────────────────────────────────────────────────
  summaryBox: {
    marginTop: 20,
    flexDirection: 'row',
    justifyContent: 'flex-end',
  },
  summaryCard: {
    width: 200,
    backgroundColor: '#f8fafc',
    border: '1px solid #e2e8f0',
    borderRadius: 4,
    padding: 12,
  },
  summaryRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  summaryKey: { color: '#64748b' },
  summaryVal: { fontFamily: 'Helvetica-Bold', color: '#0f172a' },
  summaryTotal: { flexDirection: 'row', justifyContent: 'space-between', borderTop: '1px solid #cbd5e1', paddingTop: 6, marginTop: 4 },
  summaryTotalKey: { fontFamily: 'Helvetica-Bold', color: '#0f172a', fontSize: 10 },
  summaryTotalVal: { fontFamily: 'Helvetica-Bold', color: '#0f172a', fontSize: 12 },
  // ── Footer ──────────────────────────────────────────────────────────────────
  footer: {
    position: 'absolute',
    bottom: 30,
    left: 40,
    right: 40,
    flexDirection: 'row',
    justifyContent: 'space-between',
    borderTop: '0.5px solid #e2e8f0',
    paddingTop: 6,
  },
  footerText: { fontSize: 7, color: '#94a3b8' },
})

function fmt(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function statusLabel(s: string) {
  const m: Record<string, string> = { draft: 'Draft', submitted: 'Submitted', approved: 'Approved', rejected: 'Rejected', locked: 'Locked' }
  return m[s] ?? s
}

interface Entry {
  id: string
  entry_date: string
  hours_worked: string | number
  overtime_hours: string | number | null
  day_rate: string | number | null
  is_manual: boolean | null
  notes: string | null
}

interface Operative {
  first_name: string
  last_name: string
  reference_number: string | null
  phone: string | null
  utr_number: string | null
  ni_number: string | null
}

interface Timesheet {
  week_start: string
  total_hours: string | number | null
  overtime_hours: string | number | null
  total_days: number | null
  day_rate_used: string | number | null
  gross_pay: string | number | null
  status: string | null
  approved_at: string | null
  operative: Operative | null
}

interface Props {
  ts: Timesheet
  entries: Entry[]
}

export function TimesheetPDF({ ts, entries }: Props) {
  const op = ts.operative
  const operativeName = op ? `${op.first_name} ${op.last_name}` : 'Unknown'
  const generatedAt = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>Rex</Text>
            <Text style={styles.brandSub}>PANGAEA WORKFORCE</Text>
          </View>
          <View>
            <Text style={styles.docTitle}>TIMESHEET</Text>
            <Text style={styles.docStatus}>Status: {statusLabel(ts.status ?? 'draft')}</Text>
            {ts.approved_at && (
              <Text style={styles.docStatus}>Approved: {fmtDate(ts.approved_at)}</Text>
            )}
          </View>
        </View>

        {/* Operative + Week meta */}
        <View style={styles.metaRow}>
          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Operative</Text>
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Name</Text>
              <Text style={styles.metaVal}>{operativeName}</Text>
            </View>
            {op?.reference_number && (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>Ref</Text>
                <Text style={styles.metaVal}>{op.reference_number}</Text>
              </View>
            )}
            {op?.phone && (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>Phone</Text>
                <Text style={styles.metaVal}>{op.phone}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Tax Details</Text>
            {op?.utr_number && (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>UTR</Text>
                <Text style={styles.metaVal}>{op.utr_number}</Text>
              </View>
            )}
            {op?.ni_number && (
              <View style={styles.metaItem}>
                <Text style={styles.metaKey}>NI</Text>
                <Text style={styles.metaVal}>{op.ni_number}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaCol}>
            <Text style={styles.sectionLabel}>Period</Text>
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Week commencing</Text>
              <Text style={styles.metaVal}>{fmtDate(ts.week_start)}</Text>
            </View>
            <View style={styles.metaItem}>
              <Text style={styles.metaKey}>Days worked</Text>
              <Text style={styles.metaVal}>{ts.total_days ?? 0}</Text>
            </View>
          </View>
        </View>

        {/* Entries table */}
        <Text style={styles.tableLabel}>Entries</Text>
        <View style={styles.thead}>
          <Text style={[styles.th, styles.colDate]}>Date</Text>
          <Text style={[styles.th, styles.colHours]}>Hours</Text>
          <Text style={[styles.th, styles.colOT]}>Overtime</Text>
          <Text style={[styles.th, styles.colRate]}>Day Rate</Text>
          <Text style={[styles.th, styles.colPay]}>Pay</Text>
          <Text style={[styles.th, styles.colNotes]}>Notes</Text>
        </View>
        <View style={styles.tbody}>
          {entries.map((e) => {
            const pay = e.day_rate != null
              ? `£${(Number(e.hours_worked) / 8 * Number(e.day_rate)).toFixed(2)}`
              : '—'
            return (
              <View key={e.id} style={styles.trow}>
                <Text style={[styles.td, styles.colDate]}>
                  {fmt(e.entry_date)}{e.is_manual ? ' *' : ''}
                </Text>
                <Text style={[styles.td, styles.colHours]}>{Number(e.hours_worked).toFixed(1)}</Text>
                <Text style={[styles.tdMuted, styles.colOT]}>
                  {Number(e.overtime_hours ?? 0) > 0 ? Number(e.overtime_hours).toFixed(1) : '—'}
                </Text>
                <Text style={[styles.td, styles.colRate]}>
                  {e.day_rate != null ? `£${Number(e.day_rate).toFixed(2)}` : '—'}
                </Text>
                <Text style={[styles.td, styles.colPay]}>{pay}</Text>
                <Text style={[styles.tdMuted, styles.colNotes]}>{e.notes ?? ''}</Text>
              </View>
            )
          })}
        </View>
        <View style={styles.tfooter}>
          <Text style={[styles.tdBold, styles.colDate]}>Totals</Text>
          <Text style={[styles.tdBold, styles.colHours]}>{Number(ts.total_hours ?? 0).toFixed(1)}</Text>
          <Text style={[styles.tdMuted, styles.colOT]}>{Number(ts.overtime_hours ?? 0).toFixed(1)}</Text>
          <Text style={[styles.tdMuted, styles.colRate]}>
            {ts.day_rate_used != null ? `£${Number(ts.day_rate_used).toFixed(2)}/d` : ''}
          </Text>
          <Text style={[styles.tdBold, styles.colPay]}>
            {ts.gross_pay != null ? `£${Number(ts.gross_pay).toFixed(2)}` : '—'}
          </Text>
          <Text style={[styles.tdMuted, styles.colNotes]}>* Manual entry</Text>
        </View>

        {/* Summary */}
        <View style={styles.summaryBox}>
          <View style={styles.summaryCard}>
            <Text style={[styles.sectionLabel, { marginBottom: 8 }]}>Summary</Text>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Total hours</Text>
              <Text style={styles.summaryVal}>{Number(ts.total_hours ?? 0).toFixed(1)}</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Overtime</Text>
              <Text style={styles.summaryVal}>{Number(ts.overtime_hours ?? 0).toFixed(1)}h</Text>
            </View>
            <View style={styles.summaryRow}>
              <Text style={styles.summaryKey}>Day rate</Text>
              <Text style={styles.summaryVal}>
                {ts.day_rate_used != null ? `£${Number(ts.day_rate_used).toFixed(2)}` : '—'}
              </Text>
            </View>
            <View style={styles.summaryTotal}>
              <Text style={styles.summaryTotalKey}>Gross Pay</Text>
              <Text style={styles.summaryTotalVal}>
                {ts.gross_pay != null ? `£${Number(ts.gross_pay).toFixed(2)}` : '—'}
              </Text>
            </View>
          </View>
        </View>

        {/* Footer */}
        <View style={styles.footer} fixed>
          <Text style={styles.footerText}>Generated {generatedAt} · Pangaea</Text>
          <Text style={styles.footerText} render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
        </View>
      </Page>
    </Document>
  )
}
