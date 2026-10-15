/**
 * SwarmOS Recovery Engine
 * Handles agent failure detection, task recovery assessment, and controlled reassignment.
 * Reuses assignment engine and safety policies. Marks tasks and missions BLOCKED when no eligible replacement exists.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { TaskRecord, AgentRecord } from '../db/schema.ts';
import { agentRegistry } from './agent_registry.ts';
import { assignmentEngine } from './assignment_engine.ts';
import { eventHistory } from './event_history.ts';

export interface RecoveryOutcome {
  recovered: boolean;
  status: 'REASSIGNED' | 'BLOCKED';
  replacementAgentId?: string;
  reason: string;
}

export class RecoveryEngine {
  /**
   * Recovers from an agent or task failure.
   * If an eligible replacement agent is available, reassigns the task.
   * If no capable/available replacement exists, marks the task and mission BLOCKED with detailed explanation.
   */
  public handleTaskFailure(
    task: TaskRecord,
    failedAgent: AgentRecord,
    failureReason: string
  ): RecoveryOutcome {
    // 1. Mark task attempt as FAILED in database
    const now = new Date().toISOString();
    db.insertTaskAttempt({
      id: `att_fail_${Date.now()}`,
      task_id: task.id,
      agent_id: failedAgent.id,
      status: 'FAILED',
      started_at: task.updated_at,
      ended_at: now,
      failure_reason: failureReason,
    });

    eventHistory.log(
      'TASK_FAILED',
      {
        task_id: task.id,
        agent_id: failedAgent.id,
        failure_reason: failureReason,
        attempt: task.attempt_count,
      },
      task.mission_id,
      task.id,
      failedAgent.id
    );

    // 2. Mark the failed agent as FAILED in registry
    agentRegistry.updateAgentStatus(failedAgent.id, 'FAILED', null);

    // 3. Search for an eligible replacement agent
    // Transition task temporarily back to READY so assignment engine can evaluate candidates
    db.updateTask(task.id, {
      status: 'READY',
      assigned_agent_id: null,
    });
    const freshTask = db.getTask(task.id)!;

    const replacementAgent = assignmentEngine.assignTask(freshTask);

    if (replacementAgent) {
      const rationale = `Recovered: Reassigned from failed ${failedAgent.name} to ${replacementAgent.name}.`;
      db.updateTask(task.id, {
        assignment_rationale: rationale,
      });

      eventHistory.log(
        'TASK_ASSIGNED',
        {
          task_id: task.id,
          reassigned: true,
          previous_agent_id: failedAgent.id,
          replacement_agent_id: replacementAgent.id,
          recovery_rationale: rationale,
        },
        task.mission_id,
        task.id,
        replacementAgent.id
      );

      return {
        recovered: true,
        status: 'REASSIGNED',
        replacementAgentId: replacementAgent.id,
        reason: rationale,
      };
    } else {
      // 4. No replacement available: mark task and mission BLOCKED
      const blockedReason = `Mission blocked: Agent ${failedAgent.name} failed (${failureReason}), and no eligible replacement agent with capability '${task.required_capability}' is available in fleet.`;
      
      db.updateTask(task.id, {
        status: 'BLOCKED',
        assignment_rationale: blockedReason,
      });

      db.updateMissionStatus(task.mission_id, 'BLOCKED');

      eventHistory.log(
        'POLICY_EVALUATED',
        {
          allowed: false,
          policy: 'Recovery Policy',
          task_id: task.id,
          reason: blockedReason,
        },
        task.mission_id,
        task.id,
        failedAgent.id
      );

      return {
        recovered: false,
        status: 'BLOCKED',
        reason: blockedReason,
      };
    }
  }

  /**
   * Simulates an unexpected failure on a running or assigned agent.
   */
  public injectAgentFailure(agentId: string, reason: string = 'Hardware subsystem failure'): {
    affectedTasks: TaskRecord[];
    recoveryOutcomes: RecoveryOutcome[];
  } {
    const agent = agentRegistry.getAgent(agentId);
    if (!agent) throw new Error(`Agent ${agentId} not found.`);

    agentRegistry.updateAgentStatus(agentId, 'FAILED', null);

    eventHistory.log(
      'AGENT_STATUS_CHANGED',
      { agent_id: agentId, status: 'FAILED', reason },
      null,
      null,
      agentId
    );

    // Find any tasks currently ASSIGNED, DISPATCHED, or RUNNING with this agent
    const allMissions = db.getAllMissions();
    const affectedTasks: TaskRecord[] = [];
    const recoveryOutcomes: RecoveryOutcome[] = [];

    for (const m of allMissions) {
      if (m.status !== 'RUNNING' && m.status !== 'PLANNED') continue;
      const tasks = db.getMissionTasks(m.id);
      for (const t of tasks) {
        if (
          t.assigned_agent_id === agentId &&
          (t.status === 'ASSIGNED' || t.status === 'DISPATCHED' || t.status === 'RUNNING')
        ) {
          affectedTasks.push(t);
          const outcome = this.handleTaskFailure(t, agent, reason);
          recoveryOutcomes.push(outcome);
        }
      }
    }

    return { affectedTasks, recoveryOutcomes };
  }
}

export const recoveryEngine = new RecoveryEngine();
