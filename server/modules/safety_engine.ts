/**
 * SwarmOS Safety & Policy Engine
 * Enforces deterministic rule checks before task assignment and revalidates before dispatch.
 * Prohibits restricted zone violations, capability mismatches, low battery, and resource conflicts.
 * SPDX-License-Identifier: Apache-2.0
 */

import { db } from '../db/database.ts';
import { AgentRecord, TaskRecord } from '../db/schema.ts';
import { eventHistory } from './event_history.ts';

export interface PolicyValidationResult {
  allowed: boolean;
  violated_policy: string | null;
  reason: string;
}

export class SafetyEngine {
  /**
   * Validates proposed task assignment against all operational and safety policies.
   */
  public validateAssignment(
    task: TaskRecord,
    agent: AgentRecord,
    isDispatchRevalidation: boolean = false
  ): PolicyValidationResult {
    const policies = db.getPolicies();
    const phaseLabel = isDispatchRevalidation ? 'Pre-Dispatch Revalidation' : 'Pre-Assignment Check';

    // 1. Restricted Zone Check
    const restrictedPolicy = policies.find((p) => p.rule_type === 'RESTRICTED_ZONE');
    if (restrictedPolicy && restrictedPolicy.enabled) {
      const restrictedZones = (restrictedPolicy.configuration.restricted_zones as string[]) || ['Zone R'];
      if (restrictedZones.includes(task.target_zone)) {
        const reason = `Security violation [${phaseLabel}]: Task targets restricted zone ${task.target_zone}. Operational clearance denied.`;
        eventHistory.log(
          'POLICY_EVALUATED',
          { allowed: false, policy: restrictedPolicy.name, phase: phaseLabel, reason },
          task.mission_id,
          task.id,
          agent.id
        );
        return {
          allowed: false,
          violated_policy: restrictedPolicy.name,
          reason,
        };
      }
    }

    // 2. Capability Matching Check
    const capabilityPolicy = policies.find((p) => p.rule_type === 'CAPABILITY_MATCH');
    if (capabilityPolicy && capabilityPolicy.enabled) {
      if (!agent.capabilities.includes(task.required_capability)) {
        const reason = `Capability mismatch [${phaseLabel}]: Agent ${agent.name} lacks required capability '${task.required_capability}'. Available: [${agent.capabilities.join(', ')}].`;
        eventHistory.log(
          'POLICY_EVALUATED',
          { allowed: false, policy: capabilityPolicy.name, phase: phaseLabel, reason },
          task.mission_id,
          task.id,
          agent.id
        );
        return {
          allowed: false,
          violated_policy: capabilityPolicy.name,
          reason,
        };
      }
    }

    // 3. Minimum Battery Check
    const batteryPolicy = policies.find((p) => p.rule_type === 'MINIMUM_BATTERY');
    if (batteryPolicy && batteryPolicy.enabled) {
      const minPercent = (batteryPolicy.configuration.min_percent as number) || 20;
      if (agent.battery_level < minPercent) {
        const reason = `Battery constraint [${phaseLabel}]: Agent ${agent.name} battery (${agent.battery_level}%) is below reserve safety floor (${minPercent}%).`;
        eventHistory.log(
          'POLICY_EVALUATED',
          { allowed: false, policy: batteryPolicy.name, phase: phaseLabel, reason },
          task.mission_id,
          task.id,
          agent.id
        );
        return {
          allowed: false,
          violated_policy: batteryPolicy.name,
          reason,
        };
      }
    }

    // 4. Resource Conflict Check (prevent duplicate assignment & concurrent dock collision)
    if (isDispatchRevalidation && agent.status !== 'BUSY' && agent.status !== 'AVAILABLE') {
      const reason = `Resource conflict [${phaseLabel}]: Agent ${agent.name} is in state ${agent.status} and cannot be dispatched.`;
      eventHistory.log(
        'POLICY_EVALUATED',
        { allowed: false, policy: 'Resource Conflict Check', phase: phaseLabel, reason },
        task.mission_id,
        task.id,
        agent.id
      );
      return {
        allowed: false,
        violated_policy: 'Resource Conflict Check',
        reason,
      };
    }

    // All safety policies passed
    eventHistory.log(
      'POLICY_EVALUATED',
      { allowed: true, phase: phaseLabel, checked_policies: policies.map((p) => p.name) },
      task.mission_id,
      task.id,
      agent.id
    );

    return {
      allowed: true,
      violated_policy: null,
      reason: `All safety and operational constraints satisfied during ${phaseLabel}.`,
    };
  }

  public validateTaskTarget(zone: string): PolicyValidationResult {
    if (zone === 'Zone R') {
      return {
        allowed: false,
        violated_policy: 'Restricted Zone Guard',
        reason: 'Direct task allocation to Zone R is prohibited by site security protocols.',
      };
    }
    return {
      allowed: true,
      violated_policy: null,
      reason: 'Target zone validated.',
    };
  }
}

export const safetyEngine = new SafetyEngine();
