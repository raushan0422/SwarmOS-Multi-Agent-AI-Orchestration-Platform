/**
 * SwarmOS - One Mission. Any Machine. One Control Plane.
 * Central Orchestration Dashboard - Phase 2 MVP
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { Mission, Agent, Task, TaskDependency, EventItem } from './types/swarm.ts';
import { Header } from './components/Header.tsx';
import { MissionHeader } from './components/MissionHeader.tsx';
import { MissionList } from './components/MissionList.tsx';
import { WarehouseMap } from './components/WarehouseMap.tsx';
import { FleetGrid } from './components/FleetGrid.tsx';
import { TaskPipeline } from './components/TaskPipeline.tsx';
import { EventAuditTrail } from './components/EventAuditTrail.tsx';
import { CreateMissionModal } from './components/CreateMissionModal.tsx';

export default function App() {
  const [activeTab, setActiveTab] = useState<'mission' | 'missions' | 'fleet' | 'tasks' | 'events'>('mission');
  const [missions, setMissions] = useState<Mission[]>([]);
  const [activeMissionId, setActiveMissionId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [dependencies, setDependencies] = useState<TaskDependency[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [events, setEvents] = useState<EventItem[]>([]);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState<boolean>(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const notify = (msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => setFeedbackNotice(null), 4000);
  };

  // Fetch Fleet
  const fetchAgents = useCallback(async () => {
    try {
      const res = await fetch('/api/agents');
      if (res.ok) {
        const data = await res.json();
        setAgents(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Missions
  const fetchMissions = useCallback(async () => {
    try {
      const res = await fetch('/api/missions');
      if (res.ok) {
        const data: Mission[] = await res.json();
        setMissions(data);

        if (!activeMissionId && data.length > 0) {
          setActiveMissionId(data[0].id);
        } else if (data.length === 0) {
          initDefaultMission();
        }
      }
    } catch {
      // ignore
    }
  }, [activeMissionId]);

  // Fetch Active Mission Details
  const fetchActiveMissionDetails = useCallback(async (missionId: string) => {
    try {
      const res = await fetch(`/api/missions/${missionId}`);
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks || []);
        setDependencies(data.dependencies || []);
      }
    } catch {
      // ignore
    }
  }, []);

  // Fetch Global Events
  const fetchEvents = useCallback(async (missionId?: string) => {
    try {
      const url = missionId ? `/api/missions/${missionId}/events` : '/api/events';
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setEvents(data);
      }
    } catch {
      // ignore
    }
  }, []);

  // Initialize Default Canonical Mission
  const initDefaultMission = async () => {
    try {
      const res = await fetch('/api/missions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: 'SRS Canonical Scenario',
          description:
            'Inspect Zone A and transport eligible packages to Dispatch without entering restricted areas.',
          priority: 'HIGH',
        }),
      });
      if (res.ok) {
        const newMission: Mission = await res.json();
        setMissions([newMission]);
        setActiveMissionId(newMission.id);
        const planRes = await fetch(`/api/missions/${newMission.id}/plan`, { method: 'POST' });
        if (planRes.ok) {
          const planData = await planRes.json();
          setTasks(planData.tasks);
          setDependencies(planData.dependencies);
          setMissions([planData.mission]);
        }
      }
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchAgents();
    fetchMissions();
    fetchEvents();
  }, [fetchAgents, fetchMissions, fetchEvents]);

  useEffect(() => {
    if (activeMissionId) {
      fetchActiveMissionDetails(activeMissionId);
      fetchEvents(activeMissionId);
    }
  }, [activeMissionId, fetchActiveMissionDetails, fetchEvents]);

  const activeMission = missions.find((m) => m.id === activeMissionId) || null;
  const isRunning = activeMission?.status === 'RUNNING';

  useEffect(() => {
    const intervalTime = isRunning ? 1200 : 3500;
    const timer = setInterval(() => {
      fetchAgents();
      if (activeMissionId) {
        fetchActiveMissionDetails(activeMissionId);
        fetchEvents(activeMissionId);
        fetch('/api/missions').then((r) => {
          if (r.ok) r.json().then(setMissions);
        });
      }
    }, intervalTime);

    return () => clearInterval(timer);
  }, [isRunning, activeMissionId, fetchAgents, fetchActiveMissionDetails, fetchEvents]);

  // Actions
  const handlePlanMission = async (preferLLM: boolean) => {
    if (!activeMissionId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/missions/${activeMissionId}/plan`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preferLLM }),
      });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setDependencies(data.dependencies);
        setMissions((prev) =>
          prev.map((m) => (m.id === activeMissionId ? data.mission : m))
        );
        const plannerLabel = data.plannedBy === 'llm' ? 'LLM-Assisted' : 'Deterministic';
        notify(`Task plan generated via ${plannerLabel} planner.`);
        fetchEvents(activeMissionId);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStartMission = async () => {
    if (!activeMissionId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/missions/${activeMissionId}/start`, { method: 'POST' });
      if (res.ok) {
        notify('Mission execution commenced across autonomous fleet.');
        setMissions((prev) =>
          prev.map((m) =>
            m.id === activeMissionId ? { ...m, status: 'RUNNING' } : m
          )
        );
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleStepMission = async () => {
    if (!activeMissionId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/missions/${activeMissionId}/step`, { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setTasks(data.tasks);
        setAgents(data.agents);
        setMissions((prev) =>
          prev.map((m) => (m.id === activeMissionId ? data.mission : m))
        );
        notify(
          `Executed cycle tick: ${data.tickResult.dispatchedTasksCount} task(s) dispatched.`
        );
        fetchEvents(activeMissionId);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handlePauseMission = async () => {
    if (!activeMissionId) return;
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/missions/${activeMissionId}/pause`, { method: 'POST' });
      if (res.ok) {
        notify('Mission execution paused.');
        setMissions((prev) =>
          prev.map((m) =>
            m.id === activeMissionId ? { ...m, status: 'PAUSED' } : m
          )
        );
        fetchEvents(activeMissionId);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetSystem = async () => {
    setIsProcessing(true);
    try {
      const res = await fetch('/api/system/reset', { method: 'POST' });
      if (res.ok) {
        notify('System reset to initial clean seed state.');
        await fetchAgents();
        await initDefaultMission();
        await fetchEvents();
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleInjectFailure = async (agentId: string) => {
    setIsProcessing(true);
    try {
      const res = await fetch(`/api/agents/${agentId}/fail`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Simulated hardware subsystem fault' }),
      });
      if (res.ok) {
        const data = await res.json();
        notify(`Failure injected on ${agentId}. Evaluating recovery...`);
        await fetchAgents();
        if (activeMissionId) {
          await fetchActiveMissionDetails(activeMissionId);
          await fetchEvents(activeMissionId);
          fetch('/api/missions').then((r) => {
            if (r.ok) r.json().then(setMissions);
          });
        }
      }
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCreateMission = async (name: string, description: string, priority: string) => {
    const res = await fetch('/api/missions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description, priority }),
    });
    if (res.ok) {
      const newMission: Mission = await res.json();
      setMissions((prev) => [newMission, ...prev]);
      setActiveMissionId(newMission.id);
      setActiveTab('mission');
      notify(`Mission "${newMission.name}" created.`);
      fetchEvents(newMission.id);
    }
  };

  const activeTask = tasks.find(
    (t) => t.status === 'RUNNING' || t.status === 'DISPATCHED' || t.status === 'ASSIGNED'
  );

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <Header
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenCreateMission={() => setIsCreateModalOpen(true)}
      />

      {feedbackNotice && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-indigo-500/50 text-indigo-200 px-4 py-2.5 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-indigo-400"></span>
          <span>{feedbackNotice}</span>
        </div>
      )}

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-6 flex flex-col gap-6">
        {missions.length > 1 && (
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span>Select Active Mission:</span>
            <select
              value={activeMissionId || ''}
              onChange={(e) => setActiveMissionId(e.target.value)}
              className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1 text-slate-200 text-xs focus:outline-hidden focus:border-indigo-500 font-medium"
            >
              {missions.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.name} ({m.status})
                </option>
              ))}
            </select>
          </div>
        )}

        <MissionHeader
          mission={activeMission}
          tasks={tasks}
          isProcessing={isProcessing}
          onPlan={handlePlanMission}
          onStart={handleStartMission}
          onStep={handleStepMission}
          onPause={handlePauseMission}
          onReset={handleResetSystem}
        />

        {activeTab === 'mission' && (
          <div className="flex flex-col gap-6">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
              <WarehouseMap agents={agents} activeTask={activeTask} />
              <FleetGrid agents={agents} onInjectFailure={handleInjectFailure} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
              <TaskPipeline
                tasks={tasks}
                dependencies={dependencies}
                agents={agents}
              />
              <EventAuditTrail events={events} />
            </div>
          </div>
        )}

        {activeTab === 'missions' && (
          <div className="flex flex-col gap-6">
            <MissionList
              missions={missions}
              activeMissionId={activeMissionId}
              onSelectMission={(id) => {
                setActiveMissionId(id);
                setActiveTab('mission');
              }}
              onOpenCreate={() => setIsCreateModalOpen(true)}
            />
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="flex flex-col gap-6">
            <FleetGrid agents={agents} onInjectFailure={handleInjectFailure} />
            <WarehouseMap agents={agents} activeTask={activeTask} />
          </div>
        )}

        {activeTab === 'tasks' && (
          <div className="flex flex-col gap-6">
            <TaskPipeline
              tasks={tasks}
              dependencies={dependencies}
              agents={agents}
            />
          </div>
        )}

        {activeTab === 'events' && (
          <div className="flex flex-col gap-6">
            <EventAuditTrail events={events} />
          </div>
        )}
      </main>

      <footer className="border-t border-slate-800/80 py-4 px-6 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div>
          SwarmOS Orchestration Platform · One Mission. Any Machine. One Control Plane.
        </div>
        <div className="font-mono text-slate-600">
          Simulated Warehouse Grid · Phase 2 Minimum Viable Product
        </div>
      </footer>

      <CreateMissionModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onCreate={handleCreateMission}
      />
    </div>
  );
}
