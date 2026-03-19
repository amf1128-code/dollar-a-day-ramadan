import { censorPaymentNote } from './censor';

export function buildVenmoDeeplink({ recipientHandle, amount, nightNumber, charityName, isLumpSum }) {
  const label = isLumpSum ? 'Ramadan Lump Sum' : `Ramadan Night ${nightNumber} - ${charityName}`;
  const note = censorPaymentNote(`${label} - $${amount}`);
  const encodedNote = encodeURIComponent(note);
  const handle = recipientHandle.replace('@', '');
  return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encodedNote}`;
}

export function buildPaymentNote({ nightNumber, charityName, amount, isLumpSum }) {
  const label = isLumpSum ? 'Ramadan Lump Sum' : `Ramadan Night ${nightNumber} - ${charityName}`;
  return censorPaymentNote(`${label} - $${amount}`);
}
