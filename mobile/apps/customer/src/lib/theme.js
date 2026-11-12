// Astrovedas brand theme (from the designer's Figma): warm cream surfaces, saffron-orange actions,
// deep-brown promotional banners with gold accents, Poppins type, soft rounded cards.
export const astrovedas = {
  bg: '#FDF5EC', surface: '#FFFFFF', surface2: '#F8EEE3', border: '#F1E3D4', text: '#1E1A17', text2: '#5E544C', muted: '#9A8E84',
  primary: '#E8711A', primarySoft: '#FDE6D3', onPrimary: '#FFFFFF', accent: '#F59E2B', accentSoft: '#FFF1DF',
  ok: '#16A34A', okSoft: '#E3F5EA', warn: '#B45309', warnSoft: '#FEF3E2', bad: '#DC2626', badSoft: '#FDECEC',
  info: '#B4530F', infoSoft: '#FDE7D6', live: '#E8711A', liveSoft: '#FDE6D3',
  chartLine: '#C9792F', chartAsc: '#FFF1DF',
  // brand extras
  gradient: ['#F7A35C', '#E8711A'],
  banner: ['#2A170C', '#4A2A15'],
  gold: '#F9B233',
  pricePill: '#FDE7D6', pricePillText: '#B4530F',
  bubbleMine: '#E8711A', bubbleTheirs: '#F0E7DE',
  radius: { card: 18, button: 14, input: 14 },
  shadow: { shadowColor: '#B4530F', shadowOpacity: 0.06, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 2 },
  fonts: { regular: 'Poppins_400Regular', medium: 'Poppins_500Medium', semibold: 'Poppins_600SemiBold', bold: 'Poppins_700Bold' },
};

export const CATEGORIES = [
  { key: 'love', label: 'Love', icon: 'cards-heart-outline', specialty: 'Love,Relationships' },
  { key: 'career', label: 'Career', icon: 'briefcase-outline', specialty: 'Career,Business' },
  { key: 'marriage', label: 'Marriage', icon: 'ring', specialty: 'Marriage,Kundli Matching' },
  { key: 'finance', label: 'Finance', icon: 'hand-coin-outline', specialty: 'Finance,Business' },
  { key: 'education', label: 'Education', icon: 'school-outline', specialty: 'Education' },
  { key: 'health', label: 'Health', icon: 'heart-pulse', specialty: 'Health' },
  { key: 'property', label: 'Property', icon: 'home-city-outline', specialty: 'Property,Vastu' },
];
