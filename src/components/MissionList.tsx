/**
 * SwarmOS Mission List
 * Displays table/grid of all created missions with status, priority, plan version,
 * and quick-select affordance.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Mission } from '../types/swarm.ts';

interface MissionListProps {
  missions: Mission[];
  activeMissionId: string | null;
  onSelectMission: (id: string) => void;
  onOpenCreate: () => void;
}

export const MissionList: React.FC<MissionListProps> = ({
  missions,
  activeMissionId,
  onSelectMission,
  onOpenCreate,
}) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Mission Registry & Status Ledger
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Operational mission records and terminal execution states
          </div>
        </div>

        <button
          onClick={onOpenCreate}
          className="px-3 py-1.5 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 transition-colors"
        >
          + New Mission
        </button>
      </div>

      {missions.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          No missions created yet.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-slate-400 font-mono">
                <th className="py-2.5 px-3">Mission ID</th>
                <th className="py-2.5 px-3">Name</th>
                <th className="py-2.5 px-3">Directive Description</th>
                <th className="py-2.5 px-3">Priority</th>
                <th className="py-2.5 px-3">Status</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {missions.map((m) => {
                const isSelected = m.id === activeMissionId;

                const statusColor =
                  m.status === 'COMPLETED'
                    ? 'text-emerald-400 font-medium'
                    : m.status === 'RUNNING'
                    ? 'text-indigo-400 font-medium'
                    : m.status === 'PLANNED'
                    ? 'text-sky-400'
                    : 'text-slate-400';

                return (
                  <tr
                    key={m.id}
                    className={`hover:bg-slate-800/40 transition-colors ${
                      isSelected ? 'bg-indigo-950/20' : ''
                    }`}
                  >
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {m.id}
                    </td>
                    <td className="py-3 px-3 font-semibold text-slate-100">
                      {m.name}
                    </td>
                    <td className="py-3 px-3 text-slate-300 max-w-xs truncate" title={m.description}>
                      {m.description}
                    </td>
                    <td className="py-3 px-3 font-mono text-slate-400">
                      {m.priority}
                    </td>
                    <td className="py-3 px-3 font-mono">
                      <span className={statusColor}>{m.status}</span>
                    </td>
                    <td className="py-3 px-3 text-right">
                      <button
                        onClick={() => onSelectMission(m.id)}
                        className={`px-2.5 py-1 rounded text-xs transition-colors ${
                          isSelected
                            ? 'bg-indigo-600 text-white font-medium'
                            : 'bg-slate-800 text-slate-300 hover:text-white'
                        }`}
                      >
                        {isSelected ? 'Active' : 'Select'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};
