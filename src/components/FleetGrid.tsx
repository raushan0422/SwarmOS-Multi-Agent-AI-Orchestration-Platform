/**
 * SwarmOS Fleet Grid - Phase 2
 * Displays autonomous agent fleet (Drone A, Robot B, Robot C) status, capabilities,
 * battery health, current zone, and current assigned task.
 * Includes failure injection simulator controls for live recovery testing.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Agent } from '../types/swarm.ts';

interface FleetGridProps {
  agents: Agent[];
  onInjectFailure?: (agentId: string) => Promise<void>;
  onRefresh?: () => void;
}

export const FleetGrid: React.FC<FleetGridProps> = ({ agents, onInjectFailure }) => {
  const [failingAgentId, setFailingAgentId] = useState<string | null>(null);

  const handleFailClick = async (agentId: string) => {
    if (!onInjectFailure) return;
    setFailingAgentId(agentId);
    try {
      await onInjectFailure(agentId);
    } finally {
      setFailingAgentId(null);
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Autonomous Fleet Registry
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Heterogeneous multi-agent coordination · Failure simulation controls
          </div>
        </div>
        <div className="text-xs font-mono tabular-nums text-slate-400">
          {agents.length} Registered Units
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {agents.map((agent) => {
          const isDrone = agent.type === 'drone';
          const isAvailable = agent.status === 'AVAILABLE';
          const isBusy = agent.status === 'BUSY';
          const isFailed = agent.status === 'FAILED';

          return (
            <div
              key={agent.id}
              className={`bg-slate-950 border rounded-lg p-4 flex flex-col justify-between transition-colors ${
                isFailed ? 'border-rose-900/80 bg-rose-950/10' : 'border-slate-800 hover:border-slate-700'
              }`}
            >
              {/* Agent Title & Type */}
              <div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{isDrone ? '🚁' : '🤖'}</span>
                    <div>
                      <h3 className="text-sm font-semibold text-slate-100">
                        {agent.name}
                      </h3>
                      <div className="text-xs text-slate-500 font-mono">
                        ID: {agent.id}
                      </div>
                    </div>
                  </div>

                  <span
                    className={`text-xs font-mono font-medium ${
                      isAvailable
                        ? 'text-emerald-400'
                        : isBusy
                        ? 'text-indigo-400'
                        : 'text-rose-400'
                    }`}
                  >
                    {agent.status}
                  </span>
                </div>

                {/* Capabilities — clean unboxed metadata */}
                <div className="mt-3 pt-3 border-t border-slate-800/80">
                  <div className="text-xs text-slate-400 mb-0.5">Capabilities</div>
                  <div className="text-xs font-mono text-slate-300">
                    {agent.capabilities.join(' · ')}
                  </div>
                </div>

                {/* Current Location & Current Task */}
                <div className="mt-2.5 grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <div className="text-slate-500 mb-0.5">Current Zone</div>
                    <div className="font-medium text-slate-200">
                      {agent.current_zone}
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500 mb-0.5">Current Task</div>
                    <div className="font-medium text-slate-200 truncate" title={agent.current_task || 'Idle'}>
                      {agent.current_task || 'Idle / None'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Battery Level & Failure Trigger */}
              <div className="mt-4 pt-3 border-t border-slate-800/80 flex flex-col gap-2.5">
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
                    <span>Battery</span>
                    <span className="font-mono tabular-nums text-slate-200 font-medium">
                      {agent.battery_level}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                    <div
                      className={`h-full transition-all duration-500 ${
                        agent.battery_level > 50
                          ? 'bg-emerald-500'
                          : agent.battery_level > 20
                          ? 'bg-amber-500'
                          : 'bg-rose-500'
                      }`}
                      style={{ width: `${agent.battery_level}%` }}
                    />
                  </div>
                </div>

                {/* Failure Injection Button */}
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[11px] text-slate-500 font-mono">
                    {agent.adapter_type}
                  </span>

                  {!isFailed ? (
                    <button
                      onClick={() => handleFailClick(agent.id)}
                      disabled={failingAgentId === agent.id}
                      className="px-2 py-1 text-[11px] font-medium text-rose-300 hover:text-rose-100 bg-rose-950/40 hover:bg-rose-900/60 border border-rose-800/50 rounded transition-colors"
                      title="Simulate hardware failure to test recovery engine"
                    >
                      {failingAgentId === agent.id ? 'Simulating...' : 'Inject Failure'}
                    </button>
                  ) : (
                    <span className="text-[11px] font-mono text-rose-400 font-semibold">
                      FAULT DETECTED
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
