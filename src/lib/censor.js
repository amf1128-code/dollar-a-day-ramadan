const CENSORED_TERMS = ['Gaza', 'Palestine', 'Palestinian', 'Gazan', 'Iran', 'Iranian'];

export function censorPaymentNote(note) {
  let censored = note;
  for (const term of CENSORED_TERMS) {
    const regex = new RegExp(term, 'gi');
    censored = censored.replace(regex, '[Charity]');
  }
  return censored;
}
