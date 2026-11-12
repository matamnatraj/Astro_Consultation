import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { useRealtimeEvent } from './realtime.js';
import { timeAgo } from './format.js';
import { useT } from './i18n.jsx';

/** Bell with live in-app notifications. `routeFor` maps a notification to an in-app path. */
export function NotificationBell({ routeFor = () => null, onEvent }) {
  const { api } = useAuth();
  const t = useT();
  const [data, setData] = useState({ items: [], unreadCount: 0 });
  const [open, setOpen] = useState(false);
  const nav = useNavigate();
  const ref = useRef();
  const load = () => api.get('/notifications').then(setData).catch(() => {});
  useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, []);
  useRealtimeEvent((ev) => {
    if (ev.type === 'notification') {
      setData((d) => ({ items: [ev.notification, ...d.items].slice(0, 100), unreadCount: d.unreadCount + 1 }));
      onEvent?.(ev.notification);
    }
  });
  const openItem = async (n) => {
    if (!n.read_at) {
      api.post(`/notifications/${n.notification_id}/read`).catch(() => {});
      setData((d) => ({ items: d.items.map((x) => (x === n ? { ...x, read_at: new Date().toISOString() } : x)), unreadCount: Math.max(0, d.unreadCount - 1) }));
    }
    const to = routeFor(n);
    if (to) { setOpen(false); nav(to); }
  };
  return (
    <div className="bell" ref={ref}>
      <button className="icon-btn" aria-label={`Notifications (${data.unreadCount} unread)`} onClick={() => setOpen(!open)}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 8a6 6 0 1 0-12 0c0 7-3 9-3 9h18s-3-2-3-9" /><path d="M13.7 21a2 2 0 0 1-3.4 0" /></svg>
        {data.unreadCount > 0 && <span className="bell-dot">{data.unreadCount > 9 ? '9+' : data.unreadCount}</span>}
      </button>
      {open && (
        <div className="dropdown">
          <div className="row between dropdown-head">
            <strong>{t('core.notifications')}</strong>
            {data.unreadCount > 0 && <button className="link small" onClick={() => { api.post('/notifications/read-all'); setData((d) => ({ items: d.items.map((x) => ({ ...x, read_at: x.read_at || new Date().toISOString() })), unreadCount: 0 })); }}>{t('core.markAll')}</button>}
          </div>
          <div className="dropdown-list">
            {data.items.length === 0 && <div className="muted pad">{t('core.caughtUp')}</div>}
            {data.items.map((n) => (
              <button key={n.notification_id} className={`notif ${n.read_at ? '' : 'unread'}`} onClick={() => openItem(n)}>
                <div className="notif-title">{n.title}</div>
                <div className="notif-body">{n.body}</div>
                <div className="notif-time">{timeAgo(n.created_at)}</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
