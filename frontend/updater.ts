import { callable } from "@steambrew/client";
import { debug, warn } from "./log";

const REPO = "spix18/cs-weekly-drop";
const RELEASE_URL = `https://github.com/${REPO}/releases/latest`;
const API_URL = `https://api.github.com/repos/${REPO}/releases/latest`;
const CHECK_INTERVAL = 4 * 60 * 60 * 1000;

let updateVersion: string | null = null;
let updateUrl: string | null = null;
let updateAssetUrl: string | null = null;
let updateState: "idle" | "downloading" | "installed" | "failed" = "idle";

export function availableVersion(): string | null {
  return updateState === "installed" ? null : updateVersion;
}

export function updateStatus(): string {
  return updateState;
}

export function openRelease(): void {
  const url = updateUrl ?? RELEASE_URL;
  const opener = (window as any).SteamClient?.System?.OpenInSystemBrowser;
  if (typeof opener === "function") {
    try {
      opener(url);
      return;
    } catch (err) {
      warn("OpenInSystemBrowser threw", err);
    }
  }
  try {
    window.open(url, "_blank");
  } catch (err) {
    warn("window.open threw", err);
  }
}

async function installUpdate(): Promise<void> {
  if (!updateAssetUrl || updateState !== "idle") return;
  updateState = "downloading";

  try {
    const install = callable<[{ url: string }], string>("install_update");
    const raw = await install({ url: updateAssetUrl });
    const result = JSON.parse(raw) as { success: boolean; error?: string };
    if (result.success) {
      updateState = "installed";
      debug("update installed", updateVersion);
    } else {
      updateState = "failed";
      warn("update install failed", result?.error);
    }
  } catch (err) {
    updateState = "failed";
    warn("update install error", err);
  }
}

async function check(): Promise<void> {
  try {
    const res = await fetch(API_URL, { headers: { Accept: "application/vnd.github+json" } });
    if (!res.ok) return;
    const data: any = await res.json();
    const remote: string = (data?.tag_name ?? "").replace(/^v/, "");
    const htmlUrl: string = data?.html_url ?? "";
    const assetUrl: string = data?.assets?.[0]?.browser_download_url ?? "";
    if (!remote) return;

    const current = "1.2.0";
    if (remote !== current && compareVersions(remote, current) > 0) {
      updateVersion = remote;
      updateUrl = htmlUrl;
      updateAssetUrl = assetUrl;
      debug("update available", remote);
      if (updateAssetUrl) {
        await installUpdate();
      }
    }
  } catch (err) {
    warn("update check failed", err);
  }
}

function compareVersions(a: string, b: string): number {
  const pa = a.split(".").map(Number);
  const pb = b.split(".").map(Number);
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pa[i] ?? 0) - (pb[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

export function startUpdateChecker(): void {
  check();
  window.setInterval(check, CHECK_INTERVAL);
}
