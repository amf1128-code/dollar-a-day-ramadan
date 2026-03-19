import { useState } from 'react';
import { validateDonationAmount, validateFirstName, validateLastInitial, sanitizeName } from '../lib/validation';
import { logger } from '../lib/logger';

const QUICK_AMOUNTS = [1, 5, 10, 20];

export default function DonateForm({ onDonate }) {
  const [amount, setAmount] = useState('1');
  const [customAmount, setCustomAmount] = useState('');
  const [isLumpSum, setIsLumpSum] = useState(false);
  const [firstName, setFirstName] = useState('');
  const [lastInitial, setLastInitial] = useState('');
  const [errors, setErrors] = useState({});

  const activeAmount = customAmount || amount;

  function validate() {
    const errs = {};
    const amtErr = validateDonationAmount(activeAmount);
    if (amtErr) errs.amount = amtErr;
    const nameErr = validateFirstName(firstName);
    if (nameErr) errs.firstName = nameErr;
    const initErr = validateLastInitial(lastInitial);
    if (initErr) errs.lastInitial = initErr;
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  function handleDonate(method) {
    if (!validate()) return;
    logger.info('donation', 'Form submitted', { amount: parseFloat(activeAmount), method, isLumpSum });
    onDonate({
      amount: parseFloat(activeAmount),
      isLumpSum,
      firstName: sanitizeName(firstName),
      lastInitial: lastInitial.toUpperCase(),
      method,
    });
  }

  return (
    <div className="space-y-6">
      {/* Amount selector */}
      <div>
        <label className="block text-xs tracking-widest uppercase text-warm-gray mb-3">Amount</label>
        <div className="flex gap-2 mb-3">
          {QUICK_AMOUNTS.map((val) => (
            <button
              key={val}
              onClick={() => { setAmount(String(val)); setCustomAmount(''); }}
              className={`flex-1 py-3 text-sm border transition-colors cursor-pointer ${
                activeAmount === String(val) && !customAmount
                  ? 'border-maroon bg-maroon text-cream'
                  : 'border-warm-gray-light text-warm-gray-dark hover:border-maroon hover:text-maroon'
              }`}
            >
              ${val}
            </button>
          ))}
        </div>
        <input
          type="number"
          inputMode="decimal"
          value={customAmount}
          onChange={(e) => setCustomAmount(e.target.value)}
          placeholder="Custom amount"
          className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
          min="0.01"
          max="10000"
          step="0.01"
        />
        {errors.amount && <p className="text-xs text-maroon mt-1">{errors.amount}</p>}
      </div>

      {/* Lump sum toggle */}
      <label className="flex items-center gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isLumpSum}
          onChange={(e) => setIsLumpSum(e.target.checked)}
          className="w-4 h-4 accent-maroon"
        />
        <span className="text-sm text-warm-gray-dark italic font-serif">
          This is a lump sum for the entire month
        </span>
      </label>

      {/* Name fields */}
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">First Name</label>
          <input
            type="text"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            placeholder="Enter your first name"
            className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
            maxLength={50}
          />
          {errors.firstName && <p className="text-xs text-maroon mt-1">{errors.firstName}</p>}
        </div>
        <div className="w-20">
          <label className="block text-xs tracking-widest uppercase text-warm-gray mb-2">Last Initial</label>
          <input
            type="text"
            value={lastInitial}
            onChange={(e) => setLastInitial(e.target.value.slice(0, 1))}
            placeholder="K"
            className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm text-center focus:outline-none focus:border-maroon"
            maxLength={1}
          />
          {errors.lastInitial && <p className="text-xs text-maroon mt-1">{errors.lastInitial}</p>}
        </div>
      </div>

      {/* Payment buttons */}
      <div className="flex gap-3 pt-2">
        <button
          onClick={() => handleDonate('venmo')}
          className="flex-1 bg-maroon text-cream py-4 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
        >
          Donate via Venmo
        </button>
        <button
          onClick={() => handleDonate('zelle')}
          className="flex-1 border-2 border-maroon text-maroon py-4 text-sm tracking-widest uppercase hover:bg-maroon hover:text-cream transition-colors cursor-pointer"
        >
          Donate via Zelle
        </button>
      </div>
    </div>
  );
}
