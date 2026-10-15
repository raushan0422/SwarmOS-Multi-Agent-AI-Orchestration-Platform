/**
 * SwarmOS Mission Header & Control Toolbar - Phase 2
 * Displays mission details, progress metrics, execution triggers,
 * planning mode selector (Deterministic vs LLM-Assisted), and BLOCKED / COMPLETED outcome banners.
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { Mission, Task } from '../types/swarm.ts';

interface MissionHeaderProps {
  mission: Mission | null;
  tasks: Task[];
  isProcessing: boolean;
  onPlan: (preferLLM: boolean) => void;
  onStart: () => void;
  onStep: () => void;
  onPause: () => void;
  onReset: () => void;
}

export const MissionHeader: React.FC<MissionHeaderProps> = ({
  mission,
  tasks,
  isProcessing,
  onPlan,
  onStart,
  onStep,
  onPause,
  onReset,
}) => {
  const [useLLM, setUseLLM] = useState<boolean>(false);

  if (!mission) {
    return (
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 text-center">
        <h2 className="text-lg font-semibold text-slate-100">
          No Active Mission Initialized
        </h2>
        <p className="text-sm text-slate-400 mt-1">
          Select or create a mission to begin autonomous agent orchestration.
        </p>
      </div>
    );
  }

  const completedCount = tasks.filter((t) => t.status === 'COMPLETED').length;
  const progressPercent = tasks.length > 0 ? Math.round((completedCount / tasks.length) * 100) : 0;
  const blockedTask = tasks.find((t) => t.status === 'BLOCKED');

  const getStatusBadge = (status: Mission['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-400 bg-emerald-950/60 border border-emerald-800';
      case 'BLOCKED':
        return 'text-rose-400 bg-rose-950/60 border border-rose-800 font-bold';
      case 'RUNNING':
        return 'text-indigo-400 bg-indigo-950/60 border border-indigo-700 animate-pulse';
      case 'PLANNED':
        return 'text-sky-400 bg-sky-950/60 border border-sky-800';
      case 'PAUSED':
        return 'text-amber-400 bg-amber-950/60 border border-amber-800';
      default:
        return 'text-slate-400 bg-slate-900 border border-slate-800';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col gap-4">
      {/* Top row: Mission Title & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-bold text-slate-100">
              {mission.name}
            </h1>
            <span
              className={`text-xs font-mono font-medium px-2 py-0.5 rounded ${getStatusBadge(
                mission.status
              )}`}
            >
              {mission.status}
            </span>
          </div>

          <p className="text-sm text-slate-300 mt-1 max-w-3xl">
            "{mission.description}"
          </p>

          <div className="flex items-center gap-3 text-xs text-slate-400 mt-2 font-mono">
            <span>ID: {mission.id}</span>
            <span aria-hidden="true">·</span>
            <span>Priority: {mission.priority}</span>
            <span aria-hidden="true">·</span>
            <span>Plan Version: {mission.plan_version}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Created: {new Date(mission.created_at).toLocaleTimeString()}</span>
          </div>
        </div>

        {/* Action Controls & Planner Selection */}
        <div className="flex items-center gap-2 flex-wrap">
          {mission.status === 'DRAFT' && (
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer bg-slate-950 border border-slate-800 px-2.5 py-1.5 rounded-lg">
                <input
                  type="checkbox"
                  checked={useLLM}
                  onChange={(e) => setUseLLM(e.target.checked)}
                  className="rounded border-slate-700 text-indigo-600 focus:ring-0"
                />
                <span>LLM-Assisted</span>
              </label>

              <button
                onClick={() => onPlan(useLLM)}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-indigo-600 rounded-lg hover:bg-indigo-500 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Plan Mission
              </button>
            </div>
          )}

          {(mission.status === 'PLANNED' || mission.status === 'PAUSED') && (
            <>
              <button
                onClick={onStart}
                disabled={isProcessing}
                className="px-3.5 py-2 text-xs font-semibold text-white bg-emerald-600 rounded-lg hover:bg-emerald-500 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Start Execution
              </button>
              <button
                onClick={onStep}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Step Next
              </button>
            </>
          )}

          {mission.status === 'RUNNING' && (
            <>
              <button
                onClick={onStep}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 rounded-lg border border-slate-700 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Step Next
              </button>
              <button
                onClick={onPause}
                disabled={isProcessing}
                className="px-3 py-2 text-xs font-medium text-amber-200 bg-amber-950/70 border border-amber-800 rounded-lg hover:bg-amber-900/80 disabled:opacity-50 transition-colors whitespace-nowrap"
              >
                Pause
              </button>
            </>
          )}

          <button
            onClick={onReset}
            disabled={isProcessing}
            className="px-3 py-2 text-xs font-medium text-slate-400 bg-slate-950 hover:bg-slate-800 hover:text-slate-200 rounded-lg border border-slate-800 transition-colors whitespace-nowrap"
            title="Reset system to clean seed state"
          >
            Reset System
          </button>
        </div>
      </div>

      {/* Prominent Mission Completion Outcome Display */}
      {mission.status === 'COMPLETED' && (
        <div className="bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-3 text-xs flex items-center justify-between text-emerald-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-emerald-400">MISSION COMPLETED:</span>
            <span>All {tasks.length} objectives safely executed without policy violations.</span>
          </div>
          <span className="font-mono text-emerald-400">100% Success</span>
        </div>
      )}

      {/* Prominent Mission Blocked Outcome Display */}
      {mission.status === 'BLOCKED' && (
        <div className="bg-rose-950/50 border border-rose-800 rounded-lg p-3.5 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-rose-200">
          <div className="flex items-center gap-2">
            <span className="font-bold text-rose-400 uppercase tracking-wide">Mission Blocked:</span>
            <span>
              {blockedTask?.assignment_rationale ||
                'Agent failure detected and no eligible replacement agent exists in fleet.'}
            </span>
          </div>
          <button
            onClick={onReset}
            className="px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 border border-rose-700 text-rose-100 text-xs font-medium transition-colors self-start sm:self-auto shrink-0"
          >
            Reset Fleet
          </button>
        </div>
      )}

      {/* Progress Bar */}
      {tasks.length > 0 && (
        <div className="pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5 font-mono">
            <span>Execution Progress</span>
            <span className="tabular-nums text-slate-200">
              {completedCount} / {tasks.length} tasks completed ({progressPercent}%)
            </span>
          </div>
          <div className="w-full bg-slate-950 rounded-full h-2 overflow-hidden border border-slate-800/80">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                mission.status === 'COMPLETED'
                  ? 'bg-emerald-500'
                  : mission.status === 'BLOCKED'
                  ? 'bg-rose-500'
                  : 'bg-indigo-500'
              }`}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
};
