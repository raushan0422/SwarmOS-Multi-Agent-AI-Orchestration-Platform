/**
 * SwarmOS Database Schema & In-Memory/SQLite Persistence
 * SPDX-License-Identifier: Apache-2.0
 */

export interface MissionRecord {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plan_version: number;
  created_at: string;
  updated_at: string;
}

export interface AgentRecord {
  id: string;
  name: string;
  type: 'drone' | 'amr' | 'manipulator';
  capabilities: string[]; // JSON array in DB
  current_zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone R';
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'FAILED';
  battery_level: number; // 0-100
  current_task: string | null; // Tracks current assigned task ID/title
  last_seen_at: string;
  adapter_type: 'simulator' | 'ros2' | 'mqtt';
}

export interface TaskRecord {
  id: string;
  mission_id: string;
  title: string;
  type: 'INSPECT' | 'PICKUP' | 'TRANSPORT' | 'DELIVERY' | 'NAVIGATE' | 'STANDBY';
  target_zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone R';
  required_capability: string;
  status: 'PENDING' | 'READY' | 'ASSIGNED' | 'DISPATCHED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
  priority: number;
  assigned_agent_id: string | null;
  assignment_rationale: string | null; // Explanation of the assignment decision
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDependencyRecord {
  task_id: string;
  depends_on_task_id: string;
}

export interface TaskAttemptRecord {
  id: string;
  task_id: string;
  agent_id: string;
  status: 'SUCCESS' | 'FAILED';
  started_at: string;
  ended_at: string | null;
  failure_reason: string | null;
}

export interface EventRecord {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  agent_id: string | null;
  event_type: 
    | 'MISSION_CREATED'
    | 'PLAN_GENERATED'
    | 'TASK_READY'
    | 'TASK_ASSIGNED'
    | 'POLICY_EVALUATED'
    | 'TASK_DISPATCHED'
    | 'TASK_STARTED'
    | 'TASK_COMPLETED'
    | 'TASK_FAILED'
    | 'AGENT_STATUS_CHANGED'
    | 'MISSION_COMPLETED'
    | 'MISSION_PAUSED'
    | 'SYSTEM_RESET';
  payload: Record<string, unknown>;
  timestamp: string;
}

export interface PolicyRecord {
  id: string;
  name: string;
  rule_type: 'RESTRICTED_ZONE' | 'CAPABILITY_MATCH' | 'MINIMUM_BATTERY' | 'RESOURCE_LOCK';
  configuration: Record<string, unknown>;
  enabled: boolean;
}
