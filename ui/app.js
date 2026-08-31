'use strict';
// American Cycle — hot-seat against the machine. Drives engine/game.ts's
// interactive generator; every rule lives in the engine, nothing is duplicated.

const TILES = {
  AK:[0,0],ME:[10,0], VT:[9,1],NH:[10,1],
  WA:[0,2],ID:[1,2],MT:[2,2],ND:[3,2],MN:[4,2],IL:[5,2],WI:[6,2],MI:[7,2],NY:[8,2],RI:[9,2],MA:[10,2],
  OR:[0,3],NV:[1,3],WY:[2,3],SD:[3,3],IA:[4,3],IN:[5,3],OH:[6,3],PA:[7,3],NJ:[8,3],CT:[9,3],
  CA:[0,4],UT:[1,4],CO:[2,4],NE:[3,4],MO:[4,4],KY:[5,4],WV:[6,4],VA:[7,4],MD:[8,4],DE:[9,4],
  AZ:[1,5],NM:[2,5],KS:[3,5],AR:[4,5],TN:[5,5],NC:[6,5],SC:[7,5],
  OK:[3,6],LA:[4,6],MS:[5,6],AL:[6,6],GA:[7,6],
  HI:[0,7],TX:[3,7],FL:[8,7],
};
const OFFICE_LABEL = {president:'President',senator:'Senate',governor:'Governor',representative:'House'};
const PLAYER_COLORS = ['#8A6D22','#2F5C8A','#A63A2E','#3E6B4F','#6B4E8A','#8A5A2F'];

