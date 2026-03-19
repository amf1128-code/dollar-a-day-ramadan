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
    is_lump_sum: true,
    is_confirmed: true,
    donor_venmo_handle: '',
    donor_zelle_identifier: '',
    paying_account_id: '',
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

  // Determine if we're filtering to a specific night
  const selectedNightNumber = filter.startsWith('night-') ? parseInt(filter.split('-')[1]) : null;
  const selectedNight = selectedNightNumber ? nights.find((n) => n.night_number === selectedNightNumber) : null;

  // Build unified rows when filtering by night
  function getNightRows() {
    if (!selectedNight) return null;

    const rows = [];

    // Regular donations for this night
    donations
      .filter((d) => !d.is_lump_sum && d.night_id === selectedNight.id && d.is_confirmed)
      .forEach((d) => {
        rows.push({
          key: d.id,
          donor: `${d.donor_first_name} ${d.donor_last_initial}.`,
          amount: parseFloat(d.amount),
          method: d.payment_method,
          handle: d.donor_venmo_handle || d.donor_zelle_identifier || '-',
          source: 'Direct',
          date: d.created_at,
          donation: d,
        });
      });

    // Lump sum distribution portions for this night
    distributions
      .filter((dist) => dist.night_id === selectedNight.id)
      .forEach((dist) => {
        const donation = donations.find((d) => d.id === dist.donation_id);
        if (!donation || !donation.is_confirmed) return;
        rows.push({
          key: `dist-${dist.id}`,
          donor: `${donation.donor_first_name} ${donation.donor_last_initial}.`,
          amount: parseFloat(dist.amount),
          method: donation.payment_method,
          handle: donation.donor_venmo_handle || donation.donor_zelle_identifier || '-',
          source: `Lump ($${parseFloat(donation.amount).toFixed(0)} total)`,
          date: donation.created_at,
          donation,
          isDistribution: true,
          transferred: dist.is_transferred,
          collectedBy: donation.paying_account_id ? getAccountName(donation.paying_account_id) : '-',
        });
      });

    return rows;
  }

  // For "all" view, keep existing behavior
  const filteredDonations = filter === 'all'
    ? donations
    : donations.filter((d) => {
        const nightInfo = getNightInfo(d.night_id);
        return nightInfo?.night_number === selectedNightNumber;
      });

  const regular = filteredDonations.filter((d) => !d.is_lump_sum);
  const lumpSums = filteredDonations.filter((d) => d.is_lump_sum);
  const sortedDonations = [...regular, ...lumpSums];

  // Calculate night total (direct + lump portions) when filtered
  const nightRows = getNightRows();
  const nightTotal = nightRows
    ? nightRows.reduce((sum, r) => sum + r.amount, 0)
    : null;

  // For "all" view total
  const allTotal = filteredDonations
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

  async function handleDeleteDonation(donation) {
    const label = `$${parseFloat(donation.amount).toFixed(2)} from ${donation.donor_first_name} ${donation.donor_last_initial}.`;
    const input = window.prompt(
      `This will permanently delete the donation: ${label}\n\nThis also removes any related distributions and action items.\n\nType CONFIRM to proceed:`
    );
    if (input !== 'CONFIRM') {
      if (input !== null) alert('Deletion cancelled — you must type exactly CONFIRM.');
      return;
    }
    const { error } = await supabase.from('donations').delete().eq('id', donation.id);
    if (error) {
      logger.error('ledger', 'Failed to delete donation', { code: error.code, message: error.message });
      alert(`Error: ${error.message}`);
      return;
    }
    logger.info('ledger', 'Donation deleted', { id: donation.id, amount: donation.amount });
    loadData();
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
      paying_account_id: manualForm.paying_account_id || null,
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
      is_lump_sum: true,
      is_confirmed: true,
      donor_venmo_handle: '',
      donor_zelle_identifier: '',
      paying_account_id: '',
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
              <select value={manualForm.night_id} onChange={(e) => setManualForm({ ...manualForm, night_id: e.target.value, is_lump_sum: !e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon">
                <option value="">Whole Month (Lump Sum)</option>
                {nights.map((n) => {
                  const acct = accounts.find((a) => a.id === n.account_id);
                  return (
                    <option key={n.id} value={n.id}>Night {n.night_number} - {n.charity_name}{acct ? ` (${acct.person_name})` : ''}</option>
                  );
                })}
              </select>
              {manualForm.night_id && (() => {
                const selectedNight = nights.find((n) => n.id === manualForm.night_id);
                const acct = selectedNight && accounts.find((a) => a.id === selectedNight.account_id);
                return acct ? <p className="text-xs text-warm-gray mt-1">Account: {acct.person_name}</p> : null;
              })()}
            </div>
            {manualForm.is_lump_sum && (
              <div>
                <label className="block text-xs tracking-widest uppercase text-warm-gray mb-1">Collected By</label>
                <select value={manualForm.paying_account_id} onChange={(e) => setManualForm({ ...manualForm, paying_account_id: e.target.value })} className="w-full border-b border-warm-gray-light bg-transparent py-1 text-sm focus:outline-none focus:border-maroon">
                  <option value="">Select account...</option>
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>{a.person_name}</option>
                  ))}
                </select>
              </div>
            )}
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
          <option value="all">All Donations</option>
          {nights.map((n) => (
            <option key={n.id} value={`night-${n.night_number}`}>Night {n.night_number} - {n.charity_name}</option>
          ))}
        </select>
        <span className="ml-auto font-serif text-lg text-maroon">
          ${(nightTotal !== null ? nightTotal : allTotal).toFixed(2)}
          {nightTotal !== null ? ' night total' : ' total'}
        </span>
      </div>

      {/* === NIGHT VIEW: unified rows (direct + lump portions) === */}
      {nightRows ? (
        <div className="overflow-x-auto">
          {selectedNight && (
            <div className="mb-4 p-3 border border-warm-gray-light/50 bg-white/30 text-sm">
              <span className="font-serif font-bold">Night {selectedNight.night_number}</span>
              {' — '}{selectedNight.charity_name}
              {selectedNight.account_id && (
                <span className="text-warm-gray"> ({getAccountName(selectedNight.account_id)})</span>
              )}
            </div>
          )}
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-warm-gray-light text-xs tracking-widest uppercase text-warm-gray">
                <th className="py-2 px-2 text-left">Donor</th>
                <th className="py-2 px-2 text-right">Amount</th>
                <th className="py-2 px-2 text-left">Source</th>
                <th className="py-2 px-2 text-left">Method</th>
                <th className="py-2 px-2 text-left">Handle</th>
                <th className="py-2 px-2 text-left">Collected By</th>
                <th className="py-2 px-2 text-center">Transferred</th>
                <th className="py-2 px-2"></th>
              </tr>
            </thead>
            <tbody>
              {nightRows.map((row) => (
                <tr key={row.key} className="border-b border-warm-gray-light/50">
                  <td className="py-2 px-2">{row.donor}</td>
                  <td className="py-2 px-2 text-right font-serif">${row.amount.toFixed(2)}</td>
                  <td className="py-2 px-2">
                    {row.isDistribution ? (
                      <span className="text-xs bg-gold/20 text-warm-gray-dark px-2 py-0.5">{row.source}</span>
                    ) : (
                      <span className="text-xs">Direct</span>
                    )}
                  </td>
                  <td className="py-2 px-2 capitalize">{row.method}</td>
                  <td className="py-2 px-2 text-warm-gray">{row.handle}</td>
                  <td className="py-2 px-2 text-warm-gray">{row.collectedBy || '-'}</td>
                  <td className="py-2 px-2 text-center">
                    {row.isDistribution ? (row.transferred ? 'Yes' : 'No') : '-'}
                  </td>
                  <td className="py-2 px-2 text-center">
                    {!row.isDistribution && (
                      <button onClick={() => handleDeleteDonation(row.donation)} className="text-warm-gray hover:text-maroon transition-colors cursor-pointer text-xs" title="Delete donation">✕</button>
                    )}
                  </td>
                </tr>
              ))}
              {nightRows.length > 0 && (
                <tr className="border-t-2 border-warm-gray-light font-serif">
                  <td className="py-2 px-2 font-bold">Total</td>
                  <td className="py-2 px-2 text-right font-bold text-maroon">${nightTotal.toFixed(2)}</td>
                  <td colSpan={6}></td>
                </tr>
              )}
            </tbody>
          </table>
          {nightRows.length === 0 && (
            <p className="text-warm-gray italic font-serif text-center py-8">
              No donations for this night yet.
            </p>
          )}
        </div>
      ) : (
        /* === ALL VIEW: original grouped layout === */
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
                <th className="py-2 px-2"></th>
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
                    <td className="py-2 px-2 text-center">
                      <button onClick={() => handleDeleteDonation(d)} className="text-warm-gray hover:text-maroon transition-colors cursor-pointer text-xs" title="Delete donation">✕</button>
                    </td>
                  </tr>
                );
              })}

              {lumpSums.length > 0 && regular.length > 0 && (
                <tr>
                  <td colSpan={10} className="py-3">
                    <div className="border-t-2 border-warm-gray-light"></div>
                    <p className="text-xs tracking-widest uppercase text-warm-gray mt-2">Lump Sum Donations</p>
                  </td>
                </tr>
              )}

              {lumpSums.map((d) => {
                const night = getNightInfo(d.night_id);
                const dists = distributions.filter((dist) => dist.donation_id === d.id);
                const isExpanded = expandedId === d.id;

                return [
                  <tr key={d.id} className="border-b border-warm-gray-light/50 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : d.id)}>
                    <td className="py-2 px-2">{d.donor_first_name} {d.donor_last_initial}.</td>
                    <td className="py-2 px-2 text-right font-serif">${parseFloat(d.amount).toFixed(2)}</td>
                    <td className="py-2 px-2 capitalize">{d.payment_method}</td>
                    <td className="py-2 px-2 text-warm-gray">{d.donor_venmo_handle || d.donor_zelle_identifier || '-'}</td>
                    <td className="py-2 px-2 text-center">Lump Sum</td>
                    <td className="py-2 px-2">{night?.charity_name || '-'}</td>
                    <td className="py-2 px-2 text-center">Yes</td>
                    <td className="py-2 px-2 text-center">{d.is_confirmed ? 'Yes' : 'No'}</td>
                    <td className="py-2 px-2 text-warm-gray">{new Date(d.created_at).toLocaleDateString()}</td>
                    <td className="py-2 px-2 text-center" onClick={(e) => e.stopPropagation()}>
                      <button onClick={() => handleDeleteDonation(d)} className="text-warm-gray hover:text-maroon transition-colors cursor-pointer text-xs" title="Delete donation">✕</button>
                    </td>
                  </tr>,
                  isExpanded && dists.length > 0 && (
                    <tr key={`${d.id}-dists`}>
                      <td colSpan={10} className="py-0 pl-6 pb-3">
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
                      </td>
                    </tr>
                  ),
                ];
              })}
            </tbody>
          </table>

          {sortedDonations.length === 0 && (
            <p className="text-warm-gray italic font-serif text-center py-8">
              No donations yet.
            </p>
          )}
        </div>
      )}
    </AdminLayout>
  );
}
