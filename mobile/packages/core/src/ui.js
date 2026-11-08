import { useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Animated, KeyboardAvoidingView, Modal, Platform, Pressable, RefreshControl, ScrollView,
  StyleSheet, Text, TextInput, View,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme, TONES } from './theme.js';
import { STATUS_TONE, titleCase } from './format.js';

export function T({ style, muted, small, tiny, bold, size, color, center, children, ...p }) {
  const c = useTheme();
  return (
    <Text
      style={[{ color: color || (muted ? c.muted : c.text), fontSize: size || (tiny ? 12 : small ? 13 : 15), fontWeight: bold ? '700' : '400', textAlign: center ? 'center' : undefined, lineHeight: (size || (tiny ? 12 : small ? 13 : 15)) * 1.4 }, style]}
      {...p}
    >{children}</Text>
  );
}
export const H1 = (p) => <T size={24} bold {...p} />;
export const H2 = (p) => <T size={18} bold {...p} />;

/** Scrollable screen with pull-to-refresh and safe-area padding. */
export function Screen({ children, onRefresh, refreshing = false, scroll = true, padded = true, edges = ['bottom'], footer }) {
  const c = useTheme();
  const body = scroll ? (
    <ScrollView
      contentContainerStyle={{ padding: padded ? 16 : 0, gap: 14, paddingBottom: 32 }}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
    >{children}</ScrollView>
  ) : <View style={{ flex: 1, padding: padded ? 16 : 0 }}>{children}</View>;
  return (
    <SafeAreaView edges={edges} style={{ flex: 1, backgroundColor: c.bg }}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}>
        {body}
        {footer}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

export function Card({ title, right, children, style, onPress, pad = true }) {
  const c = useTheme();
  const base = { backgroundColor: c.surface, borderColor: c.border, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14 };
  const inner = (
    <>
      {(title || right) && (
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 14, paddingBottom: pad ? 0 : 10, gap: 8 }}>
          {typeof title === 'string' ? <T bold size={16} style={{ flex: 1 }}>{title}</T> : <View style={{ flex: 1 }}>{title}</View>}
          {right}
        </View>
      )}
      <View style={pad ? { padding: 16, gap: 10 } : null}>{children}</View>
    </>
  );
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button" style={({ pressed }) => [base, { opacity: pressed ? 0.85 : 1 }, style]}>{inner}</Pressable>
    : <View style={[base, style]}>{inner}</View>;
}

export function Button({ title, onPress, variant = 'primary', size, loading, disabled, style, icon, accessibilityLabel }) {
  const c = useTheme();
  const bg = { primary: c.primary, secondary: c.surface, ghost: 'transparent', danger: c.bad, accent: c.accent }[variant];
  const fg = { primary: c.onPrimary, secondary: c.text, ghost: c.primary, danger: '#fff', accent: '#1d1a2e' }[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      onPress={onPress} disabled={isDisabled} accessibilityRole="button" accessibilityLabel={accessibilityLabel || title} accessibilityState={{ disabled: isDisabled, busy: loading }}
      hitSlop={6}
      style={({ pressed }) => [{
        backgroundColor: bg, borderRadius: 10, paddingVertical: size === 'sm' ? 8 : size === 'lg' ? 15 : 12, paddingHorizontal: size === 'sm' ? 12 : 18,
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: isDisabled ? 0.5 : pressed ? 0.8 : 1,
        borderWidth: variant === 'secondary' ? 1 : 0, borderColor: c.border, minHeight: size === 'sm' ? 36 : 44,
      }, style]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon}
      <Text style={{ color: fg, fontWeight: '700', fontSize: size === 'sm' ? 13 : size === 'lg' ? 17 : 15 }}>{title}</Text>
    </Pressable>
  );
}

export function Badge({ status, tone, label }) {
  const c = useTheme();
  const [bg, fg] = TONES(c)[tone || STATUS_TONE[status] || 'muted'];
  return <View style={{ backgroundColor: bg, borderRadius: 99, paddingHorizontal: 9, paddingVertical: 2, alignSelf: 'flex-start' }}><Text style={{ color: fg, fontSize: 12, fontWeight: '700' }}>{label || titleCase(status)}</Text></View>;
}

export function Notice({ tone = 'info', children, action }) {
  const c = useTheme();
  const [bg, fg] = TONES(c)[tone];
  return (
    <View style={{ backgroundColor: bg, borderRadius: 10, padding: 12, gap: 8 }}>
      {typeof children === 'string' ? <Text style={{ color: fg, fontSize: 14, lineHeight: 20 }}>{children}</Text> : children}
      {action}
    </View>
  );
}

