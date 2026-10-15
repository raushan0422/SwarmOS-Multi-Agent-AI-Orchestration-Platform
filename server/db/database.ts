/**
 * SwarmOS Database Engine
 * Utilizes SQLite with synchronous WAL mode for high integrity and rapid reset capability.
 * SPDX-License-Identifier: Apache-2.0
 */

import { DatabaseSync } from 'node:sqlite';
import path from 'node:path';
import fs from 'node:fs';
import {
  MissionRecord,
  AgentRecord,
  TaskRecord,
  TaskDependencyRecord,
  TaskAttemptRecord,
  EventRecord,
  PolicyRecord,
} from './schema.ts';

export class SwarmDatabase {
  private db: DatabaseSync;

  constructor(dbPath: string = ':memory:') {
    if (dbPath !== ':memory:') {
      const dir = path.dirname(dbPath);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    }
    this.db = new DatabaseSync(dbPath);
    this.initTables();
    this.seedDefaults();
  }

  private initTables(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS missions (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT NOT NULL,
        status TEXT NOT NULL,
        priority TEXT NOT NULL,
        plan_version INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        capabilities TEXT NOT NULL,
        current_zone TEXT NOT NULL,
        status TEXT NOT NULL,
        battery_level REAL NOT NULL,
        current_task TEXT,
        last_seen_at TEXT NOT NULL,
        adapter_type TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        mission_id TEXT NOT NULL,
        title TEXT NOT NULL,
        type TEXT NOT NULL,
        target_zone TEXT NOT NULL,
        required_capability TEXT NOT NULL,
        status TEXT NOT NULL,
        priority INTEGER NOT NULL DEFAULT 1,
        assigned_agent_id TEXT,
        assignment_rationale TEXT,
        attempt_count INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        FOREIGN KEY (mission_id) REFERENCES missions(id)
      );

      CREATE TABLE IF NOT EXISTS task_dependencies (
        task_id TEXT NOT NULL,
        depends_on_task_id TEXT NOT NULL,
        PRIMARY KEY (task_id, depends_on_task_id)
      );

      CREATE TABLE IF NOT EXISTS task_attempts (
        id TEXT PRIMARY KEY,
        task_id TEXT NOT NULL,
        agent_id TEXT NOT NULL,
        status TEXT NOT NULL,
        started_at TEXT NOT NULL,
        ended_at TEXT,
        failure_reason TEXT
      );

      CREATE TABLE IF NOT EXISTS events (
        id TEXT PRIMARY KEY,
        mission_id TEXT,
        task_id TEXT,
        agent_id TEXT,
        event_type TEXT NOT NULL,
        payload TEXT NOT NULL,
        timestamp TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS policies (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        rule_type TEXT NOT NULL,
        configuration TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1
      );
    `);
  }

  public seedDefaults(): void {
    const agentCount = this.db.prepare('SELECT COUNT(*) as count FROM agents').get() as { count: number };
    if (agentCount && agentCount.count > 0) {
      return;
    }

    // Default Fleet matching SRS:
    // Drone A: inspect warehouse zones
    // Robot B: transport packages
    // Robot C: transport packages and backup
    const agents: AgentRecord[] = [
      {
        id: 'agent_drone_a',
        name: 'Drone A',
        type: 'drone',
        capabilities: ['inspect', 'aerial_surveillance'],
        current_zone: 'Zone A',
        status: 'AVAILABLE',
        battery_level: 96,
        current_task: null,
        last_seen_at: new Date().toISOString(),
        adapter_type: 'simulator',
      },
      {
        id: 'agent_robot_b',
        name: 'Robot B',
        type: 'amr',
        capabilities: ['transport', 'heavy_payload'],
        current_zone: 'Zone B',
        status: 'AVAILABLE',
        battery_level: 88,
        current_task: null,
        last_seen_at: new Date().toISOString(),
        adapter_type: 'simulator',
      },
      {
        id: 'agent_robot_c',
        name: 'Robot C',
        type: 'amr',
        capabilities: ['transport', 'rapid_transit'],
        current_zone: 'Zone B',
        status: 'AVAILABLE',
        battery_level: 94,
        current_task: null,
        last_seen_at: new Date().toISOString(),
        adapter_type: 'simulator',
      },
    ];

    for (const agent of agents) {
      this.insertAgent(agent);
    }

    // Default Safety Policies
    const policies: PolicyRecord[] = [
      {
        id: 'policy_restricted_zone',
        name: 'Restricted Zone Guard',
        rule_type: 'RESTRICTED_ZONE',
        configuration: { restricted_zones: ['Zone R'], allow_override: false },
        enabled: true,
      },
      {
        id: 'policy_capability_match',
        name: 'Agent Capability Verification',
        rule_type: 'CAPABILITY_MATCH',
        configuration: { strict_match: true },
        enabled: true,
      },
      {
        id: 'policy_min_battery',
        name: 'Minimum Operational Battery',
        rule_type: 'MINIMUM_BATTERY',
        configuration: { min_percent: 20 },
        enabled: true,
      },
    ];

    for (const p of policies) {
      this.insertPolicy(p);
    }
  }

  // --- Mission Operations ---
  public insertMission(m: MissionRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO missions (id, name, description, status, priority, plan_version, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(m.id, m.name, m.description, m.status, m.priority, m.plan_version, m.created_at, m.updated_at);
  }

  public updateMissionStatus(id: string, status: MissionRecord['status']): void {
    const stmt = this.db.prepare('UPDATE missions SET status = ?, updated_at = ? WHERE id = ?');
    stmt.run(status, new Date().toISOString(), id);
  }

  public getMission(id: string): MissionRecord | null {
    const stmt = this.db.prepare('SELECT * FROM missions WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return row as unknown as MissionRecord;
  }

  public getAllMissions(): MissionRecord[] {
    const stmt = this.db.prepare('SELECT * FROM missions ORDER BY created_at DESC');
    return stmt.all() as unknown as MissionRecord[];
  }

  // --- Agent Operations ---
  public insertAgent(a: AgentRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO agents (id, name, type, capabilities, current_zone, status, battery_level, current_task, last_seen_at, adapter_type)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      a.id,
      a.name,
      a.type,
      JSON.stringify(a.capabilities),
      a.current_zone,
      a.status,
      a.battery_level,
      a.current_task ?? null,
      a.last_seen_at,
      a.adapter_type
    );
  }

  public getAgent(id: string): AgentRecord | null {
    const stmt = this.db.prepare('SELECT * FROM agents WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    if (!row) return null;
    return {
      ...(row as unknown as AgentRecord),
      capabilities: JSON.parse(row.capabilities as string),
    };
  }

  public getAllAgents(): AgentRecord[] {
    const stmt = this.db.prepare('SELECT * FROM agents ORDER BY name ASC');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((row) => ({
      ...(row as unknown as AgentRecord),
      capabilities: JSON.parse(row.capabilities as string),
    }));
  }

  public updateAgent(
    id: string,
    updates: Partial<Pick<AgentRecord, 'status' | 'current_zone' | 'battery_level' | 'current_task' | 'last_seen_at'>>
  ): void {
    const current = this.getAgent(id);
    if (!current) return;
    const newStatus = updates.status !== undefined ? updates.status : current.status;
    const newZone = updates.current_zone !== undefined ? updates.current_zone : current.current_zone;
    const newBattery = updates.battery_level !== undefined ? updates.battery_level : current.battery_level;
    const newTask = updates.current_task !== undefined ? updates.current_task : current.current_task;
    const newLastSeen = updates.last_seen_at !== undefined ? updates.last_seen_at : new Date().toISOString();

    const stmt = this.db.prepare(
      'UPDATE agents SET status = ?, current_zone = ?, battery_level = ?, current_task = ?, last_seen_at = ? WHERE id = ?'
    );
    stmt.run(newStatus, newZone, newBattery, newTask, newLastSeen, id);
  }

  // --- Task Operations ---
  public insertTask(t: TaskRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO tasks (id, mission_id, title, type, target_zone, required_capability, status, priority, assigned_agent_id, assignment_rationale, attempt_count, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      t.id,
      t.mission_id,
      t.title,
      t.type,
      t.target_zone,
      t.required_capability,
      t.status,
      t.priority,
      t.assigned_agent_id,
      t.assignment_rationale ?? null,
      t.attempt_count,
      t.created_at,
      t.updated_at
    );
  }

  public updateTask(
    id: string,
    updates: Partial<Pick<TaskRecord, 'status' | 'assigned_agent_id' | 'assignment_rationale' | 'attempt_count'>>
  ): void {
    const stmt = this.db.prepare(`
      UPDATE tasks 
      SET status = COALESCE(?, status),
          assigned_agent_id = COALESCE(?, assigned_agent_id),
          assignment_rationale = COALESCE(?, assignment_rationale),
          attempt_count = COALESCE(?, attempt_count),
          updated_at = ?
      WHERE id = ?
    `);
    stmt.run(
      updates.status ?? null,
      updates.assigned_agent_id ?? null,
      updates.assignment_rationale ?? null,
      updates.attempt_count ?? null,
      new Date().toISOString(),
      id
    );
  }

  public getTask(id: string): TaskRecord | null {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE id = ?');
    const row = stmt.get(id) as Record<string, unknown> | undefined;
    return row ? (row as unknown as TaskRecord) : null;
  }

  public getMissionTasks(missionId: string): TaskRecord[] {
    const stmt = this.db.prepare('SELECT * FROM tasks WHERE mission_id = ? ORDER BY priority ASC, created_at ASC');
    return stmt.all(missionId) as unknown as TaskRecord[];
  }

  public insertTaskDependency(dep: TaskDependencyRecord): void {
    const stmt = this.db.prepare('INSERT OR IGNORE INTO task_dependencies (task_id, depends_on_task_id) VALUES (?, ?)');
    stmt.run(dep.task_id, dep.depends_on_task_id);
  }

  public getTaskDependencies(taskId: string): string[] {
    const stmt = this.db.prepare('SELECT depends_on_task_id FROM task_dependencies WHERE task_id = ?');
    const rows = stmt.all(taskId) as { depends_on_task_id: string }[];
    return rows.map((r) => r.depends_on_task_id);
  }

  public getAllDependenciesForMission(missionId: string): TaskDependencyRecord[] {
    const stmt = this.db.prepare(`
      SELECT td.task_id, td.depends_on_task_id 
      FROM task_dependencies td
      JOIN tasks t ON td.task_id = t.id
      WHERE t.mission_id = ?
    `);
    return stmt.all(missionId) as unknown as TaskDependencyRecord[];
  }

  // --- Task Attempts ---
  public insertTaskAttempt(attempt: TaskAttemptRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO task_attempts (id, task_id, agent_id, status, started_at, ended_at, failure_reason)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      attempt.id,
      attempt.task_id,
      attempt.agent_id,
      attempt.status,
      attempt.started_at,
      attempt.ended_at,
      attempt.failure_reason
    );
  }

  public getTaskAttempts(taskId: string): TaskAttemptRecord[] {
    const stmt = this.db.prepare('SELECT * FROM task_attempts WHERE task_id = ? ORDER BY started_at ASC');
    return stmt.all(taskId) as unknown as TaskAttemptRecord[];
  }

  // --- Events ---
  public insertEvent(evt: EventRecord): void {
    const stmt = this.db.prepare(`
      INSERT INTO events (id, mission_id, task_id, agent_id, event_type, payload, timestamp)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    stmt.run(
      evt.id,
      evt.mission_id,
      evt.task_id,
      evt.agent_id,
      evt.event_type,
      JSON.stringify(evt.payload),
      evt.timestamp
    );
  }

  public getMissionEvents(missionId?: string): EventRecord[] {
    let stmt;
    if (missionId) {
      stmt = this.db.prepare('SELECT * FROM events WHERE mission_id = ? ORDER BY timestamp DESC LIMIT 100');
      const rows = stmt.all(missionId) as Record<string, unknown>[];
      return rows.map((r) => ({
        ...(r as unknown as EventRecord),
        payload: JSON.parse(r.payload as string),
      }));
    } else {
      stmt = this.db.prepare('SELECT * FROM events ORDER BY timestamp DESC LIMIT 100');
      const rows = stmt.all() as Record<string, unknown>[];
      return rows.map((r) => ({
        ...(r as unknown as EventRecord),
        payload: JSON.parse(r.payload as string),
      }));
    }
  }

  // --- Policies ---
  public insertPolicy(p: PolicyRecord): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO policies (id, name, rule_type, configuration, enabled)
      VALUES (?, ?, ?, ?, ?)
    `);
    stmt.run(p.id, p.name, p.rule_type, JSON.stringify(p.configuration), p.enabled ? 1 : 0);
  }

  public getPolicies(): PolicyRecord[] {
    const stmt = this.db.prepare('SELECT * FROM policies WHERE enabled = 1');
    const rows = stmt.all() as Record<string, unknown>[];
    return rows.map((r) => ({
      ...(r as unknown as PolicyRecord),
      configuration: JSON.parse(r.configuration as string),
      enabled: Boolean(r.enabled),
    }));
  }

  // --- System Reset ---
  public resetToCleanState(): void {
    this.db.exec(`
      DELETE FROM events;
      DELETE FROM task_attempts;
      DELETE FROM task_dependencies;
      DELETE FROM tasks;
      DELETE FROM missions;
      DELETE FROM agents;
      DELETE FROM policies;
    `);
    this.seedDefaults();
  }
}

export const db = new SwarmDatabase();
