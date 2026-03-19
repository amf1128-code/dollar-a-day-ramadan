import { formatNightNumbers } from './formatNights';

/**
 * Calculate how a lump sum donation should be distributed across remaining nights.
 *
 * @param {Object} params
 * @param {number} params.amount - Total lump sum amount
 * @param {string} params.payingAccountId - The account that received the payment
 * @param {Array<{nightId: string, nightNumber: number, accountId: string}>} params.remainingNights
 *   Nights that are >= the donation date, sorted by nightNumber
 * @returns {{
 *   distributions: Array<{nightId: string, nightNumber: number, accountId: string, amount: number}>,
 *   actionItems: Array<{fromAccountId: string, toAccountId: string, amount: number, nightNumbers: number[]}>,
 *   totalDistributed: number
 * }}
 */
export function calculateLumpSumDistribution({ amount, payingAccountId, remainingNights }) {
  if (!remainingNights || remainingNights.length === 0) {
    return { distributions: [], actionItems: [], totalDistributed: 0 };
  }

  const count = remainingNights.length;
  const perNight = Math.floor((amount / count) * 100) / 100; // round down to 2 decimals
  const subtotal = perNight * (count - 1);
  // Use rounding that avoids floating point: work in cents
  const totalCents = Math.round(amount * 100);
  const perNightCents = Math.floor(totalCents / count);
  const lastNightCents = totalCents - perNightCents * (count - 1);

  const distributions = remainingNights.map((night, i) => ({
    nightId: night.nightId,
    nightNumber: night.nightNumber,
    accountId: night.accountId,
    amount: i === count - 1 ? lastNightCents / 100 : perNightCents / 100,
  }));

  // Group distributions by account (excluding the paying account)
  const accountGroups = {};
  for (const dist of distributions) {
    if (dist.accountId === payingAccountId) continue;
    if (!accountGroups[dist.accountId]) {
      accountGroups[dist.accountId] = { amount: 0, nightNumbers: [] };
    }
    accountGroups[dist.accountId].amount = Math.round((accountGroups[dist.accountId].amount + dist.amount) * 100) / 100;
    accountGroups[dist.accountId].nightNumbers.push(dist.nightNumber);
  }

  const actionItems = Object.entries(accountGroups).map(([toAccountId, data]) => ({
    fromAccountId: payingAccountId,
    toAccountId,
    amount: data.amount,
    nightNumbers: data.nightNumbers,
  }));

  const totalDistributed = distributions.reduce((sum, d) => Math.round((sum + d.amount) * 100) / 100, 0);

  return { distributions, actionItems, totalDistributed };
}

/**
 * Format an action item description for a lump sum transfer.
 */
export function formatActionItemDescription({
  fromName,
  fromHandle,
  toName,
  toHandle,
  amount,
  nightNumbers,
  donorName,
  donorInitial,
}) {
  const nightsStr = formatNightNumbers(nightNumbers);
  return `Transfer $${amount.toFixed(2)} from @${fromHandle} to @${toHandle} for ${nightsStr} — Lump sum from ${donorName} ${donorInitial}.`;
}