export const ErrorBox = ({ error, onRetry }) => (error ? (
  <Notice tone="bad" action={onRetry ? <Button size="sm" variant="secondary" title="Try again" onPress={onRetry} style={{ alignSelf: 'flex-start' }} /> : null}>{error.message || String(error)}</Notice>
) : null);

export function Loading({ label }) {
  const c = useTheme();
  return <View style={{ padding: 40, alignItems: 'center', gap: 10 }}><ActivityIndicator color={c.primary} />{label ? <T muted small>{label}</T> : null}</View>;
}

export const Empty = ({ title, children, icon = '✦' }) => {
  const c = useTheme();
  return <View style={{ alignItems: 'center', padding: 32, gap: 6 }}><Text style={{ fontSize: 28, color: c.accent }}>{icon}</Text><T bold center>{title}</T>{children ? <T muted small center>{children}</T> : null}</View>;
};

export function Field({ label, hint, error, style, ...input }) {
  const c = useTheme();
  return (
    <View style={[{ gap: 5 }, style]}>
      {label ? <T small bold color={c.text2}>{label}</T> : null}
      <TextInput
        placeholderTextColor={c.muted}
        accessibilityLabel={label}
        {...input}
        style={[{ borderWidth: 1, borderColor: error ? c.bad : c.border, borderRadius: 10, paddingHorizontal: 12, paddingVertical: Platform.OS === 'ios' ? 12 : 9, fontSize: 16, color: c.text, backgroundColor: c.surface, minHeight: input.multiline ? 80 : 46, textAlignVertical: input.multiline ? 'top' : 'center' }, input.inputStyle]}
      />
      {error ? <T tiny color={c.bad}>{error}</T> : hint ? <T tiny muted>{hint}</T> : null}
    </View>
  );
}

export function Chip({ label, active, onPress }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} accessibilityRole="button" accessibilityState={{ selected: !!active }} hitSlop={4}
      style={{ borderRadius: 99, borderWidth: 1, borderColor: active ? c.primary : c.border, backgroundColor: active ? c.primarySoft : c.surface, paddingHorizontal: 13, paddingVertical: 7 }}>
      <Text style={{ color: active ? c.primary : c.text2, fontWeight: '600', fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}
export const Chips = ({ children, style }) => <View style={[{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, style]}>{children}</View>;

export function Segmented({ options, value, onChange }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', backgroundColor: c.surface2, borderRadius: 10, padding: 3 }} accessibilityRole="tablist">
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => !o.disabled && onChange(o.value)} disabled={o.disabled} accessibilityRole="tab" accessibilityState={{ selected: value === o.value, disabled: o.disabled }}
          style={{ flex: 1, paddingVertical: 9, borderRadius: 8, alignItems: 'center', backgroundColor: value === o.value ? c.surface : 'transparent', opacity: o.disabled ? 0.4 : 1 }}>
          <Text style={{ fontWeight: '700', fontSize: 14, color: value === o.value ? c.primary : c.text2 }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Row({ children, style, gap = 10, wrap }) {
  return <View style={[{ flexDirection: 'row', alignItems: 'center', gap, flexWrap: wrap ? 'wrap' : 'nowrap' }, style]}>{children}</View>;
}

export function ListItem({ title, subtitle, right, left, onPress, last }) {
  const c = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: last ? 0 : StyleSheet.hairlineWidth, borderColor: c.border, opacity: pressed ? 0.7 : 1 })}>
      {left}
      <View style={{ flex: 1, gap: 2 }}>{typeof title === 'string' ? <T bold>{title}</T> : title}{subtitle ? (typeof subtitle === 'string' ? <T small muted>{subtitle}</T> : subtitle) : null}</View>
      {right}
    </Pressable>
  );
}

export function KV({ rows }) {
  return (
    <View style={{ gap: 6 }}>
      {rows.filter(Boolean).map(([k, v]) => (
        <View key={k} style={{ flexDirection: 'row', gap: 12 }}>
          <T small muted style={{ width: 110 }}>{k}</T>
          {typeof v === 'string' || typeof v === 'number' ? <T small style={{ flex: 1 }}>{v}</T> : <View style={{ flex: 1 }}>{v}</View>}
        </View>
      ))}
    </View>
  );
}

export function Avatar({ name = '?', size = 44 }) {
  const initials = name.split(' ').filter(Boolean).slice(0, 2).map((s) => s[0]).join('').toUpperCase();
  const hue = [...name].reduce((h, ch) => (h * 31 + ch.charCodeAt(0)) % 360, 0);
  return <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `hsl(${hue}, 45%, 42%)`, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: '#fff', fontWeight: '700', fontSize: size * 0.38 }}>{initials}</Text></View>;
}

