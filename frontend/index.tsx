import { definePlugin, Millennium } from "@steambrew/client";
import { attach, detach, Mounted } from "./mounting";
import { playBarModule } from "./tile";
import { debug, warn, fail } from "./log";
import { loadLocale } from "./locale";

const CS2_LABEL = /Counter-Strike\s*2/i;

// The CS2 library page carries exactly one stats row; if more than one
// GameStatsSection matches (Valve renders duplicates), mount only the first so
// the countdown never appears twice with drifting clocks.
function findDropSections(doc: Document): Element[] {
  const styles = playBarModule;
  if (!styles) return [];

  const labels = Array.from(doc.querySelectorAll<HTMLElement>(`.${styles.PlayBarGameName}`));

  for (const label of labels) {
    const box = label.getBoundingClientRect();
    if (box.width <= 0 || box.height <= 0) continue;
    if (!CS2_LABEL.test((label.textContent ?? "").trim())) continue;

    let node: Element | null = label;
    for (let hops = 0; hops < 10 && node && !node.classList?.contains(styles.Container); hops++) {
      node = node.parentElement;
    }
    if (!node || !node.classList?.contains(styles.Container)) continue;

    const section = node.querySelector(`.${styles.GameStatsSection}`);
    if (section) return [section];
  }

  return [];
}

// Guard against observe() running twice on one window; the originals are
// restored when the window unloads, since plugins have no disable hook.
const patchedWindows = new WeakSet<Window>();

function patchHistory(tag: string, win: Window, enqueue: () => void): void {
  if (patchedWindows.has(win)) return;
  patchedWindows.add(win);
  try {
    const wrap = <F extends (...args: any[]) => any>(fn: F) =>
      function (this: unknown, ...args: unknown[]) {
        const result = (fn as any).apply(this, args);
        enqueue();
        return result;
      };

    const pushOriginal = win.history.pushState;
    const replaceOriginal = win.history.replaceState;
    win.history.pushState = wrap(pushOriginal) as typeof win.history.pushState;
    win.history.replaceState = wrap(replaceOriginal) as typeof win.history.replaceState;

    win.addEventListener(
      "unload",
      () => {
        try {
          win.history.pushState = pushOriginal;
          win.history.replaceState = replaceOriginal;
        } catch {
          /* window already torn down, nothing to restore */
        }
      },
      { once: true },
    );
  } catch (err) {
    warn(`[${tag}] history hook failed`, err);
  }
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

  patchHistory(tag, win, enqueue);

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

  loadLocale().then(() => {
    debug("locale loaded");
  }).catch((err) => {
    warn("locale load failed", err);
  });

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