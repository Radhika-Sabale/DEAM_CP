export interface AuthUser {
  readonly id: string;
  readonly email?: string;
  readonly app_metadata?: { readonly role?: string };
  readonly user_metadata?: { readonly display_name?: string; readonly full_name?: string };
}

export interface AuthSession {
  readonly access_token: string;
  readonly refresh_token: string;
  readonly expires_at: number;
  readonly user: AuthUser;
  readonly remember: boolean;
}

const STORAGE_KEY = 'deam:supabase-session:v1';
export function isAuthConfigured(): boolean {
  return Boolean(import.meta.env.VITE_SUPABASE_URL && import.meta.env.VITE_SUPABASE_ANON_KEY);
}

function getSupabaseUrl(): string {
  return String(import.meta.env.VITE_SUPABASE_URL ?? '').replace(/\/$/, '');
}

function getAnonKey(): string {
  return String(import.meta.env.VITE_SUPABASE_ANON_KEY ?? '');
}

export function subscribeAuthState(listener: (session: AuthSession | null) => void): () => void {
  const onChange = (event: Event) => listener((event as CustomEvent<AuthSession | null>).detail);
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY) listener(readSession());
  };
  window.addEventListener('deam:auth-state', onChange);
  window.addEventListener('storage', onStorage);
  return () => {
    window.removeEventListener('deam:auth-state', onChange);
    window.removeEventListener('storage', onStorage);
  };
}

function emitAuthState(session: AuthSession | null): void {
  window.dispatchEvent(new CustomEvent('deam:auth-state', { detail: session }));
}

function storage(remember: boolean): Storage | null {
  try { return remember ? window.localStorage : window.sessionStorage; } catch { return null; }
}

function saveSession(session: AuthSession): void {
  try {
    storage(session.remember)?.setItem(STORAGE_KEY, JSON.stringify(session));
    storage(!session.remember)?.removeItem(STORAGE_KEY);
  } catch { /* Keep the authenticated session in memory if storage is unavailable. */ }
}

function readSession(): AuthSession | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY) ?? window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as AuthSession;
    return parsed.access_token && parsed.refresh_token && parsed.user?.id ? parsed : null;
  } catch { return null; }
}

async function authRequest(path: string, init: RequestInit = {}): Promise<Record<string, unknown>> {
  const response = await fetch(`${getSupabaseUrl()}/auth/v1/${path}`, {
    ...init,
    headers: { apikey: getAnonKey(), 'content-type': 'application/json', ...init.headers },
    signal: AbortSignal.timeout(10_000),
  });
  const payload = await response.json().catch(() => ({})) as Record<string, unknown>;
  if (!response.ok) {
    const message = typeof payload.msg === 'string' ? payload.msg : typeof payload.message === 'string' ? payload.message : typeof payload.error_description === 'string' ? payload.error_description : 'Sign-in could not be completed.';
    throw new Error(message);
  }
  return payload;
}

function toSession(data: Record<string, unknown>, remember: boolean): AuthSession | null {
  const user = data.user as AuthUser | undefined;
  if (typeof data.access_token !== 'string' || typeof data.refresh_token !== 'string' || !user?.id) return null;
  const expiresIn = typeof data.expires_in === 'number' ? data.expires_in : 3600;
  const expiresAt = typeof data.expires_at === 'number' ? data.expires_at : Math.floor(Date.now() / 1000) + expiresIn;
  const session: AuthSession = { access_token: data.access_token, refresh_token: data.refresh_token, expires_at: expiresAt, user, remember };
  saveSession(session);
  emitAuthState(session);
  return session;
}

export async function signIn(email: string, password: string, remember: boolean): Promise<AuthSession> {
  if (!isAuthConfigured()) throw new Error('Login is not configured. Add the Supabase URL and anon key to the local .env file.');
  const data = await authRequest('token?grant_type=password', { method: 'POST', body: JSON.stringify({ email, password }) });
  const session = toSession(data, remember);
  if (!session) throw new Error('Sign-in needs another step. Check your email or try again.');
  return session;
}

export async function signUp(email: string, password: string, remember: boolean, displayName: string): Promise<AuthSession | null> {
  if (!isAuthConfigured()) throw new Error('Login is not configured. Add the Supabase URL and anon key to the local .env file.');
  // No role or privilege is accepted from public sign-up. Teacher access is assigned in app_metadata by an administrator.
  const data = await authRequest('signup', { method: 'POST', body: JSON.stringify({ email, password, data: { display_name: displayName.trim() } }) });
  return toSession(data, remember);
}

export async function restoreSession(): Promise<AuthSession | null> {
  if (!isAuthConfigured()) return null;
  const stored = readSession();
  if (!stored) return null;
  if (stored.expires_at > Math.floor(Date.now() / 1000) + 30) return stored;
  try {
    const data = await authRequest('token?grant_type=refresh_token', { method: 'POST', body: JSON.stringify({ refresh_token: stored.refresh_token }) });
    return toSession(data, stored.remember);
  } catch {
    await clearSession();
    return null;
  }
}

export async function signOut(session: AuthSession | null): Promise<void> {
  try {
    if (session) await authRequest('logout', { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } });
  } finally { await clearSession(); }
}

export async function clearSession(): Promise<void> {
  try { window.localStorage.removeItem(STORAGE_KEY); window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage is optional. */ }
  emitAuthState(null);
}

export async function verifyTeacherAccess(session: AuthSession): Promise<boolean> {
  const response = await fetch('/api/auth/teacher', { headers: { Authorization: `Bearer ${session.access_token}` } });
  return response.ok;
}