export function Stars({ value = 0, onChange, size = 16 }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: size > 20 ? 8 : 1 }} accessibilityLabel={`${value} of 5 stars`}>
      {[1, 2, 3, 4, 5].map((i) => (
        <Pressable key={i} disabled={!onChange} onPress={() => onChange?.(i)} hitSlop={6} accessibilityRole={onChange ? 'button' : undefined} accessibilityLabel={onChange ? `${i} stars` : undefined}>
          <Text style={{ fontSize: size, color: value >= i - 0.25 ? c.accent : c.border }}>★</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function Stat({ label, value, sub, tone }) {
  const c = useTheme();
  return (
    <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: c.surface, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, borderColor: c.border, padding: 12 }}>
      <T tiny muted bold>{label.toUpperCase()}</T>
      <T size={22} bold color={tone ? c[tone] : undefined}>{value}</T>
      {sub ? <T tiny muted>{sub}</T> : null}
    </View>
  );
}

/** Bottom sheet style modal. */
export function Sheet({ visible, onClose, title, children, footer }) {
  const c = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(15,12,30,0.45)' }} onPress={onClose} accessibilityLabel="Close" />
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ maxHeight: '88%' }}>
        <View style={{ backgroundColor: c.surface, borderTopLeftRadius: 20, borderTopRightRadius: 20, paddingBottom: insets.bottom + 12 }}>
          <View style={{ alignItems: 'center', paddingTop: 8 }}><View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: c.border }} /></View>
          <Row style={{ justifyContent: 'space-between', paddingHorizontal: 18, paddingVertical: 10 }}>
            <T bold size={17} style={{ flex: 1 }}>{title}</T>
            <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel="Close"><Text style={{ fontSize: 18, color: c.muted }}>✕</Text></Pressable>
          </Row>
          <ScrollView contentContainerStyle={{ paddingHorizontal: 18, gap: 12, paddingBottom: 8 }} keyboardShouldPersistTaps="handled">{children}</ScrollView>
          {footer ? <View style={{ paddingHorizontal: 18, paddingTop: 10, gap: 8 }}>{footer}</View> : null}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

/** Lightweight toast: const [toast, show] = useToast(); render {toast}. */
export function useToast() {
  const c = useTheme();
  const [msg, setMsg] = useState(null);
  const opacity = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!msg) return undefined;
    Animated.timing(opacity, { toValue: 1, duration: 150, useNativeDriver: Platform.OS !== 'web' }).start();
    const t = setTimeout(() => Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: Platform.OS !== 'web' }).start(() => setMsg(null)), 3000);
    return () => clearTimeout(t);
  }, [msg, opacity]);
  const bg = msg?.tone === 'bad' ? c.bad : msg?.tone === 'info' ? c.info : c.ok;
  const el = msg ? (
    <Animated.View pointerEvents="none" accessibilityLiveRegion="polite" style={{ position: 'absolute', left: 16, right: 16, bottom: 40, opacity, backgroundColor: bg, borderRadius: 12, padding: 14, zIndex: 100 }}>
      <Text style={{ color: '#fff', fontWeight: '700', textAlign: 'center' }}>{msg.text}</Text>
    </Animated.View>
  ) : null;
  return [el, (text, tone) => setMsg({ text, tone })];
}

export function Check({ checked, onChange, label }) {
  const c = useTheme();
  return (
    <Pressable onPress={() => onChange(!checked)} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }} accessibilityRole="checkbox" accessibilityState={{ checked }} hitSlop={6}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: checked ? c.primary : c.muted, backgroundColor: checked ? c.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {checked ? <Text style={{ color: c.onPrimary, fontSize: 14, fontWeight: '900' }}>✓</Text> : null}
      </View>
      <View style={{ flex: 1 }}>{typeof label === 'string' ? <T small>{label}</T> : label}</View>
    </Pressable>
  );
}

export function Tabs({ tabs, value, onChange }) {
  const c = useTheme();
  return (
    <View style={{ flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, borderColor: c.border, backgroundColor: c.surface }} accessibilityRole="tablist">
      {tabs.map((t) => (
        <Pressable key={t.value} onPress={() => onChange(t.value)} accessibilityRole="tab" accessibilityState={{ selected: value === t.value }}
          style={{ flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2, borderColor: value === t.value ? c.primary : 'transparent' }}>
          <Text style={{ fontWeight: '700', color: value === t.value ? c.primary : c.muted }}>{t.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}
