export function validateDonationAmount(amount) {
  const num = parseFloat(amount);
  if (isNaN(num) || num <= 0 || num > 10000) return 'Amount must be between $0.01 and $10,000';
  if (Math.round(num * 100) !== num * 100) return 'Amount can have at most 2 decimal places';
  return null;
}

export function validateFirstName(name) {
  const trimmed = (name || '').trim().replace(/<[^>]*>/g, '');
  if (!trimmed || trimmed.length < 1 || trimmed.length > 50) return 'First name is required (1-50 characters)';
  return null;
}

export function validateLastInitial(initial) {
  if (!initial || !/^[a-zA-Z]$/.test(initial)) return 'Last initial must be a single letter';
  return null;
}

export function normalizeVenmoHandle(handle) {
  if (!handle) return handle;
  const trimmed = handle.trim();
  if (trimmed && !trimmed.startsWith('@')) return `@${trimmed}`;
  return trimmed;
}

export function validateVenmoHandle(handle) {
  if (!handle) return 'Venmo handle is required';
  const normalized = normalizeVenmoHandle(handle);
  if (!/^@[a-zA-Z0-9-]{2,49}$/.test(normalized)) return 'Venmo handle must be 2-49 characters (letters, numbers, hyphens)';
  return null;
}

export function validateZelleIdentifier(identifier) {
  if (!identifier) return 'Zelle phone or email is required';
  const isPhone = /^\d{10}$/.test(identifier.replace(/[-()\s]/g, ''));
  const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identifier);
  if (!isPhone && !isEmail) return 'Enter a valid 10-digit phone number or email';
  return null;
}

export function sanitizeName(name) {
  return (name || '').trim().replace(/<[^>]*>/g, '');
}
