/**
 * SwarmOS Virtual Warehouse Map Visualizer
 * Renders Zone A (Storage/Inspection), Zone B (Staging), Zone C (Dispatch), and Zone R (Restricted).
 * Displays live autonomous agent markers (Drone A, Robot B, Robot C) and transit positions.
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Agent, Task } from '../types/swarm.ts';

interface WarehouseMapProps {
  agents: Agent[];
  activeTask?: Task | null;
}

interface ZoneInfo {
  id: 'Zone A' | 'Zone B' | 'Zone C' | 'Zone R';
  name: string;
  role: string;
  isRestricted: boolean;
  colorBorder: string;
  colorBg: string;
  coordinates: { x: number; y: number; w: number; h: number };
}

const ZONES: ZoneInfo[] = [
  {
    id: 'Zone A',
    name: 'Zone A',
    role: 'Storage & Aerial Inspection',
    isRestricted: false,
    colorBorder: 'border-sky-500/40',
    colorBg: 'bg-sky-950/20',
    coordinates: { x: 30, y: 30, w: 260, h: 220 },
  },
  {
    id: 'Zone B',
    name: 'Zone B',
    role: 'Staging & Automated Docking',
    isRestricted: false,
    colorBorder: 'border-emerald-500/40',
    colorBg: 'bg-emerald-950/20',
    coordinates: { x: 320, y: 30, w: 260, h: 220 },
  },
  {
    id: 'Zone C',
    name: 'Zone C',
    role: 'Outbound Dispatch & Shipping',
    isRestricted: false,
    colorBorder: 'border-amber-500/40',
    colorBg: 'bg-amber-950/20',
    coordinates: { x: 320, y: 280, w: 260, h: 200 },
  },
  {
    id: 'Zone R',
    name: 'Zone R',
    role: 'Restricted Hazardous Buffer',
    isRestricted: true,
    colorBorder: 'border-rose-600/70',
    colorBg: 'bg-rose-950/30',
    coordinates: { x: 30, y: 280, w: 260, h: 200 },
  },
];

export const WarehouseMap: React.FC<WarehouseMapProps> = ({ agents, activeTask }) => {
  return (
    <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-base font-semibold text-slate-100">
            Simulated Warehouse Spatial Grid
          </h2>
          <div className="text-xs text-slate-400 mt-0.5">
            Real-time agent localization · Autonomous geofence monitoring
          </div>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-4 text-xs text-slate-400">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-sky-500/80"></span>
            Storage
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500/80"></span>
            Staging
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-amber-500/80"></span>
            Dispatch
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm bg-rose-600/80"></span>
            Restricted (Policy Enforced)
          </span>
        </div>
      </div>

      {/* 2D Interactive Grid */}
      <div className="relative w-full h-[360px] bg-slate-950 border border-slate-800/80 rounded-lg overflow-hidden grid grid-cols-2 grid-rows-2 gap-3 p-3">
        {/* Subtle grid pattern background */}
        <div
          className="absolute inset-0 pointer-events-none opacity-15"
          style={{
            backgroundImage:
              'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.2) 1px, transparent 0)',
            backgroundSize: '24px 24px',
          }}
        />

        {ZONES.map((zone) => {
          const zoneAgents = agents.filter((a) => a.current_zone === zone.id);
          const isTargeted = activeTask?.target_zone === zone.id;

          return (
            <div
              key={zone.id}
              className={`relative rounded-lg p-3 border ${zone.colorBorder} ${zone.colorBg} flex flex-col justify-between transition-all ${
                isTargeted ? 'ring-2 ring-indigo-400/80 shadow-lg shadow-indigo-500/10' : ''
              } ${
                zone.isRestricted
                  ? 'bg-[repeating-linear-gradient(45deg,rgba(225,29,72,0.06),rgba(225,29,72,0.06)_10px,transparent_10px,transparent_20px)]'
                  : ''
              }`}
            >
              {/* Zone Header */}
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-slate-100">
                      {zone.name}
                    </span>
                    {zone.isRestricted && (
                      <span className="text-[10px] uppercase font-mono tracking-wider font-semibold text-rose-400 bg-rose-950/80 border border-rose-800/60 px-1.5 py-0.5 rounded">
                        Restricted Area
                      </span>
                    )}
                    {isTargeted && (
                      <span className="text-[10px] uppercase font-mono font-medium text-indigo-300 bg-indigo-950/80 border border-indigo-700/60 px-1.5 py-0.5 rounded">
                        Target Zone
                      </span>
                    )}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">{zone.role}</div>
                </div>

                <div className="text-xs font-mono tabular-nums text-slate-500">
                  {zoneAgents.length} {zoneAgents.length === 1 ? 'agent' : 'agents'}
                </div>
              </div>

              {/* Agents stationed in this zone */}
              <div className="flex flex-wrap items-center gap-2.5 mt-auto pt-3">
                {zoneAgents.map((agent) => {
                  const isBusy = agent.status === 'BUSY';
                  const isDrone = agent.type === 'drone';

                  return (
                    <div
                      key={agent.id}
                      className={`flex items-center gap-2 px-2.5 py-1.5 rounded-md border text-xs transition-all ${
                        isBusy
                          ? 'bg-indigo-950/70 border-indigo-500 text-indigo-200 shadow-sm'
                          : 'bg-slate-900/90 border-slate-700 text-slate-200'
                      }`}
                    >
                      {/* Icon */}
                      <span className="text-sm">
                        {isDrone ? '🚁' : '🤖'}
                      </span>

                      <div className="flex flex-col">
                        <span className="font-medium">{agent.name}</span>
                        <span className="text-[10px] text-slate-400 font-mono tabular-nums">
                          {agent.status} · {agent.battery_level}%
                        </span>
                      </div>
                    </div>
                  );
                })}

                {zoneAgents.length === 0 && (
                  <div className="text-xs text-slate-600 italic">
                    {zone.isRestricted ? 'Clear · No access permitted' : 'Station clear'}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
