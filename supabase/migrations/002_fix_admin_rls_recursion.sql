-- Fix: infinite recursion in admin_users RLS policy
-- The old policy on admin_users queried admin_users to check access, causing a loop.
-- This creates a SECURITY DEFINER function that bypasses RLS for the check,
-- then updates ALL policies to use it.

-- Step 1: Create a helper function (bypasses RLS)
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM admin_users WHERE user_id = auth.uid()
  );
$$;

-- Step 2: Fix admin_users policy
DROP POLICY IF EXISTS "Only authenticated admins can read admin_users" ON admin_users;
CREATE POLICY "Only authenticated admins can read admin_users"
  ON admin_users FOR SELECT TO authenticated
  USING (is_admin());

-- Step 3: Fix campaigns policies
DROP POLICY IF EXISTS "Admin can insert campaigns" ON campaigns;
CREATE POLICY "Admin can insert campaigns"
  ON campaigns FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update campaigns" ON campaigns;
CREATE POLICY "Admin can update campaigns"
  ON campaigns FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete campaigns" ON campaigns;
CREATE POLICY "Admin can delete campaigns"
  ON campaigns FOR DELETE TO authenticated
  USING (is_admin());

-- Step 4: Fix accounts policies
DROP POLICY IF EXISTS "Admin can read accounts" ON accounts;
CREATE POLICY "Admin can read accounts"
  ON accounts FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can insert accounts" ON accounts;
CREATE POLICY "Admin can insert accounts"
  ON accounts FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update accounts" ON accounts;
CREATE POLICY "Admin can update accounts"
  ON accounts FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete accounts" ON accounts;
CREATE POLICY "Admin can delete accounts"
  ON accounts FOR DELETE TO authenticated
  USING (is_admin());

-- Step 5: Fix nights policies
DROP POLICY IF EXISTS "Admin can insert nights" ON nights;
CREATE POLICY "Admin can insert nights"
  ON nights FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update nights" ON nights;
CREATE POLICY "Admin can update nights"
  ON nights FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete nights" ON nights;
CREATE POLICY "Admin can delete nights"
  ON nights FOR DELETE TO authenticated
  USING (is_admin());

-- Step 6: Fix donations policies
DROP POLICY IF EXISTS "Admin can read donations" ON donations;
CREATE POLICY "Admin can read donations"
  ON donations FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can update donations" ON donations;
CREATE POLICY "Admin can update donations"
  ON donations FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete donations" ON donations;
CREATE POLICY "Admin can delete donations"
  ON donations FOR DELETE TO authenticated
  USING (is_admin());

-- Step 7: Fix lump_sum_distributions policies
DROP POLICY IF EXISTS "Admin can read lump_sum_distributions" ON lump_sum_distributions;
CREATE POLICY "Admin can read lump_sum_distributions"
  ON lump_sum_distributions FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can insert lump_sum_distributions" ON lump_sum_distributions;
CREATE POLICY "Admin can insert lump_sum_distributions"
  ON lump_sum_distributions FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update lump_sum_distributions" ON lump_sum_distributions;
CREATE POLICY "Admin can update lump_sum_distributions"
  ON lump_sum_distributions FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete lump_sum_distributions" ON lump_sum_distributions;
CREATE POLICY "Admin can delete lump_sum_distributions"
  ON lump_sum_distributions FOR DELETE TO authenticated
  USING (is_admin());

-- Step 8: Fix action_items policies
DROP POLICY IF EXISTS "Admin can read action_items" ON action_items;
CREATE POLICY "Admin can read action_items"
  ON action_items FOR SELECT TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can insert action_items" ON action_items;
CREATE POLICY "Admin can insert action_items"
  ON action_items FOR INSERT TO authenticated
  WITH CHECK (is_admin());

DROP POLICY IF EXISTS "Admin can update action_items" ON action_items;
CREATE POLICY "Admin can update action_items"
  ON action_items FOR UPDATE TO authenticated
  USING (is_admin());

DROP POLICY IF EXISTS "Admin can delete action_items" ON action_items;
CREATE POLICY "Admin can delete action_items"
  ON action_items FOR DELETE TO authenticated
  USING (is_admin());
