/**
 * Curated Arabic glosses for the minimal home screen's featured roots.
 *
 * These are core classical senses — short, primary-meaning glosses in the
 * spirit of Lane's Lexicon / Hans Wehr — authored directly in Arabic so the
 * `ar` locale doesn't have to fall back to an English gloss rendered ltr
 * inside an otherwise Arabic, rtl landing page. Pending native-speaker
 * review: treat as a solid first draft, not a final philological authority.
 *
 * Keyed by the bare Arabic root (`RootStat.bare`, e.g. "رحم"), covering
 * exactly the 48 "featured" roots in public/data/root-stats.json — the set
 * used for the landing page's chips, "today's root", and suggestions
 * (see scripts/build-root-stats.ts).
 *
 * This is corpus-adjacent DATA (like lib/data/surahData.ts), not UI copy, so
 * it intentionally does NOT live in messages/*.json — those must stay
 * key-parallel across locales (see scripts/check-i18n.js), and these entries
 * have no English counterpart to parallel against.
 */

export const ROOT_GLOSSES_AR: Record<string, string> = {
  "اله": "الألوهية والمعبود",
  "قول": "القول والكلام",
  "كون": "الكون والوجود",
  "ربب": "الرب والربوبية",
  "امن": "الإيمان والأمان",
  "علم": "العلم والمعرفة",
  "قوم": "القوم والقيام",
  "اتي": "الإتيان والمجيء",
  "كفر": "الكفر والجحود",
  "شيا": "الشيء والمشيئة",
  "رسل": "الرسالة والإرسال",
  "ارض": "الأرض",
  "يوم": "اليوم",
  "ايي": "الآية والعلامة",
  "سمو": "السماء والسمو",
  "عذب": "العذاب",
  "عمل": "العمل",
  "جعل": "الجعل والتصيير",
  "رحم": "الرحمة",
  "كتب": "الكتابة والكتاب",
  "هدي": "الهداية والهدى",
  "ظلم": "الظلم والظلمات",
  "نفس": "النفس",
  "نزل": "النزول والتنزيل",
  "ذكر": "الذكر والتذكير",
  "حقق": "الحق والتحقق",
  "كذب": "الكذب والتكذيب",
  "جيا": "المجيء",
  "عبد": "العبادة والعبودية",
  "اخذ": "الأخذ",
  "خلق": "الخلق والإبداع",
  "وقي": "الوقاية والتقوى",
  "اخر": "الآخر والآخرة",
  "امر": "الأمر",
  "بعد": "البعد",
  "غفر": "الغفران والمغفرة",
  "ولي": "الولاية والولي",
  "دعو": "الدعاء والدعوة",
  "حكم": "الحكم والحكمة",
  "ملك": "الملك والمُلك",
  "جنن": "الجنة والجن",
  "خير": "الخير",
  "نور": "النور",
  "حسن": "الحسن والإحسان",
  "سمع": "السمع",
  "حيي": "الحياة",
  "خرج": "الخروج",
  "صلح": "الصلاح والإصلاح",
};
