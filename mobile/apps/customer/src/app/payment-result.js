import { Redirect, useLocalSearchParams } from 'expo-router';

// Deep-link target for the payment gateway's return URL (astrocustomer://payment-result).
// The booking screen handles the outcome; this just routes there if the app was cold-started.
export default function PaymentResult() {
  const { bookingId, payment } = useLocalSearchParams();
  return <Redirect href={bookingId ? `/booking/${bookingId}?payment=${payment || ''}` : '/sessions'} />;
}
