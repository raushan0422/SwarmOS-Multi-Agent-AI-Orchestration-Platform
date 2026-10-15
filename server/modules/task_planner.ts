/**
 * SwarmOS Task Planner & Dependency Validation Engine
 * Evaluates prerequisite DAG, detects dependency cycles, and identifies ready tasks.
 * Prevents dependent tasks from starting before prerequisites are COMPLETED.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { TaskRecord, TaskDependencyRecord } from '../db/schema.ts';
import { eventHistory } from './event_history.ts';

export class TaskPlanner {
  /**
   * Detects whether a set of tasks and dependencies contains any circular references.
   * Returns true if a cycle is detected, along with the cycle path.
   */
  public detectCycles(
    taskIds: string[],
    dependencies: TaskDependencyRecord[]
  ): { hasCycle: boolean; cyclePath?: string[] } {
    const adjList = new Map<string, string[]>();
    for (const id of taskIds) {
      adjList.set(id, []);
    }
    for (const dep of dependencies) {
      if (adjList.has(dep.task_id)) {
        adjList.get(dep.task_id)!.push(dep.depends_on_task_id);
      }
    }

    const visited = new Set<string>();
    const recStack = new Set<string>();
    const path: string[] = [];

    const dfs = (node: string): boolean => {
      visited.add(node);
      recStack.add(node);
      path.push(node);

      const neighbors = adjList.get(node) || [];
      for (const neighbor of neighbors) {
        if (!visited.has(neighbor)) {
          if (dfs(neighbor)) return true;
        } else if (recStack.has(neighbor)) {
          path.push(neighbor);
          return true;
        }
      }

      recStack.delete(node);
      path.pop();
      return false;
    };

    for (const id of taskIds) {
      if (!visited.has(id)) {
        if (dfs(id)) {
          return { hasCycle: true, cyclePath: path };
        }
      }
    }

    return { hasCycle: false };
  }

  /**
   * Evaluates all tasks in a mission and marks tasks with satisfied dependencies as READY.
   * Independent tasks with no uncompleted prerequisites are simultaneously made READY.
   */
  public evaluateReadyTasks(missionId: string): TaskRecord[] {
    const tasks = db.getMissionTasks(missionId);
    const readyTasks: TaskRecord[] = [];

    for (const task of tasks) {
      if (task.status !== 'PENDING') {
        continue;
      }

      const dependencyIds = db.getTaskDependencies(task.id);
      let allPrerequisitesMet = true;

      for (const depId of dependencyIds) {
        const depTask = db.getTask(depId);
        if (!depTask || depTask.status !== 'COMPLETED') {
          allPrerequisitesMet = false;
          break;
        }
      }

      if (allPrerequisitesMet) {
        db.updateTask(task.id, { status: 'READY' });
        const updated = db.getTask(task.id)!;
        readyTasks.push(updated);
        eventHistory.log('TASK_READY', { task_id: task.id, title: task.title }, missionId, task.id);
      }
    }

    return readyTasks;
  }

  /**
   * Check if a specific task has all its dependencies satisfied.
   */
  public isTaskExecutable(taskId: string): boolean {
    const dependencies = db.getTaskDependencies(taskId);
    for (const depId of dependencies) {
      const depTask = db.getTask(depId);
      if (!depTask || depTask.status !== 'COMPLETED') {
        return false;
      }
    }
    return true;
  }
}

export const taskPlanner = new TaskPlanner();
