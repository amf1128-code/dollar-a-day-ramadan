import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import AdminLayout from '../components/AdminLayout';

export default function AdminActions() {
  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
  const [nights, setNights] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [donations, setDonations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [showAll, setShowAll] = useState(false);
  const [newDescription, setNewDescription] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: camps } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (!camps || camps.length === 0) return;
    const camp = camps[0];
    setCampaign(camp);

    const [itemRes, nightRes, acctRes, donRes, distRes] = await Promise.all([
      supabase.from('action_items').select('*').eq('campaign_id', camp.id).order('created_at', { ascending: false }),
      supabase.from('nights').select('*').eq('campaign_id', camp.id).order('night_number'),
      supabase.from('accounts').select('*').eq('campaign_id', camp.id),
      supabase.from('donations').select('*').eq('campaign_id', camp.id).eq('is_confirmed', true),
      supabase.from('lump_sum_distributions').select('*'),
    ]);

    setItems(itemRes.data || []);
    setNights(nightRes.data || []);
    setAccounts(acctRes.data || []);
    setDonations(donRes.data || []);
    setDistributions(distRes.data || []);
  }

  async function toggleComplete(item) {
    const newCompleted = !item.is_completed;

    // Update the action item
    const { error } = await supabase
      .from('action_items')
      .update({ is_completed: newCompleted })
      .eq('id', item.id);

    if (error) {
      logger.error('actions', 'Failed to toggle action item', { code: error.code, message: error.message });
      return;
    }

    // If this is a transfer action item, update related distributions
    if (item.related_donation_id && item.to_account_id) {
      const { error: distError } = await supabase
        .from('lump_sum_distributions')
        .update({ is_transferred: newCompleted })
        .eq('donation_id', item.related_donation_id)
        .eq('account_id', item.to_account_id);

      if (distError) {
        logger.error('actions', 'Failed to update distributions', { code: distError.code, message: distError.message });
      }
    }

    logger.info('actions', 'Action item toggled', { id: item.id, completed: newCompleted });
    loadData();
  }

  async function addItem() {
    if (!campaign || !newDescription.trim()) return;

    const { error } = await supabase
      .from('action_items')
      .insert({
        campaign_id: campaign.id,
        description: newDescription.trim(),
      });

    if (error) {
      logger.error('actions', 'Failed to add action item', { code: error.code, message: error.message });
      return;
    }

    setNewDescription('');
    loadData();
  }

  // Compute nightly "donate to charity" items for past/current nights
  const today = new Date().toISOString().split('T')[0];
  const donateItems = nights
    .filter((n) => n.date <= today)
    .map((n) => {
      const acct = accounts.find((a) => a.id === n.account_id);
      const directTotal = donations
        .filter((d) => d.night_id === n.id && !d.is_lump_sum)
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const distTotal = distributions
        .filter((d) => d.night_id === n.id && d.is_transferred)
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);
      const total = directTotal + distTotal;
      if (total <= 0) return null;
      return {
        id: `donate-${n.id}`,
        nightNumber: n.night_number,
        charityName: n.charity_name,
        charityUrl: n.charity_url,
        accountName: acct?.person_name || 'unknown',
        total,
      };
    })
    .filter(Boolean);

  const displayed = showAll ? items : items.filter((i) => !i.is_completed);

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl">Action Items</h1>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={showAll}
            onChange={(e) => setShowAll(e.target.checked)}
            className="accent-maroon"
          />
          Show completed
        </label>
      </div>

      {/* Nightly donation reminders */}
      {donateItems.length > 0 && (
        <div className="mb-6">
          <h2 className="text-xs tracking-widest uppercase text-warm-gray mb-3">Nightly Donations</h2>
          <div className="space-y-2">
            {donateItems.map((item) => (
              <div key={item.id} className="p-4 border border-gold bg-gold/10">
                <p className="text-sm">
                  <span className="font-serif font-bold">Night {item.nightNumber}:</span>{' '}
                  {item.accountName} — donate <span className="font-serif text-maroon">${item.total.toFixed(2)}</span> to {item.charityName}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Add new */}
      <div className="flex gap-3 mb-6">
        <input
          type="text"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          placeholder="New action item..."
          className="flex-1 border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
          onKeyDown={(e) => e.key === 'Enter' && addItem()}
        />
        <button
          onClick={addItem}
          className="bg-maroon text-cream px-4 py-2 text-xs tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
        >
          Add
        </button>
      </div>

      {/* Items list */}
      <div className="space-y-3">
        {displayed.map((item) => (
          <div
            key={item.id}
            className={`p-4 border transition-colors ${
              item.is_completed
                ? 'border-warm-gray-light/50 bg-cream-dark opacity-60'
                : 'border-warm-gray-light bg-white/40'
            }`}
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${item.is_completed ? 'line-through text-warm-gray' : ''}`}>
                  {item.description}
                </p>
                <p className="text-xs text-warm-gray mt-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
              <button
                onClick={() => toggleComplete(item)}
                className={`shrink-0 px-4 py-2 text-xs tracking-widest uppercase transition-colors cursor-pointer ${
                  item.is_completed
                    ? 'border border-warm-gray-light text-warm-gray hover:text-maroon hover:border-maroon'
                    : 'bg-maroon text-cream hover:bg-maroon-dark'
                }`}
              >
                {item.is_completed ? 'Undo' : 'Mark Done'}
              </button>
            </div>
          </div>
        ))}

        {displayed.length === 0 && (
          <p className="text-warm-gray italic font-serif text-center py-8">
            {showAll ? 'No action items yet.' : 'All caught up. No pending action items.'}
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
