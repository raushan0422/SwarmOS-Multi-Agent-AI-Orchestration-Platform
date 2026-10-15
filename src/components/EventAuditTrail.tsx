/**
 * SwarmOS Event Audit Trail
 * Records every mission assignment, policy rejection, status change, and execution milestone.
 * Clean typographic layout with tabular timestamps and domain-appropriate indicators.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { EventItem } from '../types/swarm.ts';

interface EventAuditTrailProps {
  events: EventItem[];
}

export const EventAuditTrail: React.FC<EventAuditTrailProps> = ({ events }) => {
  const [filter, setFilter] = useState<'all' | 'policies' | 'tasks'>('all');

  const filteredEvents = events.filter((e) => {
    if (filter === 'policies') {
      return e.event_type === 'POLICY_EVALUATED';
    }
    if (filter === 'tasks') {
      return (
        e.event_type.startsWith('TASK_') ||
        e.event_type === 'PLAN_GENERATED' ||
        e.event_type === 'MISSION_COMPLETED'
      );
    }
    return true;
  });

  const getEventBadgeColor = (type: string) => {
    if (type === 'POLICY_EVALUATED') return 'text-amber-400';
    if (type === 'TASK_COMPLETED' || type === 'MISSION_COMPLETED') return 'text-emerald-400';
    if (type === 'TASK_ASSIGNED' || type === 'TASK_DISPATCHED') return 'text-indigo-400';
    if (type.includes('FAIL') || type.includes('ERROR')) return 'text-rose-400';
    return 'text-slate-400';
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Immutable Event & Audit Ledger
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Cryptographic-ready operational telemetry & policy verification logs
          </div>
        </div>

        {/* Interactive Filter Tabs (functional segmented controls) */}
        <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg self-start sm:self-auto">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter === 'all'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            All Events
          </button>
          <button
            onClick={() => setFilter('policies')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter === 'policies'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Safety Checks
          </button>
          <button
            onClick={() => setFilter('tasks')}
            className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap ${
              filter === 'tasks'
                ? 'bg-slate-800 text-white shadow-sm'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            Execution
          </button>
        </div>
      </div>

      {filteredEvents.length === 0 ? (
        <div className="py-10 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          No audit records found for current filter.
        </div>
      ) : (
        <div className="divide-y divide-slate-800/80 max-h-[360px] overflow-y-auto pr-1">
          {filteredEvents.map((evt) => {
            const timeStr = new Date(evt.timestamp).toLocaleTimeString([], {
              hour12: false,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });

            return (
              <div key={evt.id} className="py-2.5 flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <span className="text-xs font-mono tabular-nums text-slate-500 pt-0.5 whitespace-nowrap">
                    {timeStr}
                  </span>

                  <div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs font-mono font-semibold ${getEventBadgeColor(
                          evt.event_type
                        )}`}
                      >
                        {evt.event_type}
                      </span>
                      {evt.agent_id && (
                        <span className="text-xs text-slate-400 font-mono">
                          [{evt.agent_id}]
                        </span>
                      )}
                    </div>

                    <div className="text-xs text-slate-300 mt-1">
                      {evt.event_type === 'POLICY_EVALUATED' && (
                        <span>
                          {evt.payload.allowed ? 'Passed' : 'Blocked'}:{' '}
                          {evt.payload.reason || evt.payload.policy || 'Evaluated'}
                        </span>
                      )}
                      {evt.event_type === 'TASK_ASSIGNED' && (
                        <span>
                          Assigned to {evt.payload.agent_name} (Score: {evt.payload.score}) ·{' '}
                          {Array.isArray(evt.payload.rationale)
                            ? evt.payload.rationale.join(', ')
                            : ''}
                        </span>
                      )}
                      {evt.event_type === 'PLAN_GENERATED' && (
                        <span>
                          Created {evt.payload.tasks_count} structured tasks (Plan v{evt.payload.plan_version})
                        </span>
                      )}
                      {evt.event_type === 'TASK_COMPLETED' && (
                        <span>
                          Completed at {evt.payload.zone}. Battery remaining: {evt.payload.battery_remaining}%
                        </span>
                      )}
                      {evt.event_type === 'MISSION_COMPLETED' && (
                        <span className="text-emerald-300 font-medium">
                          {evt.payload.execution_summary}
                        </span>
                      )}
                      {evt.event_type === 'MISSION_CREATED' && (
                        <span>Mission initialized: {evt.payload.name}</span>
                      )}
                      {evt.event_type === 'TASK_DISPATCHED' && (
                        <span>Dispatched to target: {evt.payload.target}</span>
                      )}
                      {evt.event_type === 'SYSTEM_RESET' && (
                        <span>System reset to initial clean seed state</span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="text-[11px] font-mono text-slate-500 shrink-0">
                  {evt.task_id ? evt.task_id.slice(-6) : ''}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
