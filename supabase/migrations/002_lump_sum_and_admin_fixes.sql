-- ============================================================
-- Additional policies, columns, and triggers needed beyond the
-- initial schema (001).
-- ============================================================

-- Allow admins to insert donations (manual donation entry in ledger)
CREATE POLICY "Admin can insert donations"
  ON donations FOR INSERT TO authenticated
  WITH CHECK (is_admin());

-- Track which account collected a lump sum payment
-- (for manual entries where the collector may differ from tonight's account)
ALTER TABLE donations ADD COLUMN paying_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- Track which account a transfer action item is for (so marking done
-- can update the right distributions)
ALTER TABLE action_items ADD COLUMN to_account_id UUID REFERENCES accounts(id) ON DELETE SET NULL;

-- ============================================================
-- AUTO-DISTRIBUTE LUMP SUM DONATIONS
-- ============================================================
-- When a confirmed lump sum donation is inserted, this trigger:
--   1. Splits the amount evenly across remaining nights (today + future)
--   2. Creates lump_sum_distributions records crediting each account
--      (paying account's own distributions are pre-marked as transferred)
--   3. Creates aggregated action items for inter-account transfers
--   4. Backfills paying_account_id if not set (public donations)

CREATE OR REPLACE FUNCTION distribute_lump_sum()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_night RECORD;
  v_count INT;
  v_per_night_cents INT;
  v_last_night_cents INT;
  v_total_cents INT;
  v_idx INT := 0;
  v_paying_account_id UUID;
  v_paying_account_name TEXT;
  v_tonight_date DATE;
  v_campaign_id UUID;
  v_transfer RECORD;
BEGIN
  -- Only process confirmed lump sum donations
  IF NOT NEW.is_lump_sum OR NOT NEW.is_confirmed THEN
    RETURN NEW;
  END IF;

  v_campaign_id := NEW.campaign_id;
  v_tonight_date := CURRENT_DATE;
  v_total_cents := ROUND(NEW.amount * 100);

  -- Count remaining nights (today and future) with assigned accounts
  SELECT COUNT(*) INTO v_count
  FROM nights
  WHERE campaign_id = v_campaign_id
    AND date >= v_tonight_date
    AND account_id IS NOT NULL;

  IF v_count = 0 THEN
    RETURN NEW;
  END IF;

  v_per_night_cents := v_total_cents / v_count;
  v_last_night_cents := v_total_cents - (v_per_night_cents * (v_count - 1));

  -- Determine the paying account:
  --   Use explicit paying_account_id if set (manual entry),
  --   otherwise fall back to tonight's account (public donation)
  IF NEW.paying_account_id IS NOT NULL THEN
    SELECT id, person_name INTO v_paying_account_id, v_paying_account_name
    FROM accounts WHERE id = NEW.paying_account_id;
  ELSE
    SELECT n.account_id, a.person_name INTO v_paying_account_id, v_paying_account_name
    FROM nights n
    JOIN accounts a ON a.id = n.account_id
    WHERE n.campaign_id = v_campaign_id
      AND n.date = v_tonight_date
      AND n.account_id IS NOT NULL
    LIMIT 1;

    -- Backfill paying_account_id on the donation for future reference
    IF v_paying_account_id IS NOT NULL THEN
      UPDATE donations SET paying_account_id = v_paying_account_id WHERE id = NEW.id;
    END IF;
  END IF;

  -- Create per-night distribution records
  -- Paying account's own nights are pre-marked as transferred (they already hold the money)
  FOR v_night IN
    SELECT id AS night_id, night_number, account_id
    FROM nights
    WHERE campaign_id = v_campaign_id
      AND date >= v_tonight_date
      AND account_id IS NOT NULL
    ORDER BY night_number
  LOOP
    v_idx := v_idx + 1;

    INSERT INTO lump_sum_distributions (donation_id, night_id, amount, account_id, is_transferred)
    VALUES (
      NEW.id,
      v_night.night_id,
      CASE WHEN v_idx = v_count THEN v_last_night_cents ELSE v_per_night_cents END / 100.0,
      v_night.account_id,
      v_night.account_id = v_paying_account_id  -- true for paying account's own nights
    );
  END LOOP;

  -- Create one aggregated action item per receiving account
  -- (only for accounts that differ from the paying account)
  IF v_paying_account_id IS NOT NULL THEN
    FOR v_transfer IN
      SELECT
        d.account_id,
        a.person_name AS to_name,
        TO_CHAR(SUM(d.amount), 'FM999990.00') AS total_amount,
        STRING_AGG(n.night_number::TEXT, ', ' ORDER BY n.night_number) AS night_numbers
      FROM lump_sum_distributions d
      JOIN nights n ON n.id = d.night_id
      JOIN accounts a ON a.id = d.account_id
      WHERE d.donation_id = NEW.id
        AND d.account_id != v_paying_account_id
      GROUP BY d.account_id, a.person_name
    LOOP
      INSERT INTO action_items (campaign_id, description, related_donation_id, to_account_id)
      VALUES (
        v_campaign_id,
        'Transfer $' || v_transfer.total_amount
          || ' from ' || COALESCE(v_paying_account_name, 'unknown')
          || ' to ' || COALESCE(v_transfer.to_name, 'unknown')
          || ' (Nights ' || v_transfer.night_numbers || ')'
          || ' — Whole month donation from ' || NEW.donor_first_name || ' ' || NEW.donor_last_initial || '.',
        NEW.id,
        v_transfer.account_id
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_distribute_lump_sum ON donations;
CREATE TRIGGER trg_distribute_lump_sum
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION distribute_lump_sum();
