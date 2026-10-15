/**
 * SwarmOS Create Mission Modal
 * Enables natural language mission authoring with quick canonical scenario presets.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';

interface CreateMissionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onCreate: (name: string, description: string, priority: string) => Promise<void>;
}

const PRESETS = [
  {
    title: 'SRS Canonical Scenario',
    description:
      'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas.',
    priority: 'HIGH',
  },
  {
    title: 'Aerial Warehouse Scan',
    description: 'Inspect Zone A storage racks and confirm perimeter safety.',
    priority: 'MEDIUM',
  },
  {
    title: 'Concurrent Multi-Agent Operations',
    description:
      'Simultaneous Operations: Inspect Zone A and concurrently stage cargo in Zone B, then deliver to Dispatch.',
    priority: 'HIGH',
  },
  {
    title: 'Outbound Cargo Transit',
    description: 'Transport verified inventory from Zone B staging to Zone C dispatch gate.',
    priority: 'HIGH',
  },
];

export const CreateMissionModal: React.FC<CreateMissionModalProps> = ({
  isOpen,
  onClose,
  onCreate,
}) => {
  const [name, setName] = useState('Warehouse Package Dispatch');
  const [description, setDescription] = useState(PRESETS[0].description);
  const [priority, setPriority] = useState('HIGH');
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;

    try {
      setIsSubmitting(true);
      await onCreate(name, description, priority);
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSelectPreset = (preset: (typeof PRESETS)[0]) => {
    setName(preset.title);
    setDescription(preset.description);
    setPriority(preset.priority);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-xs">
      <div className="bg-slate-900 border border-slate-800 rounded-xl max-w-xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-semibold text-slate-100">
              Create New Mission
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Natural language mission intent with automated task conversion
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-200 text-sm font-medium"
          >
            ✕
          </button>
        </div>

        {/* Presets */}
        <div className="mb-5">
          <div className="text-xs text-slate-400 mb-2">Preset Scenarios</div>
          <div className="grid grid-cols-1 gap-2">
            {PRESETS.map((p, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => handleSelectPreset(p)}
                className={`text-left p-2.5 rounded-lg border text-xs transition-colors ${
                  description === p.description
                    ? 'border-indigo-500 bg-indigo-950/40 text-indigo-200'
                    : 'border-slate-800 bg-slate-950 hover:border-slate-700 text-slate-300'
                }`}
              >
                <div className="font-semibold text-slate-200">{p.title}</div>
                <div className="text-slate-400 mt-0.5 line-clamp-1">{p.description}</div>
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs text-slate-300 mb-1">Mission Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              placeholder="e.g. Zone A Dispatch Transfer"
              required
            />
          </div>

          <div>
            <label className="block text-xs text-slate-300 mb-1">
              Mission Directive (Plain Language)
            </label>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              placeholder="e.g. Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas."
              required
            />
          </div>

          <div className="flex items-center gap-4">
            <div className="w-1/2">
              <label className="block text-xs text-slate-300 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-hidden focus:border-indigo-500"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>
            </div>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-300 hover:text-white"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Mission'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
