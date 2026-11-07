import { useState } from 'react';
import { useAuth, useAsync, Card, Button, Badge, Modal, Spinner, Field, ErrorBox, Empty, Tabs, rupees, fmtDateTime, titleCase, useToast } from '@astro/shared';

export function Payments() {
  const { api, can } = useAuth();
  const [status, setStatus] = useState('');
  const list = useAsync(() => api.get(`/admin/payments?status=${status}`), [status]);
  const [refundFor, setRefundFor] = useState(null);
  const [toast, showToast] = useToast();
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Payments & refunds</h1><p>Gateway transactions. Card data is never stored — only gateway references.</p></div>
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ width: 200 }} aria-label="Status">{['', 'created', 'authorized', 'captured', 'partially_refunded', 'refunded', 'voided', 'failed'].map((s) => <option key={s} value={s}>{s ? titleCase(s) : 'All statuses'}</option>)}</select></div>
      {list.loading ? <Spinner /> : (
        <Card pad={false}><div className="table-wrap"><table className="table">
          <thead><tr><th>Date</th><th>Order / payment</th><th>Customer → Astrologer</th><th className="right">Authorized</th><th className="right">Captured</th><th className="right">Refunded</th><th>Status</th><th /></tr></thead>
          <tbody>{list.data.map((p) => (
            <tr key={p.transaction_id}>
              <td className="small">{fmtDateTime(p.created_at)}</td><td className="mono">{p.gateway_order_id}<div>{p.gateway_payment_id}</div></td>
              <td className="small">{p.client_name} → {p.astrologer_name}</td><td className="right">{rupees(p.amount_paise)}</td><td className="right">{rupees(p.captured_paise)}</td><td className="right">{rupees(p.refunded_paise)}</td>
              <td><Badge status={p.status} />{p.failure_reason && <div className="tiny bad">{p.failure_reason}</div>}</td>
              <td>{can('payments.refund') && ['captured', 'partially_refunded'].includes(p.status) && <Button size="sm" variant="secondary" onClick={() => setRefundFor(p)}>Refund</Button>}</td>
            </tr>
          ))}</tbody>
        </table></div></Card>
      )}
      {refundFor && <RefundModal p={refundFor} onClose={() => setRefundFor(null)} onDone={() => { setRefundFor(null); list.reload(); showToast('Refund processed'); }} />}
      {toast}
    </div>
  );
}

function RefundModal({ p, onClose, onDone }) {
  const { api } = useAuth();
  const max = p.captured_paise - p.refunded_paise;
  const [amount, setAmount] = useState(max / 100);
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api.post(`/admin/payments/${p.transaction_id}/refund`, { amountPaise: Math.round(amount * 100), reason }); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open onClose={onClose} title="Issue refund" footer={<Button variant="danger" loading={busy} disabled={!reason || amount <= 0} onClick={submit}>Refund {rupees(Math.round(amount * 100))}</Button>}>
      <ErrorBox error={err} />
      <p className="small">Refundable: <strong>{rupees(max)}</strong>. The astrologer's payable is adjusted proportionally through a ledger adjustment entry.</p>
      <Field label="Amount (₹)"><input type="number" min="1" max={max / 100} step="0.01" value={amount} onChange={(e) => setAmount(Number(e.target.value))} /></Field>
      <Field label="Reason (audited, shared with customer)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

export function Finance() {
  const [tab, setTab] = useState('payouts');
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Commission & payouts</h1><p>Ledger-based astrologer earnings, configurable commission and payout batches.</p></div></div>
      <Tabs value={tab} onChange={setTab} tabs={[{ value: 'payouts', label: 'Payouts' }, { value: 'rules', label: 'Commission rules' }, { value: 'ledger', label: 'Ledger' }]} />
      {tab === 'payouts' && <Payouts />}{tab === 'rules' && <Rules />}{tab === 'ledger' && <Ledger />}
    </div>
  );
}

