import { definePlugin, Millennium } from "@steambrew/client";
import { attach, detach, Mounted } from "./mounting";
import { playBarModule } from "./tile";
import { debug, warn, fail } from "./log";
import { loadLocale } from "./locale";

const CS2_APPID = 730;

// The library's in-memory router is reachable per window (same path size-on-disk
// uses), so we know exactly which app's page is displayed — no DOM text matching.
function currentAppId(win: Window): number | null {
  const candidates = [
    // The plugin itself runs in the shared desktop context, which owns the router.
    (window as any).MainWindowBrowserManager?.m_lastLocation?.pathname,
    // Some window scopes (desktop popups) carry their own manager.
    (win as any).MainWindowBrowserManager?.m_lastLocation?.pathname,
    // GamepadUI windows derive the route from the opener URL.
    (() => {
      try {
        return win.opener?.location?.pathname;
      } catch {
        return undefined;
      }
    })(),
  ];
  for (const path of candidates) {
    const match = typeof path === "string" ? path.match(/^\/library\/app\/(\d+)/) : null;
    if (match) return Number(match[1]);
  }
  return null;
}

// Steam keeps cached library page trees stacked in the DOM; hidden clones still
// report non-zero rects, so rect checks can't separate them. Hit-testing with
// elementFromPoint tells us which tree is actually displayed on screen. Overlays
// from the *same* page tree (tooltips, badges) wrap their content, so a hit that
// contains the element is also a pass; clone trees never contain it.
function onScreen(doc: Document, el: Element): boolean {
  const r = el.getBoundingClientRect();
  if (r.width <= 0 || r.height <= 0) return false;
  const y = r.top + Math.min(10, r.height / 2);
  for (const x of [r.left + 10, r.left + r.width / 2, r.right - 10]) {
    const hit = doc.elementFromPoint(x, y);
    if (hit && (hit === el || el.contains(hit) || hit.contains(el))) return true;
  }
  return false;
}

// Mount into the first *displayed* stats section — one tile, regardless of how
// many cached page clones the document holds.
function findDropSections(win: Window, doc: Document): Element[] {
  const styles = playBarModule;
  if (!styles) return [];
  if (currentAppId(win) !== CS2_APPID) return [];

  const visible = Array.from(doc.querySelectorAll(`.${styles.GameStatsSection}`)).filter((s) =>
    onScreen(doc, s),
  );
  return visible.length ? [visible[0]] : [];
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

    const sections = findDropSections(win, doc);
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