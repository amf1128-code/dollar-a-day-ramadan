-- Allow admins to insert donations (for manual donation entry in the ledger)
CREATE POLICY "Admin can insert donations"
  ON donations FOR INSERT TO authenticated
  WITH CHECK (is_admin());
