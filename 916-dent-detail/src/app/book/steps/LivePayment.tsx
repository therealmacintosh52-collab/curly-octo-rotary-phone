'use client';
// Loaded only when Stripe is live. Stripe Payment Element in the brand's dark theme.
import { useMemo, useState } from 'react';
import { Elements, PaymentElement, useElements, useStripe } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Spinner } from '../ui';

function Form({ returnUrl, onPaid, label }: { returnUrl: string; onPaid: () => Promise<void>; label: string }) {
  const stripe = useStripe();
  const elements = useElements();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;
    setBusy(true); setErr(null);
    const { error } = await stripe.confirmPayment({ elements, redirect: 'if_required', confirmParams: { return_url: returnUrl } });
    if (error) { setErr(error.message ?? 'Payment failed. Please try another card.'); setBusy(false); return; }
    await onPaid();
    setBusy(false);
  }
  return (
    <form onSubmit={submit} className="mt-6">
      <PaymentElement />
      {err && <p role="alert" className="bk-err mt-4">{err}</p>}
      <button type="submit" className="btn btn-gold mt-6 w-full sm:w-auto" disabled={!stripe || busy}>{busy ? <Spinner label="Processing…" /> : label}</button>
    </form>
  );
}

export default function LivePayment({ publishableKey, clientSecret, returnUrl, onPaid, label }: { publishableKey: string; clientSecret: string; returnUrl: string; onPaid: () => Promise<void>; label: string }) {
  const stripe = useMemo(() => loadStripe(publishableKey), [publishableKey]);
  return (
    <Elements stripe={stripe} options={{ clientSecret, appearance: { theme: 'night', variables: { colorPrimary: '#C9A24A', colorBackground: '#1d1f23', colorText: '#F3EEE3', colorDanger: '#f0907f', borderRadius: '14px', fontFamily: 'Inter, system-ui, sans-serif' } } }}>
      <Form returnUrl={returnUrl} onPaid={onPaid} label={label} />
    </Elements>
  );
}
