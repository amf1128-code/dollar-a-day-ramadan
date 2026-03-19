# Dollar-A-Day Ramadan

A mobile-first web app for managing a community Ramadan donation campaign. Every night of Ramadan, a different charity is featured. Donors donate via Venmo or Zelle.

## Tech Stack

- **Frontend:** React (Vite) + Tailwind CSS
- **Backend/Database:** Supabase (Postgres + Row Level Security)
- **Hosting:** Netlify

## Setup Instructions

### 1. Create a Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note your **Project URL** and **anon public key** (found in Settings > API)

### 2. Run the Database Migration

1. In your Supabase dashboard, go to **SQL Editor**
2. Copy the contents of `supabase/migrations/001_initial_schema.sql`
3. Paste and run it. This creates all tables, RLS policies, and helper functions

### 3. Create an Admin User

1. In Supabase dashboard, go to **Authentication > Users > Add User**
2. Create a user with an email and password (this will be your admin login)
3. Copy the user's UUID from the user list
4. Go to **SQL Editor** and run:
   ```sql
   INSERT INTO admin_users (user_id) VALUES ('YOUR-USER-UUID-HERE');
   ```

### 4. Deploy to Netlify

1. Push this repo to GitHub (or connect it if it's already there)
2. In Netlify, click **New site from Git** and select your repo
3. Build settings are already configured — you don't need to change anything there
4. **Add your environment variables** in Netlify: go to **Site settings > Environment variables** and add these two:
   - `VITE_SUPABASE_URL` — set this to your Supabase project URL (e.g. `https://abcdef.supabase.co`)
   - `VITE_SUPABASE_ANON_KEY` — set this to the anon/public key from your Supabase project
   - You can find both of these in your Supabase dashboard under **Settings > API**
5. Click **Deploy** (or trigger a redeploy if it already deployed without the variables)

### 5. Run Locally (Optional — only if you want to test on your own computer)

This step is not required for deployment. Skip it if you just want to get the site live.

1. Install [Node.js](https://nodejs.org/) if you don't have it
2. In a terminal, navigate to the project folder and run:
   ```bash
   cp .env.example .env
   ```
3. Open the `.env` file in a text editor and fill in your Supabase URL and anon key
4. Run:
   ```bash
   npm install
   npm run dev
   ```
5. Open http://localhost:5173 in your browser

## How to Use

### First-Time Campaign Setup

1. Go to `/admin` and log in with your admin email/password
2. Go to **Accounts** and add the people collecting donations (with their Venmo handles and/or Zelle info)
3. Go to **Setup** and either:
   - Fill in the nights manually (charity name, date, account for each night)
   - Upload a CSV/XLSX spreadsheet (click "Download Example CSV" for the format)
4. Click **Save All**

### During Ramadan

- Donors visit the home page (`/`), see tonight's charity, and donate
- Admin checks **Ledger** to see all donations
- Admin checks **Action Items** for any lump sum transfers that need to happen between accounts

## Running Tests

```bash
npx vitest run
```

This runs the 8 lump sum distribution test scenarios. All must pass.

## Loading Test Data

To test with sample data:

1. Run the migration first (step 2 above)
2. In the SQL Editor, run the contents of `supabase/seed/test_scenario.sql`
3. This creates a test campaign with 30 nights, 2 accounts, and 3 sample donations

Delete this test data before going live by running:
```sql
DELETE FROM campaigns WHERE id = 'a0000000-0000-0000-0000-000000000001';
```
(This cascades to delete all related nights, donations, etc.)

## Campaign Isolation Test (Manual)

To verify that multiple campaigns don't bleed into each other:

1. Load the test seed data (creates "Ramadan Test 2026", active)
2. Visit the home page and note the totals
3. In SQL Editor, create a second campaign:
   ```sql
   INSERT INTO campaigns (year, name, is_active) VALUES (2025, 'Ramadan 2025', false);
   ```
4. Add a donation to the old campaign and verify the home page totals don't change
5. Only the active campaign's data should appear on the public page and admin pages

## Security Notes

- **RLS is enabled on every table.** The Supabase anon key (which is public) cannot read individual donor records, account details, or action items.
- **Accounts are not publicly queryable.** Payment info for tonight's charity is fetched via a secure RPC function that returns only one account's Venmo/Zelle info.
- **Donation totals are aggregated server-side.** The public can only see totals, never individual donation records.
- **Admin authentication** uses Supabase Auth. All admin pages check for a valid session before rendering.
- **PII consideration:** Donor names and payment handles are stored in Supabase. If your campaign is sensitive, review Supabase's data region settings and limit dashboard access.
- **Rate limiting:** In Supabase dashboard, go to Settings > API > Rate Limiting and set reasonable limits (e.g. 100 requests/minute for anon).

## Design Decisions

- **No emojis anywhere in the UI.** The design is editorial and restrained with a maroon/cream color palette.
- **Payment note censorship:** Venmo flags certain geopolitical terms and may freeze accounts. All payment notes automatically censor these terms.
- **Lump sum rounding:** When a lump sum doesn't divide evenly, pennies are added to the last night's allocation so the total is always exact.
- **Admin auth uses Supabase Auth** (email/password) rather than a shared password, for better security and audit trail.
