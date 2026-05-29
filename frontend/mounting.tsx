import { createElement } from "react";
import { createRoot, Root } from "react-dom/client";
import { DropResetTile } from "./tile";
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

  try {
    const root = createRoot(node);
    root.render(createElement(DropResetTile));
    debug("tile attached");
    return { host, node, root };
  } catch (err) {
    fail("render failed", err);
    node.remove();
    return null;
  }
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
