import _english from "./locales/english.json";
import _schinese from "./locales/schinese.json";
import _tchinese from "./locales/tchinese.json";
import _russian from "./locales/russian.json";
import _german from "./locales/german.json";
import _spanish from "./locales/spanish.json";
import _french from "./locales/french.json";
import _japanese from "./locales/japanese.json";
import _koreana from "./locales/koreana.json";
import _brazilian from "./locales/brazilian.json";

type LocaleMap = Record<string, string>;

const english: LocaleMap = _english;
const schinese: LocaleMap = _schinese;
const tchinese: LocaleMap = _tchinese;
const russian: LocaleMap = _russian;
const german: LocaleMap = _german;
const spanish: LocaleMap = _spanish;
const french: LocaleMap = _french;
const japanese: LocaleMap = _japanese;
const koreana: LocaleMap = _koreana;
const brazilian: LocaleMap = _brazilian;

const bundles: Record<string, LocaleMap> = {
  english,
  schinese,
  tchinese,
  russian,
  german,
  spanish,
  french,
  japanese,
  koreana,
  brazilian,
};

const bcp47: Record<string, string> = {
  english: "en",
  schinese: "zh-CN",
  tchinese: "zh-TW",
  russian: "ru",
  german: "de",
  spanish: "es",
  french: "fr",
  japanese: "ja",
  koreana: "ko",
  brazilian: "pt-BR",
};

let active: LocaleMap = english;
let activeCode = "english";

export function currentLocale(): string {
  return bcp47[activeCode] ?? bcp47["english"] ?? "en";
}

export function t(key: string, params?: Record<string, string>): string {
  let value = active[key] ?? english[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, v);
    }
  }
  return value;
}

export async function loadLocale(): Promise<void> {
  try {
    const lang: string = await (window as any).SteamClient?.Settings?.GetCurrentLanguage?.();
    if (lang && bundles[lang]) {
      active = bundles[lang];
      activeCode = lang;
    }
  } catch {
    active = english;
    activeCode = "english";
  }
}
