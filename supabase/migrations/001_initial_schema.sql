-- Dollar-A-Day Ramadan — Full Database Schema
-- Run this in the Supabase SQL Editor to set up all tables, RLS policies, and functions.

-- ============================================================
-- TABLES
-- ============================================================

-- Admin users table (stores UUIDs of users allowed admin access)
CREATE TABLE admin_users (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Only authenticated admins can read admin_users"
  ON admin_users FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Campaigns
CREATE TABLE campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year INTEGER NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read campaigns"
  ON campaigns FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Authenticated can read campaigns"
  ON campaigns FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin can insert campaigns"
  ON campaigns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update campaigns"
  ON campaigns FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete campaigns"
  ON campaigns FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Accounts
CREATE TABLE accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  venmo_handle TEXT,
  zelle_identifier TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
-- NO public SELECT policy — anon cannot query accounts directly
CREATE POLICY "Admin can read accounts"
  ON accounts FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can insert accounts"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update accounts"
  ON accounts FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete accounts"
  ON accounts FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Nights
CREATE TABLE nights (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  night_number INTEGER NOT NULL CHECK (night_number BETWEEN 1 AND 30),
  date DATE NOT NULL,
  charity_name TEXT NOT NULL,
  charity_description TEXT,
  charity_url TEXT,
  is_zakat_eligible BOOLEAN DEFAULT FALSE,
  receipt_image_url TEXT,
  account_id UUID REFERENCES accounts(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(campaign_id, night_number)
);
ALTER TABLE nights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Public can read nights"
  ON nights FOR SELECT TO anon USING (TRUE);
CREATE POLICY "Authenticated can read nights"
  ON nights FOR SELECT TO authenticated USING (TRUE);
CREATE POLICY "Admin can insert nights"
  ON nights FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update nights"
  ON nights FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete nights"
  ON nights FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Donations
CREATE TABLE donations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  night_id UUID REFERENCES nights(id) ON DELETE SET NULL,
  is_lump_sum BOOLEAN DEFAULT FALSE,
  donor_first_name TEXT NOT NULL CHECK (length(donor_first_name) BETWEEN 1 AND 50),
  donor_last_initial TEXT NOT NULL CHECK (length(donor_last_initial) = 1),
  donor_venmo_handle TEXT,
  donor_zelle_identifier TEXT,
  amount NUMERIC NOT NULL CHECK (amount > 0 AND amount <= 10000),
  payment_method TEXT NOT NULL CHECK (payment_method IN ('venmo', 'zelle')),
  is_confirmed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
-- Anon can INSERT donations (with constraints enforced by CHECK above)
CREATE POLICY "Public can insert donations"
  ON donations FOR INSERT TO anon
  WITH CHECK (
    amount > 0 AND amount <= 10000
    AND length(donor_first_name) BETWEEN 1 AND 50
    AND length(donor_last_initial) = 1
  );
-- NO public SELECT — use RPC for aggregate totals
CREATE POLICY "Admin can read donations"
  ON donations FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update donations"
  ON donations FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete donations"
  ON donations FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Lump Sum Distributions
CREATE TABLE lump_sum_distributions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  donation_id UUID NOT NULL REFERENCES donations(id) ON DELETE CASCADE,
  night_id UUID NOT NULL REFERENCES nights(id) ON DELETE CASCADE,
  amount NUMERIC NOT NULL CHECK (amount > 0),
  account_id UUID NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  is_transferred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE lump_sum_distributions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read lump_sum_distributions"
  ON lump_sum_distributions FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can insert lump_sum_distributions"
  ON lump_sum_distributions FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update lump_sum_distributions"
  ON lump_sum_distributions FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete lump_sum_distributions"
  ON lump_sum_distributions FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- Action Items
CREATE TABLE action_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES campaigns(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  related_donation_id UUID REFERENCES donations(id) ON DELETE SET NULL,
  is_completed BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE action_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admin can read action_items"
  ON action_items FOR SELECT TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can insert action_items"
  ON action_items FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can update action_items"
  ON action_items FOR UPDATE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));
CREATE POLICY "Admin can delete action_items"
  ON action_items FOR DELETE TO authenticated
  USING (auth.uid() IN (SELECT user_id FROM admin_users));

-- ============================================================
-- RPC FUNCTIONS (public-safe data access)
-- ============================================================

-- Get payment info for a specific night (public can call this)
CREATE OR REPLACE FUNCTION get_tonight_payment_info(p_night_id UUID)
RETURNS TABLE(venmo_handle TEXT, zelle_identifier TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT a.venmo_handle, a.zelle_identifier
  FROM accounts a
  INNER JOIN nights n ON n.account_id = a.id
  WHERE n.id = p_night_id;
END;
$$;

-- Get aggregate donation totals for a campaign (public can call this)
CREATE OR REPLACE FUNCTION get_donation_totals(p_campaign_id UUID)
RETURNS TABLE(total_raised NUMERIC, night_id UUID, night_total NUMERIC)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Return overall total as the first row (night_id = NULL)
  RETURN QUERY
  SELECT
    (SELECT COALESCE(SUM(d.amount), 0)
     FROM donations d
     WHERE d.campaign_id = p_campaign_id AND d.is_confirmed = TRUE
    ) AS total_raised,
    NULL::UUID AS night_id,
    NULL::NUMERIC AS night_total;

  -- Return per-night totals (confirmed single-night donations + lump sum distributions)
  RETURN QUERY
  SELECT
    NULL::NUMERIC AS total_raised,
    n.id AS night_id,
    COALESCE(
      (SELECT SUM(d.amount) FROM donations d WHERE d.night_id = n.id AND d.is_confirmed = TRUE AND d.is_lump_sum = FALSE),
      0
    ) + COALESCE(
      (SELECT SUM(lsd.amount) FROM lump_sum_distributions lsd WHERE lsd.night_id = n.id),
      0
    ) AS night_total
  FROM nights n
  WHERE n.campaign_id = p_campaign_id;
END;
$$;

-- Grant execute to anon role
GRANT EXECUTE ON FUNCTION get_tonight_payment_info(UUID) TO anon;
GRANT EXECUTE ON FUNCTION get_donation_totals(UUID) TO anon;
