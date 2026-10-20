/**
 * @file App.tsx
 * Top-level application component composing the AppShell, hash-based navigation listener,
 * debounced project autosave, and lazy-loaded module placeholder viewports.
 */

import {
  type FC,
  Suspense,
  useEffect,
  useRef,
  useState,
} from 'react';
import { AppShell } from './components/layout/AppShell';
import { HomePage } from './components/layout/HomePage';
import { SendToNextButton } from './components/layout/SendToNextButton';
import { LoginPage } from './auth/LoginPage';
import { isAuthConfigured, restoreSession, signOut, verifyTeacherAccess, type AuthSession } from './auth/supabaseAuth';
import { useTheme } from './hooks/useTheme';
import { getModule, MODULE_REGISTRY } from './modules/registry';
import { createDebouncedAutosave, saveProject } from './store/persistence';
import { useProjectStore } from './store/projectStore';
import { selectCurrentModule, useUiStore } from './store/uiStore';
import type { ModuleId } from './types/designProject';

export const App: FC = () => {
  // Initialize theme synchronization with OS/storage
  useTheme();

  const currentModuleId = useUiStore(selectCurrentModule);
  const setModule = useUiStore((state) => state.setModule);
  const [routeNotFound, setRouteNotFound] = useState(false);
  const [routeHome, setRouteHome] = useState(false);
  const [routeLogin, setRouteLogin] = useState(false);
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(!isAuthConfigured);
  const [teacherAccess, setTeacherAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const previousModule = useRef(currentModuleId);
  const currentModuleRef = useRef(currentModuleId);
  currentModuleRef.current = currentModuleId;

  useEffect(() => {
    let active = true;
    restoreSession().then((session) => {
      if (!active) return;
      setAuthSession(session);
      setAuthReady(true);
    });
    return () => { active = false; };
  }, []);

  // We use client-side window.location.hash for routing so the app remains fully static and offline-capable without a server or router package.
  useEffect(() => {
    const handleHashSync = (): void => {
      const raw = window.location.hash.replace(/^#\/?/, '');
      if (raw === 'login') {
        setRouteLogin(true);
        setRouteHome(false);
        setRouteNotFound(false);
        return;
      }
      setRouteLogin(false);
      if (raw === 'home') {
        setRouteHome(true);
        setRouteNotFound(false);
        return;
      }
      setRouteHome(false);
      const aliasMap: Record<string, ModuleId> = {
        boolean: 'boolean-tool',
        'boolean-tool': 'boolean-tool',
        kmap: 'kmap-solver',
        'kmap-solver': 'kmap-solver',
        circuit: 'circuit-simulator',
        'circuit-simulator': 'circuit-simulator',
        flipflop: 'flipflop-simulator',
        'flipflop-simulator': 'flipflop-simulator',
        sequential: 'sequential-designer',
        'sequential-designer': 'sequential-designer',
        'number-systems': 'number-systems',
        practice: 'practice',
        quiz: 'quiz',
        'prepost-test': 'prepost-test',
        'sus-survey': 'sus-survey',
        'teacher-dashboard': 'teacher-dashboard',
        alu: 'alu',
        '8086-cpu': '8086-cpu',
        'interrupt-controller': 'interrupt-controller',
      };
      const resolved = aliasMap[raw] || (MODULE_REGISTRY.some((m) => m.id === raw) ? (raw as ModuleId) : undefined);
      if (resolved) {
        setModule(resolved);
        setRouteNotFound(false);
        if (window.location.hash !== `#/${resolved}`) window.history.replaceState(null, '', `#/${resolved}`);
      } else if (raw) {
        setRouteNotFound(true);
      } else {
        setRouteNotFound(false);
        window.history.replaceState(null, '', `#/${currentModuleRef.current}`);
      }
    };

    handleHashSync();
    window.addEventListener('hashchange', handleHashSync);
    return () => {
      window.removeEventListener('hashchange', handleHashSync);
    };
  }, [setModule]);

  useEffect(() => {
    if (!authReady) return;
    if (!isAuthConfigured) return;
    if (!authSession) {
      if (!routeLogin) {
        try { if (window.location.hash && window.location.hash !== '#/login') window.sessionStorage.setItem('deam:auth:returnTo', window.location.hash); } catch { /* Route still redirects if storage is unavailable. */ }
        window.history.replaceState(null, '', '#/login');
        setRouteLogin(true);
      }
      return;
    }
    if (routeLogin) {
      let target = '#/home';
      try { target = window.sessionStorage.getItem('deam:auth:returnTo') || target; window.sessionStorage.removeItem('deam:auth:returnTo'); } catch { /* Default to home. */ }
      window.location.hash = target === '#/login' ? '#/home' : target;
    }
  }, [authReady, authSession, routeLogin]);

  useEffect(() => {
    if (!authReady || currentModuleId !== 'teacher-dashboard') {
      setTeacherAccess('checking');
      return;
    }
    if (!isAuthConfigured || !authSession) {
      setTeacherAccess('denied');
      return;
    }
    let active = true;
    setTeacherAccess('checking');
    verifyTeacherAccess(authSession).then((allowed) => {
      if (active) setTeacherAccess(allowed ? 'allowed' : 'denied');
    }).catch(() => { if (active) setTeacherAccess('denied'); });
    return () => { active = false; };
  }, [authReady, authSession, currentModuleId]);

  useEffect(() => {
    if (previousModule.current !== currentModuleId) {
      previousModule.current = currentModuleId;
      window.history.replaceState(null, '', `#/${currentModuleId}`);
      setRouteNotFound(false);
      setRouteHome(false);
    }
  }, [currentModuleId]);

  // Wire debounced background autosave to persist changes safely without interrupting UI typing
  useEffect(() => {
    const debouncedSave = createDebouncedAutosave((p) => {
      saveProject(p);
      useProjectStore.getState().markClean();
    }, 1200);

    const unsubscribe = useProjectStore.subscribe((state) => {
      if (state.isDirty) {
        debouncedSave(state.project);
      }
    });

    return () => {
      debouncedSave.cancel();
      unsubscribe();
    };
  }, []);

  const activeModule = getModule(currentModuleId);
  const ActiveComponent = activeModule?.component;

  if (!authReady) return <div className="login-page" role="status">Checking sign-in…</div>;
  if (routeLogin || (isAuthConfigured && !authSession)) {
    return <LoginPage onAuthenticated={(session) => { setAuthSession(session); setRouteLogin(true); }} />;
  }

  const handleLogout = async () => {
    await signOut(authSession);
    setAuthSession(null);
    window.location.hash = '#/login';
  };

  return (
    <AppShell onLogout={authSession ? handleLogout : undefined}>
      <div className="space-y-6">
        {routeNotFound ? (
          <section className="module-card not-found-page p-8 text-center">
            <span className="eyebrow">PAGE NOT FOUND</span>
            <h1 className="mb-2 text-2xl font-bold">Page not found</h1>
            <p className="mb-4 text-sm text-gray-600 dark:text-gray-300">This route does not match a module.</p>
            <a className="inline-flex rounded-full bg-blue-700 px-4 py-2 text-sm font-semibold text-white" href="#/boolean-tool">Go to Boolean</a>
          </section>
        ) : currentModuleId === 'teacher-dashboard' && teacherAccess === 'checking' ? (
          <div role="status" className="module-card p-6 text-sm text-muted-foreground">Verifying teacher access…</div>
        ) : currentModuleId === 'teacher-dashboard' && teacherAccess === 'denied' ? (
          <section role="alert" className="module-card p-6"><h1>{isAuthConfigured ? 'Teacher access required' : 'Login not configured'}</h1><p>{isAuthConfigured ? 'This account does not have the teacher role.' : 'Configure Supabase sign-in before opening the teacher dashboard.'}</p></section>
        ) : <Suspense
          fallback={
            <div
              role="status"
              className="flex items-center justify-center p-12 text-sm text-gray-500"
            >
              <span className="inline-block h-5 w-5 animate-spin rounded-full border-2 border-blue-600 border-t-transparent mr-2" />
              Loading module...
            </div>
          }
        >
          {ActiveComponent ? (
          routeHome ? <HomePage /> : <ActiveComponent />
          ) : (
            <div className="p-8 text-center text-red-600">
              Module "{currentModuleId}" not found.
            </div>
          )}
        </Suspense>}

        {/* Transition Handoff Button */}
        {currentModuleId !== 'sequential-designer' && currentModuleId !== 'kmap-solver' && (
          <div className="flex justify-end border-t border-gray-200 pt-4 dark:border-gray-800">
            <SendToNextButton />
          </div>
        )}
      </div>
    </AppShell>
  );
};

export default App;
