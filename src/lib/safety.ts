/**
 * Crisis safety net for the coach (and anywhere people type to us). If a message talks about
 * suicide or self-harm, we don't run it through diet coaching or an AI at all: we answer with a
 * fixed, caring message and real helplines. Eating-disorder signals get a gentler fixed reply.
 * Deliberately simple and over-inclusive: a false positive costs one kind message.
 */
const SELF_HARM = /\b(kill(ing)? my ?self|end(ing)? (it all|my life)|suicid\w*|self[- ]?harm\w*|hurt(ing)? my ?self|cut(ting)? my ?self|want(ed)? to die|don'?t want to (live|be alive|be here)|no reason to live|better off dead|take my (own )?life|overdos\w*)\b/i;
const EATING_DISORDER = /\b(anorexi\w*|bulimi\w*|purg(e|ing)|make my ?self (throw up|sick|vomit)|throw(ing)? up after (eating|meals?)|starv(e|ing) my ?self|binge and purge|laxatives? to lose|haven'?t eaten in (\d+|several|many|a few) days)\b/i;

export const CRISIS_REPLY = [
  'I’m really sorry you’re going through this. You don’t have to handle it alone, and you deserve support right now.',
  'If you might act on these thoughts or you’re in danger, please call your local emergency number now.',
  'You can talk to someone today, free and confidential:',
  '• US & Canada: call or text 988',
  '• UK & Ireland: Samaritans, 116 123',
  '• Nigeria: Nigeria Suicide Prevention Initiative, +234 806 210 6493',
  '• Anywhere else: findahelpline.com lists free helplines in your country',
  'If you can, tell someone you trust how you’re feeling. I’m a nutrition coach, so I can’t give the help you need with this, but those people can.',
].join('\n');

export const ED_REPLY = [
  'Thank you for telling me. What you’re describing can be really hard, and it’s worth talking to someone who can properly help.',
  'Please reach out to a doctor or an eating-disorder service. Free support: US: NEDA resources at nationaleatingdisorders.org; UK: Beat, 0808 801 0677; anywhere: findahelpline.com.',
  'I won’t give weight-loss advice right now. If it helps, I’m happy to talk about regular, nourishing meals.',
].join('\n');

export function crisisReply(text: string): string | null {
  if (SELF_HARM.test(text)) return CRISIS_REPLY;
  if (EATING_DISORDER.test(text)) return ED_REPLY;
  return null;
}
