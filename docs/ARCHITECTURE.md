# SwarmOS Architecture Documentation — Phase 2 MVP

## System Overview

SwarmOS is a modular monolith orchestrating autonomous robotic agents across diverse hardware profiles behind a vendor-neutral control plane.

```
                    ┌────────────────────────────────────────────────────────┐
                    │                    SwarmOS Frontend                    │
                    │ (Mission Control / Spatial Map / Pipeline / Failure UI)│
                    └──────────────────────────┬─────────────────────────────┘
                                               │ REST / Polling (port 3000)
                    ┌──────────────────────────▼─────────────────────────────┐
                    │                  Express API Gateway                   │
                    └──────────┬───────────────┬───────────────┬─────────────┘
                               │               │               │
        ┌──────────────────────▼──┐   ┌────────▼────────┐   ┌──▼──────────────────┐
        │     Mission Planner     │   │  Agent Registry │   │    Safety Engine    │
        │ ┌─────────────────────┐ │   │ (Fleet & State) │   │ (Zone R, Cap, Bat,  │
        │ │ LLM Planner (Gemini)│ │   └────────┬────────┘   │  Resource Conflicts)│
        │ ├─────────────────────┤ │            │            │ [Double Validation] │
        │ │ Deterministic (Safe)│ │            │            └──┬──────────────────┘
        │ └─────────────────────┘ │            │               │
        └──────────────┬──────────┘            │               │
                       │                       │               │
        ┌──────────────▼───────────────────────▼───────────────▼───────────┐
        │                       Assignment Engine                          │
        │    (Capability Matching + Multi-Factor Cost Scoring + Locks)     │
        └──────────────────────────────┬───────────────────────────────────┘
                                       │
        ┌──────────────────────────────▼───────────────────────────────────┐
        │                     Execution Coordinator                       │
        │      (DAG Cycle Detection & Task State Transitions: PENDING      │
        │        -> READY -> ASSIGNED -> DISPATCHED -> RUNNING -> DONE)    │
        └──────────────────────────────┬───────────────────────────────────┘
                                       │
                       ┌───────────────┴───────────────┐
                       │                               │
        ┌──────────────▼──────────────┐ ┌──────────────▼───────────────────┐
        │    Common Adapter Layer     │ │         Recovery Engine          │
        │ ┌─────────────────────────┐ │ │ (Failure Detection, Reassignment│
        │ │ Simulated Adapter (MVP) │ │ │  to Replacement, BLOCKED states) │
        │ └─────────────────────────┘ │ └──────────────────────────────────┘
        └──────────────┬──────────────┘
                       │
        ┌──────────────▼───────────────────────────────────────────────────┐
        │                    Persistence Engine (SQLite)                   │
        │   (Missions, Agents, Tasks, Dependencies, Attempts, Events)      │
        └──────────────────────────────────────────────────────────────────┘
```

## Core Modules

### 1. Mission Planner Service (`server/modules/mission_planner.ts`)
Implements `MissionPlannerInterface`. Supports two interchangeable engines:
- **`LLMMissionPlanner`**: Uses `@google/genai` with model `gemini-3.8-flash` and strict JSON schemas (`responseSchema`) to parse arbitrary plain-language missions into DAG tasks.
- **`DeterministicPlanner`**: Fast, reliable rule-based planner serving both as default and automatic fallback if the LLM is unconfigured or times out.
- **Schema Validation**: Explicitly rejects unsupported task types, invalid zones, and restricted `Zone R` directives.

### 2. Task Planner (`server/modules/task_planner.ts`)
- **Cycle Detection**: Employs depth-first search to verify that planned dependencies form a strict Directed Acyclic Graph (DAG).
- **Prerequisite Enforcement**: Evaluates which tasks have all predecessors in `COMPLETED` status, promoting them to `READY`.

### 3. Safety & Policy Engine (`server/modules/safety_engine.ts`)
Enforces deterministic safety rules with **double validation** (evaluated before task assignment and revalidated immediately prior to physical dispatch):
- **Restricted Zone Guard**: Blocks tasks directing machines into `Zone R`.
- **Capability Compatibility**: Validates agent capabilities against task demands.
- **Battery Safety Floor**: Blocks dispatch if battery level is below 20%.
- **Resource Conflict Guard**: Prevents dispatching agents that are in `BUSY` or `FAILED` states.

### 4. Assignment Engine (`server/modules/assignment_engine.ts`)
- Employs multi-factor scoring: $\text{Score} = \text{Base} + \text{BatteryScore} + \text{ProximityBonus} + \text{SpecializationAffinity}$.
- Explains the decision in `assignment_rationale`.
- Applies atomic reservation locks to prevent race conditions.

### 5. Recovery Engine (`server/modules/recovery_engine.ts`)
- Manages agent hardware failures and task execution aborts.
- Evaluates replacement candidates: e.g. when `Robot B` fails during transport, reassigns to `Robot C`.
- If no capable replacement exists in the fleet (e.g. `Drone A` fails during aerial inspection), safely marks the task and mission as `BLOCKED` with an explanation.

### 6. Execution Coordinator (`server/modules/execution_coordinator.ts`)
Drives the state machine:
$$\text{PENDING} \longrightarrow \text{READY} \longrightarrow \text{ASSIGNED} \longrightarrow \text{DISPATCHED} \longrightarrow \text{RUNNING} \longrightarrow \text{COMPLETED}$$
Supports concurrent execution of independent ready tasks.

### 7. Common Agent Adapter (`server/modules/adapters/`)
Vendor-neutral `AgentAdapter` abstraction implemented by `SimulatedAdapter` for the simulated warehouse environment.
