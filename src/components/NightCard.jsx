import ZakatBadge from './ZakatBadge';

export default function NightCard({ night, total }) {
  return (
    <div className="border border-warm-gray-light p-5 bg-white/40">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs tracking-widest uppercase text-warm-gray mb-1">
            Night {night.night_number} &mdash; {new Date(night.date + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
          </p>
          <h3 className="font-serif text-lg leading-snug">{night.charity_name}</h3>
          {night.is_zakat_eligible && (
            <div className="mt-2">
              <ZakatBadge />
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="font-serif text-xl text-maroon">${(total || 0).toFixed(2)}</p>
          <p className="text-xs text-warm-gray">raised</p>
        </div>
      </div>
      {night.receipt_image_url && (
        <a
          href={night.receipt_image_url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block mt-3 text-xs tracking-widest uppercase text-maroon hover:text-maroon-dark transition-colors border-b border-maroon/30"
        >
          View Receipt
        </a>
      )}
    </div>
  );
}
