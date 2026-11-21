import { useEffect, useRef } from 'react';
import { CloudOff } from 'lucide-react';
import { useSession, useSyncStatus } from '@/lib/account';
import { useOnline } from '@/lib/online';
import { useStore } from '@/store/useStore';
import { toast } from './fx';

/** True when something was saved on this phone that the cloud copy doesn't have yet. */
export function usePendingSync(): boolean {
  const session = useSession();
  const changed = useStore((s) => s.lastModified ?? 0);
  const { syncedAt } = useSyncStatus();
  return !!session && changed > syncedAt;
}

/** A clear offline bar, and a note when changes made offline have reached the account. */
export function NetStatus() {
  const online = useOnline();
  const session = useSession();
  const { syncing, syncedAt } = useSyncStatus();
  const wasOffline = useRef(false);
  useEffect(() => { if (!online) wasOffline.current = true; }, [online]);
  useEffect(() => {
    if (online && wasOffline.current && !syncing && syncedAt > Date.now() - 10_000) {
      wasOffline.current = false;
      if (session) toast('Back online. Everything you logged offline is synced.');
    }
  }, [online, syncing, syncedAt, session]);
  if (online) return null;
  return (
    <>
      <div aria-hidden style={{ height: 'calc(max(env(safe-area-inset-top), 8px) + 28px)' }} />
      <div role="status" className="fixed inset-x-0 top-0 z-50 flex items-center justify-center gap-2 bg-[#5b5f66] px-4 pb-2 text-[13px] font-semibold text-white" style={{ paddingTop: 'max(env(safe-area-inset-top), 8px)' }}>
        <CloudOff size={14} /> Offline · what you log is saved on this phone and syncs later
      </div>
    </>
  );
}
