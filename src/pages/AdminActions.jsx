import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import AdminLayout from '../components/AdminLayout';

export default function AdminActions() {
  const [campaign, setCampaign] = useState(null);
  const [items, setItems] = useState([]);
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

    const { data } = await supabase
      .from('action_items')
      .select('*')
      .eq('campaign_id', camp.id)
      .order('created_at', { ascending: false });

    setItems(data || []);
  }

  async function toggleComplete(item) {
    const { error } = await supabase
      .from('action_items')
      .update({ is_completed: !item.is_completed })
      .eq('id', item.id);

    if (error) {
      logger.error('actions', 'Failed to toggle action item', { code: error.code, message: error.message });
      return;
    }

    logger.info('actions', 'Action item toggled', { id: item.id, completed: !item.is_completed });
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
              <input
                type="checkbox"
                checked={item.is_completed}
                onChange={() => toggleComplete(item)}
                className="mt-1 accent-maroon cursor-pointer"
              />
              <div className="flex-1 min-w-0">
                <p className={`text-sm leading-relaxed ${item.is_completed ? 'line-through text-warm-gray' : ''}`}>
                  {item.description}
                </p>
                <p className="text-xs text-warm-gray mt-1">
                  {new Date(item.created_at).toLocaleDateString()}
                </p>
              </div>
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
