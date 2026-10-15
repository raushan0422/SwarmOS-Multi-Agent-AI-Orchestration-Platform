/**
 * SwarmOS Agent Registry
 * Tracks agent capabilities, locations, availability, heartbeats, battery, and current task.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { AgentRecord } from '../db/schema.ts';

export class AgentRegistry {
  public getAllAgents(): AgentRecord[] {
    return db.getAllAgents();
  }

  public getAgent(id: string): AgentRecord | null {
    return db.getAgent(id);
  }

  public getAvailableAgents(): AgentRecord[] {
    return db.getAllAgents().filter((a) => a.status === 'AVAILABLE' && a.battery_level > 15);
  }

  public getAgentsByCapability(capability: string): AgentRecord[] {
    return db.getAllAgents().filter((a) => a.capabilities.includes(capability));
  }

  public updateAgentStatus(id: string, status: AgentRecord['status'], currentTask?: string | null): AgentRecord | null {
    const updates: Partial<Pick<AgentRecord, 'status' | 'current_task' | 'last_seen_at'>> = {
      status,
      last_seen_at: new Date().toISOString(),
    };
    if (currentTask !== undefined) {
      updates.current_task = currentTask;
    } else if (status === 'AVAILABLE') {
      updates.current_task = null;
    }
    db.updateAgent(id, updates);
    return db.getAgent(id);
  }

  public updateAgentLocation(id: string, zone: AgentRecord['current_zone']): AgentRecord | null {
    db.updateAgent(id, { current_zone: zone, last_seen_at: new Date().toISOString() });
    return db.getAgent(id);
  }

  public updateAgentBattery(id: string, battery: number): AgentRecord | null {
    db.updateAgent(id, { battery_level: Math.max(0, Math.min(100, battery)), last_seen_at: new Date().toISOString() });
    return db.getAgent(id);
  }

  public recordHeartbeat(id: string): void {
    db.updateAgent(id, { last_seen_at: new Date().toISOString() });
  }

  public registerAgent(agent: AgentRecord): void {
    db.insertAgent(agent);
  }
}

export const agentRegistry = new AgentRegistry();
