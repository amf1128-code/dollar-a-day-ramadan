import { censorPaymentNote } from './censor';

export function buildVenmoDeeplink({ recipientHandle, amount, nightNumber, charityName }) {
  const note = censorPaymentNote(
    `Ramadan Night ${nightNumber} - ${charityName} - $${amount}`
  );
  const encodedNote = encodeURIComponent(note);
  const handle = recipientHandle.replace('@', '');
  return `venmo://paycharge?txn=pay&recipients=${handle}&amount=${amount}&note=${encodedNote}`;
}

export function buildPaymentNote({ nightNumber, charityName, amount }) {
  return censorPaymentNote(
    `Ramadan Night ${nightNumber} - ${charityName} - $${amount}`
  );
}
