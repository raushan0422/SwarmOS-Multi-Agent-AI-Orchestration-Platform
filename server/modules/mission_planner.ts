/**
 * SwarmOS Mission Planner
 * Unified interface supporting both LLM-assisted planning and deterministic fallback.
 * Strictly validates structured outputs against warehouse constraints and task types.
 * SPDX-License-Identifier: Apache-2.0
 */

import crypto from 'node:crypto';
import { GoogleGenAI, Type } from '@google/genai';
import { db } from '../db/database.ts';
import { MissionRecord, TaskRecord } from '../db/schema.ts';
import { eventHistory } from './event_history.ts';
import { safetyEngine } from './safety_engine.ts';
import { taskPlanner } from './task_planner.ts';

export interface PlannedTaskDraft {
  title: string;
  type: TaskRecord['type'];
  target_zone: TaskRecord['target_zone'];
  required_capability: string;
  priority: number;
  depends_on_indices?: number[];
}

export interface PlanResult {
  tasks: TaskRecord[];
  warnings: string[];
  plannedBy: 'llm' | 'deterministic';
}

export interface MissionPlannerInterface {
  planMission(mission: MissionRecord, preferLLM?: boolean): Promise<PlanResult>;
}

const SUPPORTED_TASK_TYPES = ['INSPECT', 'TRANSPORT', 'DELIVERY'] as const;
const SUPPORTED_ZONES = ['Zone A', 'Zone B', 'Zone C', 'Zone R'] as const;

export class DeterministicPlanner {
  public plan(mission: MissionRecord): { drafts: PlannedTaskDraft[]; warnings: string[] } {
    if (!mission.description || mission.description.trim() === '') {
      throw new Error('Validation failure: Mission description cannot be empty.');
    }

    const descLower = mission.description.toLowerCase();
    const warnings: string[] = [];
    const drafts: PlannedTaskDraft[] = [];

    // Check for explicit mention of Zone R
    if (descLower.includes('zone r') && !descLower.includes('without') && !descLower.includes('avoid')) {
      const zoneCheck = safetyEngine.validateTaskTarget('Zone R');
      if (!zoneCheck.allowed) {
        warnings.push('Warning: Mission explicitly references restricted area. Safety policies will block execution.');
      }
    }

    if (
      descLower.includes('concurrent') ||
      descLower.includes('parallel') ||
      descLower.includes('simultaneous')
    ) {
      // Parallel execution scenario: Independent inspection and ground transport
      drafts.push({
        title: 'Aerial Perimeter Scan',
        type: 'INSPECT',
        target_zone: 'Zone A',
        required_capability: 'inspect',
        priority: 1,
        depends_on_indices: [],
      });
      drafts.push({
        title: 'Staging Cargo Preparation',
        type: 'TRANSPORT',
        target_zone: 'Zone B',
        required_capability: 'transport',
        priority: 1,
        depends_on_indices: [],
      });
      drafts.push({
        title: 'Consolidated Delivery to Dispatch',
        type: 'DELIVERY',
        target_zone: 'Zone C',
        required_capability: 'transport',
        priority: 2,
        depends_on_indices: [0, 1], // Fork-Join pattern: depends on BOTH parallel tasks
      });
    } else if (
      descLower.includes('inspect') &&
      (descLower.includes('transport') || descLower.includes('dispatch') || descLower.includes('package') || descLower.includes('deliver'))
    ) {
      drafts.push({
        title: 'Aerial Inspection & Package Scan',
        type: 'INSPECT',
        target_zone: 'Zone A',
        required_capability: 'inspect',
        priority: 1,
      });
      drafts.push({
        title: 'Load Eligible Package Payload',
        type: 'TRANSPORT',
        target_zone: 'Zone A',
        required_capability: 'transport',
        priority: 2,
        depends_on_indices: [0],
      });
      drafts.push({
        title: 'Delivery Transfer to Dispatch Outbound',
        type: 'DELIVERY',
        target_zone: 'Zone C',
        required_capability: 'transport',
        priority: 3,
        depends_on_indices: [1],
      });
    } else if (descLower.includes('inspect')) {
      const targetZone = descLower.includes('zone b') ? 'Zone B' : 'Zone A';
      drafts.push({
        title: `Visual & Thermal Inspection (${targetZone})`,
        type: 'INSPECT',
        target_zone: targetZone as TaskRecord['target_zone'],
        required_capability: 'inspect',
        priority: 1,
      });
    } else if (descLower.includes('deliver') || descLower.includes('delivery')) {
      drafts.push({
        title: 'Cargo Acquisition at Staging',
        type: 'TRANSPORT',
        target_zone: 'Zone B',
        required_capability: 'transport',
        priority: 1,
      });
      drafts.push({
        title: 'Express Delivery to Outbound Gate',
        type: 'DELIVERY',
        target_zone: 'Zone C',
        required_capability: 'transport',
        priority: 2,
        depends_on_indices: [0],
      });
    } else if (descLower.includes('transport') || descLower.includes('move')) {
      drafts.push({
        title: 'Internal Cargo Relocation',
        type: 'TRANSPORT',
        target_zone: 'Zone B',
        required_capability: 'transport',
        priority: 1,
      });
      drafts.push({
        title: 'Staging Delivery to Zone C',
        type: 'DELIVERY',
        target_zone: 'Zone C',
        required_capability: 'transport',
        priority: 2,
        depends_on_indices: [0],
      });
    } else {
      drafts.push({
        title: 'Zone A Storage Inspection',
        type: 'INSPECT',
        target_zone: 'Zone A',
        required_capability: 'inspect',
        priority: 1,
      });
      drafts.push({
        title: 'Payload Staging Transport',
        type: 'TRANSPORT',
        target_zone: 'Zone B',
        required_capability: 'transport',
        priority: 2,
        depends_on_indices: [0],
      });
      drafts.push({
        title: 'Dispatch Delivery Transfer',
        type: 'DELIVERY',
        target_zone: 'Zone C',
        required_capability: 'transport',
        priority: 3,
        depends_on_indices: [1],
      });
    }

    return { drafts, warnings };
  }
}

