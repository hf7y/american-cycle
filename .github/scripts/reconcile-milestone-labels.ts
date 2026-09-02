// Arming is inferred, never declared: a milestone is armed iff the repo's
// ROSTER row (hf7y/scheduler's schedule/ROSTER) reads `live` AND it is the
// earliest open milestone in this repo. Closing a milestone arms the next
// one; nobody writes that down anywhere. See issue #115.

export interface OpenMilestone {
  number: number;
  createdAt: string;
}

export interface OpenIssue {
  number: number;
  labels: string[];
  milestoneNumber: number | null;
}

export interface RelabelAction {
  issueNumber: number;
  removeLabel: "parked" | "playtest";
  addLabel: "playtest" | "parked";
}

const NEVER_TOUCH = "needs-human";
const LEAVE_ALONE = "deferred";

export function armedMilestoneNumber(
  rosterLive: boolean,
  openMilestones: OpenMilestone[],
): number | null {
  if (!rosterLive || openMilestones.length === 0) return null;
  const earliest = [...openMilestones].sort(
    (a, b) => a.createdAt.localeCompare(b.createdAt) || a.number - b.number,
  )[0];
  return earliest.number;
}

export function planRelabels(
  rosterLive: boolean,
  openMilestones: OpenMilestone[],
  openIssues: OpenIssue[],
): RelabelAction[] {
  const armed = armedMilestoneNumber(rosterLive, openMilestones);
  const actions: RelabelAction[] = [];
  for (const issue of openIssues) {
    if (issue.milestoneNumber == null) continue;
    if (issue.labels.includes(NEVER_TOUCH)) continue;
    if (issue.labels.includes(LEAVE_ALONE)) continue;
    const isArmed = issue.milestoneNumber === armed;
    const hasParked = issue.labels.includes("parked");
    const hasPlaytest = issue.labels.includes("playtest");
    if (isArmed && hasParked) {
      actions.push({ issueNumber: issue.number, removeLabel: "parked", addLabel: "playtest" });
    } else if (!isArmed && hasPlaytest) {
      actions.push({ issueNumber: issue.number, removeLabel: "playtest", addLabel: "parked" });
    }
  }
  return actions;
}

// schedule/ROSTER rows look like: `american-cycle  | american-cycle@monkey  | 20m | live`
// with `#`-prefixed prose lines and blank lines between them.
export function parseRosterLive(rosterText: string, projectName: string): boolean | null {
  for (const rawLine of rosterText.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const cols = line.split("|").map((c) => c.trim());
    if (cols.length < 4) continue;
    if (cols[0] === projectName) return cols[3] === "live";
  }
  return null;
}

const ROSTER_URL = "https://raw.githubusercontent.com/hf7y/scheduler/main/schedule/ROSTER";

async function ghApi(token: string, path: string, init: RequestInit = {}): Promise<any> {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      ...(init.headers ?? {}),
    },
  });
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status} ${await res.text()}`);
  }
  return res.status === 204 ? null : res.json();
}

async function fetchOpenMilestones(token: string, ownerRepo: string): Promise<OpenMilestone[]> {
  const raw = await ghApi(token, `/repos/${ownerRepo}/milestones?state=open&per_page=100`);
  return raw.map((m: any) => ({ number: m.number, createdAt: m.created_at }));
}

async function fetchOpenIssues(token: string, ownerRepo: string): Promise<OpenIssue[]> {
  const issues: OpenIssue[] = [];
  for (let page = 1; ; page++) {
    const batch = await ghApi(token, `/repos/${ownerRepo}/issues?state=open&per_page=100&page=${page}`);
    for (const raw of batch) {
      if (raw.pull_request) continue;
      issues.push({
        number: raw.number,
        labels: raw.labels.map((l: any) => l.name),
        milestoneNumber: raw.milestone ? raw.milestone.number : null,
      });
    }
    if (batch.length < 100) break;
  }
  return issues;
}

async function applyAction(token: string, ownerRepo: string, action: RelabelAction): Promise<void> {
  await ghApi(token, `/repos/${ownerRepo}/issues/${action.issueNumber}/labels/${action.removeLabel}`, {
    method: "DELETE",
  });
  await ghApi(token, `/repos/${ownerRepo}/issues/${action.issueNumber}/labels`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ labels: [action.addLabel] }),
  });
}

async function main(): Promise<void> {
  const ownerRepo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (!ownerRepo) throw new Error("GITHUB_REPOSITORY is not set");
  if (!token) throw new Error("GITHUB_TOKEN is not set");
  const projectName = ownerRepo.split("/")[1];

  const rosterText = await (await fetch(ROSTER_URL)).text();
  const rosterLive = parseRosterLive(rosterText, projectName);
  if (rosterLive === null) {
    console.log(`${projectName} has no schedule/ROSTER row -- treating as not live.`);
  }

  const [openMilestones, openIssues] = await Promise.all([
    fetchOpenMilestones(token, ownerRepo),
    fetchOpenIssues(token, ownerRepo),
  ]);

  const actions = planRelabels(rosterLive === true, openMilestones, openIssues);
  if (actions.length === 0) {
    console.log("Nothing to relabel.");
    return;
  }
  for (const action of actions) {
    console.log(`#${action.issueNumber}: ${action.removeLabel} -> ${action.addLabel}`);
    await applyAction(token, ownerRepo, action);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((err) => {
    console.error(err);
    process.exitCode = 1;
  });
}
