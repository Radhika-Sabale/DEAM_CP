/**
 * @file studyStore.ts
 * Research study configuration, consent gating, counterbalanced test form order,
 * task completion tracking, and privacy-preserving local storage persistence (Stage 11C).
 *
 * PRIVACY INVARIANT:
 * This store strictly manages pseudonymized participant IDs and study state.
 * It NEVER stores, reads, or serializes any LLM API key, student names, or emails.
 */

import { create } from 'zustand';
import { assignFormOrder } from '../engine/evaluation/prepost';
import type { FormOrder } from '../engine/evaluation/types';
import type { PrePostTestResult, SusResult } from '../types/logging';
import { useLogStore } from './logStore';

/**
 * Standard neutral placeholder consent wording.
 * LOCATION TO EDIT: Stage 12 Research Protocol will finalize this text.
 */
export const CONSENT_TEXT_PLACEHOLDER =
  'I understand that my pseudonymized interaction logs (time per step, hint requests, and answers) will be recorded locally for digital electronics pedagogy research. No personal identifying information is collected.';

const STORAGE_KEY = 'delab:v1:study_store';

export interface StudyCompletedTasks {
  readonly pretestCompleted: boolean;
  readonly posttestCompleted: boolean;
  readonly susCompleted: boolean;
  readonly practiceSessionsCount: number;
  readonly quizzesCompletedCount: number;
}

export interface StudyState {
  participantId: string;
  hasConsented: boolean;
  studyModeActive: boolean;
  formOrder: FormOrder;
  completedTasks: StudyCompletedTasks;
  pretestUnlocked: boolean;
  posttestUnlocked: boolean;
  latestPretestResult: PrePostTestResult | null;
  latestPosttestResult: PrePostTestResult | null;
  latestSusResult: SusResult | null;

  setParticipantId: (id: string) => void;
  generateParticipantId: () => string;
  setConsent: (consented: boolean) => void;
  setStudyModeActive: (active: boolean) => void;
  recordTaskCompleted: (task: keyof StudyCompletedTasks) => void;
  setLatestPretestResult: (result: PrePostTestResult) => void;
  setLatestPosttestResult: (result: PrePostTestResult) => void;
  setLatestSusResult: (result: SusResult) => void;
  unlockPretest: () => void;
  unlockPosttest: () => void;
  deleteStudyData: () => void;
}

function generateShortCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = 'P-';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

interface PersistedStudyData {
  participantId: string;
  hasConsented: boolean;
  studyModeActive: boolean;
  completedTasks: StudyCompletedTasks;
  pretestUnlocked: boolean;
  posttestUnlocked: boolean;
  latestPretestResult: PrePostTestResult | null;
  latestPosttestResult: PrePostTestResult | null;
  latestSusResult: SusResult | null;
}

function loadPersistedStudy(): Partial<PersistedStudyData> {
  if (typeof window === 'undefined' || !window.localStorage) return {};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // Ignore parse error
  }
  return {};
}

function saveStudyData(data: PersistedStudyData): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch {
    // Ignore save error
  }
}

const initialSaved = loadPersistedStudy();
const initialId = initialSaved.participantId ?? '';

export const useStudyStore = create<StudyState>((set, get) => ({
  participantId: initialId,
  hasConsented: initialSaved.hasConsented ?? false,
  studyModeActive: initialSaved.studyModeActive ?? false,
  formOrder: assignFormOrder(initialId || 'anon'),
  completedTasks: initialSaved.completedTasks ?? {
    pretestCompleted: false,
    posttestCompleted: false,
    susCompleted: false,
    practiceSessionsCount: 0,
    quizzesCompletedCount: 0,
  },
  pretestUnlocked: initialSaved.pretestUnlocked ?? false,
  posttestUnlocked: initialSaved.posttestUnlocked ?? false,
  latestPretestResult: initialSaved.latestPretestResult ?? null,
  latestPosttestResult: initialSaved.latestPosttestResult ?? null,
  latestSusResult: initialSaved.latestSusResult ?? null,

  setParticipantId: (id: string) => {
    const clean = id.trim();
    const order = assignFormOrder(clean || 'anon');
    set({ participantId: clean, formOrder: order });
    useLogStore.getState().setParticipantId(clean || undefined);
    persistCurrent();
  },

  generateParticipantId: () => {
    const newId = generateShortCode();
    get().setParticipantId(newId);
    return newId;
  },

  setConsent: (consented: boolean) => {
    set({ hasConsented: consented });
    persistCurrent();
  },

  setStudyModeActive: (active: boolean) => {
    set({ studyModeActive: active });
    persistCurrent();
  },

  recordTaskCompleted: (task) => {
    set((state) => {
      const current = state.completedTasks;
      let updated: StudyCompletedTasks;
      if (task === 'practiceSessionsCount' || task === 'quizzesCompletedCount') {
        updated = { ...current, [task]: (current[task] as number) + 1 };
      } else {
        updated = { ...current, [task]: true };
      }
      return { completedTasks: updated };
    });
    persistCurrent();
  },

  setLatestPretestResult: (result) => {
    set({ latestPretestResult: result, pretestUnlocked: false });
    get().recordTaskCompleted('pretestCompleted');
    persistCurrent();
  },

  setLatestPosttestResult: (result) => {
    set({ latestPosttestResult: result, posttestUnlocked: false });
    get().recordTaskCompleted('posttestCompleted');
    persistCurrent();
  },

  setLatestSusResult: (result) => {
    set({ latestSusResult: result });
    get().recordTaskCompleted('susCompleted');
    persistCurrent();
  },

  unlockPretest: () => {
    set({ pretestUnlocked: true });
    persistCurrent();
  },

  unlockPosttest: () => {
    set({ posttestUnlocked: true });
    persistCurrent();
  },

  deleteStudyData: () => {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
    useLogStore.getState().clearLog();
    set({
      participantId: '',
      hasConsented: false,
      studyModeActive: false,
      formOrder: assignFormOrder('anon'),
      completedTasks: {
        pretestCompleted: false,
        posttestCompleted: false,
        susCompleted: false,
        practiceSessionsCount: 0,
        quizzesCompletedCount: 0,
      },
      pretestUnlocked: false,
      posttestUnlocked: false,
      latestPretestResult: null,
      latestPosttestResult: null,
      latestSusResult: null,
    });
  },
}));

function persistCurrent(): void {
  const s = useStudyStore.getState();
  saveStudyData({
    participantId: s.participantId,
    hasConsented: s.hasConsented,
    studyModeActive: s.studyModeActive,
    completedTasks: s.completedTasks,
    pretestUnlocked: s.pretestUnlocked,
    posttestUnlocked: s.posttestUnlocked,
    latestPretestResult: s.latestPretestResult,
    latestPosttestResult: s.latestPosttestResult,
    latestSusResult: s.latestSusResult,
  });
}
