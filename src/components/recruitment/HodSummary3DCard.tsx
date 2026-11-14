// src/components/recruitment/HodSummary3DCard.tsx
import React from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Briefcase,
  Users,
} from 'lucide-react';

export interface HodSummaryGroup {
  name: string;
  total: number;
  vacancies: number;
  joined: number;
  ongoing: number;
  heldUp: number;
  departments: Set<string>;
  shownCount?: number;
}

interface HodSummary3DCardProps {
  group: HodSummaryGroup;
  isSelected?: boolean;
  onSelect: (hodName: string) => void;
}

export const HodSummary3DCard: React.FC<HodSummary3DCardProps> = ({
  group,
  isSelected = false,
  onSelect,
}) => {
  const initials = group.name
    .split(' ')
    .filter(Boolean)
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const departmentList = Array.from(group.departments);
  const fillRate = group.total > 0 ? Math.round((group.joined / group.total) * 100) : 0;

  return (
    <div className="group relative [perspective:1100px]">
      {/* 3D Backplate for Physical Layered Depth */}
      <div
        aria-hidden="true"
        className={`absolute inset-x-2 -bottom-1.5 top-2 rounded-2xl transition-all duration-300 ${
          isSelected
            ? 'bg-indigo-600/35 dark:bg-indigo-500/30 translate-y-0.5'
            : 'bg-slate-300/60 dark:bg-slate-800/80 group-hover:translate-y-1 group-hover:bg-indigo-500/25'
        }`}
      />

      <button
        type="button"
        onClick={() => onSelect(group.name)}
        title={`Jump to ${group.name} recruitment checklist`}
        className={`relative w-full text-left rounded-2xl p-4 transition-all duration-300 cursor-pointer overflow-hidden border transform-gpu group-hover:-translate-y-1.5 group-hover:[transform:translateY(-6px)_rotateX(2.5deg)] ${
          isSelected
            ? 'bg-gradient-to-br from-slate-900 via-indigo-950 to-slate-900 text-white border-indigo-400 shadow-[0_18px_35px_-12px_rgba(79,70,229,0.55)] ring-2 ring-indigo-400/50'
            : 'bg-gradient-to-br from-white via-slate-50/90 to-slate-100/80 dark:from-slate-900 dark:via-slate-900 dark:to-slate-950 text-slate-900 dark:text-white border-slate-200/90 dark:border-slate-800 shadow-[0_12px_24px_-12px_rgba(15,23,42,0.28)] hover:border-indigo-400/70 dark:hover:border-indigo-500/60 hover:shadow-[0_20px_32px_-12px_rgba(59,130,246,0.3)]'
        }`}
      >
        {/* Top Specular Edge */}
        <div
          aria-hidden="true"
          className={`absolute inset-x-0 top-0 h-[2px] ${
            isSelected
              ? 'bg-gradient-to-r from-cyan-400 via-indigo-400 to-blue-400'
              : 'bg-gradient-to-r from-transparent via-indigo-500/60 to-transparent opacity-60 group-hover:opacity-100'
          }`}
        />

        {/* Header Row: 3D Crest + HOD Name + Department Chips */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0">
            <div
              className={`w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-sm shrink-0 shadow-md border transition-transform duration-300 group-hover:scale-105 ${
                isSelected
                  ? 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white border-white/25'
                  : 'bg-gradient-to-br from-slate-800 to-indigo-900 text-amber-300 border-slate-700/80 dark:border-indigo-700/50'
              }`}
            >
              {initials || 'HD'}
            </div>
            <div className="min-w-0">
              <div className="flex items-center space-x-1.5">
                <h3
                  className={`text-sm font-extrabold truncate ${
                    isSelected ? 'text-white' : 'text-slate-900 dark:text-white'
                  }`}
                >
                  {group.name}
                </h3>
                {isSelected && (
                  <span className="px-1.5 py-0.5 rounded bg-cyan-400/20 text-cyan-200 border border-cyan-400/40 text-[9px] font-mono font-bold uppercase shrink-0">
                    Active
                  </span>
                )}
              </div>
              <div
                className={`flex items-center space-x-1 text-[11px] mt-0.5 truncate ${
                  isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                <Building2 className="w-3 h-3 shrink-0 opacity-80" />
                <span className="truncate">
                  {departmentList.length > 0 ? departmentList.join(', ') : 'General Department'}
                </span>
              </div>
            </div>
          </div>

          {/* 3D Fill Rate Badge */}
          <div
            className={`px-2 py-1 rounded-lg text-[10px] font-mono font-extrabold shrink-0 border shadow-inner ${
              isSelected
                ? 'bg-white/10 text-cyan-200 border-white/15'
                : 'bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
            }`}
          >
            {fillRate}% Filled
          </div>
        </div>

        {/* Core 3D Stat Wells: MRFs & Vacancies */}
        <div className="grid grid-cols-2 gap-2.5 mt-3.5">
          <div
            className={`rounded-xl px-3 py-2 border shadow-inner ${
              isSelected
                ? 'bg-white/10 border-white/15'
                : 'bg-white/90 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div
              className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider ${
                isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Briefcase className="w-3 h-3" />
              <span>Requisitions</span>
            </div>
            <div className="text-lg font-black font-mono mt-0.5 leading-tight">
              {group.total}
            </div>
          </div>

          <div
            className={`rounded-xl px-3 py-2 border shadow-inner ${
              isSelected
                ? 'bg-white/10 border-white/15'
                : 'bg-white/90 dark:bg-slate-950/60 border-slate-200/80 dark:border-slate-800'
            }`}
          >
            <div
              className={`flex items-center space-x-1 text-[10px] font-bold uppercase tracking-wider ${
                isSelected ? 'text-indigo-200' : 'text-slate-500 dark:text-slate-400'
              }`}
            >
              <Users className="w-3 h-3" />
              <span>Vacancies</span>
            </div>
            <div className="text-lg font-black font-mono mt-0.5 leading-tight">
              {group.vacancies}
            </div>
          </div>
        </div>

        {/* Pipeline Breakdown Chips */}
        <div className="flex flex-wrap items-center gap-1.5 mt-3 text-[10px] font-mono font-bold">
          <span
            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border ${
              isSelected
                ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
                : 'bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/70'
            }`}
          >
            <CheckCircle2 className="w-3 h-3" />
            <span>{group.joined} Joined</span>
          </span>

          <span
            className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border ${
              isSelected
                ? 'bg-blue-500/20 text-blue-200 border-blue-400/30'
                : 'bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/70'
            }`}
          >
            <Clock className="w-3 h-3" />
            <span>{group.ongoing} Ongoing</span>
          </span>

          {group.heldUp > 0 && (
            <span
              className={`inline-flex items-center space-x-1 px-2 py-0.5 rounded-md border ${
                isSelected
                  ? 'bg-amber-500/25 text-amber-200 border-amber-400/40'
                  : 'bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/70'
              }`}
            >
              <AlertTriangle className="w-3 h-3" />
              <span>{group.heldUp} Held Up</span>
            </span>
          )}
        </div>

        {/* 3D Fill Progress Bar + Checklist Link */}
        <div className="mt-3 pt-2.5 border-t border-slate-200/70 dark:border-slate-800/80 space-y-2">
          <div
            className={`w-full h-1.5 rounded-full overflow-hidden ${
              isSelected ? 'bg-white/15' : 'bg-slate-200 dark:bg-slate-800'
            }`}
          >
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isSelected
                  ? 'bg-gradient-to-r from-cyan-400 to-emerald-400'
                  : 'bg-gradient-to-r from-indigo-600 to-emerald-500'
              }`}
              style={{ width: `${fillRate}%` }}
            />
          </div>

          <div
            className={`flex items-center justify-between text-[11px] font-bold ${
              isSelected
                ? 'text-cyan-200'
                : 'text-indigo-600 dark:text-indigo-400 group-hover:text-indigo-700 dark:group-hover:text-indigo-300'
            }`}
          >
            <span>
              {isSelected ? 'Viewing HOD Checklist' : 'Open HOD Checklist'}
            </span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover:translate-x-1" />
          </div>
        </div>
      </button>
    </div>
  );
};
