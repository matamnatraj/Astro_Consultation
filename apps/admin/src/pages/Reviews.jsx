import { useAuth, useAsync, Card, Button, Badge, Spinner, Stars, fmtDateTime } from '@astro/shared';

export default function Reviews() {
  const { api } = useAuth();
  const list = useAsync(() => api.get('/admin/reviews'), []);
  const set = async (r, status) => { await api.post(`/admin/reviews/${r.review_id}/status`, { status, reason: 'Moderation' }); list.reload(); };
  return (
    <div className="stack">
      <div className="page-head"><div><h1>Reviews</h1><p>Hidden reviews are excluded from public ratings.</p></div></div>
      <Card pad={false}>{list.loading ? <Spinner /> : <div className="table-wrap"><table className="table">
        <thead><tr><th>Date</th><th>Astrologer</th><th>Customer</th><th>Rating</th><th>Comment</th><th>Status</th><th /></tr></thead>
        <tbody>{list.data.map((r) => <tr key={r.review_id}><td className="small">{fmtDateTime(r.created_at)}</td><td>{r.astrologer_name}</td><td>{r.client_name}</td><td><Stars value={r.rating} size="sm" /></td><td className="small">{r.comment}</td><td><Badge status={r.status} /></td>
          <td>{r.status === 'published' ? <Button size="sm" variant="ghost" onClick={() => set(r, 'hidden')}>Hide</Button> : <Button size="sm" variant="ghost" onClick={() => set(r, 'published')}>Restore</Button>}</td></tr>)}</tbody>
      </table></div>}</Card>
    </div>
  );
}
