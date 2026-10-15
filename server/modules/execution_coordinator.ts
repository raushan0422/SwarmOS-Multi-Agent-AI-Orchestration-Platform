/**
 * SwarmOS Execution Coordinator
 * Dispatches ready tasks, enforces dependency rules, handles parallel execution
 * for independent tasks, and triggers recovery upon failure.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { taskPlanner } from './task_planner.ts';
import { assignmentEngine } from './assignment_engine.ts';
import { simulatedAdapter } from './adapters/simulated_adapter.ts';
import { recoveryEngine } from './recovery_engine.ts';
import { eventHistory } from './event_history.ts';

export class ExecutionCoordinator {
  private activeMissions = new Set<string>();

  /**
   * Starts or resumes a mission lifecycle.
   */
  public async startMission(missionId: string, runToEnd: boolean = true): Promise<void> {
    const mission = db.getMission(missionId);
    if (!mission) throw new Error(`Mission ${missionId} not found`);

    db.updateMissionStatus(missionId, 'RUNNING');
    this.activeMissions.add(missionId);

    if (runToEnd) {
      this.runExecutionLoop(missionId).catch((err) => {
        console.error(`Error in execution loop for ${missionId}:`, err);
      });
    }
  }

  /**
   * Runs one deterministic tick of the execution engine.
   * Dispatches ready tasks (concurrently for independent tasks with available agents).
   */
  public async tickMission(missionId: string): Promise<{
    readyTasksCount: number;
    dispatchedTasksCount: number;
    completed: boolean;
    blocked: boolean;
  }> {
    const mission = db.getMission(missionId);
    if (!mission || mission.status === 'PAUSED' || mission.status === 'CANCELLED' || mission.status === 'BLOCKED') {
      return { readyTasksCount: 0, dispatchedTasksCount: 0, completed: false, blocked: mission?.status === 'BLOCKED' };
    }

    // 1. Evaluate prerequisites and mark satisfied PENDING tasks as READY
    taskPlanner.evaluateReadyTasks(missionId);

    // 2. Retrieve all currently READY tasks
    const readyTasks = db.getMissionTasks(missionId).filter((t) => t.status === 'READY');

    // 3. Assign and dispatch ready tasks
    let dispatchedCount = 0;
    const dispatchPromises: Promise<boolean>[] = [];

    for (const task of readyTasks) {
      const assignedAgent = assignmentEngine.assignTask(task);
      if (assignedAgent) {
        dispatchedCount++;
        const freshTask = db.getTask(task.id)!;
        
        // Dispatch task via simulated adapter
        const p = simulatedAdapter.dispatchTask(freshTask, assignedAgent).then((success) => {
          if (!success) {
            // Task failed during dispatch or execution
            const currentTask = db.getTask(freshTask.id)!;
            if (currentTask.status !== 'COMPLETED') {
              recoveryEngine.handleTaskFailure(
                currentTask,
                assignedAgent,
                'Execution failure or agent unavailable'
              );
            }
          }
          return success;
        });
        dispatchPromises.push(p);
      } else {
        // No capable/available agent for this ready task right now
        // Check if ANY agent in fleet even possesses the capability
        const allAgents = db.getAllAgents();
        const capableAgentExists = allAgents.some(
          (a) => a.capabilities.includes(task.required_capability) && a.status !== 'FAILED'
        );

        if (!capableAgentExists) {
          const reason = `No capable fleet agent exists for task '${task.title}' requiring '${task.required_capability}'.`;
          db.updateTask(task.id, { status: 'BLOCKED', assignment_rationale: reason });
          db.updateMissionStatus(missionId, 'BLOCKED');
        }
      }
    }

    // Await current tick's dispatches
    if (dispatchPromises.length > 0) {
      await Promise.all(dispatchPromises);
    }

    // 4. Check overall mission completion
    const allTasks = db.getMissionTasks(missionId);
    const hasBlocked = allTasks.some((t) => t.status === 'BLOCKED');
    const allDone = allTasks.length > 0 && allTasks.every((t) => t.status === 'COMPLETED');

    if (hasBlocked) {
      db.updateMissionStatus(missionId, 'BLOCKED');
      this.activeMissions.delete(missionId);
    } else if (allDone) {
      db.updateMissionStatus(missionId, 'COMPLETED');
      this.activeMissions.delete(missionId);
      eventHistory.log(
        'MISSION_COMPLETED',
        {
          mission_id: missionId,
          total_tasks: allTasks.length,
          execution_summary: 'All planned objectives completed safely.',
        },
        missionId
      );
    }

    return {
      readyTasksCount: readyTasks.length,
      dispatchedTasksCount: dispatchedCount,
      completed: allDone,
      blocked: hasBlocked,
    };
  }

  /**
   * Background runner that loops until mission completes, pauses, or blocks.
   */
  private async runExecutionLoop(missionId: string): Promise<void> {
    while (this.activeMissions.has(missionId)) {
      const mission = db.getMission(missionId);
      if (!mission || mission.status !== 'RUNNING') {
        this.activeMissions.delete(missionId);
        break;
      }

      const result = await this.tickMission(missionId);
      if (result.completed || result.blocked) {
        this.activeMissions.delete(missionId);
        break;
      }

      await new Promise((resolve) => setTimeout(resolve, 500));
    }
  }

  public pauseMission(missionId: string): void {
    this.activeMissions.delete(missionId);
    db.updateMissionStatus(missionId, 'PAUSED');
    eventHistory.log('MISSION_PAUSED', { mission_id: missionId }, missionId);
  }

  public cancelMission(missionId: string): void {
    this.activeMissions.delete(missionId);
    db.updateMissionStatus(missionId, 'CANCELLED');
    const tasks = db.getMissionTasks(missionId);
    for (const t of tasks) {
      if (t.status !== 'COMPLETED') {
        db.updateTask(t.id, { status: 'CANCELLED' });
      }
    }
  }
}

export const executionCoordinator = new ExecutionCoordinator();
