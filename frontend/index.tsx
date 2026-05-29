import { definePlugin, Millennium } from "@steambrew/client";
import { attach, detach, Mounted } from "./mounting";
import { playBarModule } from "./tile";
import { debug, warn, fail } from "./log";

const CS2_LABEL = /Counter-Strike\s*2/i;

function findDropSections(doc: Document): Element[] {
  const styles = playBarModule;
  if (!styles?.GameStatsSection || !styles.PlayBarGameName) return [];

  const found: Element[] = [];
  const labels = Array.from(doc.querySelectorAll<HTMLElement>(`.${styles.PlayBarGameName}`));

  for (const label of labels) {
    const box = label.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    if (!CS2_LABEL.test((label.textContent ?? "").trim())) continue;

    let node: Element | null = label;
    for (let hops = 0; hops < 10 && node; hops++) {
      if (styles.Container && node.classList?.contains(styles.Container)) break;
      node = node.parentElement;
    }

    const section = (node ?? doc).querySelector(`.${styles.GameStatsSection}`);
    if (section && !found.includes(section)) found.push(section);
  }

  return found;
}

function observe(tag: string, win: Window, doc: Document): void {
  const live = new Map<Element, Mounted>();
  let queued = false;
  let lastHref: string | null = null;

  const sync = () => {
    let href = "";
    try {
      href = win.location?.href ?? doc.location?.href ?? "";
    } catch (err) {
      warn(`[${tag}] href read failed`, err);
      return;
    }
    if (href !== lastHref) {
      lastHref = href;
      debug(`[${tag}] href`, href);
    }

    const sections = findDropSections(doc);
    const wanted = new Set(sections);

    for (const [host, mounted] of live) {
      if (!wanted.has(host) || !doc.contains(host)) {
        detach(mounted);
        live.delete(host);
      }
    }

    for (const host of sections) {
      if (live.has(host)) continue;
      const mounted = attach(doc, host);
      if (mounted) live.set(host, mounted);
    }
  };

  const enqueue = () => {
    if (queued) return;
    queued = true;
    win.setTimeout(() => {
      queued = false;
      try {
        sync();
      } catch (err) {
        fail(`[${tag}] sync threw`, err);
      }
    }, 100);
  };

  try {
    const push = win.history.pushState.bind(win.history);
    win.history.pushState = function (...a: any[]) {
      const r = (push as any)(...a);
      enqueue();
      return r;
    } as typeof win.history.pushState;

    const replace = win.history.replaceState.bind(win.history);
    win.history.replaceState = function (...a: any[]) {
      const r = (replace as any)(...a);
      enqueue();
      return r;
    } as typeof win.history.replaceState;
  } catch (err) {
    warn(`[${tag}] history hook failed`, err);
  }

  win.addEventListener("popstate", enqueue);
  win.addEventListener("hashchange", enqueue);

  try {
    const Watcher = (win as any).MutationObserver;
    if (Watcher && doc.body) {
      new Watcher(enqueue).observe(doc.body, { childList: true, subtree: true });
    } else {
      warn(`[${tag}] MutationObserver unavailable`);
    }
  } catch (err) {
    warn(`[${tag}] observer failed`, err);
  }

  enqueue();
  win.setInterval(enqueue, 1000);
}

export default definePlugin(() => {
  debug("plugin loaded");

  try {
    (Millennium as any).AddWindowCreateHook((ctx: any) => {
      const tag: string = ctx?.m_strName ?? "(unnamed)";
      const desktop = typeof tag === "string" && tag.startsWith("SP ");
      const bigPicture = typeof tag === "string" && tag.includes("BPM");
      if (!desktop && !bigPicture) return;

      const win: Window | undefined = ctx?.m_popup;
      const doc: Document | undefined = win?.document;
      if (!win || !doc) {
        warn("popup window missing", tag);
        return;
      }

      debug("watching", tag);
      observe(tag, win, doc);
    });
  } catch (err) {
    fail("hook registration failed", err);
  }

  return { title: "CS Weekly Drop Reset" } as any;
});
