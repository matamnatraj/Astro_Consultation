// Astrovedas design-system components (from the designer's Figma).
import { useEffect, useRef, useState } from 'react';
import { Dimensions, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { MaterialCommunityIcons as MCI, Ionicons } from '@expo/vector-icons';
import Svg, { Circle, Path, G, Line } from 'react-native-svg';
import { router } from 'expo-router';
import { rupees } from '@astro/mobile-core';
import { astrovedas as c } from '../lib/theme.js';

export const F = {
  r: { fontFamily: c.fonts.regular }, m: { fontFamily: c.fonts.medium }, s: { fontFamily: c.fonts.semibold }, b: { fontFamily: c.fonts.bold },
};
export const Txt = ({ w = 'r', size = 14, color = c.text, style, children, ...p }) => (
  <Text style={[F[w], { fontSize: size, color, lineHeight: size * 1.4 }, style]} {...p}>{children}</Text>
);

/** Brand mark: sun with rays inside a soft ring. */
export function Logo({ size = 36 }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', ...c.shadow }}>
      <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48">
        <G stroke={c.primary} strokeWidth={2.4} strokeLinecap="round">
          {Array.from({ length: 8 }, (_, i) => {
            const a = (i * Math.PI) / 4;
            return <Line key={i} x1={24 + Math.cos(a) * 14} y1={22 + Math.sin(a) * 14} x2={24 + Math.cos(a) * 19} y2={22 + Math.sin(a) * 19} />;
          })}
        </G>
        <Circle cx={24} cy={22} r={9} fill={c.accent} />
        <Path d="M10 38 C17 31 31 31 38 38" stroke={c.primary} strokeWidth={2.6} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

export function GradientButton({ title, onPress, icon, disabled, loading, style, size = 'lg', trailing = '→' }) {
  return (
    <Pressable onPress={onPress} disabled={disabled || loading} accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled: disabled || loading }}
      style={({ pressed }) => [{ borderRadius: 16, opacity: disabled ? 0.5 : pressed ? 0.85 : 1, ...c.shadow, shadowOpacity: 0.18 }, style]}>
      <LinearGradient colors={c.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
        style={{ borderRadius: 16, paddingVertical: size === 'lg' ? 16 : 11, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
        {icon ? <MCI name={icon} size={20} color="#fff" /> : null}
        <Txt w="s" size={size === 'lg' ? 16 : 14} color="#fff">{loading ? 'Please wait…' : title}</Txt>
        {trailing && !loading ? <Txt w="s" size={16} color="#fff">{trailing}</Txt> : null}
      </LinearGradient>
    </Pressable>
  );
}

export function IconButton({ name, onPress, badge, label, set = 'ion', color = c.text, style }) {
  const Icon = set === 'mci' ? MCI : Ionicons;
  return (
    <Pressable onPress={onPress} hitSlop={8} accessibilityRole="button" accessibilityLabel={label}
      style={[{ width: 44, height: 44, borderRadius: 22, backgroundColor: c.surface, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border }, style]}>
      <Icon name={name} size={21} color={color} />
      {badge ? <View style={{ position: 'absolute', top: -2, right: -2, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 }}><Txt w="s" size={10} color="#fff">{badge > 9 ? '9+' : badge}</Txt></View> : null}
    </Pressable>
  );
}

export function WalletPill({ balancePaise, onAdd, onPress }) {
  // Two sibling touch targets (balance → wallet, "+ Add" → top-up); never nested.
  return (
    <View style={{ borderRadius: 18, ...c.shadow, shadowOpacity: 0.2 }}>
      <LinearGradient colors={['#F08A34', '#E26812']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 18, paddingVertical: 10, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`Wallet balance ${rupees(balancePaise ?? 0)}`} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
          <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.22)', alignItems: 'center', justifyContent: 'center' }}><MCI name="wallet-outline" size={20} color="#fff" /></View>
          <View>
            <Txt size={11} color="rgba(255,255,255,0.9)">Wallet Balance</Txt>
            <Txt w="b" size={16} color="#fff">{rupees(balancePaise ?? 0)}</Txt>
          </View>
        </Pressable>
        <Pressable onPress={onAdd} hitSlop={6} accessibilityRole="button" accessibilityLabel="Add money" style={{ backgroundColor: '#fff', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5, marginLeft: 4 }}>
          <Txt w="s" size={13} color={c.primary}>+ Add</Txt>
        </Pressable>
      </LinearGradient>
    </View>
  );
}

export function SearchRow({ value, onChangeText, onFilter, placeholder = 'Search astrologers, services, horoscope…', onFocus, filterCount }) {
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.surface, borderRadius: 16, borderWidth: 1, borderColor: c.border, paddingHorizontal: 14, height: 52 }}>
        <Ionicons name="search-outline" size={20} color={c.muted} />
        <TextInput value={value} onChangeText={onChangeText} onFocus={onFocus} placeholder={placeholder} placeholderTextColor={c.muted} accessibilityLabel="Search"
          style={[F.r, { flex: 1, fontSize: 14, color: c.text, paddingVertical: 0 }]} returnKeyType="search" />
      </View>
      {onFilter ? (
        <Pressable onPress={onFilter} accessibilityRole="button" accessibilityLabel="Filters" style={{ width: 52, height: 52, borderRadius: 16, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="options-outline" size={22} color={c.primary} />
          {filterCount ? <View style={{ position: 'absolute', top: 6, right: 6, width: 16, height: 16, borderRadius: 8, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}><Txt w="s" size={10} color="#fff">{filterCount}</Txt></View> : null}
        </Pressable>
      ) : null}
    </View>
  );
}

/** Decorative chart grid drawn in the banner (no imagery needed). */
function BannerArt() {
  return (
    <Svg width={130} height={130} viewBox="0 0 130 130" style={{ position: 'absolute', right: -8, top: 8, opacity: 0.55 }}>
      <G stroke={c.gold} strokeWidth={1.4} fill="none" transform="rotate(-8 65 65)">
        <Path d="M15 15 H115 V115 H15 Z" /><Path d="M65 15 V115 M15 65 H115" /><Path d="M22 22 H108 V108 H22 Z" opacity={0.6} />
      </G>
      <Circle cx={65} cy={65} r={60} stroke={c.gold} strokeWidth={0.8} fill="none" opacity={0.35} />
    </Svg>
  );
}

export function PromoBanner({ eyebrow, title, highlight, body, cta, onPress }) {
  return (
    <LinearGradient colors={c.banner} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ borderRadius: 22, padding: 20, overflow: 'hidden', minHeight: 176 }}>
      <BannerArt />
      <Txt w="m" size={11} color={c.gold} style={{ letterSpacing: 0.6 }}>{eyebrow}</Txt>
      <Txt w="b" size={22} color="#fff" style={{ marginTop: 4, maxWidth: '78%' }}>{title} <Txt w="b" size={22} color={c.gold}>{highlight}</Txt></Txt>
      <Txt size={12.5} color="rgba(255,255,255,0.85)" style={{ marginTop: 4, maxWidth: '72%' }}>{body}</Txt>
      <GradientButton title={cta} onPress={onPress} size="sm" style={{ alignSelf: 'flex-start', marginTop: 14 }} />
    </LinearGradient>
  );
}

