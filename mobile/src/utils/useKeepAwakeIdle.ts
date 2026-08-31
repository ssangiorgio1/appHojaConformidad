import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';

const DEFAULT_IDLE_MINUTES = 3;

// Keeps the screen on while the wizard is actively being edited, but — unlike a bare
// useKeepAwake() — releases the lock after a stretch with no change to `activityKey` so the
// device's normal screen-lock cooldown applies again once the technician stops interacting.
export function useKeepAwakeIdle(tag: string, activityKey: unknown, idleMinutes = DEFAULT_IDLE_MINUTES) {
  useEffect(() => {
    activateKeepAwakeAsync(tag);
    const timer = setTimeout(() => deactivateKeepAwake(tag), idleMinutes * 60 * 1000);
    return () => clearTimeout(timer);
  }, [tag, activityKey, idleMinutes]);

  useEffect(() => () => void deactivateKeepAwake(tag), [tag]);
}
