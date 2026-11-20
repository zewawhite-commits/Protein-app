import { useEffect, useRef, useState } from 'react';
import { Mic, Search, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { cx } from './ui';
import { haptic } from './fx';

type Recognizer = { lang: string; interimResults: boolean; continuous: boolean; start: () => void; stop: () => void; onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal?: boolean }> }) => void) | null; onend: (() => void) | null; onerror: ((e: { error?: string }) => void) | null };
const SR = typeof window !== 'undefined' ? ((window as unknown as Record<string, unknown>).SpeechRecognition ?? (window as unknown as Record<string, unknown>).webkitSpeechRecognition) as (new () => Recognizer) | undefined : undefined;
export const canUseVoice = !!SR;

/**
 * Say what you ate: the phone's own speech-to-text (nothing is recorded or stored by us).
 * Then search for it, or let the AI log the whole meal from the sentence.
 */
export function VoiceSheet({ onClose, onSearch, date }: { onClose: () => void; onSearch: (text: string) => void; date?: string }) {
  const nav = useNavigate();
  const [said, setSaid] = useState('');
  const [listening, setListening] = useState(false);
  const [err, setErr] = useState('');
  const rec = useRef<Recognizer | null>(null);

  function start() {
    if (!SR) return;
    setErr('');
    const r = new SR();
    r.lang = navigator.language || 'en-GB';
    r.interimResults = true;
    r.continuous = false;
    r.onresult = (e) => setSaid(Array.from(e.results).map((x) => x[0].transcript).join(' ').trim());
    r.onend = () => setListening(false);
    r.onerror = (e) => { setListening(false); setErr(e?.error === 'not-allowed' ? 'Microphone access is off. Allow it in your browser settings, or type instead.' : 'Couldn’t hear that. Try again closer to the phone.'); };
    rec.current = r;
    setListening(true);
    haptic();
    try { r.start(); } catch { setListening(false); }
  }
  useEffect(() => { start(); return () => rec.current?.stop(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="fixed inset-0 z-50 flex items-end bg-black/45 backdrop-blur-[2px]" onClick={onClose} role="dialog" aria-label="Voice logging">
      <div className="w-full rounded-t-[32px] bg-bg px-6 pb-[max(env(safe-area-inset-bottom),1.5rem)] pt-5" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <p className="text-lg font-bold">Say what you ate</p>
          <button onClick={onClose} className="grid h-10 w-10 place-items-center rounded-full bg-surface" aria-label="Close"><X size={18} /></button>
        </div>
        <p className="mt-1 text-sm text-silver">For example: “two boiled eggs and a slice of toast”.</p>
        <div className="my-7 grid place-items-center">
          <button onClick={() => (listening ? rec.current?.stop() : start())} className={cx('relative grid h-24 w-24 place-items-center rounded-full text-white transition', listening ? 'bg-danger' : 'bg-primary')} aria-label={listening ? 'Stop listening' : 'Start listening'}>
            {listening && <span className="absolute inset-0 animate-ping rounded-full bg-danger/40" />}
            <Mic size={36} className="relative" />
          </button>
          <p className="mt-3 text-sm font-semibold text-silver">{listening ? 'Listening…' : said ? 'Tap to say more' : 'Tap to start'}</p>
        </div>
        <p className={cx('min-h-[3.5rem] rounded-2xl bg-surface px-4 py-3 text-[17px] leading-snug', !said && 'text-dim')}>{said || 'Your words appear here'}</p>
        {err && <p className="mt-2 text-sm text-danger">{err}</p>}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button disabled={!said} onClick={() => { onSearch(said); onClose(); }} className="btn bg-surface text-ink" style={{ boxShadow: 'var(--shadow)' }}><Search size={17} /> Search</button>
          <button disabled={!said} onClick={() => nav(`/snap?mode=describe&q=${encodeURIComponent(said)}${date ? `&date=${date}` : ''}`)} className="btn-primary">Log meal with AI</button>
        </div>
      </div>
    </div>
  );
}