export class LLMMissionPlanner {
  private genAI: GoogleGenAI | null = null;

  constructor() {
    if (process.env.GEMINI_API_KEY) {
      this.genAI = new GoogleGenAI({
        apiKey: process.env.GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });
    }
  }

  public async plan(mission: MissionRecord): Promise<{ drafts: PlannedTaskDraft[]; warnings: string[] }> {
    const key = process.env.GEMINI_API_KEY;
    if (!this.genAI || !key || key === 'MY_GEMINI_API_KEY' || key.startsWith('MY_')) {
      throw new Error('LLM not configured: valid GEMINI_API_KEY environment variable is required.');
    }

    const prompt = `
You are the SwarmOS Autonomous Robotics Mission Planner.
Convert the following high-level warehouse mission directive into an executable task dependency DAG.

Warehouse Environment Constraints:
- Available Zones: "Zone A" (storage/inspection), "Zone B" (staging), "Zone C" (dispatch).
- Restricted Zones: "Zone R" (hazardous restricted area - NEVER schedule tasks inside Zone R).
- Task Types allowed: "INSPECT", "TRANSPORT", "DELIVERY".
- Capabilities allowed: "inspect", "transport".

Directive: "${mission.description}"

Return an array of structured tasks. For each task specify:
- title: clear operational name
- type: "INSPECT" | "TRANSPORT" | "DELIVERY"
- target_zone: "Zone A" | "Zone B" | "Zone C"
- required_capability: "inspect" or "transport"
- priority: integer 1 to 5
- depends_on_indices: array of integer 0-based indices of prerequisite tasks that must complete first
`;

    // Timeout protection so remote network calls never stall execution
    const generatePromise = this.genAI.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are an autonomous robotics mission planner. Return strictly valid JSON array conforming to the schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              title: { type: Type.STRING },
              type: { type: Type.STRING },
              target_zone: { type: Type.STRING },
              required_capability: { type: Type.STRING },
              priority: { type: Type.INTEGER },
              depends_on_indices: {
                type: Type.ARRAY,
                items: { type: Type.INTEGER },
              },
            },
            required: ['title', 'type', 'target_zone', 'required_capability', 'priority'],
          },
        },
      },
    });

    const timeoutPromise = new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('LLM call timed out after 3000ms')), 3000)
    );

    const response = await Promise.race([generatePromise, timeoutPromise]);

    const text = response.text?.trim() || '';
    if (!text) throw new Error('Empty response from LLM planner.');

    const parsed: unknown = JSON.parse(text);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      throw new Error('LLM output must be a non-empty array of tasks.');
    }

    const drafts: PlannedTaskDraft[] = [];
    const warnings: string[] = [];

    // Schema and boundary validation
    for (const [idx, item] of parsed.entries()) {
      if (typeof item !== 'object' || item === null) {
        throw new Error(`Task #${idx + 1} is not a valid object.`);
      }

      const { title, type, target_zone, required_capability, priority, depends_on_indices } = item as Record<string, unknown>;

      if (typeof title !== 'string' || !title.trim()) {
        throw new Error(`Task #${idx + 1} has invalid title.`);
      }

      if (!SUPPORTED_TASK_TYPES.includes(type as any)) {
        throw new Error(`Unsupported task type '${type}' in Task #${idx + 1}.`);
      }

      if (target_zone === 'Zone R') {
        throw new Error(`Security Violation: Task #${idx + 1} targets restricted area 'Zone R'.`);
      }

      if (!SUPPORTED_ZONES.includes(target_zone as any)) {
        throw new Error(`Nonexistent zone '${target_zone}' in Task #${idx + 1}.`);
      }

      if (typeof required_capability !== 'string' || !['inspect', 'transport'].includes(required_capability)) {
        throw new Error(`Invalid required capability '${required_capability}' in Task #${idx + 1}.`);
      }

      const depIndices = Array.isArray(depends_on_indices) ? (depends_on_indices as number[]) : [];
      for (const d of depIndices) {
        if (d >= idx) {
          throw new Error(`Forward dependency or self-dependency detected: Task #${idx} cannot depend on index ${d}.`);
        }
      }

      drafts.push({
        title,
        type: type as TaskRecord['type'],
        target_zone: target_zone as TaskRecord['target_zone'],
        required_capability,
        priority: typeof priority === 'number' ? priority : 1,
        depends_on_indices: depIndices,
      });
    }

    return { drafts, warnings };
  }
}

