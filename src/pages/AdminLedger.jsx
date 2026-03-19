import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import AdminLayout from '../components/AdminLayout';

export default function AdminLedger() {
  const [campaign, setCampaign] = useState(null);
  const [donations, setDonations] = useState([]);
  const [nights, setNights] = useState([]);
  const [distributions, setDistributions] = useState([]);
  const [accounts, setAccounts] = useState([]);
  const [filter, setFilter] = useState('all');
  const [expandedId, setExpandedId] = useState(null);
  const [showManualForm, setShowManualForm] = useState(false);
  const [manualForm, setManualForm] = useState({
    night_id: '',
    donor_first_name: '',
    donor_last_initial: '',
    amount: '',
    payment_method: 'venmo',
    is_lump_sum: false,
    is_confirmed: true,
    donor_venmo_handle: '',
    donor_zelle_identifier: '',
  });

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

    const [donRes, nightRes, distRes, acctRes] = await Promise.all([
      supabase.from('donations').select('*').eq('campaign_id', camp.id).order('created_at', { ascending: false }),
      supabase.from('nights').select('*').eq('campaign_id', camp.id).order('night_number'),
      supabase.from('lump_sum_distributions').select('*'),
      supabase.from('accounts').select('*').eq('campaign_id', camp.id),
    ]);

    setDonations(donRes.data || []);
    setNights(nightRes.data || []);
    setDistributions(distRes.data || []);
    setAccounts(acctRes.data || []);
  }

  function getNightInfo(nightId) {
    return nights.find((n) => n.id === nightId);
  }

  function getAccountName(accountId) {
    return accounts.find((a) => a.id === accountId)?.person_name || 'Unknown';
  }

  const filteredDonations = donations.filter((d) => {
    if (filter === 'all') return true;
    const nightInfo = getNightInfo(d.night_id);
    if (filter.startsWith('night-')) {
      return nightInfo?.night_number === parseInt(filter.split('-')[1]);
    }
    return true;
  });

  // Sort: regular first, lump sum at bottom
  const regular = filteredDonations.filter((d) => !d.is_lump_sum);
  const lumpSums = filteredDonations.filter((d) => d.is_lump_sum);
  const sortedDonations = [...regular, ...lumpSums];

  const total = filteredDonations
    .filter((d) => d.is_confirmed)
    .reduce((sum, d) => sum + parseFloat(d.amount), 0);

  function exportCSV() {
    const headers = ['Donor', 'Amount', 'Method', 'Handle', 'Night', 'Charity', 'Lump Sum', 'Confirmed', 'Date'];
    const rows = sortedDonations.map((d) => {
      const night = getNightInfo(d.night_id);
      return [
        `${d.donor_first_name} ${d.donor_last_initial}`,
        d.amount,
        d.payment_method,
        d.donor_venmo_handle || d.donor_zelle_identifier || '',
        night?.night_number || 'N/A',
        night?.charity_name || 'Lump Sum',
        d.is_lump_sum ? 'Yes' : 'No',
        d.is_confirmed ? 'Yes' : 'No',
        new Date(d.created_at).toLocaleDateString(),
      ];
    });

    const csv = [headers, ...rows].map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'donations.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleManualSubmit() {
    if (!campaign) return;

    const payload = {
      campaign_id: campaign.id,
      night_id: manualForm.night_id || null,
      donor_first_name: manualForm.donor_first_name.trim(),
      donor_last_initial: manualForm.donor_last_initial.trim(),
      amount: parseFloat(manualForm.amount),
      payment_method: manualForm.payment_method,
      is_lump_sum: manualForm.is_lump_sum,
      is_confirmed: manualForm.is_confirmed,
      donor_venmo_handle: manualForm.donor_venmo_handle || null,
      donor_zelle_identifier: manualForm.donor_zelle_identifier || null,
    };

    const { error } = await supabase.from('donations').insert(payload);
    if (error) {
      logger.error('ledger', 'Manual donation insert failed', { code: error.code, message: error.message });
      alert(`Error: ${error.message}`);
      return;
    }

    logger.info('ledger', 'Manual donation added', { amount: payload.amount });
    setShowManualForm(false);
    setManualForm({
      night_id: '',
      donor_first_name: '',
      donor_last_initial: '',
      amount: '',
      payment_method: 'venmo',
      is_lump_sum: false,
      is_confirmed: true,
      donor_venmo_handle: '',
      donor_zelle_identifier: '',
    });
    loadData();
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-6">
        <h1 className="font-serif text-2xl">Ledger</h1>
        <div className="flex gap-3">
          <button
            onClick={() => setShowManualForm(!showManualForm)}
            className="bg-maroon text-cream px-4 py-2 text-xs tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer"
          >
            Add Manual Donation
          </button>
          <button
            onClick={exportCSV}
            className="border border-warm-gray-light px-4 py-2 text-xs tracking-widest uppercase text-warm-gray-dark hover:border-maroon hover:text-maroon transition-colors cursor-pointer"
          >
            Download CSV
          </button>
        </div>
      </div>

      {/* Manual form */}
      {showManualForm && (
        <div className="p-4 border border-warm-gray-light bg-white/40 mb-6">
          <h2 className="font-serif text-lg mb-4">Manual Donation Entry</h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">First Name</label>
              <input type="text" value={manualForm.donor_first_name} onChange={(e) => setManualForm({ ...manualForm, donor_first_name: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon" />
            </div>
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Last Initial</label>
              <input type="text" maxLength={1} value={manualForm.donor_last_initial} onChange={(e) => setManualForm({ ...manualForm, donor_last_initial: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon" />
            </div>
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Amount</label>
              <input type="number" step="0.01" value={manualForm.amount} onChange={(e) => setManualForm({ ...manualForm, amount: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon" />
            </div>
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Night</label>
              <select value={manualForm.night_id} onChange={(e) => setManualForm({ ...manualForm, night_id: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon">
                <option value="">N/A (Lump Sum)</option>
                {nights.map((n) => (
                  <option key={n.id} value={n.id}>Night {n.night_number} - {n.charity_name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Method</label>
              <select value={manualForm.payment_method} onChange={(e) => setManualForm({ ...manualForm, payment_method: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon">
                <option value="venmo">Venmo</option>
                <option value="zelle">Zelle</option>
              </select>
            </div>
            <div>
              <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Venmo Handle</label>
              <input type="text" value={manualForm.donor_venmo_handle} onChange={(e) => setManualForm({ ...manualForm, donor_venmo_handle: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon" />
            </div>
            <div className="flex items-center gap-4 pt-5">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={manualForm.is_lump_sum} onChange={(e) => setManualForm({ ...manualForm, is_lump_sum: e.target.checked })} className="accent-maroon" />
                Lump Sum
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={manualForm.is_confirmed} onChange={(e) => setManualForm({ ...manualForm, is_confirmed: e.target.checked })} className="accent-maroon" />
                Confirmed
              </label>
            </div>
          </div>
          <button onClick={handleManualSubmit} className="bg-maroon text-cream px-6 py-2 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer">
            Save Donation
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <label className="text-xs tracking-widest uppercase text-warm-gray">Filter:</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon"
        >
          <option value="all">All Nights</option>
          {nights.map((n) => (
            <option key={n.id} value={`night-${n.night_number}`}>Night {n.night_number} - {n.charity_name}</option>
          ))}
        </select>
        <span className="ml-auto font-serif text-lg text-maroon">${total.toFixed(2)} total</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-gray-light text-xs tracking-widest uppercase text-warm-gray">
              <th className="py-2 px-2 text-left">Donor</th>
              <th className="py-2 px-2 text-right">Amount</th>
              <th className="py-2 px-2 text-left">Method</th>
              <th className="py-2 px-2 text-left">Handle</th>
              <th className="py-2 px-2 text-center">Night</th>
              <th className="py-2 px-2 text-left">Charity</th>
              <th className="py-2 px-2 text-center">Lump</th>
              <th className="py-2 px-2 text-center">Confirmed</th>
              <th className="py-2 px-2 text-left">Date</th>
            </tr>
          </thead>
          <tbody>
            {regular.map((d) => {
              const night = getNightInfo(d.night_id);
              return (
                <tr key={d.id} className="border-b border-warm-gray-light/50">
                  <td className="py-2 px-2">{d.donor_first_name} {d.donor_last_initial}.</td>
                  <td className="py-2 px-2 text-right font-serif">${parseFloat(d.amount).toFixed(2)}</td>
                  <td className="py-2 px-2 capitalize">{d.payment_method}</td>
                  <td className="py-2 px-2 text-warm-gray">{d.donor_venmo_handle || d.donor_zelle_identifier || '-'}</td>
                  <td className="py-2 px-2 text-center">{night?.night_number || '-'}</td>
                  <td className="py-2 px-2">{night?.charity_name || '-'}</td>
                  <td className="py-2 px-2 text-center">-</td>
                  <td className="py-2 px-2 text-center">{d.is_confirmed ? 'Yes' : 'No'}</td>
                  <td className="py-2 px-2 text-warm-gray">{new Date(d.created_at).toLocaleDateString()}</td>
                </tr>
              );
            })}

            {lumpSums.length > 0 && regular.length > 0 && (
              <tr>
                <td colSpan={9} className="py-3">
                  <div className="border-t-2 border-warm-gray-light"></div>
                  <p className="text-xs tracking-widest uppercase text-warm-gray mt-2">Lump Sum Donations</p>
                </td>
              </tr>
            )}

            {lumpSums.map((d) => {
              const night = getNightInfo(d.night_id);
              const dists = distributions.filter((dist) => dist.donation_id === d.id);
              const isExpanded = expandedId === d.id;

              return (
                <tr key={d.id} className="border-b border-warm-gray-light/50">
                  <td colSpan={9} className="py-0">
                    <div
                      className="flex items-center py-2 cursor-pointer"
                      onClick={() => setExpandedId(isExpanded ? null : d.id)}
                    >
                      <span className="px-2 flex-none w-32">{d.donor_first_name} {d.donor_last_initial}.</span>
                      <span className="px-2 flex-none w-20 text-right font-serif">${parseFloat(d.amount).toFixed(2)}</span>
                      <span className="px-2 flex-none w-16 capitalize">{d.payment_method}</span>
                      <span className="px-2 flex-none w-24 text-warm-gray">{d.donor_venmo_handle || d.donor_zelle_identifier || '-'}</span>
                      <span className="px-2 flex-none w-12 text-center">{night?.night_number || '-'}</span>
                      <span className="px-2 flex-1">{night?.charity_name || 'Lump Sum'}</span>
                      <span className="px-2 flex-none w-12 text-center">Yes</span>
                      <span className="px-2 flex-none w-16 text-center">{d.is_confirmed ? 'Yes' : 'No'}</span>
                      <span className="px-2 flex-none w-24 text-warm-gray">{new Date(d.created_at).toLocaleDateString()}</span>
                    </div>
                    {isExpanded && dists.length > 0 && (
                      <div className="pl-6 pb-3">
                        <table className="w-full text-xs">
                          <thead>
                            <tr className="text-warm-gray tracking-widest uppercase">
                              <th className="py-1 text-left">Night</th>
                              <th className="py-1 text-right">Amount</th>
                              <th className="py-1 text-left">Account</th>
                              <th className="py-1 text-center">Transferred</th>
                            </tr>
                          </thead>
                          <tbody>
                            {dists.map((dist) => {
                              const distNight = getNightInfo(dist.night_id);
                              return (
                                <tr key={dist.id} className="border-b border-warm-gray-light/30">
                                  <td className="py-1">Night {distNight?.night_number || '?'}</td>
                                  <td className="py-1 text-right">${parseFloat(dist.amount).toFixed(2)}</td>
                                  <td className="py-1">{getAccountName(dist.account_id)}</td>
                                  <td className="py-1 text-center">{dist.is_transferred ? 'Yes' : 'No'}</td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {sortedDonations.length === 0 && (
        <p className="text-warm-gray italic font-serif text-center py-8">
          No donations yet.
        </p>
      )}
    </AdminLayout>
  );
}
