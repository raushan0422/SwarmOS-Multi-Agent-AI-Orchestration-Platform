# SwarmOS Technical Decisions Log

## Architecture Decisions

### ADR-001: Modular Monolith Full-Stack Architecture
- **Context**: The product requires an API backend, state machines, simulation loop, and an interactive monitoring dashboard. Microservices would introduce unnecessary deployment complexity and IPC latency in this hackathon development stage.
- **Decision**: Adopted a modular monolith using TypeScript and Express alongside React/Vite in a unified process.
- **Rationale**: Keeps domain boundaries clear (mission planner, task planner, assignment engine, safety engine, adapters) while enabling synchronous zero-latency calls, rapid end-to-end iteration, and zero multi-service orchestration overhead.

### ADR-002: Built-in SQLite Persistence Layer
- **Context**: The platform needs persistent records for missions, tasks, dependencies, agent fleet records, attempts, and audit events.
- **Decision**: Used synchronous SQLite via Node 22's standard library `node:sqlite`.
- **Rationale**: Guarantees atomic writes, foreign key relational integrity, rapid query performance, and allows complete demo reset in milliseconds without external database daemon dependencies.

### ADR-003: Deterministic Planner as Primary Baseline and Automatic Fallback
- **Context**: SwarmOS requires a dependable, deterministic execution guarantee even when external network connections or LLM tokens are unavailable.
- **Decision**: Implemented a rule-based deterministic planner for Phase 1 that accurately structures the SRS canonical mission into DAG-ordered tasks. In Phase 2, layered the `LLMMissionPlanner` behind a common `MissionPlannerInterface`, with automatic fallback to the deterministic planner upon any LLM error or schema rejection.
- **Rationale**: Guarantees reproducible hackathon demos and bulletproof testing.

### ADR-004: Strict Zero-Pill Frontend Design Discipline
- **Context**: Standard AI-generated interfaces default to visual clutter, badge sandwiches, and garish pill wrappers for static metadata.
- **Decision**: Enforced clean typographic layouts using subtle separators (`·`), high-density tabular numbers (`tabular-nums`), and reserved pill-shaped elements strictly for interactive button controls.
- **Rationale**: Elevates UI clarity, fits industrial robotics control room aesthetics, and ensures high contrast and readability.

### ADR-005: Pre-Dispatch Safety Revalidation & Recovery Separation
- **Context**: An agent's state or the environment can change between the moment an assignment is made and the moment physical/simulated dispatch begins.
- **Decision**: Implemented double-validation in `SafetyEngine` (pre-assignment check and pre-dispatch revalidation), coupled with a dedicated `RecoveryEngine` that handles reassignment and records attempt failure reasons.
- **Rationale**: Avoids dispatching to machines that experienced unexpected faults while in the queue, preventing unhandled runtime exceptions.