export class MissionPlannerService implements MissionPlannerInterface {
  private deterministicPlanner = new DeterministicPlanner();
  private llmPlanner = new LLMMissionPlanner();

  public async planMission(
    mission: MissionRecord,
    preferLLM: boolean = false
  ): Promise<PlanResult> {
    let drafts: PlannedTaskDraft[] = [];
    let warnings: string[] = [];
    let plannedBy: 'llm' | 'deterministic' = 'deterministic';

    // Attempt LLM planning if preferred and key exists
    if (preferLLM && process.env.GEMINI_API_KEY) {
      try {
        const llmResult = await this.llmPlanner.plan(mission);
        drafts = llmResult.drafts;
        warnings = llmResult.warnings;
        plannedBy = 'llm';
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        warnings.push(`LLM planning error (${errorMsg}). Safe deterministic fallback utilized.`);
        const fallback = this.deterministicPlanner.plan(mission);
        drafts = fallback.drafts;
        warnings.push(...fallback.warnings);
        plannedBy = 'deterministic';
      }
    } else {
      // Deterministic planning
      const result = this.deterministicPlanner.plan(mission);
      drafts = result.drafts;
      warnings = result.warnings;
      plannedBy = 'deterministic';
    }

    // Persist tasks and wire dependencies
    const createdTasks: TaskRecord[] = [];
    const now = new Date().toISOString();

    drafts.forEach((draft, idx) => {
      const taskId = `task_${mission.id}_${idx + 1}_${crypto.randomBytes(2).toString('hex')}`;
      const task: TaskRecord = {
        id: taskId,
        mission_id: mission.id,
        title: draft.title,
        type: draft.type,
        target_zone: draft.target_zone,
        required_capability: draft.required_capability,
        status: 'PENDING',
        priority: draft.priority,
        assigned_agent_id: null,
        assignment_rationale: null,
        attempt_count: 0,
        created_at: now,
        updated_at: now,
      };

      db.insertTask(task);
      createdTasks.push(task);
    });

    const taskDependencies: { task_id: string; depends_on_task_id: string }[] = [];
    drafts.forEach((draft, idx) => {
      if (draft.depends_on_indices && draft.depends_on_indices.length > 0) {
        const currentTaskId = createdTasks[idx].id;
        for (const depIdx of draft.depends_on_indices) {
          const depTaskId = createdTasks[depIdx].id;
          const depRecord = {
            task_id: currentTaskId,
            depends_on_task_id: depTaskId,
          };
          db.insertTaskDependency(depRecord);
          taskDependencies.push(depRecord);
        }
      }
    });

    // Validate no cycles in planned graph
    const cycleCheck = taskPlanner.detectCycles(
      createdTasks.map((t) => t.id),
      taskDependencies
    );
    if (cycleCheck.hasCycle) {
      throw new Error(`Cycle detected in generated task graph: ${cycleCheck.cyclePath?.join(' -> ')}`);
    }

    db.updateMissionStatus(mission.id, 'PLANNED');

    eventHistory.log(
      'PLAN_GENERATED',
      {
        plan_version: mission.plan_version,
        planned_by: plannedBy,
        tasks_count: createdTasks.length,
        task_ids: createdTasks.map((t) => t.id),
        warnings,
      },
      mission.id
    );

    return { tasks: createdTasks, warnings, plannedBy };
  }
}

export const missionPlanner = new MissionPlannerService();
