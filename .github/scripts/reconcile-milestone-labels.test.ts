import { test } from "node:test";
import assert from "node:assert/strict";
import {
  armedMilestoneNumber,
  planRelabels,
  parseRosterLive,
} from "./reconcile-milestone-labels.ts";

const V02 = { number: 1, createdAt: "2026-08-31T17:48:03Z" };
const V04 = { number: 2, createdAt: "2026-08-31T17:48:04Z" };
const V03 = { number: 3, createdAt: "2026-08-31T19:07:04Z" };

test("armedMilestoneNumber: not live -> nothing armed", () => {
  assert.equal(armedMilestoneNumber(false, [V02, V03, V04]), null);
});

test("armedMilestoneNumber: live but no open milestones -> nothing armed", () => {
  assert.equal(armedMilestoneNumber(true, []), null);
});

test("armedMilestoneNumber: live -> earliest-created open milestone wins, not lowest number", () => {
  assert.equal(armedMilestoneNumber(true, [V02, V03, V04]), V02.number);
});

test("planRelabels: needs-human is never relabelled, even parked-in-armed-milestone", () => {
  const issues = [
    { number: 1, labels: ["parked", "needs-human"], milestoneNumber: V02.number },
  ];
  assert.deepEqual(planRelabels(true, [V02, V03], issues), []);
});

test("planRelabels: deferred is left alone, even parked-in-armed-milestone", () => {
  const issues = [
    { number: 1, labels: ["parked", "deferred"], milestoneNumber: V02.number },
  ];
  assert.deepEqual(planRelabels(true, [V02, V03], issues), []);
});

test("planRelabels: parked issue in the armed milestone flips to playtest", () => {
  const issues = [{ number: 1, labels: ["parked"], milestoneNumber: V02.number }];
  assert.deepEqual(planRelabels(true, [V02, V03], issues), [
    { issueNumber: 1, removeLabel: "parked", addLabel: "playtest" },
  ]);
});

test("planRelabels: playtest issue outside the armed milestone flips to parked", () => {
  const issues = [{ number: 1, labels: ["playtest"], milestoneNumber: V03.number }];
  assert.deepEqual(planRelabels(true, [V02, V03], issues), [
    { issueNumber: 1, removeLabel: "playtest", addLabel: "parked" },
  ]);
});

test("planRelabels: issue with no milestone is skipped", () => {
  const issues = [{ number: 1, labels: ["parked"], milestoneNumber: null }];
  assert.deepEqual(planRelabels(true, [V02, V03], issues), []);
});

test("planRelabels: repo not live parks every playtest issue regardless of milestone", () => {
  const issues = [
    { number: 1, labels: ["playtest"], milestoneNumber: V02.number },
    { number: 2, labels: ["playtest"], milestoneNumber: V03.number },
  ];
  assert.deepEqual(planRelabels(false, [V02, V03], issues), [
    { issueNumber: 1, removeLabel: "playtest", addLabel: "parked" },
    { issueNumber: 2, removeLabel: "playtest", addLabel: "parked" },
  ]);
});

test("planRelabels: already-consistent tree yields no actions -- running it twice is a no-op", () => {
  const issues = [
    { number: 1, labels: ["playtest"], milestoneNumber: V02.number },
    { number: 2, labels: ["parked"], milestoneNumber: V03.number },
    { number: 3, labels: ["parked"], milestoneNumber: V04.number },
  ];
  assert.deepEqual(planRelabels(true, [V02, V03, V04], issues), []);
});

test("parseRosterLive: finds the project's row among comments and other rows", () => {
  const roster = `
# schedule/ROSTER -- prose header
# more prose, and a | pipe | in a comment line

ecosim          | ecosim@monkey          | 20m | live
american-cycle  | american-cycle@monkey  | 20m | live
gardien         | gardien@monkey         | 20m | parked
`;
  assert.equal(parseRosterLive(roster, "american-cycle"), true);
  assert.equal(parseRosterLive(roster, "gardien"), false);
});

test("parseRosterLive: unregistered project has no row -> null", () => {
  const roster = `american-cycle  | american-cycle@monkey  | 20m | live`;
  assert.equal(parseRosterLive(roster, "unregistered-project"), null);
});