export function PromoCarousel({ slides }) {
  const [index, setIndex] = useState(0);
  const listRef = useRef();
  const width = Dimensions.get('window').width - 32;
  useEffect(() => {
    const t = setInterval(() => setIndex((i) => { const n = (i + 1) % slides.length; listRef.current?.scrollToOffset({ offset: n * (width + 12), animated: true }); return n; }), 5000);
    return () => clearInterval(t);
  }, [slides.length, width]);
  return (
    <View>
      <FlatList ref={listRef} data={slides} horizontal pagingEnabled={false} snapToInterval={width + 12} decelerationRate="fast" showsHorizontalScrollIndicator={false}
        keyExtractor={(s) => s.key} ItemSeparatorComponent={() => <View style={{ width: 12 }} />}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / (width + 12)))}
        renderItem={({ item: { key: _key, ...slide } }) => <View style={{ width }}><PromoBanner {...slide} /></View>} />
      <View style={{ flexDirection: 'row', justifyContent: 'center', gap: 6, marginTop: 10 }}>
        {slides.map((s, i) => <View key={s.key} style={{ width: i === index ? 22 : 7, height: 7, borderRadius: 4, backgroundColor: i === index ? c.primary : '#E6D5C5' }} />)}
      </View>
    </View>
  );
}

export function QuickAction({ icon, label, onPress, set = 'mci' }) {
  const Icon = set === 'ion' ? Ionicons : MCI;
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={label}
      style={({ pressed }) => ({ flex: 1, backgroundColor: c.surface, borderRadius: 20, borderWidth: 1, borderColor: c.border, paddingVertical: 16, alignItems: 'center', gap: 8, opacity: pressed ? 0.8 : 1, ...c.shadow })}>
      <View style={{ width: 50, height: 50, borderRadius: 16, backgroundColor: c.accentSoft, alignItems: 'center', justifyContent: 'center' }}><Icon name={icon} size={24} color={c.primary} /></View>
      <Txt w="m" size={14}>{label}</Txt>
    </Pressable>
  );
}