const $ = (id) => document.getElementById(id);
const el = (t, cls, txt) => { const n = document.createElement(t); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

let G = null, gen = null, pending = null, S = {
  sel: null, picks: [], human: 0, opponents: [], cfgName: 'tuned', seed: 1, over: false,
};

// ---- setup ------------------------------------------------------------------
const OPPONENT_BLURB = {
  Greedy:'Takes the best race on the board, every time. No plan beyond this cycle.',
  Lookahead:'Values a seat by what it pays over its whole term. Plans two cycles out.',
  Random:'Declares anywhere. Useful as a floor, not as a rival.',
  HouseFarm:'Builds district presence and promotes upward. Fights you for the map.',
  SenateFlood:'Runs everything for Senate early, for the six-year terms and the hand size.',
  HeterodoxSpecialist:'Drafts off-brand candidates and runs them in hostile states.',
  BillMaximizer:'Chases yes-votes and majority status. Votes for everything.',
  Impeacher:'Builds a Senate bloc large enough to remove a president.',
  EconomyChicken:'Spends hot, then pivots before the Fed tightens.',
  WideAndEmpty:'Declares everywhere cheap and contests nothing. Should be a losing strategy.',
  VPBackstab:'Puts its own running mate on your ticket, then builds a Senate bloc to remove you. Currently cannot cash it.',
};
const CONFIG_BLURB = {
  tuned:'The playable tuning. Bigger hand, thinner district supply — the settings that actually produce a contested board.',
  baseline:'The design doc as corrected: biennial decay, margin-based pushes, hand 12.',
  'as-written':'v0.2 exactly, with annual decay. The map cannot realign here at any margin — that is the point of including it.',
  'flat-push':'Flat +1 lean pushes, the rule that was cut. Win a state every cycle for a decade and move the map nowhere.',
  'governors-push':'Governors push lean when they win with the grain of the state, never against it.',
  brutal:'Large office bonuses. The leader compounds hard.',
  realigning:'The one rule change that makes the map actually realign: a walkover counts as one pip of evidence about a state. Play it against "tuned" to feel the difference.',
  'three-terms':'§14\'s three-term victory. Ends tightly — but collapses the game onto the presidency, and whoever is best at that race takes everything.',
};

function setup() {
  const opts = Object.keys(AGENTS).map((k) => `<option value="${k}">${k}</option>`).join('');
  const cfgs = Object.keys(CONFIGS).map((k) => `<option value="${k}"${k === 'tuned' ? ' selected' : ''}>${k}</option>`).join('');
  modal(`
    <h1 style="font-size:26px;letter-spacing:-.01em">American Cycle</h1>
    <p class="note" style="margin:6px 0 16px">Draft real politicians, run them across a decade of elections, and try to
      leave the map different from how you found it. You are one faction among several — you hold cards of
      both parties, and so does everyone else.</p>
    <div class="setup-grid">
      <label class="f">Opponent<select id="s1">${opts}</select><span class="note" id="b1"></span></label>
      <label class="f">Second opponent<select id="s2">${opts}</select><span class="note" id="b2"></span></label>
      <label class="f">Third opponent<select id="s3"><option value="">— none —</option>${opts}</select><span class="note" id="b3"></span></label>
      <label class="f">Rules<select id="scfg">${cfgs}</select><span class="note" id="bcfg"></span></label>
    </div>
    <div class="row" style="margin-top:14px">
      <label class="f">Seed<input type="number" id="sseed" value="${(Math.random()*9999)|0}" style="width:110px"></label>
      <label class="f">Start era<select id="sera"></select><span class="note">Play opens here; later packs enter as the talon runs down (§14).</span></label>
    </div>
    <div class="row" style="margin-top:18px"><button class="btn" id="go">Open the cycle</button></div>
  `);
  const eras = Object.keys(PACKS).sort();
  $('sera').innerHTML = eras.map((e) => `<option value="${e}"${e === '1976' ? ' selected' : ''}>${e}</option>`).join('');
  $('s1').value = 'Lookahead'; $('s2').value = 'HouseFarm'; $('s3').value = 'Greedy';
  const sync = () => {
    for (const [sel, out] of [['s1','b1'],['s2','b2'],['s3','b3']]) {
      $(out).textContent = $(sel).value ? (OPPONENT_BLURB[$(sel).value] || '') : '';
    }
    $('bcfg').textContent = CONFIG_BLURB[$('scfg').value] || '';
  };
  for (const id of ['s1','s2','s3','scfg']) $(id).onchange = sync;
  sync();
  $('go').onclick = () => {
    S.opponents = ['s1','s2','s3'].map((i) => $(i).value).filter(Boolean);
    S.cfgName = $('scfg').value;
    S.seed = Number($('sseed').value) || 1;
    S.startEra = $('sera').value;
    closeModal(); start();
  };
}

function start() {
  const cfg = JSON.parse(JSON.stringify(CONFIGS[S.cfgName]));
  // every era in the build, oldest first -- §14 has refill packs draw from
  // later years, and the engine consumes them in era order
  const cards = [];
  for (const k of Object.keys(PACKS).sort()) {
    if (S.startEra && k < S.startEra) continue;      // begin at the chosen era
    cards.push(...PACKS[k].cards);
  }
  cfg.game.startYear = Number(S.startEra) || cfg.game.startYear;
  const rng = new RNG(S.seed);
  const you = { name:'You', declare:()=>[], withdraw:()=>false, proposeG:()=>3, voteBill:()=>true, veto:()=>false };
  const agents = [you, ...S.opponents.map((n) => new AGENTS[n](cfg, rng))];
  S.human = 0; S.over = false;
  G = new Game(agents, cards, cfg, S.seed);
  $('cfgName').textContent = S.cfgName;
  gen = G.interactiveTick(S.human);
  logLine(G.year, `<b>${S.opponents.length + 1} factions take the table.</b> Rules: ${S.cfgName}. Seed ${S.seed}.`, true);
  advance();
}

// ---- driving the engine generator -------------------------------------------
function advance(answer) {
  if (S.over) return;
  let r;
  try { r = gen.next(answer); } catch (e) { console.error(e); ticker('The cycle failed: ' + e.message); return; }
  if (r.done) {
    drainLog();
    const end = G.cfg.game.startYear + G.cfg.game.maxYears;
    const dead = !G.talon.length && !G.discard.length && !G.eraQueue.length;
    if (G.year >= end || dead) return gameOver(dead);
    gen = G.interactiveTick(S.human);
    return advance();
  }
  pending = r.value;
  drainLog();
  render();
  if (pending.kind === 'declare') phaseDeclare();
  else if (pending.kind === 'withdraw') phaseWithdraw();
  else if (pending.kind === 'bill') phaseBill();
}

// ---- declaration ------------------------------------------------------------
function phaseDeclare() {
  S.picks = []; S.sel = null;
  const open = pending.open;
  const me = G.players[S.human];
  const eligibleFor = (card) => open.filter((r) =>
    r.office === 'president' || eligible(card, r.state, me.districts));
  S.eligibleFor = eligibleFor;
  $('handHint').textContent = `${G.year} — pick a card, then a state`;
  ticker(`${G.year}: declarations are open.`);
  render();
}

function racesInState(state) {
  if (!S.eligibleFor || !S.sel) return [];
  return S.eligibleFor(S.sel).filter((r) => r.state === state);
}

function pickRace(state) {
  if (!S.sel) { ticker('Choose a candidate first.'); return; }
  const rs = racesInState(state);
  if (!rs.length) return;
  const card = S.sel;
  const choose = (r) => {
    const me = G.players[S.human];
    S.picks.push({ player:S.human, card, district: me.districts.find((d)=>d.state===r.state),
                   office:r.office, state:r.state, slot:r.slot });
    S.sel = null; closeModal(); render();
  };
  if (rs.length === 1) return choose(rs[0]);
  modal(`<h2>${state} — which race?</h2><div class="row" style="margin-top:12px" id="rr"></div>`);
  for (const r of rs) {
    const b = el('button','btn ghost', `${OFFICE_LABEL[r.office]}${r.slot && r.office==='representative' ? ' '+r.slot : ''}`);
    b.onclick = () => choose(r);
    $('rr').appendChild(b);
  }
}

// ---- withdrawal window ------------------------------------------------------
function phaseWithdraw() {
  const { view, race, round } = pending;
  const rows = view.myModifiers.map((m) =>
    `<tr><td>${m.source}${m.national ? ' <span class="note">(national)</span>' : ''}</td>
      <td class="${m.pips>=0?'pos':'neg'}">${m.pips>=0?'+':''}${m.pips}</td></tr>`).join('');
  const opp = view.opponentCards
    ? `<p class="note">Revealed against you: ${view.opponentCards.map((o)=>`<b>${o.party}</b>`).join(', ')}.</p>`
    : `<p class="note">This is a primary. The other cards are face down — you decide without seeing them.</p>`;
  modal(`
    <span class="eyebrow">${round} · ${race.state} ${OFFICE_LABEL[race.office]}</span>
    <h2 style="font-size:21px;margin-top:4px">Withdraw ${race.cardName}?</h2>
    <p class="note" style="margin:8px 0 12px">${view.contenders} other ${view.contenders===1?'peg is':'pegs are'} on this race.
      The dice have not been rolled and will not be until this window closes.</p>
    ${opp}
    <table class="stack" style="margin:12px 0">${rows || '<tr><td>no modifiers</td><td>0</td></tr>'}
      <tr class="tot"><td>your stack</td><td>${view.myModifierTotal>=0?'+':''}${view.myModifierTotal}</td></tr></table>
    <p class="note">Withdrawing returns the card to your hand and hands them the seat. Standing risks the card:
      a primary loss returns it, a general loss discards it.</p>
    <div class="row" style="margin-top:16px">
      <button class="btn" id="stand">Stand</button>
      <button class="btn ghost" id="pull">Withdraw</button>
    </div>`);
  $('stand').onclick = () => { closeModal(); advance({ withdraw:false }); };
  $('pull').onclick  = () => { closeModal(); advance({ withdraw:true  }); };
}

// ---- the omnibill -----------------------------------------------------------
function phaseBill() {
  const { isAuthor, votes } = pending;
  const maj = majorityOf(G.seats,'representative');
  modal(`
    <span class="eyebrow">${G.year} · the omnibill</span>
    <h2 style="font-size:21px;margin-top:4px">${isAuthor ? 'You hold the pen' : 'The bill comes to a vote'}</h2>
    <p class="note" style="margin:8px 0 12px">One number, G, for spending and taxation together. Every yes-vote scores,
      doubled for the majority party (${maj || 'none'}). Passage needs a House majority and 60% of the Senate —
      so it cannot pass on party lines alone. Spending warms the economy and loads the Fed.</p>
    <p class="note">Accumulated spending: <b class="mono">${G.economy.accumulatedG}</b> —
      chance the Fed tightens next year: <b class="mono">${(100*rateRiseOdds(G.economy.accumulatedG)).toFixed(0)}%</b>.</p>
    ${isAuthor ? `<label class="f" style="margin-top:12px">Propose G
      <input type="number" id="gv" value="3" min="${G.cfg.economy.gMin}" max="${G.cfg.economy.gMax}" style="width:110px"></label>
      <p class="note">Negative G is austerity: it cools the economy and reduces the Fed threat.</p>` : ''}
    <div class="row" style="margin-top:16px">
      ${votes ? '<button class="btn" id="yes">Vote yes</button><button class="btn ghost" id="no">Vote no</button>'
              : '<button class="btn" id="yes">Send it</button>'}
    </div>`);
  const send = (yes) => { const g = $('gv') ? Number($('gv').value) : undefined; closeModal(); advance({ g, yes }); };
  $('yes').onclick = () => send(true);
  if ($('no')) $('no').onclick = () => send(false);
}

function majorityOf(seats, office) {
  const t = {};
  for (const s of seats) if (s.holder && s.office === office) t[s.holder.party] = (t[s.holder.party]||0)+1;
  return Object.entries(t).sort((a,b)=>b[1]-a[1])[0]?.[0];
}

// ---- rendering --------------------------------------------------------------
function render() {
  if (!G) return;
  $('cYear').textContent = G.year;
  const e = G.economy;
  $('cEcon').textContent = e.level > 1 ? `+${e.level} boom` : e.level < -1 ? `${e.level} slump` : `${e.level>=0?'+':''}${e.level} flat`;
  $('cG').textContent = `G${e.accumulatedG} · ${(100*rateRiseOdds(e.accumulatedG)).toFixed(0)}% tighten`;
  const pres = G.president;
  $('cPres').textContent = pres ? `${pres.party} · ${G.players[pres.player].name}` : 'vacant';

  $('scores').replaceChildren(...G.players.map((p,i) => {
    const n = el('span','sc'+(i===S.human?' me':''), `${p.name} ${p.score}`);
    n.style.borderLeft = `3px solid ${PLAYER_COLORS[i]}`;
    return n;
  }));

  drawMap();
  drawHand();
  drawControls();
}

function drawMap() {
  const m = $('map'); m.replaceChildren();
  const declaredHere = new Set(S.picks.map((p)=>p.state));
  const openStates = new Set();
  if (pending && pending.kind === 'declare' && S.sel) for (const r of racesInState_all(S.sel)) openStates.add(r.state);
  for (const [code,[c,r]] of Object.entries(TILES)) {
    const t = el('div','st');
    t.style.gridColumn = c+1; t.style.gridRow = r+1;
    const lean = G.leanMap[code] || 0;
    if (lean) t.style.background = lean>0
      ? `color-mix(in srgb, var(--gop-soft) ${Math.min(100,45+12*Math.abs(lean))}%, var(--paper-2))`
      : `color-mix(in srgb, var(--dem-soft) ${Math.min(100,45+12*Math.abs(lean))}%, var(--paper-2))`;
    t.appendChild(el('span',null,code));
    const pips = el('div','pips');
    for (let i=0;i<Math.min(4,Math.abs(lean));i++){
      const d = el('div','pip'); d.style.background = lean>0?'var(--gop)':'var(--dem)'; pips.appendChild(d);
    }
    t.appendChild(pips);
    const held = G.seats.find((s)=>s.state===code && s.holder && (s.office==='senator'||s.office==='governor'));
    if (held){ const pg = el('div','peg'); pg.style.background = PLAYER_COLORS[held.holder.player]; t.appendChild(pg); }
    if (openStates.has(code)) { t.classList.add('act'); t.onclick = () => pickRace(code); }
    if (declaredHere.has(code)) t.classList.add('race');
    t.title = `${code} — lean ${lean>0?'R+':lean<0?'D+':''}${Math.abs(lean)||'even'}`;
    m.appendChild(t);
  }
}
function racesInState_all(card){
  const me = G.players[S.human];
  return (pending.open||[]).filter((r)=> r.office==='president' || eligible(card, r.state, me.districts));
}

function drawHand() {
  const h = $('hand'); h.replaceChildren();
  const me = G.players[S.human];
  const used = new Set(S.picks.map((p)=>p.card.id));
  const cands = me.hand.filter((c)=>c.kind==='candidate');
  if (!cands.length) h.appendChild(el('p','note','No candidates in hand.'));
  for (const c of cands) {
    if (used.has(c.id)) continue;
    const n = el('div','cc '+c.party+(S.sel && S.sel.id===c.id?' sel':''));
    const hd = el('div','hd');
    const src = (typeof PORTRAITS !== 'undefined') && PORTRAITS[c.id];
    if (src) { const img = el('img','pt'); img.src = src; img.alt = ''; hd.appendChild(img); }
    const txt = el('div');
    txt.appendChild(el('div','nm',c.name));
    txt.appendChild(el('div','mt',`${c.party} · ${c.homeState}${c.homeStateBonus?' +'+c.homeStateBonus:''} · ${c.era}`));
    hd.appendChild(txt);
    n.appendChild(hd);
    if (c.belief) n.appendChild(el('div','bel','"'+c.belief+'"'));
    const tw = el('div');
    for (const f of c.effects) tw.appendChild(el('span','tag '+(f.type==='heterodox'?'het':f.type==='extremist'?'ext':''), f.type));
    for (const i of c.identities.slice(0,3)) tw.appendChild(el('span','tag',i));
    n.appendChild(tw);
    n.onclick = () => { if (pending && pending.kind==='declare'){ S.sel = S.sel===c?null:c; render(); } };
    h.appendChild(n);
  }
  const me2 = G.players[S.human];
  $('handHint').textContent = pending && pending.kind==='declare'
    ? `${cands.length - used.size} cards · ${me2.districts.length} districts · ${S.picks.length} declared`
    : `${cands.length} cards · ${me2.districts.length} districts`;
}

function drawControls() {
  const c = $('controls'); c.replaceChildren();
  if (S.over) { const b = el('button','btn','New game'); b.onclick = setup; c.appendChild(b); return; }
  if (!pending || pending.kind !== 'declare') return;
  const go = el('button','btn', S.picks.length ? `Run ${S.picks.length} race${S.picks.length>1?'s':''}` : 'Sit this cycle out');
  go.onclick = () => { const p = S.picks; S.picks = []; S.sel = null; advance({ declarations: p }); };
  c.appendChild(go);
  if (S.picks.length) {
    const u = el('button','btn ghost','Undo last');
    u.onclick = () => { S.picks.pop(); render(); };
    c.appendChild(u);
    c.appendChild(el('span','note', S.picks.map((p)=>`${p.card.name} → ${p.state} ${OFFICE_LABEL[p.office]}`).join(' · ')));
  } else if (S.sel) {
    c.appendChild(el('span','note',`${S.sel.name} — click a highlighted state.`));
  } else {
    c.appendChild(el('span','note','Click a card to see where it can run.'));
  }
}

// ---- the wire ---------------------------------------------------------------
let logSeen = 0, eventSeen = 0;
function logLine(year, html, big) {
  const n = el('div','le'+(big?' big':''));
  n.innerHTML = `<span class="yr">${year}</span> ${html}`;
  $('log').prepend(n);
}
function ticker(t){ $('ticker').textContent = t; }

function drainLog() {
  if (!G) return;
  for (; eventSeen < G.events.length; eventSeen++) {
    const ev = G.events[eventSeen];
    if (ev.uncontested || ev.office === 'president') continue;
    const w = ev.sides.find((s)=>s.player===ev.winner);
    const l = ev.sides.find((s)=>s.player!==ev.winner);
    if (!w || !l) continue;
    const dice = `<div class="dice">
      ${die('national', w.dice.national)}${die('state', w.dice.state)}${die('candidate', w.dice.candidate)}</div>`;
    const who = G.players[ev.winner].name;
    const upset = ev.upset ? ' <b>Upset</b> — the favourite lost.' : '';
    logLine(ev.year,
      `${ev.state} ${OFFICE_LABEL[ev.office]} <b>${ev.round}</b> — ${who} takes it by ${ev.margin}.${upset}${dice}`);
  }
  for (; logSeen < G.log.length; logSeen++) {
    logLine(G.year, `<b>${G.log[logSeen]}</b>`, true);
    ticker(G.log[logSeen]);
  }
}
const die = (label, n) => `<div class="die roll"><div class="n">${n}</div><div class="l">${label}</div></div>`;

// ---- end --------------------------------------------------------------------
function gameOver(deckOut) {
  S.over = true;
  const rank = G.players.map((p,i)=>({p,i})).sort((a,b)=>b.p.score-a.p.score);
  const you = rank.findIndex((r)=>r.i===S.human)+1;
  const realigned = Object.entries(G.leanMap).filter(([,v])=>Math.abs(v)>=4);
  modal(`
    <span class="eyebrow">${G.cfg.game.startYear}–${G.year}</span>
    <h2 style="font-size:24px;margin-top:4px">${you===1?'You finished first.':`You finished ${you}${['','st','nd','rd'][you]||'th'}.`}</h2>
    <p class="note" style="margin:8px 0 14px">${deckOut ? 'The talon ran dry — the deck-out ending.' : 'The cycle ran its course.'}</p>
    <table class="stack">${rank.map((r)=>`<tr><td>${r.p.name}</td><td>${r.p.score}</td></tr>`).join('')}</table>
    <p class="note" style="margin-top:14px">${realigned.length
      ? `<b>Realigned:</b> ${realigned.map(([s,v])=>`${s} ${v>0?'R':'D'}+${Math.abs(v)}`).join(', ')}. Those states moved because someone kept winning them decisively.`
      : 'No state moved four pips or more. Nothing realigned — which is itself the finding: squeakers hold seats and change nothing.'}</p>
    <div class="row" style="margin-top:18px"><button class="btn" id="again">New game</button></div>`);
  $('again').onclick = setup;
  render();
}

// ---- modal ------------------------------------------------------------------
function modal(html){ $('modalBody').innerHTML = html; $('modal').classList.add('on'); }
function closeModal(){ $('modal').classList.remove('on'); }

setup();
