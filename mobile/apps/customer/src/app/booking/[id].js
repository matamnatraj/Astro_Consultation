import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useAuth, useAsync, useRealtimeEvent, Screen, Card, T, Row, Badge, Button, Notice, KV, Sheet, Field, Stars, ErrorBox, Loading, useToast, rupees, fmtDateTime, titleCase, useTheme } from '@astro/mobile-core';
import { payInBrowser } from '../../lib/payments.js';

const STEPS = [['pending_payment', 'Payment'], ['requested', 'Waiting for astrologer'], ['accepted', 'Accepted'], ['ready', 'Ready to join'], ['in_progress', 'In progress'], ['completed', 'Completed']];

export default function BookingDetail() {
  const { id, payment } = useLocalSearchParams();
  const { api } = useAuth();
  const c = useTheme();
  const b = useAsync(() => api.get(`/bookings/${id}`), [id]);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reviewOpen, setReviewOpen] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => {
    if (payment === 'success') show('Payment authorized — waiting for the astrologer');
    else if (payment === 'failure') show('Payment failed. You can retry.', 'bad');
  }, [payment]); // eslint-disable-line react-hooks/exhaustive-deps
  useRealtimeEvent((ev) => { if (ev.type === 'notification' && (ev.notification.data?.bookingId === id || ev.notification.data?.consultationId === b.data?.consultation?.consultationId)) b.reload(); });

  if (b.loading) return <Loading />;
  if (b.error) return <Screen><ErrorBox error={b.error} onRetry={b.reload} /></Screen>;
  const d = b.data; const k = d.consultation;
  const status = k?.status || d.status;
  const idx = STEPS.findIndex(([s]) => s === status);
  const closed = ['rejected', 'cancelled', 'expired', 'failed'].includes(status);

  const retryPay = async () => {
    setBusy(true); setErr(null);
    try { const o = await payInBrowser(api, d.bookingId); if (o !== 'redirected') { b.reload(); if (o === 'success') show('Payment authorized'); } } catch (e) { setErr(e); } finally { setBusy(false); }
  };
  const cancel = async (reason) => {
    setBusy(true); setErr(null);
    try { const r = await api.post(`/bookings/${d.bookingId}/cancel`, { reason: reason || undefined }); setCancelOpen(false); show(r.feePaise ? `Cancelled. Fee ${rupees(r.feePaise)}.` : 'Cancelled. You will not be charged.'); b.reload(); } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <>
      <Screen onRefresh={b.refresh} refreshing={b.refreshing}>
        <Row style={{ justifyContent: 'space-between' }}><T bold size={20}>{d.astrologerName}</T><Badge status={status} /></Row>
        <ErrorBox error={err} />
        {status === 'requested' ? <Notice tone="info">{`Request sent. ${d.bookingType === 'instant' ? 'The astrologer has a few minutes to accept.' : 'The astrologer will confirm before your slot.'} If they don't accept, you won't be charged.`}</Notice> : null}
        {status === 'ready' ? <Notice tone="ok" action={<Button title="Join consultation" onPress={() => router.push(`/consultation/${k.consultationId}`)} />}>Your consultation is ready. The astrologer will start the session — join now.</Notice> : null}
        {status === 'in_progress' ? <Notice tone="ok" action={<Button title="Open chat" onPress={() => router.push(`/consultation/${k.consultationId}`)} />}>Your session is live.</Notice> : null}
        {status === 'pending_payment' ? <Notice tone="warn" action={<Button title={`Pay ${rupees(d.quotedAmountPaise)}`} loading={busy} onPress={retryPay} />}>{`Payment pending. Pay by ${fmtDateTime(d.paymentExpiresAt)} to send the request.`}</Notice> : null}
        {closed ? <Notice tone="info">{d.cancelReason || k?.endReason || 'This booking is closed.'}</Notice> : (
          <Card>
            {STEPS.filter(([s]) => d.bookingType === 'scheduled' || s !== 'accepted').map(([s, l]) => {
              const i = STEPS.findIndex(([x]) => x === s);
              const done = i < idx || status === 'completed'; const cur = i === idx;
              return <Row key={s} gap={10}><View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: done ? c.ok : cur ? c.primary : c.border }} /><T small bold={cur} muted={!done && !cur}>{l}</T></Row>;
            })}
          </Card>
        )}
        <Card title="Details">
          <KV rows={[['Booking', d.bookingId.slice(0, 8).toUpperCase()], ['Type', `${titleCase(d.bookingType)} ${d.mode}`], d.scheduledAt && ['Scheduled', fmtDateTime(d.scheduledAt)], ['Duration', `up to ${d.durationMinutes} min at ${rupees(d.ratePaise)}/min`], d.topic && ['Topic', d.topic], ['Policy', `Cancellation v${d.policyVersion}`]]} />
        </Card>
        <Card title="Payment">
          {!d.payments.length ? <T small muted>No payment yet.</T> : d.payments.map((p) => (
            <View key={p.transaction_id} style={{ gap: 2 }}>
              <Row style={{ justifyContent: 'space-between' }}><T bold>{rupees(p.amount_paise)}</T><Badge status={p.status} /></Row>
              {p.captured_paise ? <T small>Charged {rupees(p.captured_paise)}</T> : null}
              {p.refunded_paise ? <T small>Refunded {rupees(p.refunded_paise)}</T> : null}
              <T tiny muted>{fmtDateTime(p.created_at)}</T>
            </View>
          ))}
        </Card>
        {k?.status === 'completed' ? (
          <Card title="Session summary">
            <KV rows={[['Started', fmtDateTime(k.startedAt)], ['Ended', `${fmtDateTime(k.endedAt)} (${k.endReason})`], ['Billed', `${Math.ceil(k.billableSeconds / 60)} min · ${rupees(k.finalAmountPaise)}`]]} />
            <Button variant="accent" title="Rate this session" onPress={() => setReviewOpen(true)} />
            <Button variant="secondary" title="Receipt" onPress={async () => setReceipt(await api.get(`/consultations/${k.consultationId}/receipt`))} />
            <Button variant="ghost" title="View transcript" onPress={() => router.push(`/consultation/${k.consultationId}`)} />
          </Card>
        ) : null}
        {k && ['requested', 'accepted', 'ready'].includes(k.status) ? <Button variant="secondary" title="Cancel booking" onPress={() => setCancelOpen(true)} /> : null}
        {status === 'pending_payment' ? <Button variant="ghost" title="Discard booking" onPress={() => cancel('Cancelled before payment')} /> : null}
        <Button variant="ghost" title="Report a problem" onPress={() => router.push('/support')} />
      </Screen>
      <CancelSheet visible={cancelOpen} booking={d} busy={busy} onClose={() => setCancelOpen(false)} onConfirm={cancel} />
      <ReviewSheet visible={reviewOpen} consultationId={k?.consultationId} onClose={() => setReviewOpen(false)} onDone={() => { setReviewOpen(false); show('Thanks for your feedback!'); }} />
      <Sheet visible={!!receipt} onClose={() => setReceipt(null)} title={`Receipt ${receipt?.receiptNumber || ''}`}>
        {receipt ? <KV rows={[['Astrologer', receipt.consultation.astrologer.name], ['Date', fmtDateTime(receipt.consultation.startedAt)], ['Minutes', `${Math.ceil((receipt.consultation.billableSeconds || 0) / 60)} × ${rupees(receipt.consultation.ratePaise)}`], ['Charged', rupees(receipt.consultation.finalAmountPaise)], ...receipt.refunds.map((r) => ['Refund', `−${rupees(r.amount_paise)} (${r.reason})`]), ['Payment ref', receipt.payments[0]?.gateway_payment_id || '—']]} /> : null}
      </Sheet>
      {toast}
    </>
  );
}

