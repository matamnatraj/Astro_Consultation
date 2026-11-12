import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth, useAsync, useT, Spinner, ErrorBox, rupees, fmtDate } from '@astro/shared';
import { Icon, AstroAvatar, useAppConfig } from '../brand.jsx';

export default function Rate() {
  const { id } = useParams();
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const k = useAsync(() => api.get(`/consultations/${id}`), [id]);
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [tags, setTags] = useState([]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  if (k.loading) return <Spinner />;
  if (k.error) return <ErrorBox error={k.error} />;
  const x = k.data;
  const mins = Math.ceil((x.billableSeconds || 0) / 60);
  const submit = async () => {
    setBusy(true); setErr(null);
    try { await api.post(`/consultations/${id}/review`, { rating, comment: text || undefined, tags }); navigate(`/consultations/${id}`, { replace: true }); } catch (e) { setErr(e); setBusy(false); }
  };
  const TAGS = cfg.reviewTags?.length ? cfg.reviewTags : ['Knowledgeable', 'Helpful', 'Polite', 'Accurate', 'Friendly', 'Professional'];
  return (
    <div className="stack" style={{ gap: 20, maxWidth: 560, margin: '0 auto', width: '100%' }}>
      <h1 className="av-h1" style={{ textAlign: 'center' }}>{t('chat.rate')}</h1>
      <div className="stack-s" style={{ alignItems: 'center' }}><AstroAvatar name={x.astrologer.name} size={96} /><strong style={{ fontSize: 20, marginTop: 8 }}>{x.astrologer.name}</strong></div>
      <div className="av-tiles">
        {[['clock', t('x.duration'), t('common.min', { n: mins })], ['rupee', t('x.amount'), rupees(x.chargedPaise ?? x.finalAmountPaise ?? 0)], ['calendar', t('x.date'), fmtDate(x.endedAt || x.startedAt)]].map(([i, l, v]) => (
          <div key={l} className="av-tile" style={{ background: '#FFF8F1', border: '1px solid #F3DCC4', boxShadow: 'none' }}><span className="ico"><Icon name={i} size={19} /></span><span className="l">{l}</span><span className="v">{v}</span></div>
        ))}
      </div>
      <strong style={{ textAlign: 'center', fontSize: 17, fontWeight: 500 }}>{t('x.howWas')}</strong>
      <div className="av-stars">{[1, 2, 3, 4, 5].map((i) => <button key={i} type="button" className={rating >= i ? 'on' : ''} aria-label={`${i} stars`} aria-pressed={rating >= i} onClick={() => setRating(i)}>★</button>)}</div>
      <label className="av-card" style={{ boxShadow: 'none', border: '1px solid var(--border)' }}>
        <textarea rows={4} value={text} onChange={(e) => setText(e.target.value.slice(0, 500))} placeholder={t('x.feedbackPh')} aria-label="Feedback" style={{ border: 0, padding: 0, resize: 'vertical' }} />
        <span className="tiny muted" style={{ textAlign: 'right' }}>{text.length}/500</span>
      </label>
      <div className="chips" style={{ gap: 10 }}>{TAGS.map((tg) => {
        const on = tags.includes(tg);
        return <button key={tg} type="button" role="checkbox" aria-checked={on} className={`chip ${on ? 'active' : ''}`} style={{ padding: '8px 14px', fontSize: 14 }} onClick={() => setTags(on ? tags.filter((v) => v !== tg) : [...tags, tg])}>{on ? '✓ ' : ''}{tg}</button>;
      })}</div>
      <ErrorBox error={err} />
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!rating || busy} onClick={submit} aria-label="Submit Review">{t('x.submitReview')}</button>
    </div>
  );
}
