import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth, useI18n, LANGS, LanguagePicker, rupees } from '@astro/shared';
import { Icon, Logo, AstroAvatar, useWallet, useAppConfig } from '../brand.jsx';

function Item({ icon, label, onClick, value, danger }) {
  return (
    <button type="button" className={`av-item ${danger ? 'danger' : ''}`} onClick={onClick}>
      <span className="ico" style={danger ? { color: 'var(--bad)' } : undefined}><Icon name={icon} size={20} /></span>
      <span className="grow">{label}</span>{value ? <span className="val">{value}</span> : null}{!danger && <Icon name="right" size={18} style={{ color: 'var(--muted)' }} />}
    </button>
  );
}

export default function ProfileMenu() {
  const { me, logout } = useAuth();
  const { t, lang } = useI18n();
  const navigate = useNavigate();
  const cfg = useAppConfig();
  const [balance] = useWallet();
  const [langOpen, setLangOpen] = useState(false);
  const phone = me.user.phone ? `${me.user.phone.slice(0, 6)}xxxx${me.user.phone.slice(-3)}` : me.user.email;
  return (
    <div className="stack" style={{ gap: 16, maxWidth: 640, margin: '0 auto', width: '100%' }}>
      <div className="av-card" style={{ padding: 0, overflow: 'hidden', gap: 0 }}>
        <div className="row" style={{ gap: 14, padding: 18 }}>
          <AstroAvatar name={me.user.displayName || '?'} size={64} />
          <div className="grow"><strong style={{ fontSize: 20 }}>{me.user.displayName || t('tab.profile')}</strong><div className="small" style={{ color: 'var(--text-2)' }}>{phone}</div></div>
          <button type="button" className="av-icon-btn" aria-label="Edit profile" onClick={() => navigate('/account')}><Icon name="edit" size={19} /></button>
        </div>
        <div className="row between" style={{ background: '#FFF6E8', borderTop: '1px solid #F6DDB0', padding: 16 }}>
          <div><div className="small" style={{ color: 'var(--text-2)' }}>{cfg.walletName}</div><strong style={{ fontSize: 22 }}>{rupees(balance ?? 0)}</strong></div>
          <button type="button" className="btn btn-primary" onClick={() => navigate('/wallet')}>{t('profile.recharge')}</button>
        </div>
      </div>
      <div className="av-menu-card">
        <Item icon="history" label={t('profile.consultations')} onClick={() => navigate('/bookings')} />
        <Item icon="kundli" label={t('profile.kundlis')} onClick={() => navigate('/kundli')} />
        <Item icon="matching" label={t('kundli.matching')} onClick={() => navigate('/matching')} />
        <Item icon="heart" label={t('profile.favorites')} onClick={() => navigate('/favorites')} />
        <Item icon="globe" label={t('profile.language')} value={LANGS.find((l) => l.code === lang)?.native} onClick={() => setLangOpen(true)} />
      </div>
      <div className="av-menu-card">
        <Item icon="help" label={t('profile.support')} onClick={() => navigate('/support')} />
        <Item icon="shield" label={t('profile.account')} onClick={() => navigate('/account')} />
      </div>
      <div className="av-menu-card"><Item icon="logout" label={t('profile.signOut')} onClick={logout} danger /></div>
      <div className="stack-s" style={{ alignItems: 'center' }}><Logo size={34} /><span className="tiny muted">Astrovedas · v1.0.0</span></div>
      <LanguagePicker open={langOpen} onClose={() => setLangOpen(false)} />
    </div>
  );
}
