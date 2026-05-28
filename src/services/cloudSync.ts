const SUPABASE_URL = String(import.meta.env.VITE_SUPABASE_URL || '').replace(/\/$/, '');
const SUPABASE_ANON_KEY = String(import.meta.env.VITE_SUPABASE_ANON_KEY || '');

const SESSION_KEY = 'precomap_cloud_session';
const SNAPSHOT_TABLE = 'precomap_snapshots';
const STORAGE_KEYS = [
  'precomap_customers',
  'precomap_products',
  'precomap_orders',
  'precomap_order_items',
  'precomap_price_history',
  'precomap_uploads',
  'precomap_user_role',
  'precomap_dismissed_alert_ids'
];

const BUSINESS_STORAGE_KEYS = [
  'precomap_customers',
  'precomap_products',
  'precomap_orders',
  'precomap_order_items',
  'precomap_price_history',
  'precomap_uploads'
];

export interface CloudSession {
  access_token: string;
  refresh_token: string | null;
  expires_at: number;
  user: {
    id: string;
    email: string | null;
  };
}

export interface CloudSyncSummary {
  localRecords: number;
  remoteRecords: number;
  mergedRecords: number;
  restored: boolean;
  pushed: boolean;
}

let backupTimer: number | null = null;
let isRestoringSnapshot = false;

export function isCloudConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
}

export function isLocalModeAllowed(): boolean {
  return import.meta.env.DEV || import.meta.env.VITE_ALLOW_LOCAL_MODE === 'true';
}

function authHeaders(session?: CloudSession) {
  return {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${session?.access_token || SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json'
  };
}

function readStorageValue(key: string): unknown {
  const raw = localStorage.getItem(key);
  if (raw === null) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function writeStorageValue(key: string, value: unknown): void {
  if (value === null || value === undefined) {
    localStorage.removeItem(key);
    return;
  }
  if (typeof value === 'string') {
    localStorage.setItem(key, value);
    return;
  }
  localStorage.setItem(key, JSON.stringify(value));
}

function collectSnapshot(): Record<string, unknown> {
  return STORAGE_KEYS.reduce<Record<string, unknown>>((snapshot, key) => {
    snapshot[key] = readStorageValue(key);
    return snapshot;
  }, {});
}

function countBusinessRecords(snapshot: Record<string, unknown>): number {
  return BUSINESS_STORAGE_KEYS.reduce((count, key) => {
    const value = snapshot[key];
    return count + (Array.isArray(value) ? value.length : 0);
  }, 0);
}

function getRecordDate(value: unknown): number {
  if (!value || typeof value !== 'object') return 0;
  const record = value as Record<string, unknown>;
  const rawDate = record.updated_at || record.created_at || record.date || record.issue_date;
  if (typeof rawDate !== 'string') return 0;
  const timestamp = Date.parse(rawDate);
  return Number.isFinite(timestamp) ? timestamp : 0;
}

function getMergeKey(value: unknown, index: number): string {
  if (value && typeof value === 'object') {
    const record = value as Record<string, unknown>;
    if (typeof record.id === 'string' && record.id) return `id:${record.id}`;
    if (typeof record.invoice_key === 'string' && record.invoice_key) return `invoice:${record.invoice_key}`;
  }

  try {
    return `raw:${JSON.stringify(value)}`;
  } catch {
    return `index:${index}`;
  }
}

function mergeEntityArray(remoteValue: unknown, localValue: unknown): unknown[] {
  const remoteItems = Array.isArray(remoteValue) ? remoteValue : [];
  const localItems = Array.isArray(localValue) ? localValue : [];
  const merged = new Map<string, unknown>();
  const order: string[] = [];

  [...remoteItems, ...localItems].forEach((item, index) => {
    const key = getMergeKey(item, index);
    const current = merged.get(key);

    if (!current) {
      order.push(key);
      merged.set(key, item);
      return;
    }

    if (getRecordDate(item) >= getRecordDate(current)) {
      merged.set(key, item);
    }
  });

  return order.map(key => merged.get(key));
}

function mergePrimitiveArray(remoteValue: unknown, localValue: unknown): unknown[] {
  const merged = new Set<unknown>();
  if (Array.isArray(remoteValue)) remoteValue.forEach(value => merged.add(value));
  if (Array.isArray(localValue)) localValue.forEach(value => merged.add(value));
  return Array.from(merged);
}

function mergeSnapshots(remoteSnapshot: Record<string, unknown>, localSnapshot: Record<string, unknown>): Record<string, unknown> {
  const merged: Record<string, unknown> = {};

  STORAGE_KEYS.forEach(key => {
    const remoteValue = remoteSnapshot[key];
    const localValue = localSnapshot[key];

    if (key === 'precomap_dismissed_alert_ids') {
      merged[key] = mergePrimitiveArray(remoteValue, localValue);
      return;
    }

    if (Array.isArray(remoteValue) || Array.isArray(localValue)) {
      merged[key] = mergeEntityArray(remoteValue, localValue);
      return;
    }

    if (key === 'precomap_user_role' && localValue) {
      merged[key] = localValue;
      return;
    }

    merged[key] = remoteValue ?? localValue ?? null;
  });

  return merged;
}

function writeSnapshotToStorage(snapshot: Record<string, unknown>): void {
  isRestoringSnapshot = true;
  try {
    STORAGE_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        writeStorageValue(key, snapshot[key]);
      }
    });
  } finally {
    isRestoringSnapshot = false;
  }
}