function CancelSheet({ visible, onClose, onConfirm, busy, booking }) {
  const [reason, setReason] = useState('');
  const status = booking.consultation?.status;
  const hoursBefore = booking.scheduledAt ? (new Date(booking.scheduledAt) - Date.now()) / 3600000 : null;
  const fee = status === 'requested' ? 0 : booking.bookingType === 'instant' ? 50 : hoursBefore >= 2 ? 0 : 50;
  return (
    <Sheet visible={visible} onClose={onClose} title="Cancel booking" footer={<Button variant="danger" title="Cancel booking" loading={busy} onPress={() => onConfirm(reason)} />}>
      <Notice tone={fee ? 'warn' : 'info'}>{fee ? `Under policy v${booking.policyVersion}, a ${fee}% cancellation fee (${rupees((booking.quotedAmountPaise * fee) / 100)}) applies.` : 'You will not be charged for this cancellation.'}</Notice>
      <Field label="Reason (optional)" value={reason} onChangeText={setReason} multiline />
    </Sheet>
  );
}

function ReviewSheet({ visible, onClose, consultationId, onDone }) {
  const { api } = useAuth();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const submit = async () => { setBusy(true); setErr(null); try { await api.post(`/consultations/${consultationId}/review`, { rating, comment: comment || undefined }); onDone(); } catch (e) { setErr(e); } finally { setBusy(false); } };
  return (
    <Sheet visible={visible} onClose={onClose} title="Rate your session" footer={<Button title="Submit review" disabled={!rating} loading={busy} onPress={submit} />}>
      <ErrorBox error={err} />
      <View style={{ alignItems: 'center' }}><Stars value={rating} onChange={setRating} size={36} /></View>
      <Field label="Comments (optional)" value={comment} onChangeText={setComment} multiline />
      <T tiny muted>Reviews are public and may be moderated. For complaints, contact support instead.</T>
    </Sheet>
  );
}
