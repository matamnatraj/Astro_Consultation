import { useRef, useState } from 'react';
import { PanResponder, View } from 'react-native';
import { astrovedas as c } from '../lib/theme.js';

/** Two-thumb range slider (integer steps), built on PanResponder so it needs no native module. */
export function RangeSlider({ min, max, low, high, step = 1, onChange }) {
  const [width, setWidth] = useState(1);
  const state = useRef({ low, high, start: 0 });
  state.current.low = low; state.current.high = high;
  const toValue = (x) => Math.round((min + (Math.max(0, Math.min(width, x)) / width) * (max - min)) / step) * step;
  const toX = (v) => ((v - min) / (max - min)) * width;
  const responder = (which) => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { state.current.start = toX(state.current[which]); },
    onPanResponderMove: (_e, g) => {
      const v = toValue(state.current.start + g.dx);
      if (which === 'low') onChange(Math.min(v, state.current.high - step), state.current.high);
      else onChange(state.current.low, Math.max(v, state.current.low + step));
    },
  });
  const lowR = useRef(null); const highR = useRef(null);
  lowR.current = responder('low'); highR.current = responder('high');
  const Thumb = ({ x, r, label }) => (
    <View {...r.panHandlers} accessibilityRole="adjustable" accessibilityLabel={label} hitSlop={16}
      style={{ position: 'absolute', left: x - 13, top: -11, width: 26, height: 26, borderRadius: 13, backgroundColor: '#fff', alignItems: 'center', justifyContent: 'center', ...c.shadow, shadowOpacity: 0.25 }}>
      <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.primary }} />
    </View>
  );
  return (
    <View style={{ height: 30, justifyContent: 'center', marginHorizontal: 13 }} onLayout={(e) => setWidth(e.nativeEvent.layout.width)}>
      <View style={{ height: 4, borderRadius: 2, backgroundColor: '#EFE1D3' }} />
      <View style={{ position: 'absolute', left: toX(low), width: toX(high) - toX(low), height: 4, borderRadius: 2, backgroundColor: c.primary }} />
      <Thumb x={toX(low)} r={lowR.current} label={`Minimum ${low}`} />
      <Thumb x={toX(high)} r={highR.current} label={`Maximum ${high}`} />
    </View>
  );
}
