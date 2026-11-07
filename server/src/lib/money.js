/** All amounts are integer paise. */
export const rupees = (paise) => (paise / 100).toFixed(2);

/** Billable minutes are rounded up per started minute and capped by the booked duration. */
export function billableSeconds(elapsedSec, maxSec) {
  if (elapsedSec <= 0) return 0;
  const roundedUp = Math.ceil(elapsedSec / 60) * 60;
  return Math.min(roundedUp, maxSec);
}

export function amountForSeconds(ratePaisePerMin, seconds) {
  return Math.round((ratePaisePerMin * seconds) / 60);
}

/** Split gross into platform fee + payable using basis points. Fee rounds half-up. */
export function splitCommission(grossPaise, feeBps) {
  const fee = Math.round((grossPaise * feeBps) / 10000);
  return { gross: grossPaise, platformFee: fee, payable: grossPaise - fee };
}
