/**
 * SwarmOS Top Navigation Bar
 * Follows strict 3-zone contract:
 * [Brand Wordmark] — [Single-line Nav Links] — [1 Primary Action Button]
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';

interface HeaderProps {
  activeTab: 'mission' | 'missions' | 'fleet' | 'tasks' | 'events';
  onSelectTab: (tab: 'mission' | 'missions' | 'fleet' | 'tasks' | 'events') => void;
  onOpenCreateMission: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTab,
  onSelectTab,
  onOpenCreateMission,
}) => {
  return (
    <header className="flex items-center justify-between gap-8 px-6 py-3.5 bg-slate-900 border-b border-slate-800 text-slate-100 sticky top-0 z-40">
      {/* Zone 1: Single text element wordmark */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="text-lg font-bold tracking-tight text-white whitespace-nowrap">
          SwarmOS
        </span>
      </div>

      {/* Zone 2: Single-line text navigation links */}
      <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-400">
        <button
          onClick={() => onSelectTab('mission')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'mission'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Mission Control
        </button>
        <button
          onClick={() => onSelectTab('missions')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'missions'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Mission Registry
        </button>
        <button
          onClick={() => onSelectTab('fleet')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'fleet'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Agent Fleet
        </button>
        <button
          onClick={() => onSelectTab('tasks')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'tasks'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Task Pipeline
        </button>
        <button
          onClick={() => onSelectTab('events')}
          className={`transition-colors whitespace-nowrap shrink-0 pb-0.5 ${
            activeTab === 'events'
              ? 'text-white border-b-2 border-indigo-500 font-semibold'
              : 'hover:text-slate-200'
          }`}
        >
          Event Audit Trail
        </button>
      </nav>

      {/* Zone 3: 1 primary action */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={onOpenCreateMission}
          className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors whitespace-nowrap shrink-0 shadow-sm"
        >
          New Mission
        </button>
      </div>
    </header>
  );
};
