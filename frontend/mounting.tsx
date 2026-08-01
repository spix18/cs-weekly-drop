import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { DropResetTile, RenderGuard } from "./tile";
import { debug, fail } from "./log";

export interface Mounted {
  host: Element;
  node: HTMLElement;
  root: Root;
}

export function attach(doc: Document, host: Element): Mounted | null {
  if (host.querySelector("[data-cs-weekly-drop]")) return null;

  const node = doc.createElement("div");
  node.setAttribute("data-cs-weekly-drop", "");
  node.style.display = "contents";
  host.appendChild(node);

  let root: Root;
  try {
    root = createRoot(node);
  } catch (err) {
    // createRoot is the only synchronous failure point; React renders
    // asynchronously, so render-time throws are caught by RenderGuard below.
    fail("createRoot failed", err);
    node.remove();
    return null;
  }
  root.render(createElement(RenderGuard, null, createElement(DropResetTile)));
  debug("tile attached");
  return { host, node, root };
}

export function detach(mounted: Mounted): void {
  try {
    mounted.root.unmount();
  } catch (err) {
    fail("unmount failed", err);
  }
  mounted.node.remove();
  debug("tile detached");
}
