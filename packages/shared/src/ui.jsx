import { useEffect, useState } from 'react';
import { STATUS_TONE, titleCase } from './format.js';

export const Button = ({ variant = 'primary', size, loading, children, className = '', ...p }) => (
  <button className={`btn btn-${variant} ${size ? `btn-${size}` : ''} ${className}`} disabled={loading || p.disabled} {...p}>
    {loading && <span className="spinner sm" />}{children}
  </button>
);

export const Card = ({ title, actions, children, className = '', pad = true }) => (
  <section className={`card ${className}`}>
    {(title || actions) && <header className="card-head"><h3>{title}</h3><div className="row gap-s">{actions}</div></header>}
    <div className={pad ? 'card-body' : ''}>{children}</div>
  </section>
);

export const Badge = ({ status, tone, children }) => (
  <span className={`badge tone-${tone || STATUS_TONE[status] || 'muted'}`}>{children || titleCase(status)}</span>
);

export const Spinner = ({ label }) => <div className="center pad-l"><span className="spinner" />{label && <span className="muted">{label}</span>}</div>;

export const Empty = ({ title, children, icon = '✦' }) => (
  <div className="empty"><div className="empty-icon">{icon}</div><strong>{title}</strong>{children && <div className="muted">{children}</div>}</div>
);

export const ErrorBox = ({ error, onRetry }) => error ? (
  <div className="alert alert-bad" role="alert">
    <span>{error.message || String(error)}</span>
    {onRetry && <Button variant="ghost" size="sm" onClick={onRetry}>Retry</Button>}
  </div>
) : null;

export const Alert = ({ tone = 'info', children }) => <div className={`alert alert-${tone}`}>{children}</div>;

export const Field = ({ label, hint, error, children }) => (
  <label className="field">
    <span className="field-label">{label}</span>
    {children}
    {hint && !error && <span className="field-hint">{hint}</span>}
    {error && <span className="field-error">{error}</span>}
  </label>
);

export function Modal({ open, onClose, title, children, footer, wide }) {
  useEffect(() => {
    if (!open) return undefined;
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'modal-wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <header className="modal-head"><h3>{title}</h3>{onClose && <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>}</header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-foot">{footer}</footer>}
      </div>
    </div>
  );
}

export function Tabs({ tabs, value, onChange }) {
  return (
    <div className="tabs" role="tablist">
      {tabs.map((t) => (
        <button key={t.value} role="tab" aria-selected={value === t.value} className={`tab ${value === t.value ? 'active' : ''}`} onClick={() => onChange(t.value)}>
          {t.label}{t.count ? <span className="tab-count">{t.count}</span> : null}
        </button>
      ))}
    </div>
  );
}

export function Stat({ label, value, sub, tone }) {
  return <div className={`stat ${tone ? `tone-${tone}` : ''}`}><div className="stat-label">{label}</div><div className="stat-value">{value}</div>{sub && <div className="stat-sub">{sub}</div>}</div>;
}

export function Stars({ value = 0, onChange, size = 'md' }) {
  const [hover, setHover] = useState(0);
  return (
    <span className={`stars stars-${size}`} onMouseLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} role={onChange ? 'button' : undefined} aria-label={onChange ? `${i} stars` : undefined}
          className={(hover || value) >= i - 0.25 ? 'on' : ''} onMouseEnter={() => onChange && setHover(i)} onClick={() => onChange?.(i)}>★</span>
      ))}
    </span>
  );
}

export function useToast() {
  const [toast, setToast] = useState(null);
  useEffect(() => { if (!toast) return undefined; const t = setTimeout(() => setToast(null), 3500); return () => clearTimeout(t); }, [toast]);
  const el = toast ? <div className={`toast toast-${toast.tone || 'ok'}`} role="status">{toast.text}</div> : null;
  return [el, (text, tone) => setToast({ text, tone })];
}

export const Avatar = ({ name = '?', size = 40 }) => {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const hue = [...name].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 0);
  return <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.38, background: `hsl(${hue} 45% 42%)` }}>{initials}</span>;
};
