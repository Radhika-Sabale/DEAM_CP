/**
 * @file uiStore.ts
 * Global UI state store managing module navigation, theme selection,
 * sidebar toggling, modal visibility, and accessible toast notifications.
 */

import { create } from 'zustand';
import type { ModuleId } from '../types/designProject';

/**
 * Display themes supported by the application.
 */
export type ThemeMode = 'light' | 'dark' | 'system';

/**
 * Visual severity level for toast notifications.
 */
export type ToastLevel = 'success' | 'info' | 'warning' | 'error';

/**
 * Accessibility aria-live announce priority.
 */
export type ToastAriaLive = 'polite' | 'assertive';

/**
 * Individual toast item payload in the active notification queue.
 */
export interface ToastItem {
  readonly id: string;
  readonly message: string;
  readonly level: ToastLevel;
  readonly title?: string;
  readonly ariaLive?: ToastAriaLive;
  readonly durationMs?: number;
  readonly createdAt: number;
}

/**
 * UI State interface.
 */
export interface UiState {
  currentModule: ModuleId;
  theme: ThemeMode;
  sidebarOpen: boolean;
  toasts: readonly ToastItem[];
  openModalId: string | null;

  setModule: (moduleId: ModuleId) => void;
  setTheme: (theme: ThemeMode) => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  pushToast: (
    toast: Omit<ToastItem, 'id' | 'createdAt'> & { durationMs?: number }
  ) => string;
  dismissToast: (id: string) => void;
  openModal: (modalId: string) => void;
  closeModal: () => void;
}

const STORAGE_THEME_KEY = 'delab:v1:ui_theme';
const STORAGE_SIDEBAR_KEY = 'delab:v1:ui_sidebar';

function getInitialTheme(): ThemeMode {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_THEME_KEY);
      if (stored === 'light' || stored === 'dark' || stored === 'system') {
        return stored;
      }
    }
  } catch {
    // Ignore storage errors
  }
  return 'system';
}

function getInitialSidebar(): boolean {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      const stored = window.localStorage.getItem(STORAGE_SIDEBAR_KEY);
      if (stored !== null) {
        return stored === 'true';
      }
    }
  } catch {
    // Ignore storage errors
  }
  if (typeof window !== 'undefined' && typeof window.innerWidth === 'number' && window.innerWidth < 768) {
    return false;
  }
  return true; // Default open on desktop
}

export const useUiStore = create<UiState>((set, get) => ({
  currentModule: 'boolean-tool',
  theme: getInitialTheme(),
  sidebarOpen: getInitialSidebar(),
  toasts: [],
  openModalId: null,

  setModule: (moduleId: ModuleId) => {
    set({ currentModule: moduleId });
    if (typeof window !== 'undefined') {
      const HASH_MAP: Partial<Record<ModuleId, string>> = {
        'boolean-tool': '#/boolean',
        'kmap-solver': '#/kmap',
        'circuit-simulator': '#/circuit',
        'flipflop-simulator': '#/flipflop',
        'sequential-designer': '#/sequential',
        'number-systems': '#/number-systems',
        practice: '#/practice',
        quiz: '#/quiz',
        'prepost-test': '#/prepost-test',
        'sus-survey': '#/sus-survey',
        'teacher-dashboard': '#/teacher-dashboard',
        alu: '#/alu',
        '8086-cpu': '#/8086-cpu',
        'interrupt-controller': '#/interrupt-controller',
      };
      window.location.hash = HASH_MAP[moduleId] || `#${moduleId}`;
    }
  },

  setTheme: (theme: ThemeMode) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_THEME_KEY, theme);
      }
    } catch {
      // Ignore storage errors
    }
    set({ theme });
  },

  toggleSidebar: () => {
    const nextState = !get().sidebarOpen;
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_SIDEBAR_KEY, String(nextState));
      }
    } catch {
      // Ignore storage errors
    }
    set({ sidebarOpen: nextState });
  },

  setSidebarOpen: (open: boolean) => {
    try {
      if (typeof window !== 'undefined' && window.localStorage) {
        window.localStorage.setItem(STORAGE_SIDEBAR_KEY, String(open));
      }
    } catch {
      // Ignore storage errors
    }
    set({ sidebarOpen: open });
  },

  pushToast: (toast) => {
    const id = `toast-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const duration = toast.durationMs ?? 5000;
    const newToast: ToastItem = {
      id,
      message: toast.message,
      level: toast.level,
      title: toast.title,
      ariaLive: toast.ariaLive ?? (toast.level === 'error' ? 'assertive' : 'polite'),
      durationMs: duration,
      createdAt: Date.now(),
    };

    set((state) => ({
      toasts: [...state.toasts, newToast],
    }));

    if (duration > 0 && typeof window !== 'undefined') {
      setTimeout(() => {
        get().dismissToast(id);
      }, duration);
    }

    return id;
  },

  dismissToast: (id: string) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id),
    }));
  },

  openModal: (modalId: string) => {
    set({ openModalId: modalId });
  },

  closeModal: () => {
    set({ openModalId: null });
  },
}));

/**
 * Small exported selectors to minimize React component re-renders.
 */
export const selectCurrentModule = (state: UiState): ModuleId =>
  state.currentModule;

export const selectTheme = (state: UiState): ThemeMode => state.theme;

export const selectSidebarOpen = (state: UiState): boolean => state.sidebarOpen;

export const selectToasts = (state: UiState): readonly ToastItem[] =>
  state.toasts;

export const selectOpenModalId = (state: UiState): string | null =>
  state.openModalId;
