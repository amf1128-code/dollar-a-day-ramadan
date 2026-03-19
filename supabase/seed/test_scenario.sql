-- Run this in the Supabase SQL Editor after running the migration.
-- Delete this data before going live.

-- Create a test campaign
INSERT INTO campaigns (id, year, name, is_active)
VALUES ('a0000000-0000-0000-0000-000000000001', 2026, 'Ramadan Test 2026', true);

-- Create two test accounts
INSERT INTO accounts (id, campaign_id, person_name, venmo_handle, zelle_identifier)
VALUES
  ('b0000000-0000-0000-0000-000000000001', 'a0000000-0000-0000-0000-000000000001', 'Ali', '@ali-k', '5551234567'),
  ('b0000000-0000-0000-0000-000000000002', 'a0000000-0000-0000-0000-000000000001', 'Jack', '@jack-s', '5559876543');

-- Create 30 nights: Nights 1-15 to Ali, Nights 16-30 to Jack
-- Starting Feb 28, 2026
INSERT INTO nights (id, campaign_id, night_number, date, charity_name, charity_description, charity_url, is_zakat_eligible, account_id)
SELECT
  ('c0000000-0000-0000-0000-' || lpad(n::text, 12, '0'))::uuid,
  'a0000000-0000-0000-0000-000000000001',
  n,
  ('2026-02-28'::date + (n - 1) * interval '1 day')::date,
  'Test Charity ' || n,
  CASE WHEN n <= 3 THEN 'A short description for charity ' || n ELSE NULL END,
  CASE WHEN n = 1 THEN 'https://example.org' ELSE NULL END,
  (n % 5 = 0),
  CASE
    WHEN n <= 15 THEN 'b0000000-0000-0000-0000-000000000001'
    ELSE 'b0000000-0000-0000-0000-000000000002'
  END
FROM generate_series(1, 30) AS n;

-- Test donation 1: Regular $5 donation for Night 1
INSERT INTO donations (campaign_id, night_id, is_lump_sum, donor_first_name, donor_last_initial, donor_venmo_handle, amount, payment_method, is_confirmed)
VALUES (
  'a0000000-0000-0000-0000-000000000001',
  'c0000000-0000-0000-0000-000000000001',
  false,
  'Sarah',
  'M',
  '@sarah-m',
  5.00,
  'venmo',
  true
);

-- Test donation 2: $30 lump sum on Night 1 (paid to Ali)
INSERT INTO donations (id, campaign_id, night_id, is_lump_sum, donor_first_name, donor_last_initial, donor_venmo_handle, amount, payment_method, is_confirmed)
VALUES (
  'd0000000-0000-0000-0000-000000000001',
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  true,
  'Omar',
  'R',
  '@omar-r',
  30.00,
  'venmo',
  true
);

-- Test donation 3: $20 lump sum mid-month (Night 11, paid to Ali)
INSERT INTO donations (id, campaign_id, night_id, is_lump_sum, donor_first_name, donor_last_initial, donor_venmo_handle, amount, payment_method, is_confirmed)
VALUES (
  'd0000000-0000-0000-0000-000000000002',
  'a0000000-0000-0000-0000-000000000001',
  NULL,
  true,
  'Fatima',
  'A',
  '@fatima-a',
  20.00,
  'venmo',
  true
);
