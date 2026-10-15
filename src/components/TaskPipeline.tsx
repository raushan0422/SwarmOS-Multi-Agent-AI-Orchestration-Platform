/**
 * SwarmOS Task Pipeline & Dependency Flow
 * Visualizes structured tasks, dependency ordering, execution states,
 * and transparent assignment decisions / rationale.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Task, TaskDependency, Agent } from '../types/swarm.ts';

interface TaskPipelineProps {
  tasks: Task[];
  dependencies: TaskDependency[];
  agents: Agent[];
}

export const TaskPipeline: React.FC<TaskPipelineProps> = ({
  tasks,
  dependencies,
  agents,
}) => {
  const getAgentName = (agentId: string | null) => {
    if (!agentId) return 'Unassigned';
    const found = agents.find((a) => a.id === agentId);
    return found ? `${found.name} (${found.type})` : agentId;
  };

  const getDependencyTitles = (taskId: string) => {
    const parentIds = dependencies
      .filter((d) => d.task_id === taskId)
      .map((d) => d.depends_on_task_id);

    return parentIds
      .map((pId) => {
        const parentTask = tasks.find((t) => t.id === pId);
        return parentTask ? parentTask.title : pId;
      })
      .filter(Boolean);
  };

  const getStatusColor = (status: Task['status']) => {
    switch (status) {
      case 'COMPLETED':
        return 'text-emerald-400 border-emerald-800/80 bg-emerald-950/40';
      case 'RUNNING':
      case 'DISPATCHED':
        return 'text-indigo-400 border-indigo-700/80 bg-indigo-950/40';
      case 'ASSIGNED':
      case 'READY':
        return 'text-amber-400 border-amber-800/80 bg-amber-950/40';
      case 'PENDING':
        return 'text-slate-400 border-slate-800 bg-slate-900/40';
      case 'FAILED':
      case 'BLOCKED':
        return 'text-rose-400 border-rose-800/80 bg-rose-950/40';
      default:
        return 'text-slate-400 border-slate-800 bg-slate-900/40';
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Task Execution Pipeline & Prerequisites
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Deterministic DAG evaluation · Explainable capability assignments
          </div>
        </div>

        <div className="text-xs font-mono tabular-nums text-slate-400">
          {tasks.filter((t) => t.status === 'COMPLETED').length} / {tasks.length} Completed
        </div>
      </div>

      {tasks.length === 0 ? (
        <div className="py-12 text-center text-slate-500 text-sm border border-dashed border-slate-800 rounded-lg">
          No tasks planned yet. Click "Plan Mission" to convert the mission prompt into structured tasks.
        </div>
      ) : (
        <div className="space-y-3">
          {tasks.map((task, index) => {
            const deps = getDependencyTitles(task.id);
            const statusStyle = getStatusColor(task.status);
            const assignedName = getAgentName(task.assigned_agent_id);

            return (
              <div
                key={task.id}
                className="bg-slate-950 border border-slate-800 rounded-lg p-4 flex flex-col md:flex-row md:items-start justify-between gap-4 transition-all"
              >
                {/* Left: Step index, Title, Description */}
                <div className="flex items-start gap-3.5 flex-1">
                  <span className="font-mono text-xs font-semibold text-slate-500 mt-0.5 w-6">
                    0{index + 1}.
                  </span>

                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h4 className="text-sm font-semibold text-slate-100">
                        {task.title}
                      </h4>
                      <span className="text-xs font-mono text-slate-400">
                        ({task.type})
                      </span>
                    </div>

                    {/* Metadata line */}
                    <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1 font-mono">
                      <span>Target: {task.target_zone}</span>
                      <span aria-hidden="true">·</span>
                      <span>Required: {task.required_capability}</span>
                      <span aria-hidden="true">·</span>
                      <span>Attempts: {task.attempt_count}</span>
                    </div>

                    {/* Prerequisite info */}
                    {deps.length > 0 && (
                      <div className="text-xs text-slate-400 mt-1">
                        <span className="text-slate-500">Prerequisite:</span> {deps.join(', ')}
                      </div>
                    )}

                    {/* Assignment Explanation / Rationale */}
                    {task.assignment_rationale && (
                      <div className="text-xs text-indigo-300/90 mt-2 bg-indigo-950/30 border border-indigo-900/40 rounded px-2.5 py-1.5">
                        <span className="text-indigo-400 font-medium">Assignment Decision:</span>{' '}
                        {task.assignment_rationale}
                      </div>
                    )}
                  </div>
                </div>

                {/* Right: Assigned Agent & Status Indicator */}
                <div className="flex items-center gap-4 self-end md:self-start shrink-0">
                  <div className="text-right">
                    <div className="text-xs text-slate-500">Assigned Machine</div>
                    <div className="text-xs font-semibold text-slate-200">
                      {assignedName}
                    </div>
                  </div>

                  <div
                    className={`px-3 py-1 rounded text-xs font-mono font-medium border ${statusStyle}`}
                  >
                    {task.status}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
