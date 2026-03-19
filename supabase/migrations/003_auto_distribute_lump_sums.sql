-- Auto-distribute lump sum donations across remaining nights on insert.
-- Uses SECURITY DEFINER so it can write to lump_sum_distributions and
-- action_items even when the inserting role is anon.

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
  v_night_account_name TEXT;
  v_amount_str TEXT;
  v_tonight_date DATE;
  v_campaign_id UUID;
BEGIN
  -- Only process confirmed lump sum donations
  IF NOT NEW.is_lump_sum OR NOT NEW.is_confirmed THEN
    RETURN NEW;
  END IF;

  v_campaign_id := NEW.campaign_id;
  v_tonight_date := CURRENT_DATE;
  v_total_cents := ROUND(NEW.amount * 100);

  -- Count remaining nights (today and future)
  SELECT COUNT(*) INTO v_count
  FROM nights
  WHERE campaign_id = v_campaign_id
    AND date >= v_tonight_date
    AND account_id IS NOT NULL;

  -- If no remaining nights, skip distribution
  IF v_count = 0 THEN
    RETURN NEW;
  END IF;

  v_per_night_cents := v_total_cents / v_count;
  v_last_night_cents := v_total_cents - (v_per_night_cents * (v_count - 1));

  -- Find the paying account (tonight's account)
  SELECT n.account_id, a.person_name INTO v_paying_account_id, v_paying_account_name
  FROM nights n
  JOIN accounts a ON a.id = n.account_id
  WHERE n.campaign_id = v_campaign_id
    AND n.date = v_tonight_date
    AND n.account_id IS NOT NULL
  LIMIT 1;

  -- Create distributions for each remaining night
  FOR v_night IN
    SELECT id AS night_id, night_number, account_id
    FROM nights
    WHERE campaign_id = v_campaign_id
      AND date >= v_tonight_date
      AND account_id IS NOT NULL
    ORDER BY night_number
  LOOP
    v_idx := v_idx + 1;

    INSERT INTO lump_sum_distributions (donation_id, night_id, amount, account_id)
    VALUES (
      NEW.id,
      v_night.night_id,
      CASE WHEN v_idx = v_count THEN v_last_night_cents ELSE v_per_night_cents END / 100.0,
      v_night.account_id
    );

    -- Create action item for transfers to other accounts
    IF v_paying_account_id IS NOT NULL AND v_night.account_id != v_paying_account_id THEN
      SELECT person_name INTO v_night_account_name FROM accounts WHERE id = v_night.account_id;
      v_amount_str := TO_CHAR(
        CASE WHEN v_idx = v_count THEN v_last_night_cents ELSE v_per_night_cents END / 100.0,
        'FM999990.00'
      );
      INSERT INTO action_items (campaign_id, description, related_donation_id)
      VALUES (
        v_campaign_id,
        'Transfer $' || v_amount_str
          || ' from ' || COALESCE(v_paying_account_name, 'unknown')
          || ' to ' || COALESCE(v_night_account_name, 'unknown')
          || ' for Night ' || v_night.night_number
          || ' — Whole month donation from ' || NEW.donor_first_name || ' ' || NEW.donor_last_initial || '.',
        NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- Trigger on donation insert
DROP TRIGGER IF EXISTS trg_distribute_lump_sum ON donations;
CREATE TRIGGER trg_distribute_lump_sum
  AFTER INSERT ON donations
  FOR EACH ROW
  EXECUTE FUNCTION distribute_lump_sum();
