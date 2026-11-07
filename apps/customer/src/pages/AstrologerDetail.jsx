import { Fragment } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useAuth, useAsync, Card, Spinner, ErrorBox, Avatar, Stars, Badge, rupees, fmtDate } from '@astro/shared';

export default function AstrologerDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const { data: a, loading, error, reload } = useAsync(() => api.get(`/astrologers/${id}`), [id]);
  if (loading) return <Spinner />;
  if (error) return <ErrorBox error={error} onRetry={reload} />;
  return (
    <div className="layout-side">
      <div className="full">
        <Link to="/astrologers" className="small">← All astrologers</Link>
      </div>
      <div className="stack" style={{ minWidth: 0 }}>
        <Card>
          <div className="row" style={{ alignItems: 'flex-start' }}>
            <Avatar name={a.displayName} size={72} />
            <div className="grow">
              <h1>{a.displayName}</h1>
              <div className="muted">{a.experienceYears} years experience · {a.languages.join(', ')}</div>
              <div><Stars value={a.ratingAvg} /> {a.ratingCount ? `${a.ratingAvg.toFixed(1)} from ${a.ratingCount} reviews` : 'No reviews yet'}</div>
              <div className="mt">{a.isOnline ? (a.isBusy ? <Badge tone="warn">In a session</Badge> : <Badge tone="ok">Online now</Badge>) : <Badge tone="muted">Offline</Badge>}</div>
            </div>
          </div>
          <p className="mt" style={{ whiteSpace: 'pre-line' }}>{a.bio}</p>
          <div className="mt"><div className="field-label">Specialties</div><div className="chips">{a.specialties.map((s) => <span key={s} className="chip">{s}</span>)}</div></div>
          {a.services.length > 0 && <div className="mt"><div className="field-label">Services</div><div className="chips">{a.services.map((s) => <span key={s} className="chip">{s}</span>)}</div></div>}
        </Card>
        <Card title={`Reviews (${a.reviews.length})`}>
          {a.reviews.length === 0 ? <p className="muted">No reviews yet.</p> : (
            <div className="list">{a.reviews.map((r, i) => (
              <div className="list-item" key={i} style={{ alignItems: 'flex-start' }}>
                <div className="grow"><Stars value={r.rating} size="sm" /> <strong className="small">{r.reviewer}</strong> <span className="tiny muted">{fmtDate(r.created_at)}</span>
                  {r.comment && <p className="small">{r.comment}</p>}</div>
              </div>
            ))}</div>
          )}
        </Card>
      </div>
      <Card title="Consult" className="sticky">
        <div className="stack">
          <div className="kv">
            {a.modes.map((m) => <Fragment key={m}><dt>{m[0].toUpperCase() + m.slice(1)}</dt><dd><strong>{rupees(a.rates[m])}</strong>/min</dd></Fragment>)}
          </div>
          {a.isOnline && !a.isBusy && <Link className="btn btn-primary btn-block" to={`/book/${a.astrologerId}?type=instant`}>Chat now</Link>}
          <Link className="btn btn-secondary btn-block" to={`/book/${a.astrologerId}?type=scheduled`}>Schedule a session</Link>
          <p className="tiny muted">{a.slots.length} open slots in the next 14 days. You only pay for the minutes you use.</p>
        </div>
      </Card>
    </div>
  );
}
