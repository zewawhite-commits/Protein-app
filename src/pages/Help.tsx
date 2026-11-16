import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronDown, Loader2, Send } from 'lucide-react';
import { SUPPORT_EMAIL } from './Legal';
import { sendMessage } from '@/lib/feedback';
import { haptic, toast } from '@/components/fx';
import { cx } from '@/components/ui';

const FAQ: [string, React.ReactNode][] = [
  ['How accurate are photo scans?', <>The AI names the foods and estimates the weight; the nutrition always comes from official food tables. Weights from a photo are estimates — that’s why you see a range (“likely 200–300 g”) and “Amount: rough”. For the most accurate numbers, weigh the food and type the grams.</>],
  ['Why does it ask about oil, butter and sugar?', <>A photo can’t show how much oil went into cooking or sugar into a drink, and they change calories a lot. Pick None, A little, Usual or A lot — restaurants and street food usually use more.</>],
  ['Why do I see a calorie range?', <>Because the amounts are estimated. Weigh the food or answer the questions about hidden extras and the range narrows.</>],
  ['I scanned the same photo twice — why is it the same?', <>On purpose: the same photo always gives the same result, and it doesn’t use another scan.</>],
  ['Is my food log saved if I use two phones?', <>Yes. Sign in on both; changes from each phone are combined, and a deleted item stays deleted. The app also keeps a daily backup on each phone (Profile → Your data → Automatic backups).</>],
  ['A food is missing or its numbers look wrong', <>Use “Request this food” at the bottom of a search, or open the food and tap “Report it”. For packaged food, scan the nutrition label to save the right numbers.</>],
  ['How do allergy warnings work?', <>Foods are checked against your allergies and diet by name and recipe. It can miss ingredients, so always check labels and ask how food was made.</>],
  ['What do Free, Plus and Pro include?', <><Link to="/premium" className="font-semibold text-accent">See the plans</Link>. Free includes the food database, barcode, progress and a few AI scans each month. Everyone can try Pro free for 7 days, no card needed.</>],
  ['How do I cancel or get a refund?', <>Profile → Subscription → Manage, change or cancel. You keep your plan until the end of the period you paid for. See the <Link to="/refunds" className="font-semibold text-accent">Cancellation & Refund Policy</Link>.</>],
  ['What happens to my photos and data?', <>Photos stay on your phone unless you post them. Read the <Link to="/privacy" className="font-semibold text-accent">Privacy Policy</Link>; you can export or delete everything from Profile.</>],
];

export default function Help() {
  const nav = useNavigate();
  const [open, setOpen] = useState<number | null>(0);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  return (
    <div className="mx-auto min-h-dvh max-w-lg animate-fade-up px-5 pb-16 md:max-w-2xl md:px-8">
      <header className="pt-safe flex items-center pb-4">
        <button onClick={() => (history.length > 1 ? nav(-1) : nav('/'))} className="grid h-11 w-11 place-items-center rounded-full bg-surface" style={{ boxShadow: 'var(--shadow)' }} aria-label="Back"><ArrowLeft size={20} /></button>
      </header>
      <h1 className="text-[30px] font-extrabold leading-tight tracking-tight">Help</h1>
      <p className="mt-1 text-[15px] text-silver">Quick answers, and a way to reach us.</p>

      <div className="card mt-5 divide-y divide-line/60">
        {FAQ.map(([q, a], i) => (
          <div key={q}>
            <button onClick={() => setOpen((o) => (o === i ? null : i))} className="flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left text-[15px] font-semibold" aria-expanded={open === i}>
              {q}<ChevronDown size={17} className={cx('shrink-0 text-silver transition', open === i && 'rotate-180')} />
            </button>
            {open === i && <p className="px-4 pb-4 text-[14px] leading-relaxed text-silver">{a}</p>}
          </div>
        ))}
      </div>

      <section className="card mt-5 p-5">
        <p className="text-[17px] font-bold">Send us feedback</p>
        <p className="mt-1 text-[14px] text-silver">A bug, an idea, a missing food — it goes straight to the team.</p>
        <label className="sr-only" htmlFor="fb-text">Your message</label>
        <textarea id="fb-text" value={text} onChange={(e) => setText(e.target.value.slice(0, 1000))} rows={4} className="field mt-3 !h-auto py-3" placeholder="What happened, or what would make Provora better?" />
        <button
          disabled={busy || text.trim().length < 5}
          onClick={async () => {
            setBusy(true);
            try { await sendMessage('feedback', text.trim()); haptic(); setText(''); toast('Thanks — we read every message'); }
            catch (e) { toast((e as Error).message); }
            finally { setBusy(false); }
          }}
          className="btn-primary mt-3 w-full"
        >
          {busy ? <Loader2 size={17} className="animate-spin" /> : <Send size={17} />} Send
        </button>
        {SUPPORT_EMAIL && <p className="mt-3 text-center text-[13px] text-silver">Or email <a className="font-semibold text-accent" href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> — we reply within 3 working days.</p>}
      </section>
    </div>
  );
}