export function CategoryTile({ icon, label, onPress, compact }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityLabel={`${label} astrologers`} style={{ alignItems: 'center', gap: 6, width: compact ? 76 : undefined }}>
      <View style={{ width: 64, height: 64, borderRadius: 18, backgroundColor: c.surface, borderWidth: 1, borderColor: c.border, alignItems: 'center', justifyContent: 'center', ...c.shadow }}>
        <MCI name={icon} size={30} color={c.primary} />
      </View>
      <Txt size={13}>{label}</Txt>
    </Pressable>
  );
}

export function SectionHeader({ title, onViewAll }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
      <Txt w="s" size={17}>{title}</Txt>
      {onViewAll ? <Pressable onPress={onViewAll} hitSlop={8} accessibilityRole="link"><Txt w="m" size={13} color={c.primary}>View All →</Txt></Pressable> : null}
    </View>
  );
}

const initials = (name = '?') => name.replace(/^(Acharya|Pandit|Dr\.|Jyotishi)\s+/i, '').split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
const AVATAR_TONES = [['#F7A35C', '#E8711A'], ['#F2B66D', '#C9792F'], ['#E9965D', '#B4530F'], ['#F5C27B', '#E38B2C']];

/** Astrologer avatar: warm gradient disc with initials, gold ring, optional online badge. */
export function AstroAvatar({ name, size = 72, online, showOnlineLabel }) {
  const tone = AVATAR_TONES[[...name].reduce((h, ch) => h + ch.charCodeAt(0), 0) % AVATAR_TONES.length];
  return (
    <View style={{ alignItems: 'center' }}>
      <View style={{ padding: 3, borderRadius: size, borderWidth: 2, borderColor: '#F3C089' }}>
        <LinearGradient colors={tone} style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
          <Txt w="s" size={size * 0.34} color="#fff">{initials(name)}</Txt>
        </LinearGradient>
      </View>
      {online && showOnlineLabel ? (
        <View style={{ position: 'absolute', bottom: -8, flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.ok, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 2, borderColor: '#fff' }}>
          <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#fff' }} /><Txt w="m" size={11} color="#fff">Online</Txt>
        </View>
      ) : online ? <View style={{ position: 'absolute', right: 4, bottom: 4, width: 14, height: 14, borderRadius: 7, backgroundColor: c.ok, borderWidth: 2, borderColor: '#fff' }} /> : null}
    </View>
  );
}

export const PricePill = ({ paise }) => (
  <View style={{ backgroundColor: c.pricePill, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 6, flexDirection: 'row', alignItems: 'baseline' }}>
    <Txt w="b" size={15} color={c.pricePillText}>{rupees(paise)}</Txt><Txt size={12} color={c.pricePillText}>/min</Txt>
  </View>
);

export const RatingPill = ({ rating, count }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: c.accentSoft, borderRadius: 10, paddingHorizontal: 8, paddingVertical: 2 }}>
    <Ionicons name="star" size={13} color={c.accent} />
    <Txt w="s" size={12.5}>{count ? rating.toFixed(1) : 'New'}</Txt>
    {count ? <Txt size={12} color={c.muted}>({count >= 1000 ? `${(count / 1000).toFixed(1)}K` : count})</Txt> : null}
  </View>
);

export function HeartButton({ active, onPress, size = 24 }) {
  return (
    <Pressable onPress={onPress} hitSlop={10} accessibilityRole="button" accessibilityLabel={active ? 'Remove from favourites' : 'Add to favourites'} accessibilityState={{ selected: !!active }}>
      <Ionicons name={active ? 'heart' : 'heart-outline'} size={size} color={active ? c.primary : '#C9A98E'} />
    </Pressable>
  );
}

/** Soft action button (Chat / Call) used on astrologer cards. */
export function SoftAction({ icon, label, onPress, disabled, filled }) {
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
      style={({ pressed }) => ({ flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 46, borderRadius: 23, backgroundColor: filled ? c.primary : '#F6EDE4', opacity: disabled ? 0.45 : pressed ? 0.8 : 1 })}>
      <Ionicons name={icon} size={19} color={filled ? '#fff' : c.primary} />
      <Txt w="m" size={15} color={filled ? '#fff' : c.primary}>{label}</Txt>
    </Pressable>
  );
}