function Payouts() {
  const { api } = useAuth();
  const d = useAsync(() => api.get('/admin/payouts'), []);
  const [mark, setMark] = useState(null);
  const [busy, setBusy] = useState(false);
  const [toast, showToast] = useToast();
  if (d.loading) return <Spinner />;
  const batch = async () => { setBusy(true); try { const r = await api.post('/admin/payouts/batch'); showToast(`${r.length} payouts created`); d.reload(); } catch (e) { showToast(e.message, 'bad'); } finally { setBusy(false); } };
  return (
    <div className="stack">
      <Card title="Balances" actions={<Button size="sm" loading={busy} onClick={batch}>Create payout batch</Button>}>
        <p className="small muted">Entries become eligible after a {d.data.holdDays}-day hold. Batches include astrologers with ≥ {rupees(d.data.minPayoutPaise)} eligible and bank details on file.</p>
        {!d.data.pending.length ? <Empty title="No outstanding balances" /> : (
          <div className="table-wrap"><table className="table"><thead><tr><th>Astrologer</th><th className="right">On hold</th><th className="right">Eligible</th><th>Bank details</th></tr></thead>
            <tbody>{d.data.pending.map((p) => <tr key={p.astrologer_id}><td>{p.display_name}</td><td className="right">{rupees(p.on_hold_paise)}</td><td className="right"><strong>{rupees(p.eligible_paise)}</strong></td><td>{p.has_bank_details ? <Badge tone="ok">On file</Badge> : <Badge tone="warn">Missing</Badge>}</td></tr>)}</tbody></table></div>
        )}
      </Card>
      <Card title="Payout batches" pad={false}>
        <div className="table-wrap"><table className="table">
          <thead><tr><th>Created</th><th>Astrologer</th><th className="right">Amount</th><th>Entries</th><th>Status</th><th>Reference</th><th /></tr></thead>
          <tbody>{d.data.payouts.map((p) => <tr key={p.payout_id}><td className="small">{fmtDateTime(p.created_at)}</td><td>{p.astrologer_name}</td><td className="right">{rupees(p.amount_paise)}</td><td>{p.entry_count}</td><td><Badge status={p.status} /></td><td className="mono">{p.reference || p.failure_reason}</td>
            <td>{p.status === 'processing' && <Button size="sm" variant="secondary" onClick={() => setMark(p)}>Reconcile</Button>}</td></tr>)}</tbody>
        </table></div>
      </Card>
      {mark && <MarkPayout p={mark} onClose={() => setMark(null)} onDone={() => { setMark(null); d.reload(); showToast('Payout updated'); }} />}
      {toast}
    </div>
  );
}

function MarkPayout({ p, onClose, onDone }) {
  const { api } = useAuth();
  const [ref, setRef] = useState('');
  const [reason, setReason] = useState('');
  const [err, setErr] = useState(null);
  const go = async (status) => { try { await api.post(`/admin/payouts/${p.payout_id}/mark`, { status, reference: ref || undefined, reason: reason || undefined }); onDone(); } catch (e) { setErr(e); } };
  return (
    <Modal open onClose={onClose} title={`Reconcile payout — ${p.astrologer_name} ${rupees(p.amount_paise)}`}
      footer={<><Button variant="secondary" disabled={!reason} onClick={() => go('failed')}>Mark failed</Button><Button disabled={!ref} onClick={() => go('paid')}>Mark paid</Button></>}>
      <ErrorBox error={err} />
      <Field label="Bank / UTR reference (for paid)"><input value={ref} onChange={(e) => setRef(e.target.value)} /></Field>
      <Field label="Failure reason (for failed — entries return to eligible)"><input value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
    </Modal>
  );
}

