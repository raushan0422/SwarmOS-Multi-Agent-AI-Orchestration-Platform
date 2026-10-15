/**
 * SwarmOS Frontend Type Definitions
 * SPDX-License-Identifier: Apache-2.0
 */

export interface Mission {
  id: string;
  name: string;
  description: string;
  status: 'DRAFT' | 'PLANNED' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'BLOCKED' | 'CANCELLED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  plan_version: number;
  created_at: string;
  updated_at: string;
}

export interface Agent {
  id: string;
  name: string;
  type: 'drone' | 'amr' | 'manipulator';
  capabilities: string[];
  current_zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone R';
  status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'FAILED';
  battery_level: number;
  current_task: string | null;
  last_seen_at: string;
  adapter_type: 'simulator' | 'ros2' | 'mqtt';
}

export interface Task {
  id: string;
  mission_id: string;
  title: string;
  type: 'INSPECT' | 'PICKUP' | 'TRANSPORT' | 'DELIVERY' | 'NAVIGATE' | 'STANDBY';
  target_zone: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone R';
  required_capability: string;
  status: 'PENDING' | 'READY' | 'ASSIGNED' | 'DISPATCHED' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'BLOCKED' | 'CANCELLED';
  priority: number;
  assigned_agent_id: string | null;
  assignment_rationale: string | null;
  attempt_count: number;
  created_at: string;
  updated_at: string;
}

export interface TaskDependency {
  task_id: string;
  depends_on_task_id: string;
}

export interface EventItem {
  id: string;
  mission_id: string | null;
  task_id: string | null;
  agent_id: string | null;
  event_type: string;
  payload: Record<string, any>;
  timestamp: string;
}

export interface MissionDetailsResponse {
  mission: Mission;
  tasks: Task[];
  dependencies: TaskDependency[];
  recentEvents: EventItem[];
}
