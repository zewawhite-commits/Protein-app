/**
 * Spoken replies use the phone's own voices (free, nothing sent anywhere). We pick the most natural
 * female voice the device has, in the person's language, and never a male voice when another exists.
 */
const MALE = /\b(male|man|daniel|alex|fred|arthur|rishi|aaron|guy|ryan|thomas|oliver|george|gordon|lee|reed|rocko|grandpa|eddy|ralph|albert|junior|bruce|jacques|tom|james|david|mark|william|liam|brian|christopher|eric|roger|steffan|connor|william|prabhat|ravi|matthew|joey|justin|kevin|russell|geraint)\b/i;
const GOOD = /\b(natural|neural|premium|enhanced|siri)\b/i;
const FEMALE = /\b(female|woman|samantha|karen|moira|tessa|serena|fiona|martha|victoria|allison|ava|susan|zoe|kate|nicky|veena|aria|jenny|sonia|libby|emma|michelle|ana|clara|natasha|hazel|zira|catherine|heera|neerja|ezinne|abeo|leah|maisie|ada)\b/i;

let cached: SpeechSynthesisVoice | null | undefined;

export function pickVoice(voices: SpeechSynthesisVoice[], lang = 'en-GB'): SpeechSynthesisVoice | null {
  const base = lang.slice(0, 2).toLowerCase();
  const inLang = voices.filter((v) => v.lang?.toLowerCase().startsWith(base));
  const pool = inLang.length ? inLang : voices.filter((v) => v.lang?.toLowerCase().startsWith('en'));
  const score = (v: SpeechSynthesisVoice) =>
    (MALE.test(v.name) ? -100 : 0) + (FEMALE.test(v.name) ? 20 : 0) + (GOOD.test(v.name) ? 10 : 0) +
    (v.lang?.toLowerCase() === lang.toLowerCase() ? 5 : 0) + (v.localService ? 1 : 0);
  const best = [...pool].sort((a, b) => score(b) - score(a))[0];
  return best && score(best) > -50 ? best : null;
}

/** A ready-to-speak utterance with the chosen voice. */
export function utter(text: string): SpeechSynthesisUtterance {
  const u = new SpeechSynthesisUtterance(text);
  const lang = navigator.language || 'en-GB';
  u.lang = lang;
  try {
    if (cached === undefined || cached === null) cached = pickVoice(window.speechSynthesis.getVoices(), lang);
    if (cached) { u.voice = cached; u.lang = cached.lang; }
  } catch { /* default voice */ }
  u.rate = 1; u.pitch = 1.05;
  return u;
}

// Voices load late on some browsers: choose again once they arrive.
try { window.speechSynthesis?.addEventListener?.('voiceschanged', () => { cached = undefined; }); } catch { /* no speech */ }
