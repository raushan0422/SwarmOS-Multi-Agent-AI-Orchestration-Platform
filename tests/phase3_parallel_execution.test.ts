/**
 * SwarmOS Phase 3 Feature A - Parallel Task Execution Tests
 * Validates:
 * - Independent ready tasks run concurrently
 * - Agent and resource reservations prevent conflicts
 * - Downstream join-tasks respect all multi-task dependencies
 * - Both tasks complete safely without race conditions
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db/database.ts';
import { agentRegistry } from '../server/modules/agent_registry.ts';
import { missionPlanner } from '../server/modules/mission_planner.ts';
import { taskPlanner } from '../server/modules/task_planner.ts';
import { assignmentEngine } from '../server/modules/assignment_engine.ts';
import { executionCoordinator } from '../server/modules/execution_coordinator.ts';
import { MissionRecord } from '../server/db/schema.ts';

test('P3-FA1: Planner structures independent parallel tasks with a join dependency barrier', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_parallel_test',
    name: 'Concurrent Operations Mission',
    description: 'Simultaneous Operations: Inspect Zone A and concurrently stage cargo in Zone B, then deliver to Dispatch.',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);

  const { tasks } = await missionPlanner.planMission(mission, false);
  assert.equal(tasks.length, 3, 'Must create 3 tasks (2 parallel + 1 join)');

  // Task 1 and Task 2 are independent
  const task1Deps = db.getTaskDependencies(tasks[0].id);
  const task2Deps = db.getTaskDependencies(tasks[1].id);
  assert.equal(task1Deps.length, 0, 'Task 1 must have 0 dependencies');
  assert.equal(task2Deps.length, 0, 'Task 2 must have 0 dependencies');

  // Task 3 is a join task depending on both
  const task3Deps = db.getTaskDependencies(tasks[2].id);
  assert.equal(task3Deps.length, 2, 'Task 3 must depend on both Task 1 and Task 2');
  assert.ok(task3Deps.includes(tasks[0].id));
  assert.ok(task3Deps.includes(tasks[1].id));
});

test('P3-FA2: Independent tasks become READY concurrently without prematurely unlocking join task', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_parallel_ready',
    name: 'Concurrent Readiness Test',
    description: 'Simultaneous Operations: Inspect Zone A and concurrently stage cargo in Zone B, then deliver to Dispatch.',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);
  const { tasks } = await missionPlanner.planMission(mission, false);

  // Initial ready evaluation: both Task 1 and Task 2 should be READY simultaneously
  const readyTasks = taskPlanner.evaluateReadyTasks(mission.id);
  assert.equal(readyTasks.length, 2, 'Both independent tasks must be READY simultaneously');
  const readyIds = readyTasks.map((t) => t.id);
  assert.ok(readyIds.includes(tasks[0].id));
  assert.ok(readyIds.includes(tasks[1].id));

  // Join Task 3 must remain PENDING
  const task3 = db.getTask(tasks[2].id)!;
  assert.equal(task3.status, 'PENDING');
});

test('P3-FA3: Concurrent assignment locks distinct agents and prevents double-booking', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_parallel_assign',
    name: 'Concurrent Assignment Test',
    description: 'Simultaneous Operations: Inspect Zone A and concurrently stage cargo in Zone B, then deliver to Dispatch.',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);
  const { tasks } = await missionPlanner.planMission(mission, false);
  taskPlanner.evaluateReadyTasks(mission.id);

  // Assign Task 1
  const ready1 = db.getTask(tasks[0].id)!;
  const agent1 = assignmentEngine.assignTask(ready1);
  assert.ok(agent1, 'Agent 1 must be assigned');
  assert.equal(agent1?.id, 'agent_drone_a', 'Drone A assigned to inspection');

  // Drone A is now locked to BUSY
  assert.equal(agentRegistry.getAgent('agent_drone_a')?.status, 'BUSY');

  // Assign Task 2 concurrently
  const ready2 = db.getTask(tasks[1].id)!;
  const agent2 = assignmentEngine.assignTask(ready2);
  assert.ok(agent2, 'Agent 2 must be assigned');
  assert.notEqual(agent2?.id, agent1?.id, 'Agent 2 must be distinct from Agent 1 (no double booking)');
  assert.ok(agent2?.id.startsWith('agent_robot'), 'Robot assigned to ground transport');

  // Both agents are now BUSY
  assert.equal(agentRegistry.getAgent(agent2!.id)?.status, 'BUSY');
});

test('P3-FA4: Execution Coordinator dispatches and runs independent tasks in parallel to full completion', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_parallel_e2e',
    name: 'Concurrent Execution E2E',
    description: 'Simultaneous Operations: Inspect Zone A and concurrently stage cargo in Zone B, then deliver to Dispatch.',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);
  const { tasks } = await missionPlanner.planMission(mission, false);
  db.updateMissionStatus(mission.id, 'RUNNING');

  // Tick 1: Both Task 1 and Task 2 are dispatched concurrently in the SAME tick
  const tick1 = await executionCoordinator.tickMission(mission.id);
  assert.equal(tick1.dispatchedTasksCount, 2, 'Must dispatch exactly 2 tasks concurrently in tick 1');

  // After tick 1, both Task 1 and Task 2 must be COMPLETED
  const tasksAfterTick1 = db.getMissionTasks(mission.id);
  assert.equal(tasksAfterTick1[0].status, 'COMPLETED');
  assert.equal(tasksAfterTick1[1].status, 'COMPLETED');

  // Now Join Task 3 is unlocked
  const tick2 = await executionCoordinator.tickMission(mission.id);
  assert.equal(tick2.dispatchedTasksCount, 1, 'Join Task 3 must dispatch in tick 2');
  assert.equal(tick2.completed, true, 'Mission must reach COMPLETED state');

  const finalMission = db.getMission(mission.id)!;
  assert.equal(finalMission.status, 'COMPLETED');
});
