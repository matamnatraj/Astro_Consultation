import { astrovedas as c } from './theme.js';

// Same thresholds as the server's verdict, so the label can be shown in the app language.
export const verdictKey = (total) => (total >= 33 ? 'match.excellent' : total >= 25 ? 'match.veryGood' : total >= 18 ? 'match.average' : 'match.notRecommended');
export const scoreColor = (total) => (total >= 25 ? c.ok : total >= 18 ? c.accent : c.bad);
