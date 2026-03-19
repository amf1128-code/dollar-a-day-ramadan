import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import { normalizeVenmoHandle } from '../lib/validation';
import AdminLayout from '../components/AdminLayout';

export default function AdminAccounts() {
  const [campaign, setCampaign] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [nights, setNights] = useState([]);
  const [donations, setDonations] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [form, setForm] = useState({ person_name: '', venmo_handle: '', zelle_identifier: '' });
  const [editingId, setEditingId] = useState(null);
  const [message, setMessage] = useState(null);

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

    const [acctRes, nightRes, donRes, distRes] = await Promise.all([
      supabase.from('accounts').select('*').eq('campaign_id', camp.id).order('person_name'),
      supabase.from('nights').select('*').eq('campaign_id', camp.id).order('night_number'),
      supabase.from('donations').select('*').eq('campaign_id', camp.id),
      supabase.from('lump_sum_distributions').select('*'),
    ]);

    setAccounts(acctRes.data || []);
    setNights(nightRes.data || []);
    setDonations(donRes.data || []);
    setDistributions(distRes.data || []);
  }

  function getAccountNights(accountId) {
    return nights.filter((n) => n.account_id === accountId).map((n) => n.night_number).sort((a, b) => a - b);
  }

  function getAccountTally(accountId) {
    const accountNightIds = nights.filter((n) => n.account_id === accountId).map((n) => n.id);
    const today = new Date().toISOString().split('T')[0];
    const pastNightIds = nights.filter((n) => n.account_id === accountId && n.date <= today).map((n) => n.id);

    // Money IN: regular donations to my nights + full lump sums I collected
    const directReceived = donations
      .filter((d) => d.is_confirmed && !d.is_lump_sum && accountNightIds.includes(d.night_id))
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const lumpSumsCollected = donations
      .filter((d) => d.is_confirmed && d.is_lump_sum && d.paying_account_id === accountId)
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const totalReceived = directReceived + lumpSumsCollected;

    // Money I owe to other accounts (lump sum portions for others' nights)
    const oweToOthers = distributions
      .filter((d) => {
        const donation = donations.find((don) => don.id === d.donation_id);
        return donation && donation.paying_account_id === accountId && d.account_id !== accountId;
      })
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);

    // Of that, how much has been transferred
    const transferred = distributions
      .filter((d) => {
        const donation = donations.find((don) => don.id === d.donation_id);
        return donation && donation.paying_account_id === accountId && d.account_id !== accountId && d.is_transferred;
      })
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);

    // My share = what I should donate to charities across my nights
    const myShare = totalReceived - oweToOthers;

    // Plus: money others owe ME (lump sums collected by others with distributions to my nights)
    const owedToMe = distributions
      .filter((d) => {
        const donation = donations.find((don) => don.id === d.donation_id);
        return donation && donation.paying_account_id !== accountId && d.account_id === accountId;
      })
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);
    const receivedFromOthers = distributions
      .filter((d) => {
        const donation = donations.find((don) => don.id === d.donation_id);
        return donation && donation.paying_account_id !== accountId && d.account_id === accountId && d.is_transferred;
      })
      .reduce((sum, d) => sum + parseFloat(d.amount), 0);

    // Total I should donate to charity = my share from what I collected + what others transfer to me
    const totalToDonate = myShare + owedToMe;

    // How much of totalToDonate is for past nights (due now)
    const dueSoFar = donations
      .filter((d) => d.is_confirmed && !d.is_lump_sum && pastNightIds.includes(d.night_id))
      .reduce((sum, d) => sum + parseFloat(d.amount), 0)
      + distributions
        .filter((d) => pastNightIds.includes(d.night_id) && d.account_id === accountId)
        .reduce((sum, d) => sum + parseFloat(d.amount), 0);

    return {
      totalReceived,
      oweToOthers,
      transferred,
      pendingOut: oweToOthers - transferred,
      myShare,
      owedToMe,
      receivedFromOthers,
      pendingIn: owedToMe - receivedFromOthers,
      totalToDonate,
      dueSoFar,
    };
  }

  async function handleSave() {
    if (!campaign) {
      setMessage('No active campaign found. Please create one in the Setup tab first.');
      return;
    }
    if (!form.person_name.trim()) {
      setMessage('Person name is required.');
      return;
    }

    const payload = {
      campaign_id: campaign.id,
      person_name: form.person_name.trim(),
      venmo_handle: normalizeVenmoHandle(form.venmo_handle) || null,
      zelle_identifier: form.zelle_identifier.trim() || null,
    };

    let error;
    if (editingId) {
      ({ error } = await supabase.from('accounts').update(payload).eq('id', editingId));
    } else {
      ({ error } = await supabase.from('accounts').insert(payload));
    }

    if (error) {
      logger.error('accounts', 'Failed to save account', { code: error.code, message: error.message });
      setMessage(`Error: ${error.message}`);
      return;
    }

    logger.info('accounts', 'Account saved', { personName: form.person_name });
    setForm({ person_name: '', venmo_handle: '', zelle_identifier: '' });
    setEditingId(null);
    setMessage(null);
    loadData();
  }

  function handleEdit(account) {
    setForm({
      person_name: account.person_name,
      venmo_handle: account.venmo_handle || '',
      zelle_identifier: account.zelle_identifier || '',
    });
    setEditingId(account.id);
  }

  async function handleDelete(accountId) {
    if (!window.confirm('Delete this account? This cannot be undone.')) return;
    const { error } = await supabase.from('accounts').delete().eq('id', accountId);
    if (error) {
      setMessage(`Error: ${error.message}`);
      return;
    }
    loadData();
  }

  return (
    <AdminLayout>
      <h1 className="font-serif text-2xl mb-6">Accounts</h1>

      {/* Add/Edit form */}
      <div className="p-4 border border-warm-gray-light bg-white/40 mb-6">
        <h2 className="font-serif text-lg mb-4">{editingId ? 'Edit Account' : 'Add Account'}</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Person Name</label>
            <input
              type="text"
              value={form.person_name}
              onChange={(e) => setForm({ ...form, person_name: e.target.value })}
              className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
              placeholder="Ali"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Venmo Handle</label>
            <input
              type="text"
              value={form.venmo_handle}
              onChange={(e) => setForm({ ...form, venmo_handle: e.target.value })}
              className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
              placeholder="@ali-k"
            />
          </div>
          <div>
            <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Zelle (Phone/Email)</label>
            <input
              type="text"
              value={form.zelle_identifier}
              onChange={(e) => setForm({ ...form, zelle_identifier: e.target.value })}
              className="w-full border-b border-warm-gray-light bg-transparent py-2 text-sm focus:outline-none focus:border-maroon"
              placeholder="555-123-4567"
            />
          </div>
        </div>
        {message && <p className="text-sm text-maroon mb-3">{message}</p>}
        <div className="flex gap-3">
          <button
            onClick={handleSave}
            className="bg-maroon text-cream px-6 py-2 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
          >
            {editingId ? 'Update' : 'Add Account'}
          </button>
          {editingId && (
            <button
              onClick={() => { setEditingId(null); setForm({ person_name: '', venmo_handle: '', zelle_identifier: '' }); }}
              className="border border-warm-gray-light px-6 py-2 text-sm tracking-widest uppercase text-warm-gray-dark hover:border-maroon hover:text-maroon transition-colors cursor-pointer"
            >
              Cancel
            </button>
          )}
        </div>
      </div>

      {/* Account cards */}
      <div className="space-y-4">
        {accounts.map((account) => {
          const assignedNights = getAccountNights(account.id);
          const tally = getAccountTally(account.id);
          return (
            <div key={account.id} className="p-4 border border-warm-gray-light bg-white/40">
              <div className="flex items-start justify-between mb-3">
                <div>
                  <h3 className="font-serif text-lg">{account.person_name}</h3>
                  {account.venmo_handle && (
                    <p className="text-sm text-warm-gray">Venmo: {account.venmo_handle}</p>
                  )}
                  {account.zelle_identifier && (
                    <p className="text-sm text-warm-gray">Zelle: {account.zelle_identifier}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="font-serif text-xl text-maroon">${tally.totalToDonate.toFixed(2)}</p>
                  <p className="text-xs text-warm-gray">total to donate</p>
                </div>
              </div>

              {assignedNights.length > 0 && (
                <p className="text-xs text-warm-gray-dark mb-2">
                  Assigned nights: {assignedNights.join(', ')}
                </p>
              )}

              {/* Running tally */}
              <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-1 text-xs border-t border-warm-gray-light/50 pt-3">
                <div className="flex justify-between">
                  <span className="text-warm-gray">Received:</span>
                  <span className="font-serif">${tally.totalReceived.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-warm-gray">Due so far (past nights):</span>
                  <span className="font-serif">${tally.dueSoFar.toFixed(2)}</span>
                </div>
                {tally.oweToOthers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Owe to others:</span>
                    <span className="font-serif text-maroon">-${tally.oweToOthers.toFixed(2)}</span>
                  </div>
                )}
                {tally.oweToOthers > 0 && (
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Transferred out:</span>
                    <span className="font-serif">${tally.transferred.toFixed(2)}{tally.pendingOut > 0 ? ` (${tally.pendingOut.toFixed(2)} pending)` : ''}</span>
                  </div>
                )}
                {tally.owedToMe > 0 && (
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Owed to me:</span>
                    <span className="font-serif">+${tally.owedToMe.toFixed(2)}</span>
                  </div>
                )}
                {tally.owedToMe > 0 && (
                  <div className="flex justify-between">
                    <span className="text-warm-gray">Received from others:</span>
                    <span className="font-serif">${tally.receivedFromOthers.toFixed(2)}{tally.pendingIn > 0 ? ` (${tally.pendingIn.toFixed(2)} pending)` : ''}</span>
                  </div>
                )}
                <div className="flex justify-between col-span-2 border-t border-warm-gray-light/50 pt-1 mt-1">
                  <span className="text-warm-gray font-bold">Your share to donate:</span>
                  <span className="font-serif font-bold">${tally.myShare.toFixed(2)}</span>
                </div>
              </div>

              <div className="flex gap-3 mt-3">
                <button
                  onClick={() => handleEdit(account)}
                  className="text-xs tracking-widest uppercase text-maroon border-b border-maroon/30 hover:border-maroon transition-colors cursor-pointer"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleDelete(account.id)}
                  className="text-xs tracking-widest uppercase text-warm-gray hover:text-maroon transition-colors cursor-pointer"
                >
                  Delete
                </button>
              </div>
            </div>
          );
        })}

        {accounts.length === 0 && (
          <p className="text-warm-gray italic font-serif text-center py-8">
            No accounts yet. Add one above to get started.
          </p>
        )}
      </div>
    </AdminLayout>
  );
}