function Rules() {
  const { api } = useAuth();
  const rules = useAsync(() => api.get('/admin/commission-rules'), []);
  const astros = useAsync(() => api.get('/admin/astrologers?status=approved'), []);
  const [f, setF] = useState({ scope: 'default', platformFeePct: 30, astrologerId: '', mode: 'chat', note: '' });
  const [err, setErr] = useState(null);
  const save = async (e) => {
    e.preventDefault(); setErr(null);
    try {
      await api.post('/admin/commission-rules', { scope: f.scope, platformFeeBps: Math.round(f.platformFeePct * 100), astrologerId: f.scope === 'astrologer' ? f.astrologerId : undefined, mode: f.scope === 'mode' ? f.mode : undefined, note: f.note || undefined });
      rules.reload();
    } catch (x) { setErr(x); }
  };
  return (
    <div className="stack">
      <Card title="New rule">
        <form onSubmit={save} className="stack">
          <ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Scope"><select value={f.scope} onChange={(e) => setF({ ...f, scope: e.target.value })}><option value="default">Default</option><option value="mode">Consultation mode</option><option value="astrologer">Specific astrologer</option></select></Field>
            {f.scope === 'mode' && <Field label="Mode"><select value={f.mode} onChange={(e) => setF({ ...f, mode: e.target.value })}><option>chat</option><option>voice</option><option>video</option></select></Field>}
            {f.scope === 'astrologer' && <Field label="Astrologer"><select required value={f.astrologerId} onChange={(e) => setF({ ...f, astrologerId: e.target.value })}><option value="">Select…</option>{astros.data?.map((a) => <option key={a.astrologer_id} value={a.astrologer_id}>{a.display_name}</option>)}</select></Field>}
            <Field label="Platform fee %"><input type="number" min="0" max="100" step="0.5" value={f.platformFeePct} onChange={(e) => setF({ ...f, platformFeePct: Number(e.target.value) })} /></Field>
            <Field label="Note"><input value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} /></Field>
          </div>
          <p className="tiny muted">Takes effect now; the previous rule for the same scope is closed with an end date. Precedence: astrologer › mode › default.</p>
          <div><Button type="submit">Save rule</Button></div>
        </form>
      </Card>
      <Card title="Rules" pad={false}>
        {rules.loading ? <Spinner /> : <div className="table-wrap"><table className="table"><thead><tr><th>Scope</th><th>Applies to</th><th className="right">Fee</th><th>Effective</th><th>Note</th></tr></thead>
          <tbody>{rules.data.map((r) => <tr key={r.rule_id} style={{ opacity: r.effective_to ? 0.55 : 1 }}><td>{titleCase(r.scope)}</td><td>{r.astrologer_name || r.mode || 'All'}</td><td className="right">{r.platform_fee_bps / 100}%</td><td className="small">{fmtDateTime(r.effective_from)} → {r.effective_to ? fmtDateTime(r.effective_to) : <Badge tone="ok">current</Badge>}</td><td className="small">{r.note}</td></tr>)}</tbody></table></div>}
      </Card>
    </div>
  );
}

function Ledger() {
  const { api } = useAuth();
  const l = useAsync(() => api.get('/admin/ledger'), []);
  if (l.loading) return <Spinner />;
  return (
    <Card pad={false}><div className="table-wrap"><table className="table">
      <thead><tr><th>Date</th><th>Astrologer</th><th>Type</th><th className="right">Gross</th><th className="right">Platform fee</th><th className="right">Payable</th><th>Status</th><th>Note</th></tr></thead>
      <tbody>{l.data.map((e) => <tr key={e.ledger_id}><td className="small">{fmtDateTime(e.created_at)}</td><td>{e.astrologer_name}</td><td>{e.entry_type}</td><td className="right">{rupees(e.gross_paise)}</td><td className="right">{rupees(e.platform_fee_paise)}</td><td className="right">{rupees(e.payable_paise)}</td><td><Badge status={e.status} /></td><td className="tiny">{e.note}</td></tr>)}</tbody>
    </table></div></Card>
  );
}
