/**
 * SwarmOS Common Agent Adapter Interface
 * Vendor-neutral abstraction allowing SwarmOS to communicate with drones, AMRs,
 * ROS2 nodes, MQTT brokers, or simulator runtimes interchangeably.
 * SPDX-License-Identifier: Apache-2.0
 */

import { AgentRecord, TaskRecord } from '../../db/schema.ts';

export interface ExecutionFeedback {
  taskId: string;
  agentId: string;
  status: 'ACKNOWLEDGED' | 'IN_TRANSIT' | 'EXECUTING' | 'COMPLETED' | 'FAILED';
  progressPercent: number;
  currentZone: AgentRecord['current_zone'];
  batteryLevel: number;
  message?: string;
}

export interface AgentAdapter {
  adapterType: string;
  dispatchTask(
    task: TaskRecord,
    agent: AgentRecord,
    onProgress?: (feedback: ExecutionFeedback) => void
  ): Promise<boolean>;
  cancelTask(taskId: string): Promise<boolean>;
  pingAgent(agentId: string): Promise<boolean>;
}
