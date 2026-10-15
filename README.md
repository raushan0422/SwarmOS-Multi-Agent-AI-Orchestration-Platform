# SwarmOS

> **One Mission. Any Machine. One Control Plane.**

SwarmOS is a vendor-neutral autonomous robotics and drone orchestration platform. It converts high-level natural language missions into structured tasks, assigns them based on agent capabilities, validates safety constraints, coordinates execution across heterogeneous machines (drones and mobile robots), and records an immutable event audit trail.

---

## Features (Phase 1: Working Proof of Concept)

- **Mission Authoring & Parsing**: Create missions in plain language or run preset scenarios including the canonical SRS scenario: *"Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas."*
- **Deterministic Mission Planner**: Automatically generates structured task breakdowns (`INSPECT`, `PICKUP`, `TRANSPORT`), sets targets, and assigns dependency prerequisites.
- **Heterogeneous Fleet Registry**:
  - **Drone A**: Aerial reconnaissance and inspection unit.
  - **Robot B**: Autonomous Mobile Robot (AMR) with heavy payload transport.
  - **Robot C**: Autonomous Mobile Robot (AMR) with rapid transit capability.
- **Prerequisite & DAG Evaluation**: Strict task state progression (`PENDING` → `READY` → `ASSIGNED` → `DISPATCHED` → `RUNNING` → `COMPLETED`). Tasks never start before prerequisites finish.
- **Deterministic Safety & Policy Engine**:
  - `RESTRICTED_ZONE`: Prohibits any task targeting Zone R (Restricted buffer).
  - `CAPABILITY_MATCH`: Verifies agent possesses exact task capability before assignment.
  - `MINIMUM_BATTERY`: Blocks assignments to agents with battery levels below 20%.
- **Cost-Scored Assignment Engine**: Automatically pairs ready tasks with the most qualified and available agent.
- **Simulator Adapter**: Simulates realistic stepped execution with zone transits, battery depletion, and execution feedback.
- **Interactive Warehouse Map Visualizer**: 2D spatial representation of Zone A (Storage), Zone B (Staging), Zone C (Dispatch), and Zone R (Restricted warning zone), showing real-time agent positions.
- **Event Audit Ledger**: Comprehensive timeline recording policy validations, assignments, state transitions, and completions.
- **One-Click Reset**: Resets the entire fleet and database back to clean seed states without manual database edits.

---

## Setup & Running the Application

### Prerequisites

- Node.js 20+ (Node 22 LTS recommended)
- npm or bun

### Installation

```bash
npm install
```

### Development Server

Runs both the Express API backend and Vite client frontend concurrently on port 3000:

```bash
npm run dev
```

Visit the application at `http://localhost:3000`.

### Running Automated Tests

Run the deterministic test suite:

```bash
npm test
```

Or directly via `tsx`:

```bash
npx tsx --test tests/phase1_mission_lifecycle.test.ts
```

---

## API Summary

- `POST /api/missions`: Create a mission record
- `GET /api/missions`: List all missions
- `GET /api/missions/:id`: Get mission detail, task graph, and recent events
- `POST /api/missions/:id/plan`: Generate and validate deterministic plan
- `POST /api/missions/:id/start`: Start autonomous execution
- `POST /api/missions/:id/step`: Execute a single deterministic cycle tick
- `POST /api/missions/:id/pause`: Pause mission execution
- `GET /api/agents`: List all fleet units
- `PATCH /api/agents/:id/status`: Update agent status, zone, or battery
- `GET /api/missions/:id/tasks`: List mission tasks and dependencies
- `GET /api/missions/:id/events`: Query mission event audit log
- `POST /api/system/reset`: Reset entire database and fleet to clean initial state
