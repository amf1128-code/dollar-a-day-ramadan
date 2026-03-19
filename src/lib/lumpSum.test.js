import { describe, it, expect } from 'vitest';
import { calculateLumpSumDistribution } from './lumpSum';

function makeNights(nightNumbers, accountMap) {
  return nightNumbers.map((n) => ({
    nightId: `night-${n}`,
    nightNumber: n,
    accountId: accountMap(n),
  }));
}

describe('Lump Sum Distribution', () => {
  it('Scenario 1: even split, two accounts', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    const nights = makeNights(
      Array.from({ length: 30 }, (_, i) => i + 1),
      (n) => (n <= 15 ? accountA : accountB)
    );

    const result = calculateLumpSumDistribution({
      amount: 30,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(30);
    expect(result.totalDistributed).toBe(30);

    // Each night gets $1.00
    for (const dist of result.distributions) {
      expect(dist.amount).toBe(1.0);
    }

    // 1 action item: transfer to account B
    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0].fromAccountId).toBe(accountA);
    expect(result.actionItems[0].toAccountId).toBe(accountB);
    expect(result.actionItems[0].amount).toBe(15);
    expect(result.actionItems[0].nightNumbers).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 16)
    );
  });

  it('Scenario 2: mid-Ramadan lump sum', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    // Only remaining nights: 11-30
    const nights = makeNights(
      Array.from({ length: 20 }, (_, i) => i + 11),
      (n) => (n <= 15 ? accountA : accountB)
    );

    const result = calculateLumpSumDistribution({
      amount: 20,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(20);
    expect(result.totalDistributed).toBe(20);

    for (const dist of result.distributions) {
      expect(dist.amount).toBe(1.0);
    }

    expect(result.actionItems).toHaveLength(1);
    expect(result.actionItems[0].amount).toBe(15);
    expect(result.actionItems[0].nightNumbers).toEqual(
      Array.from({ length: 15 }, (_, i) => i + 16)
    );
  });

  it('Scenario 3: uneven division — no rounding loss', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    const nights = makeNights(
      Array.from({ length: 29 }, (_, i) => i + 1),
      (n) => (n <= 15 ? accountA : accountB)
    );

    const result = calculateLumpSumDistribution({
      amount: 10,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(29);
    expect(result.totalDistributed).toBe(10);

    // Per night: floor(1000/29) = 34 cents = $0.34
    // Last night gets remainder: 1000 - 34*28 = 1000 - 952 = 48 cents = $0.48
    for (let i = 0; i < 28; i++) {
      expect(result.distributions[i].amount).toBe(0.34);
    }
    expect(result.distributions[28].amount).toBe(0.48);

    // Verify exact total
    const manualSum = result.distributions.reduce((s, d) => Math.round((s + d.amount) * 100) / 100, 0);
    expect(manualSum).toBe(10);
  });

  it('Scenario 4: three accounts', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    const accountC = 'account-c';
    const nights = makeNights(
      Array.from({ length: 30 }, (_, i) => i + 1),
      (n) => {
        if (n <= 10) return accountA;
        if (n <= 20) return accountB;
        return accountC;
      }
    );

    const result = calculateLumpSumDistribution({
      amount: 30,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(30);
    expect(result.totalDistributed).toBe(30);
    expect(result.actionItems).toHaveLength(2);

    const toB = result.actionItems.find((a) => a.toAccountId === accountB);
    const toC = result.actionItems.find((a) => a.toAccountId === accountC);
    expect(toB.amount).toBe(10);
    expect(toC.amount).toBe(10);
    expect(toB.nightNumbers).toEqual(Array.from({ length: 10 }, (_, i) => i + 11));
    expect(toC.nightNumbers).toEqual(Array.from({ length: 10 }, (_, i) => i + 21));
  });

  it('Scenario 5: no transfers when all remaining nights are same account', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    // Lump sum on night 20, remaining nights 20-30, all account B
    const nights = makeNights(
      Array.from({ length: 11 }, (_, i) => i + 20),
      (n) => (n <= 15 ? accountA : accountB)
    );

    const result = calculateLumpSumDistribution({
      amount: 30,
      payingAccountId: accountB,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(11);
    expect(result.totalDistributed).toBe(30);
    expect(result.actionItems).toHaveLength(0);
  });

  it('Scenario 6: lump sum on last night', () => {
    const accountA = 'account-a';
    const nights = makeNights([30], () => accountA);

    const result = calculateLumpSumDistribution({
      amount: 50,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(1);
    expect(result.distributions[0].amount).toBe(50);
    expect(result.totalDistributed).toBe(50);
    expect(result.actionItems).toHaveLength(0);
  });

  it('Scenario 7: alternating nights, two accounts', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    const nights = makeNights(
      Array.from({ length: 30 }, (_, i) => i + 1),
      (n) => (n % 2 === 1 ? accountA : accountB)
    );

    const result = calculateLumpSumDistribution({
      amount: 30,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(30);
    expect(result.totalDistributed).toBe(30);
    expect(result.actionItems).toHaveLength(1);

    const item = result.actionItems[0];
    expect(item.toAccountId).toBe(accountB);
    expect(item.amount).toBe(15);
    // Should be individual even numbers, not a range
    expect(item.nightNumbers).toEqual([2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24, 26, 28, 30]);
  });

  it('Scenario 8: alternating three accounts, mid-month', () => {
    const accountA = 'account-a';
    const accountB = 'account-b';
    const accountC = 'account-c';
    const allNights = Array.from({ length: 30 }, (_, i) => i + 1);
    const accountMap = (n) => {
      const mod = ((n - 1) % 3);
      if (mod === 0) return accountA;
      if (mod === 1) return accountB;
      return accountC;
    };

    // Remaining nights: 10-30 (21 nights)
    const remaining = allNights.filter((n) => n >= 10);
    const nights = makeNights(remaining, accountMap);

    const result = calculateLumpSumDistribution({
      amount: 21,
      payingAccountId: accountA,
      remainingNights: nights,
    });

    expect(result.distributions).toHaveLength(21);
    expect(result.totalDistributed).toBe(21);

    // Account A remaining: 10, 13, 16, 19, 22, 25, 28 -> 7 nights
    const aNights = result.distributions.filter((d) => d.accountId === accountA);
    expect(aNights).toHaveLength(7);

    // Account B remaining: 11, 14, 17, 20, 23, 26, 29 -> 7 nights
    const bNights = result.distributions.filter((d) => d.accountId === accountB);
    expect(bNights).toHaveLength(7);

    // Account C remaining: 12, 15, 18, 21, 24, 27, 30 -> 7 nights
    const cNights = result.distributions.filter((d) => d.accountId === accountC);
    expect(cNights).toHaveLength(7);

    expect(result.actionItems).toHaveLength(2);
    const toB = result.actionItems.find((a) => a.toAccountId === accountB);
    const toC = result.actionItems.find((a) => a.toAccountId === accountC);
    expect(toB.amount).toBe(7);
    expect(toC.amount).toBe(7);
    expect(toB.nightNumbers).toEqual([11, 14, 17, 20, 23, 26, 29]);
    expect(toC.nightNumbers).toEqual([12, 15, 18, 21, 24, 27, 30]);
  });
});
