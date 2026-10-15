/**
 * SwarmOS Event History & Audit Logger
 * Records lifecycle state transitions, assignments, policy validations, and execution events.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { db } from '../db/database.ts';
import { EventRecord } from '../db/schema.ts';

export class EventHistory {
  public log(
    eventType: EventRecord['event_type'],
    payload: Record<string, unknown>,
    missionId?: string | null,
    taskId?: string | null,
    agentId?: string | null
  ): EventRecord {
    const event: EventRecord = {
      id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      mission_id: missionId ?? null,
      task_id: taskId ?? null,
      agent_id: agentId ?? null,
      event_type: eventType,
      payload,
      timestamp: new Date().toISOString(),
    };
    db.insertEvent(event);
    return event;
  }

  public getEvents(missionId?: string): EventRecord[] {
    return db.getMissionEvents(missionId);
  }
}

export const eventHistory = new EventHistory();
