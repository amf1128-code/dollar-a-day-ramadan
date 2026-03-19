import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import DonateForm from '../components/DonateForm';
import PaymentModal from '../components/PaymentModal';
import NightCard from '../components/NightCard';
import ZakatBadge from '../components/ZakatBadge';

export default function Home() {
  const [campaign, setCampaign] = useState(null);
  const [nights, setNights] = useState([]);
  const [tonight, setTonight] = useState(null);
  const [totalRaised, setTotalRaised] = useState(0);
  const [nightTotals, setNightTotals] = useState({});
  const [paymentInfo, setPaymentInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [donationData, setDonationData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitCooldown, setSubmitCooldown] = useState(false);
  const [successMessage, setSuccessMessage] = useState(null);

  useEffect(() => {
    loadCampaignData();
  }, []);

  async function loadCampaignData() {
    try {
      // Get active campaign
      const { data: campaigns, error: campErr } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .limit(1);

      if (campErr) {
        logger.error('home', 'Failed to load campaigns', { code: campErr.code, message: campErr.message });
        setLoading(false);
        return;
      }

      if (!campaigns || campaigns.length === 0) {
        setLoading(false);
        return;
      }

      const camp = campaigns[0];
      setCampaign(camp);

      // Get all nights
      const { data: nightsData, error: nightsErr } = await supabase
        .from('nights')
        .select('*')
        .eq('campaign_id', camp.id)
        .order('night_number', { ascending: true });

      if (nightsErr) {
        logger.error('home', 'Failed to load nights', { code: nightsErr.code, message: nightsErr.message });
        setLoading(false);
        return;
      }

      setNights(nightsData || []);

      // Find tonight
      const today = new Date().toISOString().split('T')[0];
      const tonightData = (nightsData || []).find((n) => n.date === today);
      setTonight(tonightData || null);

      // Load payment info for tonight
      if (tonightData) {
        const { data: payInfo, error: payErr } = await supabase
          .rpc('get_tonight_payment_info', { p_night_id: tonightData.id });

        if (!payErr && payInfo && payInfo.length > 0) {
          setPaymentInfo(payInfo[0]);
        } else if (payErr) {
          logger.warn('home', 'Failed to load payment info', { code: payErr.code, message: payErr.message });
        }
      }

      // Load totals
      const { data: totals, error: totalsErr } = await supabase
        .rpc('get_donation_totals', { p_campaign_id: camp.id });

      if (!totalsErr && totals) {
        const overall = totals.find((t) => t.night_id === null);
        if (overall) setTotalRaised(parseFloat(overall.total_raised) || 0);

        const perNight = {};
        for (const t of totals) {
          if (t.night_id) {
            perNight[t.night_id] = parseFloat(t.night_total) || 0;
          }
        }
        setNightTotals(perNight);
      } else if (totalsErr) {
        logger.warn('home', 'Failed to load totals', { code: totalsErr.code, message: totalsErr.message });
      }

      setLoading(false);
    } catch (err) {
      logger.error('home', 'Unexpected error loading campaign', { message: err.message });
      setLoading(false);
    }
  }

  function handleDonate(data) {
    setDonationData(data);
    setShowModal(true);
    logger.info('donation', 'Payment modal opened', { method: data.method, nightNumber: tonight?.night_number });
  }

  async function handleConfirm(paymentHandle) {
    if (submitting || submitCooldown) return;
    setSubmitting(true);

    const donation = {
      campaign_id: campaign.id,
      night_id: donationData.isLumpSum ? null : tonight?.id,
      is_lump_sum: donationData.isLumpSum,
      donor_first_name: donationData.firstName,
      donor_last_initial: donationData.lastInitial,
      amount: donationData.amount,
      payment_method: donationData.method,
      is_confirmed: true,
    };

    if (donationData.method === 'venmo' && paymentHandle) {
      donation.donor_venmo_handle = paymentHandle;
    } else if (donationData.method === 'zelle' && paymentHandle) {
      donation.donor_zelle_identifier = paymentHandle;
    }

    logger.info('donation', 'Attempting database insert', { nightNumber: tonight?.night_number, amount: donationData.amount });

    const { error } = await supabase.from('donations').insert(donation);

    if (error) {
      logger.error('donation', 'Database insert failed', { code: error.code, message: error.message, details: error.details });
      alert('There was an error saving your donation. Please try again.');
      setSubmitting(false);
      return;
    }

    logger.info('donation', 'Database insert succeeded', { nightNumber: tonight?.night_number, amount: donationData.amount });

    setShowModal(false);
    setDonationData(null);
    setSubmitting(false);
    setSuccessMessage(`Thank you for your $${donationData.amount.toFixed(2)} donation.`);

    // Cooldown to prevent double submission
    setSubmitCooldown(true);
    setTimeout(() => setSubmitCooldown(false), 10000);

    // Refresh totals
    loadCampaignData();
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-warm-gray tracking-widest uppercase text-sm">Loading...</p>
      </div>
    );
  }

  if (!campaign) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <h1 className="font-serif text-3xl mb-3">Dollar-A-Day</h1>
          <p className="text-warm-gray">Campaign not currently active. Check back soon.</p>
        </div>
      </div>
    );
  }

  const today = new Date().toISOString().split('T')[0];
  const pastNights = nights.filter((n) => n.date < today).sort((a, b) => b.night_number - a.night_number);

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="px-6 pt-10 pb-6 border-b border-warm-gray-light">
        <p className="text-xs tracking-widest uppercase text-warm-gray mb-2">{campaign.name}</p>
        <div className="flex items-baseline justify-between">
          <h1 className="font-serif text-4xl sm:text-5xl tracking-tight">Dollar-A-Day</h1>
          <div className="text-right">
            <p className="font-serif text-2xl sm:text-3xl text-maroon">${totalRaised.toFixed(2)}</p>
            <p className="text-xs tracking-widest uppercase text-warm-gray">raised</p>
          </div>
        </div>
      </header>

      {/* Tonight's charity */}
      {tonight ? (
        <section className="px-6 py-8 border-b border-warm-gray-light">
          <p className="text-xs tracking-widest uppercase text-warm-gray mb-3">
            Tonight &mdash; Night {tonight.night_number}
          </p>
          <h2 className="font-serif text-2xl sm:text-3xl mb-3">{tonight.charity_name}</h2>
          {tonight.is_zakat_eligible && (
            <div className="mb-3">
              <ZakatBadge />
            </div>
          )}
          {tonight.charity_description && (
            <p className="text-warm-gray-dark text-sm leading-relaxed mb-3">{tonight.charity_description}</p>
          )}
          {tonight.charity_url && (
            <a
              href={tonight.charity_url.match(/^https?:\/\//) ? tonight.charity_url : `https://${tonight.charity_url}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-block text-xs tracking-widest uppercase text-maroon border-b border-maroon/30 hover:border-maroon transition-colors"
            >
              Visit Charity
            </a>
          )}
        </section>
      ) : (
        <section className="px-6 py-8 border-b border-warm-gray-light">
          <p className="text-warm-gray italic font-serif">No charity scheduled for today. Check back tomorrow.</p>
        </section>
      )}

      {/* Success message */}
      {successMessage && (
        <div className="mx-6 mt-6 p-4 bg-zakat-green-light border border-zakat-green/30 text-zakat-green text-sm">
          {successMessage}
        </div>
      )}

      {/* Donate form */}
      {tonight && (
        <section className="px-6 py-8 border-b border-warm-gray-light">
          <DonateForm onDonate={handleDonate} />
        </section>
      )}

      {/* Previous nights */}
      {pastNights.length > 0 && (
        <section className="px-6 py-8">
          <h2 className="font-serif text-xl mb-4">Previous Nights</h2>
          <div className="space-y-3">
            {pastNights.map((night) => (
              <NightCard key={night.id} night={night} total={nightTotals[night.id]} />
            ))}
          </div>
        </section>
      )}

      {/* Footer */}
      <footer className="px-6 py-6 border-t border-warm-gray-light text-center">
        <p className="text-xs text-warm-gray tracking-wide">Dollar-A-Day Ramadan</p>
      </footer>

      {/* Payment modal */}
      {showModal && donationData && (
        <PaymentModal
          method={donationData.method}
          amount={donationData.amount}
          nightNumber={tonight?.night_number}
          charityName={tonight?.charity_name}
          paymentInfo={paymentInfo}
          onConfirm={handleConfirm}
          onCancel={() => { setShowModal(false); setDonationData(null); }}
        />
      )}
    </div>
  );
}
