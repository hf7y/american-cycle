import { test } from "node:test";
import assert from "node:assert/strict";
import { handler } from "./report.js";

const ORIGINAL_FETCH = globalThis.fetch;
const ORIGINAL_TOKEN = process.env.GITHUB_TOKEN;
const ORIGINAL_REPO = process.env.REPORT_REPO;

function withEnv(token, repo, fn) {
  process.env.GITHUB_TOKEN = token;
  if (repo === undefined) delete process.env.REPORT_REPO;
  else process.env.REPORT_REPO = repo;
  return Promise.resolve(fn()).finally(() => {
    if (ORIGINAL_TOKEN === undefined) delete process.env.GITHUB_TOKEN;
    else process.env.GITHUB_TOKEN = ORIGINAL_TOKEN;
    if (ORIGINAL_REPO === undefined) delete process.env.REPORT_REPO;
    else process.env.REPORT_REPO = ORIGINAL_REPO;
  });
}

function post(body) {
  return { httpMethod: "POST", body: JSON.stringify(body) };
}

test("rejects a non-POST method", async () => {
  const res = await handler({ httpMethod: "GET" });
  assert.equal(res.statusCode, 405);
});

test("rejects unparseable JSON", async () => {
  const res = await handler({ httpMethod: "POST", body: "not json" });
  assert.equal(res.statusCode, 400);
});

test("a filled honeypot is accepted and dropped -- fetch is never called", async () => {
  let called = false;
  globalThis.fetch = () => { called = true; throw new Error("must not be called"); };
  try {
    const res = await withEnv("tok", undefined, () =>
      handler(post({ kind: "idea", message: "hi", honeypot: "http://spam.example" })));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true });
    assert.equal(called, false);
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});

test("rejects an empty message", async () => {
  const res = await withEnv("tok", undefined, () => handler(post({ kind: "idea", message: "   " })));
  assert.equal(res.statusCode, 400);
});

test("503s when GITHUB_TOKEN is not configured", async () => {
  const res = await withEnv("", undefined, () => handler(post({ kind: "idea", message: "hello" })));
  assert.equal(res.statusCode, 503);
});

test("files a bug report against the configured repo with the bug label", async () => {
  let seenUrl, seenBody, seenAuth;
  globalThis.fetch = async (url, opts) => {
    seenUrl = url; seenBody = JSON.parse(opts.body); seenAuth = opts.headers.Authorization;
    return { ok: true, json: async () => ({ html_url: "https://github.com/hf7y/american-cycle/issues/999" }) };
  };
  try {
    const res = await withEnv("shh", "hf7y/american-cycle", () =>
      handler(post({
        kind: "bug", message: "the map never repaints after a walkover",
        seed: 7, cfgName: "as-written-plus", startEra: "1976", opponents: ["Greedy"], year: 1980,
        buildStamp: "deadbeef",
      })));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(JSON.parse(res.body), { ok: true, url: "https://github.com/hf7y/american-cycle/issues/999" });
    assert.equal(seenUrl, "https://api.github.com/repos/hf7y/american-cycle/issues");
    assert.equal(seenAuth, "Bearer shh");
    assert.deepEqual(seenBody.labels, ["playtest", "bug"]);
    assert.match(seenBody.title, /^Bug report: /);
    assert.match(seenBody.body, /"seed": 7/);
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});

test("an idea report gets the enhancement label, not bug", async () => {
  let seenBody;
  globalThis.fetch = async (_url, opts) => {
    seenBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ html_url: "https://example/1" }) };
  };
  try {
    const res = await withEnv("tok", undefined, () => handler(post({ kind: "idea", message: "add a scoreboard" })));
    assert.equal(res.statusCode, 200);
    assert.deepEqual(seenBody.labels, ["playtest", "enhancement"]);
    assert.match(seenBody.title, /^Idea report: /);
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});

test("a long message is truncated in the title but kept whole in the body", async () => {
  const long = "x".repeat(200);
  let seenBody;
  globalThis.fetch = async (_url, opts) => {
    seenBody = JSON.parse(opts.body);
    return { ok: true, json: async () => ({ html_url: "https://example/1" }) };
  };
  try {
    await withEnv("tok", undefined, () => handler(post({ kind: "idea", message: long })));
    assert.equal(seenBody.title.length, "Idea report: ".length + 72);
    assert.ok(seenBody.body.includes(long));
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});

test("propagates a GitHub API error as 502 without leaking the raw response beyond a slice", async () => {
  globalThis.fetch = async () => ({ ok: false, text: async () => "boom".repeat(200) });
  try {
    const res = await withEnv("tok", undefined, () => handler(post({ kind: "idea", message: "hi" })));
    assert.equal(res.statusCode, 502);
    const parsed = JSON.parse(res.body);
    assert.equal(parsed.ok, false);
    assert.ok(parsed.error.length <= 300);
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});

test("a network failure reaching GitHub is a 502, not an unhandled rejection", async () => {
  globalThis.fetch = async () => { throw new Error("ECONNRESET"); };
  try {
    const res = await withEnv("tok", undefined, () => handler(post({ kind: "idea", message: "hi" })));
    assert.equal(res.statusCode, 502);
  } finally { globalThis.fetch = ORIGINAL_FETCH; }
});
