/**
 * Curated English gloss + transliteration for the Quran's root-less proper
 * nouns (prophets, angels, peoples, places…). These names carry a lemma but
 * NO triliteral root in the Quranic Arabic Corpus, so they never appear in
 * `root-stats.json`; `scripts/build-name-stats.ts` reads this map to label the
 * offline name-occurrence index that powers name search + counting.
 *
 * Keyed by the RAW Buckwalter LEM exactly as it appears in
 * `public/data/quranic-corpus-morphology-0.4.txt` (collision-free stable id).
 * A missing entry is fine — the build still indexes the name and it stays
 * findable/countable by its Arabic form; it just lacks an English gloss and a
 * hand-tuned romanization (which then falls back to a generated one).
 */

export interface NameGloss {
  /** English name / meaning shown as the gloss. */
  en: string;
  /** Display transliteration, e.g. "Mūsā". */
  translit: string;
}

export const NAME_GLOSSES = new Map<string, NameGloss>([
  // ── Prophets & messengers ──
  ["muwsaY`", { en: "Moses", translit: "Mūsā" }],
  ["EiysaY", { en: "Jesus", translit: "ʿĪsā" }],
  ["muHam~ad", { en: "Muhammad", translit: "Muḥammad" }],
  [">aHomad", { en: "Ahmad (Muhammad)", translit: "Aḥmad" }],
  ["<iboraAhiym", { en: "Abraham", translit: "Ibrāhīm" }],
  ["<isomaAEiyl", { en: "Ishmael", translit: "Ismāʿīl" }],
  ["<isoHaAq", { en: "Isaac", translit: "Isḥāq" }],
  ["yaEoquwb", { en: "Jacob", translit: "Yaʿqūb" }],
  ["yuwsuf", { en: "Joseph", translit: "Yūsuf" }],
  ["nuwH", { en: "Noah", translit: "Nūḥ" }],
  ["luwT", { en: "Lot", translit: "Lūṭ" }],
  ["ha`ruwn", { en: "Aaron", translit: "Hārūn" }],
  ["sulayoma`n", { en: "Solomon", translit: "Sulaymān" }],
  ["daAwud", { en: "David", translit: "Dāwūd" }],
  ["zakariy~aA", { en: "Zachariah", translit: "Zakariyyā" }],
  ["yaHoyaY`", { en: "John (the Baptist)", translit: "Yaḥyā" }],
  [">ay~uwb", { en: "Job", translit: "Ayyūb" }],
  ["yuwnus", { en: "Jonah", translit: "Yūnus" }],
  ["$uEayob", { en: "Shuʿayb", translit: "Shuʿayb" }],
  ["<idoriys", { en: "Enoch (Idris)", translit: "Idrīs" }],
  ["<iloyaAs", { en: "Elijah", translit: "Ilyās" }],
  ["{loyasaEa", { en: "Elisha", translit: "al-Yasaʿ" }],
  ["luqoma`n", { en: "Luqman", translit: "Luqmān" }],
  ["*uwaAlokifol", { en: "Dhūl-Kifl (Ezekiel)", translit: "Dhū al-Kifl" }],

  // ── Figures: righteous, kings, opponents ──
  ["maroyam", { en: "Mary", translit: "Maryam" }],
  ["Eimora`n", { en: "Imran (Amram)", translit: "ʿImrān" }],
  ["masiyH", { en: "Messiah (Christ)", translit: "Masīḥ" }],
  ["firoEawon", { en: "Pharaoh", translit: "Firʿawn" }],
  ["ha`ma`n", { en: "Haman", translit: "Hāmān" }],
  ["qa`ruwn", { en: "Korah (Qarun)", translit: "Qārūn" }],
  ["jaAluwt", { en: "Goliath", translit: "Jālūt" }],
  ["TaAluwt", { en: "Saul (Talut)", translit: "Ṭālūt" }],
  ["tub~aE", { en: "Tubbaʿ", translit: "Tubbaʿ" }],
  ["<iram", { en: "Iram (of ʿĀd)", translit: "Iram" }],
  ["zayod", { en: "Zayd", translit: "Zayd" }],
  ["A^zar", { en: "Azar (Abraham's father)", translit: "Āzar" }],
  ["Euzayor", { en: "Ezra (Uzayr)", translit: "ʿUzayr" }],
  ["A^dam", { en: "Adam", translit: "Ādam" }],

  // ── Angels & unseen beings ──
  ["jiboriyl", { en: "Gabriel", translit: "Jibrīl" }],
  ["miykaY`l", { en: "Michael", translit: "Mīkāl" }],
  ["ha`ruwt", { en: "Harut (angel)", translit: "Hārūt" }],
  ["ma`ruwt", { en: "Marut (angel)", translit: "Mārūt" }],
  ["<iboliys", { en: "Iblis (Satan)", translit: "Iblīs" }],
  ["ya>ojuwj", { en: "Gog", translit: "Yaʾjūj" }],
  ["ma>ojuwj", { en: "Magog", translit: "Maʾjūj" }],

  // ── Peoples & tribes ──
  ["<isoraA}iyl", { en: "Israel (Jacob) / Children of Israel", translit: "Isrāʾīl" }],
  ["vamuwd", { en: "Thamud", translit: "Thamūd" }],
  ["yahuwdiy~", { en: "Jew / Jewish", translit: "Yahūdī" }],
  ["qurayo$", { en: "Quraysh", translit: "Quraysh" }],
  ["r~uwm", { en: "Romans (Byzantines)", translit: "Rūm" }],

  // ── Scriptures ──
  ["t~aworaY`p", { en: "Torah", translit: "Tawrāh" }],
  ["<injiyl", { en: "Gospel (Injil)", translit: "Injīl" }],

  // ── Places ──
  ["jahan~am", { en: "Hell (Jahannam)", translit: "Jahannam" }],
  ["saqar", { en: "Saqar (Hellfire)", translit: "Saqar" }],
  ["laZaY`", { en: "Laza (Blazing Fire)", translit: "Laẓā" }],
  ["firodawos", { en: "Paradise (Firdaws)", translit: "Firdaws" }],
  ["Eadon", { en: "Eden ('Adn)", translit: "ʿAdn" }],
  ["salosabiyl", { en: "Salsabil (spring in Paradise)", translit: "Salsabīl" }],
  ["madoyan", { en: "Midian (Madyan)", translit: "Madyan" }],
  ["baAbil", { en: "Babylon (Babil)", translit: "Bābil" }],
  ["mak~ap", { en: "Mecca", translit: "Makkah" }],
  ["bak~ap", { en: "Bakkah (Mecca)", translit: "Bakkah" }],
  ["yavorib", { en: "Yathrib (Medina)", translit: "Yathrib" }],
  ["S~afaA", { en: "Safa (hill in Mecca)", translit: "Ṣafā" }],
  ["marowap", { en: "Marwa (hill in Mecca)", translit: "Marwah" }],
  ["Earafa`t", { en: "Arafat", translit: "ʿArafāt" }],
  ["bador", { en: "Badr", translit: "Badr" }],
  ["Hunayon", { en: "Hunayn", translit: "Ḥunayn" }],
  ["juwdiY~", { en: "Judi (mountain)", translit: "Jūdī" }],
  ["sayonaA^'", { en: "Sinai", translit: "Sīnāʾ" }],
  ["siyniyn", { en: "Sinai (Tin Sinin)", translit: "Sīnīn" }],
  ["saba<", { en: "Sheba (Saba)", translit: "Sabaʾ" }],

  // ── Idols of the pagans ──
  ["{ll~a`t", { en: "Al-Lat (idol)", translit: "al-Lāt" }],
  ["{loEuz~aY`", { en: "Al-'Uzza (idol)", translit: "al-ʿUzzā" }],
  ["manaw`p", { en: "Manat (idol)", translit: "Manāh" }],
  ["yaguwv", { en: "Yaghuth (idol)", translit: "Yaghūth" }],
  ["yaEuwq", { en: "Ya'uq (idol)", translit: "Yaʿūq" }],

  // ── Months / misc ──
  ["ramaDaAn", { en: "Ramadan", translit: "Ramaḍān" }],
]);
