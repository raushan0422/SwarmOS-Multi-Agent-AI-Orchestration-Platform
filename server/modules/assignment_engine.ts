/**
 * SwarmOS Assignment Engine
 * Matches ready tasks with eligible, available autonomous agents based on capabilities,
 * safety clearance, and multi-factor scoring (distance, duration, energy cost).
 * Explains every assignment decision and prevents conflicting assignments.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { AgentRecord, TaskRecord } from '../db/schema.ts';
import { agentRegistry } from './agent_registry.ts';
import { safetyEngine } from './safety_engine.ts';
import { eventHistory } from './event_history.ts';

export interface AssignmentCandidate {
  agent: AgentRecord;
  score: number;
  reasons: string[];
}

export class AssignmentEngine {
  /**
   * Finds the optimal capable agent for a given task, records rationale, and locks assignment.
   */
  public assignTask(task: TaskRecord): AgentRecord | null {
    if (task.status !== 'READY') {
      return null;
    }

    const availableAgents = agentRegistry.getAvailableAgents();
    const scoredCandidates: AssignmentCandidate[] = [];

    for (const agent of availableAgents) {
      // 1. Hard constraint: Safety & Capability check
      const safetyResult = safetyEngine.validateAssignment(task, agent, false);
      if (!safetyResult.allowed) {
        continue;
      }

      // 2. Multi-factor Cost & Efficiency Scoring
      let score = 100;
      const reasons: string[] = [`Capability '${task.required_capability}' verified`];

      // Energy Cost / Battery Reserve (higher battery gives higher score)
      const batteryScore = agent.battery_level * 0.4;
      score += batteryScore;
      reasons.push(`Battery: ${agent.battery_level}% (+${batteryScore.toFixed(0)} energy score)`);

      // Distance / Transit Cost
      if (agent.current_zone === task.target_zone) {
        score += 35;
        reasons.push(`Colocated in ${task.target_zone} (0m transit cost)`);
      } else {
        // Inter-zone transit cost penalty
        score += 10;
        reasons.push(`Transit required from ${agent.current_zone} to ${task.target_zone}`);
      }

      // Estimated Duration / Specialization Affinity
      if (task.type === 'INSPECT' && agent.type === 'drone') {
        score += 45;
        reasons.push('Specialized high-speed aerial sensor unit');
      } else if (
        (task.type === 'TRANSPORT' || task.type === 'DELIVERY' || task.type === 'PICKUP') &&
        agent.type === 'amr'
      ) {
        // Robot B vs Robot C specialization (payload vs speed)
        if (agent.capabilities.includes('heavy_payload')) {
          score += 30;
          reasons.push('High-torque heavy transport chassis');
        } else if (agent.capabilities.includes('rapid_transit')) {
          score += 28;
          reasons.push('High-agility rapid transit chassis');
        } else {
          score += 20;
          reasons.push('General mobile robot unit');
        }
      }

      scoredCandidates.push({ agent, score, reasons });
    }

    // No eligible agent found
    if (scoredCandidates.length === 0) {
      return null;
    }

    // Sort by descending score
    scoredCandidates.sort((a, b) => b.score - a.score);
    const chosen = scoredCandidates[0].agent;
    const rationale = scoredCandidates[0].reasons.join(' · ');

    // Atomic assignment & reservation lock to prevent conflicting assignments
    db.updateTask(task.id, {
      status: 'ASSIGNED',
      assigned_agent_id: chosen.id,
      assignment_rationale: rationale,
      attempt_count: task.attempt_count + 1,
    });

    agentRegistry.updateAgentStatus(chosen.id, 'BUSY', task.title);

    eventHistory.log(
      'TASK_ASSIGNED',
      {
        task_id: task.id,
        agent_id: chosen.id,
        agent_name: chosen.name,
        score: scoredCandidates[0].score,
        rationale: scoredCandidates[0].reasons,
      },
      task.mission_id,
      task.id,
      chosen.id
    );

    return chosen;
  }
}

export const assignmentEngine = new AssignmentEngine();
