import { Fragment, useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, Card, Badge, Button, Spinner, ErrorBox, Modal, Field, Stars, Alert, rupees, fmtDateTime, useRealtimeEvent, useToast, titleCase } from '@astro/shared';

const STEPS = [['pending_payment', 'Payment'], ['requested', 'Waiting for astrologer'], ['accepted', 'Accepted'], ['ready', 'Ready to join'], ['in_progress', 'In progress'], ['completed', 'Completed']];

export default function BookingDetail() {
  const { id } = useParams();
  const [params, setParams] = useSearchParams();
  const { api } = useAuth();
  const { data: b, loading, error, reload } = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, showToast] = useToast();

  useEffect(() => {
    const p = params.get('payment');
    if (p) {
      showToast(p === 'success' ? 'Payment authorized — waiting for the astrologer' : 'Payment failed. You can retry.', p === 'success' ? 'ok' : 'bad');
      setParams({}, { replace: true });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeEvent((ev) => {
    if (ev.type === 'notification' && (ev.notification.data?.bookingId === id || ev.notification.data?.consultationId === b?.consultation?.consultationId)) reload();
  });
  useEffect(() => {
    if (b?.consultation && ['requested', 'accepted'].includes(b.consultation.status)) { const t = setInterval(reload, 15000); return () => clearInterval(t); }
    return undefined;
  }, [b?.consultation?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading && !b) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  const c = b.consultation;
  const status = c?.status || b.status;
  const stepIndex = STEPS.findIndex(([s]) => s === status);
  const terminalBad = ['rejected', 'cancelled', 'expired', 'failed'].includes(status);

  const retryPayment = async () => {
    setBusy(true); setErr(null);
    try {
      const co = await api.post('/payments/checkout', { bookingId: b.bookingId, returnUrl: `${window.location.origin}/bookings/${b.bookingId}` });
      window.location.assign(co.checkoutUrl);
    } catch (e) { setErr(e); setBusy(false); }
  };
  const cancel = async (reason) => {
    setBusy(true); setErr(null);
    try {
      const r = await api.post(`/bookings/${b.bookingId}/cancel`, { reason: reason || undefined });
      setCancelOpen(false);
      showToast(r.feePaise ? `Cancelled. Cancellation fee ${rupees(r.feePaise)}.` : 'Cancelled. You will not be charged.');
      reload();
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <div className="layout-side">
      <div className="full"><Link to="/bookings" className="small">← My sessions</Link></div>
      <div className="stack" style={{ minWidth: 0 }}>
        <Card title={<span>{b.astrologerName} <Badge status={status} /></span>}>
          <div className="stack">
            <ErrorBox error={err} />
            {status === 'requested' && <Alert tone="info">Your request has been sent. {b.bookingType === 'instant' ? 'The astrologer has a few minutes to accept.' : 'The astrologer will confirm before your slot.'} If they don't accept, you won't be charged.</Alert>}
            {status === 'ready' && <Alert tone="ok"><span>Your consultation is ready. The astrologer will start the session — join now so you don't miss it.</span><Link className="btn btn-primary btn-sm" to={`/consultations/${c.consultationId}`}>Join</Link></Alert>}
            {status === 'in_progress' && <Alert tone="ok"><span>Your session is live.</span><Link className="btn btn-primary btn-sm" to={`/consultations/${c.consultationId}`}>Open chat</Link></Alert>}
            {status === 'pending_payment' && <Alert tone="warn"><span>Payment pending. Complete payment by {fmtDateTime(b.paymentExpiresAt)} to send the request.</span><Button size="sm" loading={busy} onClick={retryPayment}>Pay {rupees(b.quotedAmountPaise)}</Button></Alert>}
            {terminalBad && <Alert tone="info">{b.cancelReason || c?.endReason || 'This booking is closed.'}</Alert>}
            {!terminalBad && (
              <div className="timeline">
                {STEPS.filter(([s]) => b.bookingType === 'scheduled' || s !== 'accepted').map(([s, label]) => {
                  const i = STEPS.findIndex(([x]) => x === s);
                  return <div key={s} className={`timeline-item ${i < stepIndex || status === 'completed' ? 'done' : i === stepIndex ? 'current' : ''}`}>{label}</div>;
                })}
              </div>
            )}
            <dl className="kv">
              <dt>Booking</dt><dd className="mono">{b.bookingId.slice(0, 8).toUpperCase()}</dd>
              <dt>Type</dt><dd>{titleCase(b.bookingType)} {b.mode}</dd>
              {b.scheduledAt && <><dt>Scheduled</dt><dd>{fmtDateTime(b.scheduledAt)}</dd></>}
              <dt>Duration</dt><dd>up to {b.durationMinutes} min at {rupees(b.ratePaise)}/min</dd>
              {b.topic && <><dt>Topic</dt><dd>{b.topic}</dd></>}
              <dt>Policy</dt><dd>Cancellation policy v{b.policyVersion}</dd>
            </dl>
          </div>
        </Card>
        {c?.status === 'completed' && (
          <Card title="Session summary">
            <dl className="kv">
              <dt>Started</dt><dd>{fmtDateTime(c.startedAt)}</dd><dt>Ended</dt><dd>{fmtDateTime(c.endedAt)} ({c.endReason})</dd>
              <dt>Billed</dt><dd>{Math.ceil(c.billableSeconds / 60)} min · <strong>{rupees(c.finalAmountPaise)}</strong></dd>
            </dl>
            <div className="row gap-s mt wrap">
              <Link className="btn btn-secondary btn-sm" to={`/consultations/${c.consultationId}`}>View transcript</Link>
              <Button size="sm" variant="secondary" onClick={async () => setReceipt(await api.get(`/consultations/${c.consultationId}/receipt`))}>Receipt</Button>
              <Button size="sm" variant="accent" onClick={() => setReviewOpen(true)}>Rate this session</Button>
            </div>
          </Card>
        )}
      </div>
      <Card title="Payment" className="sticky">
        <div className="stack">
          {b.payments.length === 0 && <p className="muted small">No payment yet.</p>}
          {b.payments.map((p) => (
            <div key={p.transaction_id} className="summary-box small">
              <div className="row between"><strong>{rupees(p.amount_paise)}</strong><Badge status={p.status} /></div>
              {p.captured_paise > 0 && <div>Charged {rupees(p.captured_paise)}</div>}
              {p.refunded_paise > 0 && <div>Refunded {rupees(p.refunded_paise)}</div>}
              <div className="muted tiny">{fmtDateTime(p.created_at)}</div>
            </div>
          ))}
          {c && ['requested', 'accepted', 'ready'].includes(c.status) && <Button variant="secondary" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
          {status === 'pending_payment' && <Button variant="ghost" onClick={() => cancel('Cancelled before payment')}>Discard booking</Button>}
          <Link to={`/support?bookingId=${b.bookingId}`} className="small">Report a problem with this booking</Link>
        </div>
      </Card>
      <CancelModal open={cancelOpen} onClose={() => setCancelOpen(false)} onConfirm={cancel} busy={busy} booking={b} />
      <ReviewModal open={reviewOpen} onClose={() => setReviewOpen(false)} consultationId={c?.consultationId} onDone={() => { setReviewOpen(false); showToast('Thanks for your feedback!'); }} />
      <Modal open={!!receipt} onClose={() => setReceipt(null)} title={`Receipt ${receipt?.receiptNumber || ''}`}>
        {receipt && (
          <dl className="kv">
            <dt>Astrologer</dt><dd>{receipt.consultation.astrologer.name}</dd>
            <dt>Date</dt><dd>{fmtDateTime(receipt.consultation.startedAt)}</dd>
            <dt>Billed minutes</dt><dd>{Math.ceil((receipt.consultation.billableSeconds || 0) / 60)} × {rupees(receipt.consultation.ratePaise)}</dd>
            <dt>Amount charged</dt><dd><strong>{rupees(receipt.consultation.finalAmountPaise)}</strong></dd>
            {receipt.refunds.map((r) => <Fragment key={r.refund_id}><dt>Refund</dt><dd>−{rupees(r.amount_paise)} ({r.reason})</dd></Fragment>)}
            <dt>Payment ref</dt><dd className="mono">{receipt.payments[0]?.gateway_payment_id}</dd>
          </dl>
        )}
        <p className="tiny muted">{receipt?.note}</p>
      </Modal>
      {toast}
    </div>
  );
}

function CancelModal({ open, onClose, onConfirm, busy, booking }) {
  const [reason, setReason] = useState('');
  const hoursBefore = booking.scheduledAt ? (new Date(booking.scheduledAt) - Date.now()) / 3600000 : null;
  const status = booking.consultation?.status;
  const fee = status === 'requested' ? 0 : booking.bookingType === 'instant' ? 50 : hoursBefore >= 2 ? 0 : 50;
  return (
    <Modal open={open} onClose={onClose} title="Cancel booking" footer={<><Button variant="ghost" onClick={onClose}>Keep booking</Button><Button variant="danger" loading={busy} onClick={() => onConfirm(reason)}>Cancel booking</Button></>}>
      <Alert tone={fee ? 'warn' : 'info'}>{fee ? `Under policy v${booking.policyVersion}, a ${fee}% cancellation fee (${rupees(booking.quotedAmountPaise * fee / 100)}) applies.` : 'You will not be charged for this cancellation.'}</Alert>
      <Field label="Reason (optional)"><textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} maxLength={300} /></Field>
    </Modal>
  );
}

function ReviewModal({ open, onClose, consultationId, onDone }) {
  const { api } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api.post(`/consultations/${consultationId}/review`, { rating, comment: comment || undefined }); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  return (
    <Modal open={open} onClose={onClose} title="Rate your session" footer={<Button disabled={!rating} loading={busy} onClick={submit}>Submit review</Button>}>
      <ErrorBox error={err} />
      <div className="center"><Stars value={rating} onChange={setRating} size="lg" /></div>
      <Field label="Comments (optional)"><textarea rows={3} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} /></Field>
      <p className="tiny muted">Reviews are public and may be moderated. For complaints, contact support instead.</p>
    </Modal>
  );
}