/** Full-width astrologer card (list screen). */
export function AstrologerCard({ a, onToggleFavorite, onChat, onCall, callEnabled }) {
  return (
    <View style={{ backgroundColor: c.surface, borderRadius: 22, padding: 16, gap: 14, ...c.shadow }}>
      <Pressable onPress={() => router.push(`/astrologer/${a.astrologerId}`)} accessibilityRole="link" accessibilityLabel={`${a.displayName} profile`} style={{ flexDirection: 'row', gap: 14 }}>
        <AstroAvatar name={a.displayName} size={68} online={a.isOnline} showOnlineLabel />
        <View style={{ flex: 1, gap: 3 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <Txt w="s" size={17} style={{ flex: 1 }} numberOfLines={1}>{a.displayName}</Txt>
            {onToggleFavorite ? <HeartButton active={a.isFavorite} onPress={() => onToggleFavorite(a)} /> : null}
          </View>
          <Txt size={13} color={c.text2} numberOfLines={2}>{a.specialties.slice(0, 3).join(', ')}</Txt>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <RatingPill rating={a.ratingAvg} count={a.ratingCount} />
              <Txt size={12.5} color={c.text2}>• {a.experienceYears} Yrs exp</Txt>
            </View>
            <PricePill paise={a.rates.chat} />
          </View>
        </View>
      </Pressable>
      <View style={{ flexDirection: 'row', gap: 12 }}>
        <SoftAction icon="chatbox-outline" label={a.isBusy ? 'Busy' : 'Chat'} onPress={() => onChat(a)} disabled={a.isBusy} />
        <SoftAction icon="call-outline" label="Call" onPress={() => onCall(a)} disabled={!callEnabled || !a.modes.includes('voice')} />
      </View>
    </View>
  );
}

/** Compact card for horizontal "Online Astrologers" carousels. */
export function AstrologerMiniCard({ a, onToggleFavorite, onChat }) {
  // Card body opens the profile; heart and Chat are sibling touch targets (never nested).
  return (
    <View style={{ width: 172, backgroundColor: c.surface, borderRadius: 22, padding: 14, ...c.shadow }}>
      <Pressable onPress={() => router.push(`/astrologer/${a.astrologerId}`)} accessibilityRole="link" accessibilityLabel={`${a.displayName} profile`} style={{ alignItems: 'center', gap: 6 }}>
        <AstroAvatar name={a.displayName} size={62} online={a.isOnline} />
        <Txt w="s" size={14.5} numberOfLines={1} style={{ marginTop: 4 }}>{a.displayName}</Txt>
        <Txt size={12} color={c.text2} numberOfLines={1}>{a.specialties.slice(0, 2).join(', ')}</Txt>
        <RatingPill rating={a.ratingAvg} count={a.ratingCount} />
      </Pressable>
      {onToggleFavorite ? <View style={{ position: 'absolute', top: 12, right: 12 }}><HeartButton size={20} active={a.isFavorite} onPress={() => onToggleFavorite(a)} /></View> : null}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 10 }}>
        <Txt w="b" size={14} color={c.pricePillText}>{rupees(a.rates.chat)}<Txt size={11} color={c.pricePillText}>/min</Txt></Txt>
        <Pressable onPress={() => onChat(a)} disabled={a.isBusy} accessibilityRole="button" accessibilityLabel={`Chat with ${a.displayName}`} hitSlop={6}
          style={{ backgroundColor: a.isBusy ? '#EADBCD' : c.primary, borderRadius: 14, paddingHorizontal: 14, paddingVertical: 6 }}>
          <Txt w="s" size={12.5} color="#fff">{a.isBusy ? 'Busy' : 'Chat'}</Txt>
        </Pressable>
      </View>
    </View>
  );
}

export function ChipToggle({ label, active, onPress, icon }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} hitSlop={4}
      style={{ flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 22, paddingHorizontal: 16, paddingVertical: 10, backgroundColor: active ? c.primarySoft : c.surface, borderWidth: 1, borderColor: active ? '#F6C9A3' : c.border }}>
      {active && !icon ? <Ionicons name="checkmark" size={15} color={c.pricePillText} /> : null}
      {icon ? <Ionicons name={icon} size={16} color={active ? c.pricePillText : c.text2} /> : null}
      <Txt w={active ? 's' : 'r'} size={14} color={active ? c.pricePillText : c.text}>{label}</Txt>
    </Pressable>
  );
}

export function ModeTabs({ value, onChange }) {
  const tabs = [['all', 'All', 'star-circle-outline'], ['chat', 'Chat', 'chatbox-outline'], ['voice', 'Call', 'call-outline']];
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      {tabs.map(([v, l, icon]) => (
        <Pressable key={v} onPress={() => onChange(v)} accessibilityRole="tab" accessibilityState={{ selected: value === v }}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 8, borderRadius: 24, paddingHorizontal: 18, paddingVertical: 11, backgroundColor: value === v ? c.primary : c.surface, ...(value === v ? {} : c.shadow) }}>
          {v === 'all' ? <MCI name={icon} size={18} color={value === v ? '#fff' : c.primary} /> : <Ionicons name={icon} size={18} color={value === v ? '#fff' : c.primary} />}
          <Txt w="m" size={15} color={value === v ? '#fff' : c.text}>{l}</Txt>
        </Pressable>
      ))}
    </View>
  );
}

export function Screen({ children }) {
  return <View style={{ flex: 1, backgroundColor: c.bg }}>{children}</View>;
}
