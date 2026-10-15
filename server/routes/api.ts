/**
 * SwarmOS API Router - Phase 2 MVP
 * Implements REST endpoints conforming to the SwarmOS Software Requirements Specification.
 * Supports LLM/deterministic mission planning, failure injection, and recovery monitoring.
 * SPDX-License-Identifier: Apache-2.0
 */

import { Router, Request, Response } from 'express';
import crypto from 'node:crypto';
import { db } from '../db/database.ts';
import { MissionRecord } from '../db/schema.ts';
import { missionPlanner } from '../modules/mission_planner.ts';
import { executionCoordinator } from '../modules/execution_coordinator.ts';
import { agentRegistry } from '../modules/agent_registry.ts';
import { recoveryEngine } from '../modules/recovery_engine.ts';
import { eventHistory } from '../modules/event_history.ts';

export const apiRouter = Router();

// --- Missions Endpoints ---

// POST /api/missions - Create a new mission
apiRouter.post('/missions', (req: Request, res: Response) => {
  try {
    const { name, description, priority } = req.body;
    if (!description) {
      return res.status(400).json({ error: 'Mission description is required' });
    }

    const id = `msn_${Date.now()}_${crypto.randomBytes(2).toString('hex')}`;
    const missionName = name || `Mission ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
    const now = new Date().toISOString();

    const mission: MissionRecord = {
      id,
      name: missionName,
      description,
      status: 'DRAFT',
      priority: priority || 'HIGH',
      plan_version: 1,
      created_at: now,
      updated_at: now,
    };

    db.insertMission(mission);
    eventHistory.log('MISSION_CREATED', { name: mission.name, description }, id);

    res.status(201).json(mission);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/missions - List all missions
apiRouter.get('/missions', (_req: Request, res: Response) => {
  try {
    const missions = db.getAllMissions();
    res.json(missions);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/missions/:id - Mission details with task breakdown and dependencies
apiRouter.get('/missions/:id', (req: Request, res: Response) => {
  try {
    const mission = db.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }
    const tasks = db.getMissionTasks(mission.id);
    const dependencies = db.getAllDependenciesForMission(mission.id);
    const events = db.getMissionEvents(mission.id);

    res.json({
      mission,
      tasks,
      dependencies,
      recentEvents: events.slice(0, 15),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/missions/:id/plan - Generate and validate task plan (supports LLM or deterministic)
apiRouter.post('/missions/:id/plan', async (req: Request, res: Response) => {
  try {
    const mission = db.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    const preferLLM = req.query.mode === 'llm' || req.body?.preferLLM === true;
    const planResult = await missionPlanner.planMission(mission, preferLLM);
    const updatedMission = db.getMission(mission.id);
    const dependencies = db.getAllDependenciesForMission(mission.id);

    res.json({
      mission: updatedMission,
      tasks: planResult.tasks,
      dependencies,
      warnings: planResult.warnings,
      plannedBy: planResult.plannedBy,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/missions/:id/start - Start approved mission execution
apiRouter.post('/missions/:id/start', async (req: Request, res: Response) => {
  try {
    const mission = db.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    await executionCoordinator.startMission(mission.id, true);
    res.json({
      status: 'RUNNING',
      message: `Mission ${mission.name} execution started.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/missions/:id/step - Execute a single deterministic cycle tick
apiRouter.post('/missions/:id/step', async (req: Request, res: Response) => {
  try {
    const mission = db.getMission(req.params.id);
    if (!mission) {
      return res.status(404).json({ error: 'Mission not found' });
    }

    if (mission.status === 'PLANNED') {
      db.updateMissionStatus(mission.id, 'RUNNING');
    }

    const result = await executionCoordinator.tickMission(mission.id);
    const updatedMission = db.getMission(mission.id);
    const tasks = db.getMissionTasks(mission.id);
    const agents = db.getAllAgents();

    res.json({
      tickResult: result,
      mission: updatedMission,
      tasks,
      agents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/missions/:id/pause - Pause execution
apiRouter.post('/missions/:id/pause', (req: Request, res: Response) => {
  try {
    executionCoordinator.pauseMission(req.params.id);
    res.json({ status: 'PAUSED', message: 'Mission paused.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/missions/:id/cancel - Cancel mission
apiRouter.post('/missions/:id/cancel', (req: Request, res: Response) => {
  try {
    executionCoordinator.cancelMission(req.params.id);
    res.json({ status: 'CANCELLED', message: 'Mission cancelled.' });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/missions/:id/tasks - Get all tasks for mission
apiRouter.get('/missions/:id/tasks', (req: Request, res: Response) => {
  try {
    const tasks = db.getMissionTasks(req.params.id);
    const dependencies = db.getAllDependenciesForMission(req.params.id);
    res.json({ tasks, dependencies });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/tasks/:id/attempts - Get attempt history for a specific task
apiRouter.get('/tasks/:id/attempts', (req: Request, res: Response) => {
  try {
    const attempts = db.getTaskAttempts(req.params.id);
    res.json(attempts);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/missions/:id/events - Get events for mission
apiRouter.get('/missions/:id/events', (req: Request, res: Response) => {
  try {
    const events = db.getMissionEvents(req.params.id);
    res.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/events - Get all global system events
apiRouter.get('/events', (_req: Request, res: Response) => {
  try {
    const events = db.getMissionEvents();
    res.json(events);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// --- Agents Fleet Endpoints & Failure Injection ---

// GET /api/agents - List all agents
apiRouter.get('/agents', (_req: Request, res: Response) => {
  try {
    const agents = agentRegistry.getAllAgents();
    res.json(agents);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// GET /api/agents/:id - Single agent detail
apiRouter.get('/agents/:id', (req: Request, res: Response) => {
  try {
    const agent = agentRegistry.getAgent(req.params.id);
    if (!agent) {
      return res.status(404).json({ error: 'Agent not found' });
    }
    res.json(agent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// PATCH /api/agents/:id/status - Update agent status
apiRouter.patch('/agents/:id/status', (req: Request, res: Response) => {
  try {
    const { status, current_zone, battery_level } = req.body;
    db.updateAgent(req.params.id, {
      status,
      current_zone,
      battery_level,
      last_seen_at: new Date().toISOString(),
    });
    const agent = agentRegistry.getAgent(req.params.id);
    res.json(agent);
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/agents/:id/fail - Inject agent failure (Phase 2 requirement)
apiRouter.post('/agents/:id/fail', (req: Request, res: Response) => {
  try {
    const reason = req.body?.reason || 'Simulator injected hardware fault';
    const result = recoveryEngine.injectAgentFailure(req.params.id, reason);
    const updatedAgent = agentRegistry.getAgent(req.params.id);

    res.json({
      status: 'FAILED',
      agent: updatedAgent,
      recoveryOutcomes: result.recoveryOutcomes,
      affectedTasks: result.affectedTasks,
      message: `Agent ${req.params.id} marked as FAILED. Failure recovery evaluated.`,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// POST /api/tasks/:id/fail - Inject task failure
apiRouter.post('/tasks/:id/fail', (req: Request, res: Response) => {
  try {
    const task = db.getTask(req.params.id);
    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }
    if (!task.assigned_agent_id) {
      return res.status(400).json({ error: 'Task has no assigned agent to fail' });
    }
    const agent = agentRegistry.getAgent(task.assigned_agent_id)!;
    const outcome = recoveryEngine.handleTaskFailure(task, agent, req.body?.reason || 'Injected operational failure');

    res.json({
      task: db.getTask(task.id),
      recoveryOutcome: outcome,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});

// --- System Control Endpoints ---

// POST /api/system/reset - Reset demo to clean initial state
apiRouter.post('/system/reset', (_req: Request, res: Response) => {
  try {
    db.resetToCleanState();
    eventHistory.log('SYSTEM_RESET', { reset_by: 'user_action' });
    const agents = agentRegistry.getAllAgents();
    res.json({
      status: 'RESET_OK',
      message: 'System reset to initial clean state. Fleet reseeded.',
      agents,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    res.status(500).json({ error: message });
  }
});
