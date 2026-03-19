import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import AdminLayout from '../components/AdminLayout';
import * as XLSX from 'xlsx';

export default function AdminSetup() {
  const [campaign, setCampaign] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [nights, setNights] = useState([]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState(null);
  const [uploadError, setUploadError] = useState(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    const { data: camps } = await supabase
      .from('campaigns')
      .select('*')
      .eq('is_active', true)
      .limit(1);

    if (camps && camps.length > 0) {
      setCampaign(camps[0]);

      const { data: accts } = await supabase
        .from('accounts')
        .select('*')
        .eq('campaign_id', camps[0].id)
        .order('person_name');

      setAccounts(accts || []);

      const { data: nts } = await supabase
        .from('nights')
        .select('*')
        .eq('campaign_id', camps[0].id)
        .order('night_number');

      if (nts && nts.length > 0) {
        setNights(nts);
      } else {
        // Start with empty template
        setNights(
          Array.from({ length: 30 }, (_, i) => ({
            night_number: i + 1,
            date: '',
            charity_name: '',
            charity_description: '',
            charity_url: '',
            is_zakat_eligible: false,
            account_id: '',
          }))
        );
      }
    } else {
      // No active campaign — create one
      const year = new Date().getFullYear();
      const { data: newCamp, error } = await supabase
        .from('campaigns')
        .insert({ year, name: `Ramadan ${year}`, is_active: true })
        .select()
        .single();

      if (error) {
        logger.error('setup', 'Failed to create campaign', { code: error.code, message: error.message });
        return;
      }

      setCampaign(newCamp);
      setNights(
        Array.from({ length: 30 }, (_, i) => ({
          night_number: i + 1,
          date: '',
          charity_name: '',
          charity_description: '',
          charity_url: '',
          is_zakat_eligible: false,
          account_id: '',
        }))
      );
    }
  }

  function updateNight(index, field, value) {
    setNights((prev) => {
      const updated = [...prev];
      updated[index] = { ...updated[index], [field]: value };
      return updated;
    });
  }

  function validateNights(data) {
    const errors = [];
    for (let i = 0; i < data.length; i++) {
      const n = data[i];
      if (!Number.isInteger(n.night_number) || n.night_number < 1 || n.night_number > 30) {
        errors.push(`Row ${i + 1}: night_number must be 1-30`);
      }
      if (!n.date || isNaN(Date.parse(n.date))) {
        errors.push(`Row ${i + 1}: invalid date`);
      }
      if (!n.charity_name || n.charity_name.length === 0 || n.charity_name.length > 200) {
        errors.push(`Row ${i + 1}: charity_name must be 1-200 characters`);
      }
    }
    return errors;
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;
    setUploadError(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const workbook = XLSX.read(evt.target.result, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet);

        const parsed = rows.map((row) => {
          const accountMatch = accounts.find(
            (a) => a.person_name.toLowerCase() === String(row.account_name || '').toLowerCase()
          );
          return {
            night_number: parseInt(row.night_number),
            date: String(row.date || ''),
            charity_name: String(row.charity_name || ''),
            charity_description: String(row.charity_description || ''),
            charity_url: String(row.charity_url || ''),
            is_zakat_eligible: row.is_zakat_eligible === true || row.is_zakat_eligible === 'true' || row.is_zakat_eligible === 'TRUE',
            account_id: accountMatch?.id || '',
          };
        });

        const errors = validateNights(parsed);
        if (errors.length > 0) {
          setUploadError(errors.join('\n'));
          return;
        }

        setNights(parsed);
        setMessage('Spreadsheet loaded. Review and save.');
      } catch (err) {
        setUploadError('Failed to parse file. Check format and try again.');
        logger.error('setup', 'File parse error', { message: err.message });
      }
    };
    reader.readAsArrayBuffer(file);
  }

  function downloadExampleCSV() {
    const csv = `night_number,date,charity_name,charity_description,charity_url,is_zakat_eligible,account_name\n1,2026-02-17,Example Charity,Short description of the charity,https://example.org,true,Ali`;
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'nights_example.csv';
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleSave() {
    if (!campaign) return;
    setSaving(true);
    setMessage(null);

    const errors = validateNights(nights);
    if (errors.length > 0) {
      setMessage(errors.join('\n'));
      setSaving(false);
      return;
    }

    // Upsert nights
    for (const night of nights) {
      const payload = {
        campaign_id: campaign.id,
        night_number: night.night_number,
        date: night.date,
        charity_name: night.charity_name,
        charity_description: night.charity_description || null,
        charity_url: night.charity_url || null,
        is_zakat_eligible: night.is_zakat_eligible,
        account_id: night.account_id || null,
      };

      const { error } = night.id
        ? await supabase.from('nights').update(payload).eq('id', night.id)
        : await supabase.from('nights').upsert(payload, { onConflict: 'campaign_id,night_number' });

      if (error) {
        logger.error('setup', 'Failed to save night', { nightNumber: night.night_number, code: error.code, message: error.message });
        setMessage(`Error saving Night ${night.night_number}: ${error.message}`);
        setSaving(false);
        return;
      }
    }

    logger.info('setup', 'Campaign nights saved', { count: nights.length });
    setMessage('All nights saved successfully.');
    setSaving(false);
    loadData();
  }

  return (
    <AdminLayout>
      <div className="mb-6">
        <h1 className="font-serif text-2xl mb-1">Campaign Setup</h1>
        {campaign && (
          <p className="text-sm text-warm-gray">{campaign.name} ({campaign.year})</p>
        )}
      </div>

      {/* Upload section */}
      <div className="mb-6 p-4 border border-warm-gray-light bg-white/40">
        <label className="block cursor-pointer">
          <span className="inline-block bg-maroon text-cream px-6 py-3 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors cursor-pointer">
            Upload Nights from Spreadsheet
          </span>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={handleFileUpload}
            className="hidden"
          />
        </label>
        <div className="mt-3">
          <button
            onClick={downloadExampleCSV}
            className="text-xs tracking-widest uppercase text-maroon border-b border-maroon/30 hover:border-maroon transition-colors cursor-pointer"
          >
            Download Example CSV
          </button>
          <p className="text-xs text-warm-gray mt-1">
            The account_name column must match a name from your Accounts page.
          </p>
        </div>
        {uploadError && (
          <pre className="mt-3 text-xs text-maroon whitespace-pre-wrap">{uploadError}</pre>
        )}
      </div>

      {/* Nights table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-warm-gray-light text-xs tracking-widest uppercase text-warm-gray">
              <th className="py-2 px-2 text-left">#</th>
              <th className="py-2 px-2 text-left">Date</th>
              <th className="py-2 px-2 text-left">Charity</th>
              <th className="py-2 px-2 text-left">Description</th>
              <th className="py-2 px-2 text-left">URL</th>
              <th className="py-2 px-2 text-center">Zakat</th>
              <th className="py-2 px-2 text-left">Account</th>
            </tr>
          </thead>
          <tbody>
            {nights.map((night, i) => (
              <tr key={i} className="border-b border-warm-gray-light/50">
                <td className="py-2 px-2 text-warm-gray">{night.night_number}</td>
                <td className="py-2 px-2">
                  <input
                    type="date"
                    value={night.date}
                    onChange={(e) => updateNight(i, 'date', e.target.value)}
                    className="border-b border-warm-gray-light bg-transparent py-1 text-xs focus:outline-none focus:border-maroon w-32"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={night.charity_name}
                    onChange={(e) => updateNight(i, 'charity_name', e.target.value)}
                    className="border-b border-warm-gray-light bg-transparent py-1 text-xs focus:outline-none focus:border-maroon w-full"
                    placeholder="Charity name"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="text"
                    value={night.charity_description || ''}
                    onChange={(e) => updateNight(i, 'charity_description', e.target.value)}
                    className="border-b border-warm-gray-light bg-transparent py-1 text-xs focus:outline-none focus:border-maroon w-full"
                    placeholder="Optional"
                  />
                </td>
                <td className="py-2 px-2">
                  <input
                    type="url"
                    value={night.charity_url || ''}
                    onChange={(e) => updateNight(i, 'charity_url', e.target.value)}
                    className="border-b border-warm-gray-light bg-transparent py-1 text-xs focus:outline-none focus:border-maroon w-full"
                    placeholder="https://..."
                  />
                </td>
                <td className="py-2 px-2 text-center">
                  <input
                    type="checkbox"
                    checked={night.is_zakat_eligible}
                    onChange={(e) => updateNight(i, 'is_zakat_eligible', e.target.checked)}
                    className="accent-zakat-green"
                  />
                </td>
                <td className="py-2 px-2">
                  <select
                    value={night.account_id || ''}
                    onChange={(e) => updateNight(i, 'account_id', e.target.value)}
                    className="border-b border-warm-gray-light bg-transparent py-1 text-xs focus:outline-none focus:border-maroon w-full"
                  >
                    <option value="">Select...</option>
                    {accounts.map((a) => (
                      <option key={a.id} value={a.id}>{a.person_name}</option>
                    ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {message && (
        <div className="mt-4 p-3 text-sm border border-warm-gray-light bg-white/40 whitespace-pre-wrap">
          {message}
        </div>
      )}

      <div className="mt-6">
        <button
          onClick={handleSave}
          disabled={saving}
          className="bg-maroon text-cream px-8 py-3 text-sm tracking-widest uppercase hover:bg-maroon-dark transition-colors disabled:opacity-50 cursor-pointer"
        >
          {saving ? 'Saving...' : 'Save All'}
        </button>
      </div>
    </AdminLayout>
  );
}
