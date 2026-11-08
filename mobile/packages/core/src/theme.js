import { useColorScheme } from 'react-native';

const light = {
  bg: '#f6f5fb', surface: '#ffffff', surface2: '#f1effa', border: '#e3e0f0', text: '#1d1a2e', text2: '#5d5875', muted: '#8a85a3',
  primary: '#4b3fb5', primarySoft: '#ebe8fb', onPrimary: '#ffffff', accent: '#e8962e', accentSoft: '#fdf1e1',
  ok: '#1f8a5b', okSoft: '#e3f5ec', warn: '#a8670b', warnSoft: '#fdf3e0', bad: '#c0392b', badSoft: '#fbe8e6',
  info: '#2f6db5', infoSoft: '#e5effa', live: '#d6336c', liveSoft: '#fce6ee', chartLine: '#6b62a8', chartAsc: '#fdf1e1',
};
const dark = {
  bg: '#12111c', surface: '#1b1a29', surface2: '#23213a', border: '#312e4c', text: '#ecebf5', text2: '#b6b2cf', muted: '#8580a5',
  primary: '#8c80f0', primarySoft: '#2a2650', onPrimary: '#12111c', accent: '#f0a94c', accentSoft: '#3a2b16',
  ok: '#4cc38a', okSoft: '#173327', warn: '#e6a640', warnSoft: '#362812', bad: '#f07167', badSoft: '#3a1c1a',
  info: '#6aa6ec', infoSoft: '#172a40', live: '#f06595', liveSoft: '#3a1726', chartLine: '#8c84c4', chartAsc: '#3a2b16',
};

export function useTheme() {
  return useColorScheme() === 'dark' ? dark : light;
}
export const TONES = (c) => ({
  ok: [c.okSoft, c.ok], warn: [c.warnSoft, c.warn], bad: [c.badSoft, c.bad], info: [c.infoSoft, c.info],
  live: [c.liveSoft, c.live], muted: [c.surface2, c.muted],
});
