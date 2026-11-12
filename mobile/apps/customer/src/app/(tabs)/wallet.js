import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useLocalSearchParams, router } from 'expo-router';
import { MaterialCommunityIcons as MCI } from '@expo/vector-icons';
import { useAuth, useAsync, useToast, ErrorBox, rupees, fmtDateTime } from '@astro/mobile-core';
import { astrovedas as c } from '../../lib/theme.js';
import { useWallet, useAppConfig } from '../../lib/stores.js';
import { payRecharge } from '../../lib/payments.js';
import { F, Txt, GradientButton } from '../../components/brand.js';

const TXN_ICON = { recharge: ['plus-circle', c.ok], bonus: ['gift', c.accent], hold: ['lock-clock', c.primary], release: ['lock-open-variant', c.ok], refund: ['cash-refund', c.ok], adjustment: ['swap-horizontal', c.text2] };

export default function Wallet() {
  const { api } = useAuth();
  const cfg = useAppConfig();
  const { add, payment } = useLocalSearchParams();
  const [, refreshWallet] = useWallet();
  const w = useAsync(() => api.get('/wallet'), []);
  const [amount, setAmount] = useState(add ? String(Math.max(50, Number(add))) : '500');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);
  const [toast, show] = useToast();
  useEffect(() => { if (add) setAmount(String(Math.max(50, Number(add)))); }, [add]);
  useEffect(() => { if (payment === 'success') { show('Wallet recharged'); w.reload(); refreshWallet(); } else if (payment === 'failure') show('Recharge failed', 'bad'); }, [payment]); // eslint-disable-line react-hooks/exhaustive-deps
  const rupeesNum = Number(amount) || 0;
  const pack = w.data?.packs.find((p) => p.amountPaise === rupeesNum * 100);

  const proceed = async () => {
    setBusy(true); setErr(null);
    try {
      const out = await payRecharge(api, rupeesNum * 100);
      if (out === 'success') { show(`${rupees(rupeesNum * 100)} added to your wallet`); await w.reload(); refreshWallet(); if (add && router.canGoBack()) router.back(); }
      else if (out === 'failure') show('Recharge failed. No money was taken.', 'bad');
    } catch (e) { setErr(e); } finally { setBusy(false); }
  };

  return (
    <SafeAreaView edges={['top']} style={{ flex: 1, backgroundColor: c.bg }}>
      <ScrollView contentContainerStyle={{ padding: 16, gap: 18, paddingBottom: 110 }} refreshControl={<RefreshControl refreshing={w.refreshing} onRefresh={() => { w.refresh(); refreshWallet(); }} tintColor={c.primary} />} keyboardShouldPersistTaps="handled">
        <Txt w="s" size={22}>{cfg.walletName}</Txt>
        <LinearGradient colors={['#F08A34', '#D95F0E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 26, padding: 22, gap: 6, overflow: 'hidden' }}>
          <MCI name="wallet" size={120} color="rgba(255,255,255,0.12)" style={{ position: 'absolute', right: -10, bottom: -20 }} />
          <Txt size={14} color="rgba(255,255,255,0.9)">Available balance</Txt>
          <Txt w="b" size={36} color="#fff">{rupees(w.data?.balancePaise ?? 0)}</Txt>
          <Txt size={12.5} color="rgba(255,255,255,0.85)">Pay for chats and calls instantly. Unused minutes always come back here.</Txt>
        </LinearGradient>

        <View style={{ gap: 12 }}>
          <Txt w="m" size={16}>{add ? `Add at least ₹${add} to continue` : 'Enter amount'}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: 1.5, borderColor: '#E3D2C2', paddingBottom: 6 }}>
            <Txt w="s" size={28}>₹</Txt>
            <TextInput value={amount} onChangeText={(v) => setAmount(v.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" accessibilityLabel="Recharge amount" style={[F.s, { flex: 1, fontSize: 28, color: c.text, paddingVertical: 4 }]} />
            {[100, 500].map((n) => <Pressable key={n} onPress={() => setAmount(String(rupeesNum + n))} accessibilityRole="button" style={{ borderWidth: 1, borderColor: '#D9C6B4', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 6 }}><Txt w="m">+ ₹{n}</Txt></Pressable>)}
          </View>
          {pack?.bonusPct ? <View style={{ backgroundColor: '#FFF4DE', borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' }}><MCI name="gift" size={18} color={c.accent} /><Txt w="m" size={14}>Get {rupees(pack.bonusPaise)} extra on this recharge!</Txt></View> : null}
        </View>

        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
          {(w.data?.packs || []).map((p) => {
            const on = rupeesNum * 100 === p.amountPaise;
            return (
              <Pressable key={p.amountPaise} onPress={() => setAmount(String(p.amountPaise / 100))} accessibilityRole="radio" accessibilityState={{ selected: on }}
                style={{ width: '31.3%', borderRadius: 18, borderWidth: 2, borderColor: on ? '#F2C14E' : c.border, backgroundColor: on ? '#FFFBEA' : c.surface, overflow: 'hidden' }}>
                {p.popular ? <View style={{ position: 'absolute', top: 0, alignSelf: 'center', backgroundColor: '#EF6C3A', borderBottomLeftRadius: 10, borderBottomRightRadius: 10, paddingHorizontal: 8, zIndex: 2 }}><Txt w="m" size={10} color="#fff">Most Popular</Txt></View> : null}
                <Txt w="s" size={18} style={{ textAlign: 'center', paddingTop: 22, paddingBottom: 12 }}>{rupees(p.amountPaise)}</Txt>
                <View style={{ backgroundColor: '#EAF6EE', paddingVertical: 6 }}><Txt w="m" size={12.5} color={c.ok} style={{ textAlign: 'center' }}>{p.bonusPct ? `${p.bonusPct}% Extra` : 'No bonus'}</Txt></View>
              </Pressable>
            );
          })}
        </View>
        <ErrorBox error={err} />
        <GradientButton title={`Proceed to add ${rupees(rupeesNum * 100)}`} onPress={proceed} loading={busy} disabled={rupeesNum < 50} trailing="" />
        <Txt size={12} color={c.muted} style={{ textAlign: 'center' }}>Secure payment through our gateway. Minimum ₹50.</Txt>

        <Txt w="s" size={17} style={{ marginTop: 6 }}>Transactions</Txt>
        <View style={{ backgroundColor: c.surface, borderRadius: 20, paddingHorizontal: 14, ...c.shadow }}>
          {!w.data?.transactions.length ? <Txt color={c.muted} style={{ padding: 16, textAlign: 'center' }}>No transactions yet.</Txt> : w.data.transactions.map((t, i) => {
            const [icon, color] = TXN_ICON[t.type] || ['circle', c.text2];
            return (
              <View key={t.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderColor: c.border }}>
                <MCI name={icon} size={24} color={color} />
                <View style={{ flex: 1 }}><Txt w="m" size={14}>{t.description}</Txt><Txt size={12} color={c.muted}>{fmtDateTime(t.createdAt)}</Txt></View>
                <View style={{ alignItems: 'flex-end' }}>
                  <Txt w="s" size={15} color={t.amountPaise > 0 ? c.ok : c.text}>{t.amountPaise > 0 ? '+' : '−'}{rupees(Math.abs(t.amountPaise))}</Txt>
                  <Txt size={11.5} color={c.muted}>Bal {rupees(t.balanceAfterPaise)}</Txt>
                </View>
              </View>
            );
          })}
        </View>
      </ScrollView>
      {toast}
    </SafeAreaView>
  );
}
