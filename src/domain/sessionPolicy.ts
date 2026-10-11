export const SESSION_MAX_AGE_MS = 3 * 24 * 60 * 60 * 1000;
export const SESSION_IDLE_TIMEOUT_MS = 3 * 24 * 60 * 60 * 1000;

export type SessionActivity = { startedAt: number; lastActiveAt: number };

export function parseSessionActivity(raw: string | null): SessionActivity | null {
  try {
    const value: unknown = JSON.parse(raw ?? 'null');
    if (!value || typeof value !== 'object') return null;
    const { startedAt, lastActiveAt } = value as SessionActivity;
    if (
      !Number.isSafeInteger(startedAt) ||
      !Number.isSafeInteger(lastActiveAt) ||
      startedAt <= 0 ||
      lastActiveAt < startedAt
    )
      return null;
    return { startedAt, lastActiveAt };
  } catch {
    return null;
  }
}

export function sessionExpired(activity: SessionActivity, now: number): boolean {
  return (
    now < activity.startedAt ||
    now < activity.lastActiveAt ||
    now - activity.startedAt >= SESSION_MAX_AGE_MS ||
    now - activity.lastActiveAt >= SESSION_IDLE_TIMEOUT_MS
  );
}
