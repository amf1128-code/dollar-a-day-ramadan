import { useState } from 'react';
import { buildVenmoDeeplink, buildPaymentNote } from '../lib/deeplinks';
import { validateVenmoHandle, validateZelleIdentifier, normalizeVenmoHandle } from '../lib/validation';
import { logger } from '../lib/logger';

export default function PaymentModal({
  method,
  amount,
  nightNumber,
  charityName,
  paymentInfo,
  onConfirm,
  onCancel,
}) {
  const [handle, setHandle] = useState('');
  const [step, setStep] = useState('input'); // input | confirm
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const note = buildPaymentNote({ nightNumber, charityName, amount });

  function handleCopy(text) {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function handleProceed() {
    if (method === 'venmo') {
      const err = validateVenmoHandle(handle || paymentInfo?.venmo_handle);
      if (err && !paymentInfo?.venmo_handle) {
        setError(err);
        return;
      }

      logger.info('donation', 'Venmo deeplink fired', { nightNumber, amount });
      const deeplink = buildVenmoDeeplink({
        recipientHandle: paymentInfo?.venmo_handle || '',
        amount,
        nightNumber,
        charityName,
      });

      // Try deeplink
      window.location.href = deeplink;

      // After a short delay, move to confirmation (deeplink may or may not have worked)
      setTimeout(() => setStep('confirm'), 1500);
    } else {
      // Zelle — just show info and go to confirm
      setStep('confirm');
    }
  }

  if (step === 'confirm') {
    return (
      <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
        <div className="bg-cream w-full max-w-md mx-auto p-6 sm:rounded-t-none sm:rounded-lg border-t border-warm-gray-light">
          <h3 className="font-serif text-xl mb-4">Did your payment go through?</h3>
          <p className="text-sm text-warm-gray-dark mb-6">
            ${amount} via {method === 'venmo' ? 'Venmo' : 'Zelle'} for Night {nightNumber}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => {
                logger.info('donation', 'Payment confirmed by donor', { nightNumber, amount });
                onConfirm(handle);
              }}
              className="flex-1 bg-maroon text-cream py-3 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
            >
              Yes, I Confirm
            </button>
            <button
              onClick={onCancel}
              className="flex-1 border border-warm-gray-light py-3 text-sm tracking-widest uppercase text-warm-gray-dark hover:border-maroon hover:text-maroon transition-colors cursor-pointer"
            >
              No, Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40">
      <div className="bg-cream w-full max-w-md mx-auto p-6 sm:rounded-t-none sm:rounded-lg border-t border-warm-gray-light">
        <h3 className="font-serif text-xl mb-4">
          {method === 'venmo' ? 'Pay via Venmo' : 'Pay via Zelle'}
        </h3>

        {method === 'venmo' && (
          <>
            {paymentInfo?.venmo_handle ? (
              <div className="mb-4">
                <p className="text-sm text-warm-gray-dark mb-2">Send payment to:</p>
                <p className="font-serif text-lg">{paymentInfo.venmo_handle}</p>
              </div>
            ) : (
              <p className="text-sm text-warm-gray-dark mb-4">Venmo info unavailable for this night.</p>
            )}
            <div className="mb-4">
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">
                Your Venmo Handle (optional)
              </label>
              <input
                type="text"
                value={handle}
                onChange={(e) => { setHandle(normalizeVenmoHandle(e.target.value)); setError(null); }}
                placeholder="@your-handle"
                className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">
                Suggested Note
              </label>
              <div className="flex items-center gap-2">
                <p className="text-sm italic text-warm-gray-dark flex-1">{note}</p>
                <button
                  onClick={() => handleCopy(note)}
                  className="text-xs tracking-widest uppercase text-maroon border border-maroon/30 px-2 py-1 hover:bg-maroon hover:text-cream transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </>
        )}

        {method === 'zelle' && (
          <>
            {paymentInfo?.zelle_identifier ? (
              <div className="mb-4">
                <p className="text-sm text-warm-gray-dark mb-2">Send Zelle payment to:</p>
                <div className="flex items-center gap-2">
                  <p className="font-serif text-lg">{paymentInfo.zelle_identifier}</p>
                  <button
                    onClick={() => handleCopy(paymentInfo.zelle_identifier)}
                    className="text-xs tracking-widest uppercase text-maroon border border-maroon/30 px-2 py-1 hover:bg-maroon hover:text-cream transition-colors shrink-0 cursor-pointer"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-warm-gray-dark mb-4">Zelle info unavailable for this night.</p>
            )}
            <div className="mb-4">
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">
                Your Phone Number (for records)
              </label>
              <input
                type="tel"
                value={handle}
                onChange={(e) => { setHandle(e.target.value); setError(null); }}
                placeholder="(555) 123-4567"
                className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
              />
            </div>
            <div className="mb-4">
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">
                Suggested Memo
              </label>
              <div className="flex items-center gap-2">
                <p className="text-sm italic text-warm-gray-dark flex-1">{note}</p>
                <button
                  onClick={() => handleCopy(note)}
                  className="text-xs tracking-widest uppercase text-maroon border border-maroon/30 px-2 py-1 hover:bg-maroon hover:text-cream transition-colors shrink-0 cursor-pointer"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
            <p className="text-xs text-warm-gray mb-4">
              Open your banking app to complete the Zelle transfer.
            </p>
          </>
        )}

        {error && <p className="text-sm text-maroon mb-3">{error}</p>}

        <div className="flex gap-3">
          <button
            onClick={handleProceed}
            className="flex-1 bg-maroon text-cream py-3 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
          >
            {method === 'venmo' ? 'Open Venmo' : 'I Sent It'}
          </button>
          <button
            onClick={onCancel}
            className="flex-1 border border-warm-gray-light py-3 text-sm tracking-widest uppercase text-warm-gray-dark hover:border-maroon hover:text-maroon transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
