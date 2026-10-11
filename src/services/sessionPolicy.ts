import type { AuthChangeEvent, Session } from '@supabase/supabase-js';
import { parseSessionActivity, sessionExpired } from '../domain/sessionPolicy.ts';
import type { SessionActivity } from '../domain/sessionPolicy.ts';

// No credentials are stored here. session_id stays stable when the JWT is refreshed.
function activityKey(session: Session): string {
  const payload = session.access_token.split('.')[1];
  const claims = JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/'))) as {
    session_id: string;
  };
  if (!claims.session_id) throw new Error('INVALID_SESSION');
  return `auth-activity:${claims.session_id}`;
}

export function createSessionPolicy(onExpire: () => void) {
  let key: string | null = null;
  let activity: SessionActivity | null = null;
  let expired = false;
  let lastWrite = 0;

  function expire() {
    if (expired) return;
    expired = true;
    // Supabase auth callbacks must finish before another auth method is called.
    queueMicrotask(onExpire);
  }

  function check(): boolean {
    if (!key || !activity) return false;
    try {
      const stored = parseSessionActivity(localStorage.getItem(key));
      if (!stored || stored.startedAt !== activity.startedAt) {
        expire();
        return false;
      }
      activity = stored;
      if (sessionExpired(activity, Date.now())) expire();
    } catch {
      expire();
    }
    return !expired;
  }

  function accept(session: Session | null, event: AuthChangeEvent): boolean {
    if (!session) {
      key = null;
      activity = null;
      expired = false;
      return true;
    }
    try {
      const nextKey = activityKey(session);
      if (key !== nextKey) expired = false;
      key = nextKey;
      activity = parseSessionActivity(localStorage.getItem(key));
      if (!activity) {
        // Restored sessions without a deadline must authenticate again, including
        // sessions created before this policy was deployed. Refresh never resets it.
        if (event !== 'SIGNED_IN' && event !== 'PASSWORD_RECOVERY') {
          expire();
          return false;
        }
        const now = Date.now();
        activity = { startedAt: now, lastActiveAt: now };
        localStorage.setItem(key, JSON.stringify(activity));
      }
      return check();
    } catch {
      expire();
      return false;
    }
  }

  function recordActivity(event: Event) {
    if (!event.isTrusted || document.visibilityState !== 'visible' || !check() || !activity || !key)
      return;
    const now = Date.now();
    if (now - lastWrite < 1000) return;
    activity.lastActiveAt = now;
    try {
      localStorage.setItem(key, JSON.stringify(activity));
      lastWrite = now;
    } catch {
      expire();
    }
  }

  const events = ['pointerdown', 'pointermove', 'keydown', 'scroll', 'touchstart'];
  for (const event of events) window.addEventListener(event, recordActivity, { passive: true });
  const verify = () => {
    check();
  };
  window.addEventListener('focus', verify);
  window.addEventListener('pageshow', verify);
  window.addEventListener('storage', verify);
  document.addEventListener('visibilitychange', verify);
  const timer = window.setInterval(verify, 1000);

  return {
    accept,
    dispose() {
      window.clearInterval(timer);
      for (const event of events) window.removeEventListener(event, recordActivity);
      window.removeEventListener('focus', verify);
      window.removeEventListener('pageshow', verify);
      window.removeEventListener('storage', verify);
      document.removeEventListener('visibilitychange', verify);
    },
  };
}