async function fetchCloudSnapshot(session: CloudSession): Promise<Record<string, unknown> | null> {
  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SNAPSHOT_TABLE}?select=data&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    { headers: authHeaders(session) }
  );

  if (!response.ok) {
    throw new Error('Nao foi possivel carregar o banco remoto.');
  }

  const rows = await response.json();
  return (rows?.[0]?.data as Record<string, unknown> | undefined) || null;
}

export function getCurrentSession(): CloudSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as CloudSession;
    if (!session?.access_token || !session?.user?.id) return null;
    if (session.expires_at && session.expires_at < Date.now()) {
      localStorage.removeItem(SESSION_KEY);
      return null;
    }
    return session;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function saveSession(session: CloudSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export async function signInWithEmail(email: string, password: string): Promise<CloudSession> {
  if (!isCloudConfigured()) {
    throw new Error('Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.');
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ email, password })
  });

  if (!response.ok) {
    throw new Error('E-mail ou senha inválidos.');
  }

  const data = await response.json();
  const session: CloudSession = {
    access_token: data.access_token,
    refresh_token: data.refresh_token || null,
    expires_at: Date.now() + Number(data.expires_in || 3600) * 1000,
    user: {
      id: data.user.id,
      email: data.user.email || email
    }
  };

  saveSession(session);
  await syncCloudSnapshot(session);
  return session;
}

export function signOutCloud(): void {
  localStorage.removeItem(SESSION_KEY);
}

export async function restoreCloudSnapshot(session = getCurrentSession()): Promise<void> {
  if (!isCloudConfigured() || !session) return;

  const response = await fetch(
    `${SUPABASE_URL}/rest/v1/${SNAPSHOT_TABLE}?select=data&user_id=eq.${encodeURIComponent(session.user.id)}&limit=1`,
    { headers: authHeaders(session) }
  );

  if (!response.ok) {
    throw new Error('Não foi possível carregar o banco remoto.');
  }

  const rows = await response.json();
  const snapshot = rows?.[0]?.data as Record<string, unknown> | undefined;
  if (!snapshot) return;

  isRestoringSnapshot = true;
  try {
    STORAGE_KEYS.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(snapshot, key)) {
        writeStorageValue(key, snapshot[key]);
      }
    });
  } finally {
    isRestoringSnapshot = false;
  }
}

export async function syncCloudSnapshot(session = getCurrentSession()): Promise<CloudSyncSummary> {
  const emptySummary: CloudSyncSummary = {
    localRecords: 0,
    remoteRecords: 0,
    mergedRecords: 0,
    restored: false,
    pushed: false
  };

  if (!isCloudConfigured() || !session) return emptySummary;

  const localSnapshot = collectSnapshot();
  const localRecords = countBusinessRecords(localSnapshot);
  const remoteSnapshot = await fetchCloudSnapshot(session);
  const remoteRecords = remoteSnapshot ? countBusinessRecords(remoteSnapshot) : 0;

  if (remoteSnapshot && remoteRecords > 0) {
    const mergedSnapshot = mergeSnapshots(remoteSnapshot, localSnapshot);
    const mergedRecords = countBusinessRecords(mergedSnapshot);
    writeSnapshotToStorage(mergedSnapshot);

    const changedRemote = JSON.stringify(mergedSnapshot) !== JSON.stringify(remoteSnapshot);
    const pushed = changedRemote ? await pushCloudSnapshot(session, mergedSnapshot) : false;

    return {
      localRecords,
      remoteRecords,
      mergedRecords,
      restored: true,
      pushed
    };
  }

  if (localRecords > 0) {
    const pushed = await pushCloudSnapshot(session, localSnapshot);
    return {
      localRecords,
      remoteRecords,
      mergedRecords: localRecords,
      restored: false,
      pushed
    };
  }

  if (remoteSnapshot) {
    writeSnapshotToStorage(remoteSnapshot);
  }

  return {
    localRecords,
    remoteRecords,
    mergedRecords: remoteRecords,
    restored: Boolean(remoteSnapshot),
    pushed: false
  };
}

export async function pushCloudSnapshot(
  session = getCurrentSession(),
  snapshot = collectSnapshot()
): Promise<boolean> {
  if (!isCloudConfigured() || !session || isRestoringSnapshot) return false;

  const response = await fetch(`${SUPABASE_URL}/rest/v1/${SNAPSHOT_TABLE}?on_conflict=user_id`, {
    method: 'POST',
    headers: {
      ...authHeaders(session),
      Prefer: 'resolution=merge-duplicates'
    },
    body: JSON.stringify({
      user_id: session.user.id,
      data: snapshot,
      updated_at: new Date().toISOString()
    })
  });

  if (!response.ok) {
    console.warn('Falha ao sincronizar banco remoto', await response.text());
    return false;
  }

  return true;
}

export function scheduleCloudBackup(): void {
  if (!isCloudConfigured() || !getCurrentSession() || isRestoringSnapshot) return;
  if (backupTimer !== null) {
    window.clearTimeout(backupTimer);
  }
  backupTimer = window.setTimeout(() => {
    backupTimer = null;
    void pushCloudSnapshot();
  }, 900);
}
