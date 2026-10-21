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
import { isAuthConfigured, restoreSession, signOut, subscribeAuthState, verifyTeacherAccess, type AuthSession } from './auth/supabaseAuth';
import { Modal } from './components/ui/Modal';
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
  const [loginMode, setLoginMode] = useState<'signin' | 'signup'>('signin');
  const [authSession, setAuthSession] = useState<AuthSession | null>(null);
  const [authReady, setAuthReady] = useState(!isAuthConfigured());
  const [teacherAccess, setTeacherAccess] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const [authPrompt, setAuthPrompt] = useState<string | null>(null);
  const [authPromptMode, setAuthPromptMode] = useState<'signin' | 'signup'>('signin');
  const pendingAuthAction = useRef<(() => void) | null>(null);
  const previousModule = useRef(currentModuleId);
  const currentModuleRef = useRef(currentModuleId);
  currentModuleRef.current = currentModuleId;

  useEffect(() => {
    return subscribeAuthState(setAuthSession);
  }, []);

  useEffect(() => {
    const onRequireAccount = (event: Event) => {
      const detail = (event as CustomEvent<{ reason: string; continueAction: () => void }>).detail;
      if (authSession) detail.continueAction();
      else requestSignIn(detail.reason, detail.continueAction);
    };
    window.addEventListener('deam:require-account', onRequireAccount);
    return () => window.removeEventListener('deam:require-account', onRequireAccount);
  }, [authSession]);

  useEffect(() => {
    if (!isAuthConfigured()) return;
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
      if (raw.startsWith('login')) {
        setLoginMode(raw.includes('mode=signup') ? 'signup' : 'signin');
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
    if (!authReady || currentModuleId !== 'teacher-dashboard') {
      setTeacherAccess('checking');
      return;
    }
    if (!isAuthConfigured() || !authSession) {
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
      if (authSession && state.isDirty) {
        debouncedSave(state.project);
      }
    });

    return () => {
      debouncedSave.cancel();
      unsubscribe();
    };
  }, [authSession]);

  const activeModule = getModule(currentModuleId);
  const ActiveComponent = activeModule?.component;

  const requestSignIn = (reason: string, afterSignIn?: () => void, mode: 'signin' | 'signup' = 'signin') => {
    pendingAuthAction.current = afterSignIn ?? null;
    setAuthPromptMode(mode);
    setAuthPrompt(reason);
  };
  const handleAuthenticated = (session: AuthSession) => {
    setAuthSession(session);
    setRouteLogin(false);
    setAuthPrompt(null);
    const action = pendingAuthAction.current;
    pendingAuthAction.current = null;
    action?.();
    if (window.location.hash.startsWith('#/login')) window.location.hash = `#/${currentModuleRef.current}`;
  };

  if (routeLogin) {
    return <LoginPage onAuthenticated={handleAuthenticated} initialMode={loginMode} />;
  }

  const handleLogout = async () => {
    await signOut(authSession);
    setAuthSession(null);
    window.location.hash = '#/home';
  };

  return (
    <>
    <AppShell onLogout={authSession ? handleLogout : undefined} authUser={authSession?.user} onRequestSignIn={requestSignIn}>
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
          <section role="alert" className="module-card p-6"><h1>{isAuthConfigured() ? 'Teacher access required' : 'Login not configured'}</h1><p>{isAuthConfigured() ? authSession ? 'This account does not have the teacher role.' : 'Teacher access only. Sign in with a teacher account to continue.' : 'Configure Supabase sign-in before opening the teacher dashboard.'}</p>{!authSession && isAuthConfigured() && <button type="button" className="login-submit mt-4" onClick={() => requestSignIn('Sign in with a teacher account to continue.')}>Sign in</button>}</section>
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
    <Modal isOpen={Boolean(authPrompt)} onClose={() => { setAuthPrompt(null); pendingAuthAction.current = null; }} title="Sign in to continue">
      <LoginPage onAuthenticated={handleAuthenticated} reason={authPrompt ?? undefined} initialMode={authPromptMode} />
    </Modal>
    </>
  );
};

export default App;
