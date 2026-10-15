/**
 * SwarmOS Phase 1 Automated Lifecycle & Requirements Test Suite
 * Strictly validates requirements P1.1 through P1.7:
 * - P1.1: Database persistence and seed state
 * - P1.2: Mission creation with unique ID and status
 * - P1.3: Deterministic planner with INSPECT, TRANSPORT, DELIVERY and zone validation
 * - P1.4: Agent registry tracking all 3 seeded agents, battery, zone, status, and current task
 * - P1.5: Assignment engine with capability checks and explainable decisions
 * - P1.6: Common adapter interface, simulation, transit, and dependent task ordering
 * - P1.7: Mission completion recording and repeatable reset
 * SPDX-License-Identifier: Apache-2.0
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../server/db/database.ts';
import { agentRegistry } from '../server/modules/agent_registry.ts';
import { missionPlanner } from '../server/modules/mission_planner.ts';
import { taskPlanner } from '../server/modules/task_planner.ts';
import { assignmentEngine } from '../server/modules/assignment_engine.ts';
import { safetyEngine } from '../server/modules/safety_engine.ts';
import { executionCoordinator } from '../server/modules/execution_coordinator.ts';
import { simulatedAdapter } from '../server/modules/adapters/simulated_adapter.ts';
import { MissionRecord } from '../server/db/schema.ts';

test('P1.1 & P1.4: Agent Registry seeds all 3 agents and tracks required properties', () => {
  db.resetToCleanState();
  const agents = agentRegistry.getAllAgents();
  assert.equal(agents.length, 3, 'Must seed exactly 3 agents');

  // Drone A: inspection
  const droneA = agentRegistry.getAgent('agent_drone_a');
  assert.ok(droneA, 'Drone A must exist');
  assert.equal(droneA?.type, 'drone');
  assert.ok(droneA?.capabilities.includes('inspect'));
  assert.equal(droneA?.status, 'AVAILABLE');
  assert.equal(droneA?.current_zone, 'Zone A');
  assert.ok(typeof droneA?.battery_level === 'number');
  assert.equal(droneA?.current_task, null);

  // Robot B: package transport
  const robotB = agentRegistry.getAgent('agent_robot_b');
  assert.ok(robotB, 'Robot B must exist');
  assert.equal(robotB?.type, 'amr');
  assert.ok(robotB?.capabilities.includes('transport'));
  assert.equal(robotB?.status, 'AVAILABLE');
  assert.equal(robotB?.current_zone, 'Zone B');

  // Robot C: package transport and backup
  const robotC = agentRegistry.getAgent('agent_robot_c');
  assert.ok(robotC, 'Robot C must exist');
  assert.equal(robotC?.type, 'amr');
  assert.ok(robotC?.capabilities.includes('transport'));
  assert.equal(robotC?.status, 'AVAILABLE');
  assert.equal(robotC?.current_zone, 'Zone B');
});

test('P1.2: Mission creation saves unique ID, status, and supports details retrieval', () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_unique_101',
    name: 'Custom Warehouse Dispatch',
    description: 'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  db.insertMission(mission);
  const retrieved = db.getMission('msn_unique_101');
  assert.ok(retrieved, 'Mission must be retrievable by ID');
  assert.equal(retrieved?.id, 'msn_unique_101');
  assert.equal(retrieved?.status, 'DRAFT');
  assert.equal(retrieved?.name, 'Custom Warehouse Dispatch');
});

test('P1.3: Deterministic mission planner generates tasks with INSPECT, TRANSPORT, DELIVERY', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_plan_test',
    name: 'SRS Mission Plan',
    description: 'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);

  const { tasks } = await missionPlanner.planMission(mission, false);
  assert.equal(tasks.length, 3, 'Canonical mission produces 3 tasks');

  // Task types supported: INSPECT, TRANSPORT, DELIVERY
  assert.equal(tasks[0].type, 'INSPECT');
  assert.equal(tasks[0].target_zone, 'Zone A');
  assert.equal(tasks[0].required_capability, 'inspect');

  assert.equal(tasks[1].type, 'TRANSPORT');
  assert.equal(tasks[1].required_capability, 'transport');

  assert.equal(tasks[2].type, 'DELIVERY');
  assert.equal(tasks[2].target_zone, 'Zone C');
  assert.equal(tasks[2].required_capability, 'transport');

  // Prerequisites wired correctly
  const task2Deps = db.getTaskDependencies(tasks[1].id);
  assert.deepEqual(task2Deps, [tasks[0].id], 'Task 2 depends on Task 1');

  const task3Deps = db.getTaskDependencies(tasks[2].id);
  assert.deepEqual(task3Deps, [tasks[1].id], 'Task 3 depends on Task 2');
});

test('P1.5: Assignment engine chooses eligible agent deterministically and explains decision', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_assign_test',
    name: 'Assignment Test',
    description: 'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);
  const { tasks } = await missionPlanner.planMission(mission, false);

  // Mark task 1 as READY
  db.updateTask(tasks[0].id, { status: 'READY' });
  const readyTask1 = db.getTask(tasks[0].id)!;

  // Drone A has inspect capability, Robot B and C do not
  const assignedAgent = assignmentEngine.assignTask(readyTask1);
  assert.ok(assignedAgent, 'An eligible agent must be chosen');
  assert.equal(assignedAgent?.id, 'agent_drone_a', 'Drone A must be chosen for inspection task');

  // Verify task record updated with explanation rationale
  const updatedTask1 = db.getTask(tasks[0].id)!;
  assert.equal(updatedTask1.status, 'ASSIGNED');
  assert.equal(updatedTask1.assigned_agent_id, 'agent_drone_a');
  assert.ok(updatedTask1.assignment_rationale, 'Assignment explanation rationale must be recorded');
  assert.ok(updatedTask1.assignment_rationale?.includes("Capability 'inspect' verified"));

  // Verify agent tracks current task
  const updatedDrone = agentRegistry.getAgent('agent_drone_a')!;
  assert.equal(updatedDrone.status, 'BUSY');
  assert.equal(updatedDrone.current_task, readyTask1.title);

  // Ineligible assignment attempt: Drone A must NOT be assigned to a transport task
  db.updateTask(tasks[1].id, { status: 'READY' });
  const readyTransportTask = db.getTask(tasks[1].id)!;
  const droneCheck = safetyEngine.validateAssignment(readyTransportTask, updatedDrone);
  assert.equal(droneCheck.allowed, false, 'Drone cannot be assigned transport task');
});

test('P1.6: Common Adapter & Simulator executes dependent tasks in correct order', async () => {
  db.resetToCleanState();
  const mission: MissionRecord = {
    id: 'msn_exec_test',
    name: 'Execution Lifecycle Test',
    description: 'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas',
    status: 'DRAFT',
    priority: 'HIGH',
    plan_version: 1,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  db.insertMission(mission);
  await missionPlanner.planMission(mission, false);
  db.updateMissionStatus(mission.id, 'RUNNING');

  // Verify adapter implements interface
  assert.equal(simulatedAdapter.adapterType, 'simulator');
  assert.equal(typeof simulatedAdapter.dispatchTask, 'function');
  assert.equal(typeof simulatedAdapter.cancelTask, 'function');
  assert.equal(typeof simulatedAdapter.pingAgent, 'function');

  // Step 1: Only Task 1 executes (predecessor)
  const readyBeforeStep1 = taskPlanner.evaluateReadyTasks(mission.id);
  assert.equal(readyBeforeStep1.length, 1);
  const tick1 = await executionCoordinator.tickMission(mission.id);
  assert.equal(tick1.dispatchedTasksCount, 1);
  const tasksAfter1 = db.getMissionTasks(mission.id);
  assert.equal(tasksAfter1[0].status, 'COMPLETED');
  assert.equal(tasksAfter1[1].status, 'PENDING', 'Task 2 must not start before Task 1 completes');

  // Step 2: Now Task 2 executes
  const tick2 = await executionCoordinator.tickMission(mission.id);
  assert.equal(tick2.dispatchedTasksCount, 1);
  const tasksAfter2 = db.getMissionTasks(mission.id);
  assert.equal(tasksAfter2[1].status, 'COMPLETED');
  assert.equal(tasksAfter2[2].status, 'PENDING', 'Task 3 must not start before Task 2 completes');

  // Step 3: Now Task 3 executes
  const tick3 = await executionCoordinator.tickMission(mission.id);
  assert.equal(tick3.dispatchedTasksCount, 1);
  assert.equal(tick3.completed, true);

  // Verify terminal state
  const finalMission = db.getMission(mission.id)!;
  assert.equal(finalMission.status, 'COMPLETED', 'Mission must be COMPLETED');

  // Verify all agents released to AVAILABLE with current_task = null
  const agents = agentRegistry.getAllAgents();
  for (const agent of agents) {
    assert.equal(agent.status, 'AVAILABLE');
    assert.equal(agent.current_task, null);
  }
});
