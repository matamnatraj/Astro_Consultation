import { useMemo, useState } from 'react';
import { useAuth, useAsync, Card, Button, Field, Spinner, ErrorBox, Badge, useToast, fmtTime } from '@astro/shared';

export default function Availability() {
  const { api } = useAuth();
  const slots = useAsync(() => api.get('/astrologer/me/availability'), []);
  const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
  const [f, setF] = useState({ date: tomorrow, start: '10:00', end: '13:00', slotMinutes: 30 });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, showToast] = useToast();
  const byDay = useMemo(() => {
    const m = new Map();
    for (const s of slots.data || []) {
      const d = new Date(s.startAt).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });
      if (!m.has(d)) m.set(d, []);
      m.get(d).push(s);
    }
    return [...m.entries()];
  }, [slots.data]);

  const add = async (e) => {
    e.preventDefault(); setBusy(true); setErr(null);
    try {
      const startAt = new Date(`${f.date}T${f.start}:00`).toISOString(); // browser local time
      const endAt = new Date(`${f.date}T${f.end}:00`).toISOString();
      const created = await api.post('/astrologer/me/availability', { startAt, endAt, slotMinutes: Number(f.slotMinutes) });
      showToast(`${created.length} slots added`); slots.reload();
    } catch (x) { setErr(x); } finally { setBusy(false); }
  };
  const remove = async (s) => { try { await api.del(`/astrologer/me/availability/${s.slotId}`); slots.reload(); } catch (x) { showToast(x.message, 'bad'); } };

  return (
    <div className="stack">
      <div className="page-head"><div><h1>Availability</h1><p>Open slots customers can book in advance. Times shown in your device's time zone ({Intl.DateTimeFormat().resolvedOptions().timeZone}).</p></div></div>
      <Card title="Add a window">
        <form onSubmit={add} className="stack">
          <ErrorBox error={err} />
          <div className="form-grid">
            <Field label="Date"><input type="date" min={new Date().toISOString().slice(0, 10)} required value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} /></Field>
            <Field label="From"><input type="time" required value={f.start} onChange={(e) => setF({ ...f, start: e.target.value })} /></Field>
            <Field label="To"><input type="time" required value={f.end} onChange={(e) => setF({ ...f, end: e.target.value })} /></Field>
            <Field label="Slot length"><select value={f.slotMinutes} onChange={(e) => setF({ ...f, slotMinutes: e.target.value })}><option value="15">15 min</option><option value="30">30 min</option><option value="45">45 min</option><option value="60">60 min</option></select></Field>
          </div>
          <div><Button type="submit" loading={busy}>Add slots</Button></div>
        </form>
      </Card>
      {slots.loading ? <Spinner /> : byDay.map(([day, list]) => (
        <Card key={day} title={day}>
          <div className="slot-grid">
            {list.map((s) => (
              <div key={s.slotId} className="slot" style={{ cursor: 'default' }}>
                <div>{fmtTime(s.startAt)}–{fmtTime(s.endAt)}</div>
                <div className="row between" style={{ marginTop: 4 }}><Badge status={s.status === 'open' ? 'draft' : s.status === 'booked' ? 'confirmed' : 'pending_payment'}>{s.status}</Badge>
                  {s.status === 'open' && <button className="link tiny" onClick={() => remove(s)} aria-label="Remove slot">Remove</button>}</div>
              </div>
            ))}
          </div>
        </Card>
      ))}
      {toast}
    </div>
  );
}
