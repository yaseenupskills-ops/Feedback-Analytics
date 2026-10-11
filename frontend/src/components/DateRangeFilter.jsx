import React, { useState } from 'react';
import { Calendar, ChevronDown } from 'lucide-react';

const PRESETS = [
  { label: 'All Time', days: null },
  { label: 'Last 7 Days', days: 7 },
  { label: 'Last 30 Days', days: 30 },
  { label: 'Last 60 Days', days: 60 },
];

export default function DateRangeFilter({ onChange }) {
  const [activePreset, setActivePreset] = useState('All Time');
  const [showCustom, setShowCustom] = useState(false);
  const [customFrom, setCustomFrom] = useState('');
  const [customTo, setCustomTo] = useState('');

  const handlePresetSelect = (preset) => {
    setActivePreset(preset.label);
    setShowCustom(false);

    if (preset.days === null) {
      onChange({ from: null, to: null, label: 'All Time' });
      return;
    }

    const toDate = new Date();
    const fromDate = new Date();
    fromDate.setDate(toDate.getDate() - preset.days);

    onChange({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      label: preset.label,
    });
  };

  const handleCustomApply = (e) => {
    e.preventDefault();
    if (!customFrom) return;

    setActivePreset('Custom Range');
    onChange({
      from: new Date(customFrom).toISOString(),
      to: customTo ? new Date(customTo + 'T23:59:59').toISOString() : new Date().toISOString(),
      label: 'Custom Range',
    });
  };

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1 shadow-sm">
        <div className="px-2.5 py-1 text-slate-400">
          <Calendar className="w-4 h-4" />
        </div>
        {PRESETS.map((preset) => (
          <button
            key={preset.label}
            type="button"
            onClick={() => handlePresetSelect(preset)}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              activePreset === preset.label && !showCustom
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
            }`}
          >
            {preset.label}
          </button>
        ))}
        <button
          type="button"
          onClick={() => setShowCustom(!showCustom)}
          className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
            activePreset === 'Custom Range' || showCustom
              ? 'bg-slate-900 text-white shadow-sm'
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
          }`}
        >
          <span>Custom</span>
          <ChevronDown className="w-3.5 h-3.5" />
        </button>
      </div>

      {showCustom && (
        <form
          onSubmit={handleCustomApply}
          className="flex items-center gap-2 bg-white border border-slate-200 rounded-xl p-2 shadow-sm animate-fadeIn"
        >
          <input
            type="date"
            value={customFrom}
            onChange={(e) => setCustomFrom(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            required
          />
          <span className="text-xs text-slate-400">to</span>
          <input
            type="date"
            value={customTo}
            onChange={(e) => setCustomTo(e.target.value)}
            className="px-2 py-1 text-xs border border-slate-200 rounded-lg text-slate-700 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <button
            type="submit"
            className="px-2.5 py-1 bg-indigo-600 text-white text-xs font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Apply
          </button>
        </form>
      )}
    </div>
  );
}