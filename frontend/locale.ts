import english from "./locales/english.json";
import schinese from "./locales/schinese.json";
import tchinese from "./locales/tchinese.json";
import russian from "./locales/russian.json";
import german from "./locales/german.json";
import spanish from "./locales/spanish.json";
import french from "./locales/french.json";
import japanese from "./locales/japanese.json";
import koreana from "./locales/koreana.json";
import brazilian from "./locales/brazilian.json";

type LocaleMap = Record<string, string>;

const bundles: Record<string, LocaleMap> = {
  english: english as LocaleMap,
  schinese: schinese as LocaleMap,
  tchinese: tchinese as LocaleMap,
  russian: russian as LocaleMap,
  german: german as LocaleMap,
  spanish: spanish as LocaleMap,
  french: french as LocaleMap,
  japanese: japanese as LocaleMap,
  koreana: koreana as LocaleMap,
  brazilian: brazilian as LocaleMap,
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

let active: LocaleMap = english as LocaleMap;
let activeCode = "english";

let pluralRules = new Intl.PluralRules(bcp47[activeCode]);

export function currentLocale(): string {
  return bcp47[activeCode] ?? "en";
}

export function pluralForm(unit: string, value: number): string {
  const category = pluralRules.select(value);
  return (
    active[`${unit}_${category}`] ??
    (english as LocaleMap)[`${unit}_${category}`] ??
    active[category === "one" ? unit : `${unit}s`] ??
    (english as LocaleMap)[category === "one" ? unit : `${unit}s`] ??
    unit
  );
}

export function t(key: string, params?: Record<string, string>): string {
  let value = active[key] ?? (english as LocaleMap)[key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      value = value.replace(`{${k}}`, v);
    }
  }
  return value;
}

export async function loadLocale(): Promise<void> {
  try {
    const lang = await (window as any).SteamClient?.Settings?.GetCurrentLanguage?.();
    if (lang && bundles[lang]) {
      active = bundles[lang];
      activeCode = lang;
      pluralRules = new Intl.PluralRules(currentLocale());
    }
  } catch {
    active = english as LocaleMap;
    activeCode = "english";
  }
}
