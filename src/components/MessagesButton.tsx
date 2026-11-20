import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { unreadCount } from '@/lib/social';

/** Messages, with the number of unread chats. */
export function MessagesButton() {
  const [n, setN] = useState(0);
  useEffect(() => { void unreadCount().then(setN).catch(() => undefined); }, []);
  return (
    <Link to="/messages" className="relative grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label={n ? `Messages, ${n} unread` : 'Messages'}>
      <Mail size={19} />
      {n > 0 && <span className="absolute -right-0.5 -top-0.5 grid h-[18px] min-w-[18px] place-items-center rounded-full bg-danger px-1 text-[11px] font-bold text-white">{n > 9 ? '9+' : n}</span>}
    </Link>
  );
}
