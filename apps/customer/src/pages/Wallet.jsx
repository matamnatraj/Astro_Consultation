import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth, useAsync, useT, useToast, ErrorBox, rupees, fmtDateTime } from '@astro/shared';
import { Icon, useWallet, useAppConfig, startRecharge } from '../brand.jsx';

const TXN_ICON = { recharge: ['plus', 'var(--ok)'], bonus: ['gift', 'var(--accent)'], hold: ['lock', 'var(--primary)'], release: ['check', 'var(--ok)'], refund: ['history', 'var(--ok)'], adjustment: ['edit', 'var(--text-2)'] };

export default function Wallet() {
  const { api } = useAuth();
  const t = useT();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const [params, setParams] = useSearchParams();
  const add = params.get('add');
  const back = params.get('back');
  const payment = params.get('payment');
  const [, refreshWallet] = useWallet();
  const w = useAsync(() => api.get('/wallet'), []);
  const [amount, setAmount] = useState(add ? String(Math.max(50, Number(add))) : '500');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => {
    if (!payment) return;
    if (payment === 'success') { show(t('x.recharged')); refreshWallet(); w.reload(); if (back) { navigate(back, { replace: true }); return; } }
    else show(t('wallet.failed'), 'bad');
    const next = new URLSearchParams(params); next.delete('payment'); setParams(next, { replace: true });
  }, [payment]); // eslint-disable-line react-hooks/exhaustive-deps
  const rupeesNum = Number(amount) || 0;
  const pack = w.data?.packs.find((p) => p.amountPaise === rupeesNum * 100);
  const proceed = async () => {
    setBusy(true); setErr(null);
    try { await startRecharge(api, rupeesNum * 100, `/wallet${back ? `?back=${encodeURIComponent(back)}` : ''}`); } catch (e) { setErr(e); setBusy(false); }
  };

  return (
    <div className="stack" style={{ gap: 18, maxWidth: 860, margin: '0 auto', width: '100%' }}>
      {back && <Link to={back} className="small row gap-s"><Icon name="left" size={16} />{t('x.backToConsult')}</Link>}
      <h1 className="av-h1">{cfg.walletName}</h1>
      <div className="av-balance">
        <span className="ghost" aria-hidden="true"><Icon name="wallet" size={150} stroke={1.2} /></span>
        <div style={{ opacity: .9 }}>{t('wallet.available')}</div>
        <div className="big">{rupees(w.data?.balancePaise ?? 0)}</div>
        <div className="small" style={{ opacity: .85, maxWidth: 420 }}>{t('wallet.body')}</div>
      </div>

      <div className="stack-s">
        <strong style={{ fontSize: 16, fontWeight: 500 }}>{add ? t('wallet.addAtLeast', { n: add }) : t('wallet.enter')}</strong>
        <div className="av-amount">
          <strong style={{ fontSize: 28 }}>₹</strong>
          <input value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, '').slice(0, 6))} inputMode="numeric" aria-label="Recharge amount" />
          {[100, 500].map((n) => <button key={n} type="button" className="btn btn-secondary btn-sm" onClick={() => setAmount(String(rupeesNum + n))}>+ ₹{n}</button>)}
        </div>
        {pack?.bonusPct ? <div className="av-gift"><Icon name="gift" size={18} style={{ color: 'var(--accent)' }} />{t('wallet.extra', { amt: rupees(pack.bonusPaise) })}</div> : null}
      </div>

      <div className="av-packs" role="radiogroup">
        {(w.data?.packs || []).map((p) => {
          const on = rupeesNum * 100 === p.amountPaise;
          return (
            <button key={p.amountPaise} type="button" role="radio" aria-checked={on} className={`av-pack ${on ? 'on' : ''}`} onClick={() => setAmount(String(p.amountPaise / 100))}>
              {p.popular && <span className="pop">{t('wallet.popular')}</span>}
              <div className="amt">{rupees(p.amountPaise)}</div>
              <div className="bonus">{p.bonusPct ? t('wallet.pctExtra', { n: p.bonusPct }) : t('wallet.noBonus')}</div>
            </button>
          );
        })}
      </div>
      <ErrorBox error={err} />
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={rupeesNum < 50 || busy} onClick={proceed} aria-label={t('wallet.proceed', { amt: rupees(rupeesNum * 100) })}>{busy ? t('common.loading') : t('wallet.proceed', { amt: rupees(rupeesNum * 100) })}</button>
      <p className="tiny muted" style={{ textAlign: 'center', margin: 0 }}>{t('wallet.secure')}</p>

      <h2 style={{ fontSize: 18, margin: '6px 0 0' }}>{t('wallet.txns')}</h2>
      <div className="av-menu-card">
        {!w.data?.transactions.length ? <p className="muted" style={{ padding: 16, textAlign: 'center' }}>{t('wallet.noTxns')}</p> : w.data.transactions.map((tx) => {
          const [icon, color] = TXN_ICON[tx.type] || ['star', 'var(--text-2)'];
          return (
            <div key={tx.id} className="av-item" style={{ cursor: 'default' }}>
              <span className="ico" style={{ color }}><Icon name={icon} size={20} /></span>
              <div className="grow"><div>{tx.description}</div><div className="tiny muted" style={{ fontWeight: 400 }}>{fmtDateTime(tx.createdAt)}</div></div>
              <div style={{ textAlign: 'right' }}><strong style={{ color: tx.amountPaise > 0 ? 'var(--ok)' : 'var(--text)' }}>{tx.amountPaise > 0 ? '+' : '−'}{rupees(Math.abs(tx.amountPaise))}</strong>
                <div className="tiny muted" style={{ fontWeight: 400 }}>{t('x.bal', { amt: rupees(tx.balanceAfterPaise) })}</div></div>
            </div>
          );
        })}
      </div>
      {toast}
    </div>
  );
}
