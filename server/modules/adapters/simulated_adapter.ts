/**
 * SwarmOS Simulated Agent Adapter
 * Executes tasks for simulated Drone and Autonomous Mobile Robots (AMRs) in the virtual warehouse.
 * Revalidates safety immediately before dispatch, handles execution feedback,
 * logs attempt history, and detects injected mid-execution failures.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { db } from '../../db/database.ts';
import { AgentRecord, TaskRecord } from '../../db/schema.ts';
import { AgentAdapter, ExecutionFeedback } from './agent_adapter.ts';
import { agentRegistry } from '../agent_registry.ts';
import { eventHistory } from '../event_history.ts';
import { safetyEngine } from '../safety_engine.ts';

export class SimulatedAdapter implements AgentAdapter {
  public adapterType = 'simulator';
  private runningTasks = new Map<string, NodeJS.Timeout>();

  public async dispatchTask(
    task: TaskRecord,
    agent: AgentRecord,
    onProgress?: (feedback: ExecutionFeedback) => void
  ): Promise<boolean> {
    const attemptId = `att_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const startTime = new Date().toISOString();

    // 1. Pre-dispatch Safety Revalidation
    const preDispatchCheck = safetyEngine.validateAssignment(task, agent, true);
    if (!preDispatchCheck.allowed) {
      db.updateTask(task.id, {
        status: 'BLOCKED',
        assignment_rationale: `Dispatch blocked: ${preDispatchCheck.reason}`,
      });
      return false;
    }

    // 2. Acknowledge and mark DISPATCHED
    db.updateTask(task.id, { status: 'DISPATCHED' });
    eventHistory.log(
      'TASK_DISPATCHED',
      { task_id: task.id, agent_id: agent.id, target: task.target_zone },
      task.mission_id,
      task.id,
      agent.id
    );

    onProgress?.({
      taskId: task.id,
      agentId: agent.id,
      status: 'ACKNOWLEDGED',
      progressPercent: 10,
      currentZone: agent.current_zone,
      batteryLevel: agent.battery_level,
      message: `${agent.name} acknowledged dispatch order.`,
    });

    // 3. Transition to RUNNING
    await this.delay(600);

    // Verify agent didn't fail during acknowledge
    const currentAgentState = agentRegistry.getAgent(agent.id);
    if (!currentAgentState || currentAgentState.status === 'FAILED') {
      return false;
    }

    db.updateTask(task.id, { status: 'RUNNING' });
    eventHistory.log(
      'TASK_STARTED',
      { task_id: task.id, agent_id: agent.id, action: task.type },
      task.mission_id,
      task.id,
      agent.id
    );

    // 4. Simulate transit & work execution towards target zone
    await this.delay(1200);

    // Check again for mid-task failure injection
    const midState = agentRegistry.getAgent(agent.id);
    if (!midState || midState.status === 'FAILED') {
      return false;
    }

    const newBattery = Math.max(5, agent.battery_level - (agent.type === 'drone' ? 3 : 2));
    agentRegistry.updateAgentLocation(agent.id, task.target_zone);
    agentRegistry.updateAgentBattery(agent.id, newBattery);

    onProgress?.({
      taskId: task.id,
      agentId: agent.id,
      status: 'EXECUTING',
      progressPercent: 75,
      currentZone: task.target_zone,
      batteryLevel: newBattery,
      message: `${agent.name} reached ${task.target_zone} and executing action.`,
    });

    // 5. Complete Task
    await this.delay(1000);

    const finalState = agentRegistry.getAgent(agent.id);
    if (!finalState || finalState.status === 'FAILED') {
      return false;
    }

    db.updateTask(task.id, { status: 'COMPLETED' });
    agentRegistry.updateAgentStatus(agent.id, 'AVAILABLE', null);

    db.insertTaskAttempt({
      id: attemptId,
      task_id: task.id,
      agent_id: agent.id,
      status: 'SUCCESS',
      started_at: startTime,
      ended_at: new Date().toISOString(),
      failure_reason: null,
    });

    eventHistory.log(
      'TASK_COMPLETED',
      {
        task_id: task.id,
        agent_id: agent.id,
        battery_remaining: newBattery,
        zone: task.target_zone,
      },
      task.mission_id,
      task.id,
      agent.id
    );

    onProgress?.({
      taskId: task.id,
      agentId: agent.id,
      status: 'COMPLETED',
      progressPercent: 100,
      currentZone: task.target_zone,
      batteryLevel: newBattery,
      message: `${agent.name} successfully completed task ${task.title}.`,
    });

    return true;
  }

  public async cancelTask(taskId: string): Promise<boolean> {
    const timer = this.runningTasks.get(taskId);
    if (timer) {
      clearTimeout(timer);
      this.runningTasks.delete(taskId);
    }
    db.updateTask(taskId, { status: 'CANCELLED' });
    return true;
  }

  public async pingAgent(agentId: string): Promise<boolean> {
    const agent = agentRegistry.getAgent(agentId);
    return agent !== null && agent.status !== 'OFFLINE' && agent.status !== 'FAILED';
  }

  private delay(ms: number): Promise<void> {
    const duration = process.env.NODE_ENV === 'test' ? 15 : ms;
    return new Promise((resolve) => setTimeout(resolve, duration));
  }
}

export const simulatedAdapter = new SimulatedAdapter();
