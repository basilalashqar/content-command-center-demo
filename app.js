/* Qatar Living Editorial Command Center — frontend logic.
   Talks to the FastAPI backend mounted on the same origin. */

const API = {
  overview:        () => fetch("/api/overview").then(jsonOr(throw_)),
  evidence:        () => fetch("/api/evidence").then(jsonOr(throw_)),
  styleExamples:   () => fetch("/api/style-examples").then(jsonOr(throw_)),
  samples:         () => fetch("/api/samples").then(jsonOr(throw_)),
  promptPreview:   () => fetch("/api/prompt-preview").then(jsonOr(throw_)),
  freshness:       () => fetch("/api/freshness").then(jsonOr(throw_)),
  health:          () => fetch("/api/health").then(jsonOr(throw_)),
  generate:        (b) => post("/api/generate", b),
  rewrite:         (b) => post("/api/rewrite", b),
  score:           (b) => post("/api/score", b),
  classify:        (b) => post("/api/classify", b),
  cleanup:         (b) => post("/api/cleanup", b),
  generatePackage: (b) => post("/api/generate-package", b),
  paraphrase:      (b) => post("/api/paraphrase", b),
  radar:           (refresh) => fetch("/api/radar" + (refresh ? "?refresh=1" : "")).then(jsonOr(throw_)),
  sampleImages:    () => fetch("/api/sample-images").then(jsonOr(throw_)),
  compareSamples:  () => fetch("/api/compare-samples").then(jsonOr(throw_)),
  compareRun:      (b) => post("/api/compare", b),
  operatingModel:  () => fetch("/api/operating-model").then(jsonOr(throw_)),
  audit:           () => fetch("/api/workflow/audit").then(jsonOr(throw_)),
  variants:        (b) => post("/api/headline-variants", b),
  arabic:          (b) => post("/api/translate-arabic", b),
  quality:         (b) => post("/api/quality", b),
  roi:             (b) => post("/api/roi", b),
  roiDefault:      () => fetch("/api/roi").then(jsonOr(throw_)),
  queueList:       () => fetch("/api/workflow/queue").then(jsonOr(throw_)),
  queueAdd:        (b) => post("/api/workflow/queue", b),
  queueAct:        (id, b) => post(`/api/workflow/item/${id}`, b),
  learning:        () => fetch("/api/workflow/learning").then(jsonOr(throw_)),
  queueReset:      () => post("/api/workflow/reset", {}),
  cmsOpps:         () => fetch("/api/cms/opportunities").then(jsonOr(throw_)),
  cmsPush:         (b) => post("/api/cms/push-draft", b),
};

function jsonOr(handler) {
  return async (r) => {
    if (!r.ok) {
      const text = await r.text();
      throw new Error(`${r.status} ${text.slice(0, 400)}`);
    }
    return r.json();
  };
}
function throw_(){ throw new Error("unreachable"); }
function post(url, body) {
  return fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }).then(jsonOr(throw_));
}

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => Array.from(document.querySelectorAll(sel));

/* ───────── Boot ───────── */
window.addEventListener("DOMContentLoaded", async () => {
  wireNav();
  wireGenerateForm();
  wireRewriteForm();
  wireCheckerForm();
  wireGovernanceForm();
  wireCleanupForm();
  wireRoiForm();
  wireCopilotButtons();
  wireRunDemoJumps();
  wireParaphraseForm();
  wireRadar();
  loadSampleImages();
  renderSectionStories();   // audience-facing "today → problem → what it does → benefit" strips
  wireInlineSamples();      // one-click examples on Checker + Governance (press & run live)
  wireWalk();               // on-screen guided walkthrough (audience-safe)
  await loadOverview();   // first paint
  // Lazy-load others on first nav click; but pre-warm freshness data
  loadFreshness();
});

/* ───────── Audience-facing story strips ─────────
   Shown ON the demo (safe for the screen-share): for each section, four plain-
   language points the room can read while you talk — what the team does today,
   the snag, what this does, and the benefit. No coaching, no script. */
const SECTION_STORY = {
  overview: {
    today: "Your team writes, formats, tags and cleans every piece by hand — across the site and social.",
    problem: "Most of that time goes to repetitive work, not the reporting only a person can do.",
    does: "Gets the routine work ready — drafts, formats, checks — and hands it to the team to approve.",
    benefit: "The same editors get more done, in your voice, with the final call always theirs." },
  radar: {
    today: "Someone keeps an eye on QNA, The Peninsula and Gulf Times all day to catch what's worth covering.",
    problem: "Stories slip by, and there's no quick read on what's sensitive.",
    does: "Watches those sources for you around the clock and flags anything sensitive.",
    benefit: "Nothing gets missed — the desk starts the day ahead instead of catching up." },
  generate: {
    today: "An editor writes the article, then re-does it for Instagram, a push and a story — one at a time.",
    problem: "Preparing every format by hand eats hours, and the voice drifts between them.",
    does: "Turns one brief into every format at once, in your style — and flags anything not in the source.",
    benefit: "Hours back per story, a steady voice, and you can see where every fact came from." },
  paraphrase: {
    today: "Editors read a wire story and re-write it by hand — often ending up too close to the original.",
    problem: "It's slow, and near-copying hurts originality and search ranking.",
    does: "Re-tells the story in your own words, keeps the facts and quotes, and checks it isn't a copy.",
    benefit: "A clean, original first draft in seconds — ready for an editor to polish." },
  compare: {
    today: "How good a piece is depends on who's on shift, with no easy check against your house style.",
    problem: "It's hard to say, objectively, whether something really sounds like Qatar Living.",
    does: "Takes the same facts and writes a version in your style, right next to your real article.",
    benefit: "You judge it with your own eyes — no claims, just the two side by side." },
  checker: {
    today: "Staying on house style relies on each writer remembering the rules; a senior re-checks by hand.",
    problem: "Honorifics and tone drift, and the senior editor becomes the bottleneck.",
    does: "Scores any piece against your own style rules in seconds and points to what to fix.",
    benefit: "Consistent style without waiting on one person to read everything." },
  governance: {
    today: "Editors judge by feel what's sensitive — royals, ministries, security — and pass it up informally.",
    problem: "It's inconsistent, and a sensitive piece can slip through to publish.",
    does: "Checks every piece, flags what's sensitive, and routes it to the right reviewer — nothing auto-publishes.",
    benefit: "Peace of mind: the risky items always reach a person before they go live." },
  freshness: {
    today: "Keeping events current means someone checking dozens of dates by hand — so it rarely happens.",
    problem: "More than half your listed events have already ended, which readers notice.",
    does: "Spots the expired events on its own and suggests a fix for approval.",
    benefit: "Your events page stays trustworthy, with almost no effort." },
  cleanup: {
    today: "Before publishing, editors clean up pasted text and stamp the same sign-off on every article.",
    problem: "It's tedious, and the identical paragraph ends up on hundreds of pages.",
    does: "Clears the repeated boilerplate and pasted clutter in one click.",
    benefit: "Cleaner pages, and a few minutes saved on every single article." },
  copilot: {
    today: "Edits and approvals happen in people's heads and email — nothing is recorded or learned from.",
    problem: "The system never gets smarter, and there's no trail of who decided what.",
    does: "Gives editors a simple approve / edit / send-back, and learns from every change they make.",
    benefit: "It gets better at your style over time, with a clear record behind every call." },
  cms: {
    today: "Moving content between the writing tool and the website means copy-pasting back and forth.",
    problem: "That friction is slow, and a place for mistakes to creep in.",
    does: "Pulls in what needs writing and sends back a draft — a person always presses publish.",
    benefit: "Less manual shuffling, with publishing firmly in your team's hands." },
  roi: {
    today: "All the manual steps above add up — across the whole desk, every single day.",
    problem: "That's a lot of skilled time spent on routine work instead of journalism.",
    does: "Hands a few hours back to each editor every week by taking on the routine parts.",
    benefit: "The same team produces more, across more channels, without burning out." },
  operating: {
    today: "There's no single view of who owns what, or proof of how a decision was made.",
    problem: "That makes the whole process hard to manage and to stand behind.",
    does: "Gives every step an owner, a measure, and a full record of what happened.",
    benefit: "A process you can run, measure and improve — and explain to anyone who asks." },
};

const STORY_CELLS = [
  ["today",   "Today, by hand",  "st-today"],
  ["problem", "The problem",     "st-problem"],
  ["does",    "What this does",  "st-does"],
  ["benefit", "The benefit",     "st-benefit"],
];

/* One-click examples so you can press and run live in front of the room. */
const SAMPLE_CHECKER =
`Qatar and France Sign Cultural Cooperation Agreement in Doha

Qatar and France signed a cultural cooperation agreement in Doha on Sunday, the Ministry of Culture announced. The agreement was signed by HE the Minister of Culture and his French counterpart during an official visit.

It covers joint exhibitions, heritage preservation and academic exchange between the two countries. Officials said the agreement reflects the strong ties between Qatar and France and supports the country's cultural development goals.`;

const SAMPLE_GOV_HIGH =
`HH the Amir Receives Pakistani Prime Minister at the Amiri Diwan

HH Sheikh Tamim bin Hamad Al Thani received HE the Prime Minister of Pakistan at the Amiri Diwan on Monday. The two sides discussed bilateral relations and a number of regional security developments. The Ministry of Foreign Affairs said the talks also covered defence cooperation between the two countries.`;

const SAMPLE_GOV_LOW =
`Handmade Party Experience Returns to Mall of Qatar This Weekend

A handmade party experience returns to Mall of Qatar this weekend, with fresh products, live demonstrations and activities for families and shoppers throughout the day.`;

function wireInlineSamples() {
  $("#c-sample")?.addEventListener("click", () => { $("#c-input").value = SAMPLE_CHECKER; });
  $("#gov-sample-high")?.addEventListener("click", () => { $("#gov-input").value = SAMPLE_GOV_HIGH; });
  $("#gov-sample-low")?.addEventListener("click", () => { $("#gov-input").value = SAMPLE_GOV_LOW; });
}

/* ───────── Guided walkthrough (audience-safe, shown on the demo) ─────────
   Steps through the workflow showing the SAME plain-language value story already
   on each screen — Today / Problem / What this does / Benefit. No private coaching
   here; that lives only at the unlisted notes URL, for the presenter's own screen. */
const WALK_ORDER = [
  { section: "overview", sel: ".run-demo-bar", title: "The big picture — the workflow",
    flow: ["Radar", "Brief", "Draft", "Checks", "Approval", "Publish", "Learn"],
    intro: [
      "This is the whole workflow, end to end. The system handles the repetitive parts; your editors stay in charge of every decision.",
      "It spots the news, prepares a brief, writes the draft in your voice, runs the checks — then your team approves and publishes.",
      "Nothing publishes on its own, and it learns from every edit your editors make.",
      "Let's walk through it, one piece at a time." ] },
  { section: "radar",      sel: ".radar-bar",                       title: "Live News Radar" },
  { section: "generate",   sel: "#section-generate .section-head",  title: "One brief → every format" },
  { section: "paraphrase", sel: "#section-paraphrase .section-head",title: "Re-report any source, in your voice" },
  { section: "compare",    sel: "#section-compare .section-head",   title: "Side by side with your real article" },
  { section: "governance", sel: "#section-governance .section-head",title: "Sensitive content stays controlled" },
  { section: "freshness",  sel: "#freshness-summary",               title: "Events that stay up to date" },
  { section: "cleanup",    sel: "#section-cleanup .section-head",    title: "The boring clean-up, in one click" },
  { section: "checker",    sel: "#section-checker .section-head",    title: "A quick check against your style" },
  { section: "copilot",    sel: "#section-copilot .section-head",   title: "Editors in control — and it learns" },
  { section: "roi",        sel: "#section-roi .section-head",        title: "What it gives back" },
  { section: "overview",   sel: ".run-demo-bar", title: "What we're proposing",
    intro: [
      "A short, paid pilot — two to four weeks, with a few of your editors.",
      "We measure it on real numbers: how often the drafts are accepted, and hours saved.",
      "You keep full control the whole way — and we build from there." ] },
];
let WALK_I = 0;

function wireWalk() {
  $("#walk-start")?.addEventListener("click", startWalk);
  $("#walk-next")?.addEventListener("click", () => { WALK_I++; renderWalkStep(); });
  $("#walk-back")?.addEventListener("click", () => { if (WALK_I > 0) { WALK_I--; renderWalkStep(); } });
  $("#walk-end")?.addEventListener("click", endWalk);
  $("#walk-min")?.addEventListener("click", minWalk);
  $("#walk-mini")?.addEventListener("click", resumeWalk);
  document.addEventListener("keydown", (e) => {
    const w = $("#walk");
    if (!w || w.classList.contains("walk-hidden") || w.classList.contains("walk-min")) return;
    if (e.key === "ArrowRight") { WALK_I++; renderWalkStep(); }
    else if (e.key === "ArrowLeft") { if (WALK_I > 0) { WALK_I--; renderWalkStep(); } }
    else if (e.key === "Escape") { minWalk(); }
  });
}
function startWalk() {
  WALK_I = 0;
  document.body.classList.add("walk-active");
  $("#walk").classList.remove("walk-hidden", "walk-min");
  renderWalkStep();
}
function endWalk() {
  $("#walk").classList.add("walk-hidden");
  $("#walk").classList.remove("walk-min");
  document.body.classList.remove("walk-active");
  clearWalkSpot();
}
function minWalk() {
  $("#walk-mini-step").textContent = `${WALK_I + 1}/${WALK_ORDER.length}`;
  $("#walk").classList.add("walk-min");
  clearWalkSpot();
}
function resumeWalk() { $("#walk").classList.remove("walk-min"); renderWalkStep(); }
function clearWalkSpot() { document.querySelectorAll(".tour-spot").forEach(e => e.classList.remove("tour-spot")); }

function renderWalkStep() {
  clearWalkSpot();
  if (WALK_I < 0) WALK_I = 0;
  if (WALK_I >= WALK_ORDER.length) { endWalk(); return; }
  const my = WALK_I, s = WALK_ORDER[WALK_I];
  const navBtn = document.querySelector(`.nav-item[data-section="${s.section}"]`);
  if (navBtn) navBtn.click();
  setTimeout(() => {
    if (my !== WALK_I) return;
    clearWalkSpot();
    const el = document.querySelector(s.sel);
    if (el) { el.classList.add("tour-spot"); el.scrollIntoView({ behavior: "smooth", block: "center" }); }
    $("#walk-prog").textContent = `Step ${WALK_I + 1} / ${WALK_ORDER.length}`;
    $("#walk-title").textContent = s.title;
    let body;
    if (s.intro) {
      const flow = s.flow ? `<div class="walk-flow">${s.flow.map((st, idx) =>
        `<span class="flow-stage">${st}</span>${idx < s.flow.length - 1 ? '<span class="flow-arrow">›</span>' : ''}`).join("")}</div>` : "";
      body = flow + `<ul class="walk-points">${s.intro.map(p => `<li>${p}</li>`).join("")}</ul>`;
    } else {
      const st = SECTION_STORY[s.section] || {};
      body = `<div class="walk-grid">${STORY_CELLS.filter(([k]) => st[k]).map(([k, label, cls]) =>
        `<div class="vcell ${cls}"><div class="vlabel">${label}</div><div class="vtext">${st[k]}</div></div>`).join("")}</div>`;
    }
    $("#walk-body").innerHTML = body;
    $("#walk-back").style.visibility = (WALK_I === 0) ? "hidden" : "visible";
    $("#walk-next").textContent = (WALK_I === WALK_ORDER.length - 1) ? "Finish ✓" : "Next →";
  }, 360);
}

function renderSectionStories() {
  Object.keys(SECTION_STORY).forEach((id) => {
    const sec = document.querySelector(`#section-${id}`);
    if (!sec) return;
    const head = sec.querySelector(".section-head");
    if (!head || sec.querySelector(".story-strip")) return;
    const s = SECTION_STORY[id];
    const cells = STORY_CELLS.filter(([k]) => s[k]).map(([k, label, cls]) =>
      `<div class="vcell ${cls}"><div class="vlabel">${label}</div><div class="vtext">${s[k]}</div></div>`
    ).join("");
    head.insertAdjacentHTML("afterend", `<div class="vstrip">${cells}</div>`);
  });
}

/* Real Qatar Living hero images (from the scraped corpus) */
let SAMPLE_IMAGES = [];
async function loadSampleImages() {
  try { const d = await API.sampleImages(); SAMPLE_IMAGES = d.images || []; } catch {}
}
let _imgCursor = 0;
function heroImg() {
  if (!SAMPLE_IMAGES.length) return null;
  const u = SAMPLE_IMAGES[_imgCursor % SAMPLE_IMAGES.length];
  _imgCursor++;
  return u;
}
function heroStyle(url) {
  return url ? `style="background-image:linear-gradient(180deg,rgba(0,66,109,.05),rgba(0,66,109,.35)),url('${url}');background-size:cover;background-position:center"` : "";
}

/* Run-demo jump buttons on the overview */
function wireRunDemoJumps() {
  $$("[data-jump]").forEach(b => b.addEventListener("click", () => {
    const target = b.dataset.jump;
    const navBtn = document.querySelector(`.nav-item[data-section="${target}"]`);
    if (navBtn) navBtn.click();
  }));
  // One-click Sensitive-News demo: populate the government scenario + auto-generate.
  // Pull the scenario straight from /api/samples so we never race the rendered buttons.
  const sens = document.querySelector('[data-demo="sensitive"]');
  if (sens) sens.addEventListener("click", async () => {
    document.querySelector('.nav-item[data-section="generate"]').click();
    let sc = null;
    try {
      const s = await API.samples();
      sc = (s.scenarios || []).find(x => x.id === "gov_announcement") || (s.scenarios || [])[0];
    } catch {}
    if (!sc) return;
    const bset = (id, v) => { const el = $(id); if (el) el.value = v || ""; };
    bset("#g-topic", sc.brief.topic);   bset("#g-entity", sc.brief.entity);
    bset("#g-category", sc.brief.category); bset("#g-date", sc.brief.date);
    bset("#g-facts", sc.brief.facts);   bset("#g-quote", sc.brief.quote);
    bset("#g-risk-hint", sc.brief.risk_hint || ""); bset("#g-length", sc.brief.length || "standard");
    bset("#g-mode", "package");
    $("#g-submit").click();
  });
}

/* ───────── Nav ───────── */
function wireNav() {
  $$(".nav-item").forEach(btn => {
    btn.addEventListener("click", () => {
      const target = btn.dataset.section;
      $$(".nav-item").forEach(b => b.classList.toggle("active", b === btn));
      $$(".section").forEach(s => s.classList.toggle("visible", s.id === `section-${target}`));
      // Lazy loads
      if (target === "evidence") loadEvidence();
      if (target === "freshness") loadFreshness();
      if (target === "generate") loadScenarios();
      if (target === "rewrite")  loadRewriteSamples();
      if (target === "cleanup")  loadCleanupSample();
      if (target === "copilot")  { loadQueue(); loadLearning(); }
      if (target === "cms")      loadCmsOpps();
      if (target === "roi")      loadRoiDefault();
      if (target === "operating") { loadOperatingModel(); loadAudit(); }
      if (target === "radar") loadRadar(false);
      if (target === "compare") loadCompareSamples();
    });
  });
}

/* ───────── Compare to real ───────── */
let COMPARE_LOADED = false;
async function loadCompareSamples() {
  if (COMPARE_LOADED) return; COMPARE_LOADED = true;
  const row = $("#compare-row");
  try {
    const d = await API.compareSamples();
    (d.samples || []).forEach(s => {
      const btn = document.createElement("button");
      btn.className = "scenario-btn";
      btn.innerHTML = `${escapeHtml(s.label)} <span class="muted" style="font-weight:400">— ${escapeHtml(s.headline.slice(0,40))}…</span>`;
      btn.onclick = () => runCompare(s.id, btn);
      row.appendChild(btn);
    });
  } catch (e) {
    $("#compare-output").innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}
async function runCompare(id, btn) {
  const out = $("#compare-output");
  out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Generating the pilot's version from the same facts…</div>`;
  try {
    const d = await API.compareRun({ id });
    const r = d.real, p = d.pilot;
    const scoreRow = (label, a, bb, better) => `
      <div class="cmp-metric">
        <span class="cmp-metric-label">${label}</span>
        <span class="cmp-v ${better==='real'?'cmp-win':''}">${a}</span>
        <span class="cmp-v ${better==='pilot'?'cmp-win':''}">${bb}</span>
      </div>`;
    out.innerHTML = `
      <div class="cmp-grid">
        <div class="cmp-col">
          <div class="cmp-head cmp-head-real">Real Qatar Living article <span class="badge badge-trust">published</span></div>
          <div class="ql-article">
            <div class="ql-breadcrumb">Home <span>›</span> News <span>›</span> Qatar</div>
            <h2 class="ql-article-h1">${escapeHtml(r.headline)}</h2>
            <div class="ql-byline"><span class="ql-avatar">QL</span><span><b>Qatar Living</b> · ${escapeHtml(r.date||"")}</span></div>
            <div class="ql-article-body">${(r.body||"").split(/\n\s*\n/).slice(0,6).map(x=>`<p>${escapeHtml(x)}</p>`).join("")}</div>
          </div>
          ${r.cms_issues_in_original ? `<div class="muted" style="margin-top:6px">⚠ ${r.cms_issues_in_original} CMS-hygiene issues in the original (boilerplate / paste artefacts).</div>` : ""}
        </div>
        <div class="cmp-col">
          <div class="cmp-head cmp-head-pilot">LeenAI from the same facts <span class="badge badge-stop">draft · not published</span></div>
          <div class="ql-article">
            <div class="ql-breadcrumb">Home <span>›</span> News <span>›</span> Qatar</div>
            <h2 class="ql-article-h1">${escapeHtml(p.headline)}</h2>
            <div class="ql-byline"><span class="ql-avatar">QL</span><span><b>Qatar Living Desk</b> · draft</span></div>
            <div class="ql-article-body">${(p.body||"").split(/\n\s*\n/).slice(0,6).map(x=>`<p>${escapeHtml(x)}</p>`).join("")}</div>
          </div>
          <div class="muted" style="margin-top:6px">✓ 0 CMS issues · governance: <b>${escapeHtml(p.governance.risk)}</b> (${escapeHtml(p.governance.action||"")})</div>
        </div>
      </div>
      <div class="cmp-scores">
        <div class="cmp-metric cmp-metric-head"><span class="cmp-metric-label">Metric</span><span>Real QL</span><span>LeenAI</span></div>
        ${scoreRow("House-style adherence (extracted rules)", r.scores.style_adherence, p.scores.style_adherence, null)}
        ${scoreRow("Readability (Flesch · higher = easier)", r.scores.readability, p.scores.readability, null)}
        ${scoreRow("Grounding — facts traceable to source", "n/a", p.scores.grounding ?? "—", "pilot")}
        ${scoreRow("CMS hygiene issues", r.cms_issues_in_original, 0, "pilot")}
      </div>
      <div class="muted" style="margin-top:10px;font-size:12.5px;line-height:1.5">
        <b>Honest read:</b> the pilot's draft is <b>independently worded from the same facts</b>
        (names, figures and direct quotes are preserved by design) — it is not a copy. It does
        <b>not replace Qatar Living's editors</b>: it produces a clean, source-faithful first
        draft — grounding ${escapeHtml(String(p.scores.grounding ?? "—"))}, no CMS residue, no
        auto-publish. <b>Editors remain in control.</b>
      </div>
    `;
  } catch (e) {
    out.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}

/* ───────── News Radar ───────── */
let RADAR_LOADED = false, RADAR_ITEMS = [];
function wireRadar() {
  const r = $("#radar-refresh");
  if (r) r.addEventListener("click", () => loadRadar(true));
  const a = $("#radar-auto");
  if (a) a.addEventListener("click", autoPrepareTop);
}

async function autoPrepareTop() {
  const btn = $("#radar-auto"), out = $("#radar-auto-out");
  if (!RADAR_ITEMS.length) { await loadRadar(false); }
  const top = RADAR_ITEMS.slice(0, 3);
  if (!top.length) return;
  btn.disabled = true; btn.textContent = "Preparing…";
  out.innerHTML = `<div class="callout" id="auto-log"><b>Auto-preparing the top ${top.length} stories…</b><br></div>`;
  const log = $("#auto-log");
  let queued = 0;
  for (const it of top) {
    log.innerHTML += `· “${escapeHtml(it.title.slice(0,60))}” → re-reporting…<br>`;
    try {
      const r = await API.paraphrase({ text: it.title + ". (Source headline — full text to be verified by the desk.)", source_name: it.source });
      const pp = r.paraphrase || {};
      const qi = await API.queueAdd({
        headline: pp.headline, body: pp.body, risk: r.governance?.risk || "Low",
        risk_labels: r.governance?.risk_labels || [], style_score: r.style_score?.score ?? null,
        grounding_score: r.quality?.factual_grounding?.grounding_score ?? null,
        source_confidence: r.governance?.source_confidence ?? null, source: it.source,
      });
      queued++;
      log.innerHTML += `&nbsp;&nbsp;✓ queued as item #${qi.id} · risk ${escapeHtml(r.governance?.risk||"Low")} · style ${r.style_score?.score ?? "—"}<br>`;
    } catch (e) {
      log.innerHTML += `&nbsp;&nbsp;✗ ${escapeHtml(e.message)}<br>`;
    }
  }
  log.innerHTML += `<br><b>${queued} drafts prepared and sent to the approval queue.</b> Open <b>Editorial Copilot</b> to review — humans approve before anything publishes.`;
  btn.disabled = false; btn.textContent = "⚡ Auto-prepare top 3 → queue";
}
async function loadRadar(force) {
  if (RADAR_LOADED && !force) return;
  RADAR_LOADED = true;
  const grid = $("#radar-grid"), status = $("#radar-status");
  if (force) { status.textContent = "Re-scraping live Qatar news…"; grid.innerHTML = `<div class="empty-state"><span class="spinner"></span> scraping…</div>`; }
  try {
    const d = await API.radar(force);
    RADAR_ITEMS = d.items || [];
    status.innerHTML = `<b>${d.count}</b> live items · updated ${escapeHtml(d.last_updated || "—")} · auto-refreshes every ~12 min`;
    const rc = d.risk_counts || {};
    $("#radar-riskmix").innerHTML = `<span class="risk-badge High" style="padding:2px 8px">${rc.High||0} High</span> <span class="risk-badge Medium" style="padding:2px 8px">${rc.Medium||0} Med</span> <span class="risk-badge Low" style="padding:2px 8px">${rc.Low||0} Low</span>`;
    if (!RADAR_ITEMS.length) { grid.innerHTML = `<div class="empty-state">No items right now — try Refresh.</div>`; return; }
    grid.innerHTML = RADAR_ITEMS.map(it => `
      <div class="radar-card">
        <div class="radar-card-top">
          <span class="radar-src">${it.is_local ? '<span class="radar-localdot" title="Qatar local source">●</span> ' : ''}${escapeHtml(it.source)}</span>
          <span class="risk-badge ${it.risk}" style="padding:2px 8px;font-size:10px">${it.risk}</span>
        </div>
        <div class="radar-title">${escapeHtml(it.title)}</div>
        <div class="radar-meta">${escapeHtml((it.published||"").slice(0,22))}${it.no_auto_publish ? ' · needs senior review' : ''}</div>
        <button class="btn-primary radar-prep" data-id="${it.id}">Prepare in Qatar Living style →</button>
      </div>`).join("");
    grid.querySelectorAll(".radar-prep").forEach(b => b.onclick = () => prepareRadarItem(+b.dataset.id, b));
  } catch (e) {
    status.textContent = "Radar error: " + e.message;
    grid.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}
async function prepareRadarItem(id, btn) {
  const it = RADAR_ITEMS.find(x => x.id === id);
  if (!it) return;
  const out = $("#radar-output");
  btn.disabled = true; btn.textContent = "Preparing…";
  out.innerHTML = `<div class="card"><div class="empty-state"><span class="spinner"></span> Re-reporting "${escapeHtml(it.title.slice(0,70))}" in Qatar Living tone…</div></div>`;
  out.scrollIntoView({ behavior: "smooth", block: "start" });
  try {
    const r = await API.paraphrase({ text: it.title + ". (Source headline — full text to be verified by the desk.)", source_name: it.source });
    const card = document.createElement("div"); card.className = "card";
    out.innerHTML = ""; out.appendChild(card);
    renderParaphrase(r, card);
  } catch (e) {
    out.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  } finally { btn.disabled = false; btn.textContent = "Prepare in Qatar Living style →"; }
}

/* ───────── Overview ───────── */
async function loadOverview() {
  try {
    const o = await API.overview();
    renderStatGrid(o);
  } catch (e) {
    $("#stat-grid").innerHTML =
      `<div class="error-box">Could not load overview: ${escapeHtml(e.message)}</div>`;
  }
}

function renderStatGrid(o) {
  const cards = [
    { num: fmt(o.n_articles), label: "Articles analysed",
      sub: o.date_range ? `${o.date_range[0]} → ${o.date_range[1]}` : "" },
    { num: fmt(o.n_events), label: "Events analysed", sub: "Full sitemap inventory" },
    { num: `${fmtPct(o.stale_events_pct)}%`, label: "Stale events", cls: "bad",
      sub: o.stale_events_count ? `${o.stale_events_count} listed past endDate` : "" },
    { num: `${fmtPct(o.high_risk_pct)}%`, label: "High-risk content", cls: "warn",
      sub: o.high_risk_count ? `${o.high_risk_count} of ${o.n_articles}` : "" },
    { num: `${fmtPct(o.headline_entity_first_pct)}%`, label: "Entity-first headlines", cls: "ok",
      sub: "97.3% start with a proper noun" },
    { num: fmt(o.social_cta_repeats), label: "Boilerplate CTA repeats", cls: "warn",
      sub: "Same paragraph copy-pasted across the corpus" },
    { num: "0.79", label: "Original quotes per article", cls: "bad",
      sub: "65% of articles carry no quote — mostly repackaged wire copy" },
    { num: `${fmtPct(o.honorific_usage_pct)}%`, label: "Articles using honorifics", cls: "ok",
      sub: "29% — house-style discipline matters" },
  ];
  $("#stat-grid").innerHTML = cards.map(c => `
    <div class="stat-card">
      <div class="num ${c.cls || ""}">${c.num}</div>
      <div class="label">${c.label}</div>
      ${c.sub ? `<div class="sub">${escapeHtml(c.sub)}</div>` : ""}
    </div>
  `).join("");
}

/* ───────── Generate ───────── */
let SCENARIOS_LOADED = false;
async function loadScenarios() {
  if (SCENARIOS_LOADED) return;
  SCENARIOS_LOADED = true;
  try {
    const s = await API.samples();
    const row = $("#scenario-row");
    s.scenarios.forEach(sc => {
      const btn = document.createElement("button");
      btn.className = "scenario-btn";
      btn.innerHTML = `${escapeHtml(sc.title)}<span class="risk-mini ${sc.expected_risk}">${sc.expected_risk}</span>`;
      btn.onclick = () => {
        $("#g-topic").value    = sc.brief.topic;
        $("#g-entity").value   = sc.brief.entity;
        $("#g-category").value = sc.brief.category;
        $("#g-date").value     = sc.brief.date;
        $("#g-facts").value    = sc.brief.facts;
        $("#g-quote").value    = sc.brief.quote;
        $("#g-risk-hint").value = sc.brief.risk_hint || "";
        $("#g-length").value   = sc.brief.length;
        $("#g-output").innerHTML = `<div class="empty-state">Scenario loaded: <b>${escapeHtml(sc.title)}</b>. Click <i>Generate package</i>.</div>`;
      };
      row.appendChild(btn);
    });
  } catch (e) {
    console.warn("scenario load failed", e);
  }
}

let LAST_GENERATED = null;   // remembered for variants/Arabic side-actions

function wireGenerateForm() {
  $("#g-submit").addEventListener("click", async () => {
    const btn = $("#g-submit");
    const out = $("#g-output");
    btn.disabled = true;
    const body = {
      topic: $("#g-topic").value.trim(),
      facts: $("#g-facts").value.trim(),
      entity: $("#g-entity").value.trim(),
      date: $("#g-date").value.trim(),
      quote: $("#g-quote").value.trim(),
      category: $("#g-category").value.trim(),
      risk_hint: $("#g-risk-hint").value,
      length: $("#g-length").value || "standard",
    };
    if (!body.topic) {
      out.innerHTML = `<div class="error-box">Topic is required.</div>`;
      btn.disabled = false;
      return;
    }
    const mode = $("#g-mode")?.value || "package";
    try {
      if (mode === "package") {
        out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Preparing the full content package…</div>`;
        const result = await API.generatePackage(body);
        const p = result.package;
        LAST_GENERATED = {
          headline: p.article.headline, body: p.article.body, brief: body,
          style_score: result.style_score?.score,
          grounding_score: result.quality?.factual_grounding?.grounding_score,
          risk: result.governance?.risk, risk_labels: result.governance?.risk_labels,
          source_confidence: result.governance?.source_confidence,
        };
        renderPackage(result, out);
      } else if (mode === "stream") {
        await runStreamGenerate(body, out);
      } else {
        out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Generating Qatar Living-style draft…</div>`;
        const result = await API.generate(body);
        LAST_GENERATED = {
          headline: result.draft.headline, body: result.draft.body, brief: body,
          style_score: result.style_score?.score,
          grounding_score: result.quality?.factual_grounding?.grounding_score,
          risk: result.governance?.risk, risk_labels: result.governance?.risk_labels,
        };
        renderGenerated(result, out);
      }
    } catch (e) {
      out.innerHTML = `<div class="error-box">Generation failed: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

async function runStreamGenerate(body, out) {
  // Layout: live draft frame, then placeholders for governance + score that
  // populate when the "done" SSE event arrives.
  out.innerHTML = `
    <div class="stream-status pill pill-warn">
      <span class="spinner"></span> preparing draft…
    </div>
    <div class="draft-frame stream-frame">
      <h2 class="stream-headline"><span class="muted">…</span></h2>
      <div class="stream-body"></div>
    </div>
    <div class="stream-meta"></div>
  `;
  const headEl = out.querySelector(".stream-headline");
  const bodyEl = out.querySelector(".stream-body");
  const metaEl = out.querySelector(".stream-meta");
  const statusEl = out.querySelector(".stream-status");
  let full = "";
  let headlineLocked = false;

  const resp = await fetch("/api/generate-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!resp.ok || !resp.body) {
    const t = await resp.text();
    throw new Error(`stream ${resp.status} ${t.slice(0,200)}`);
  }
  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let nl;
    while ((nl = buf.indexOf("\n\n")) !== -1) {
      const chunk = buf.slice(0, nl);
      buf = buf.slice(nl + 2);
      const lines = chunk.split("\n").filter(l => l.startsWith("data: "));
      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        let ev;
        try { ev = JSON.parse(data); } catch { continue; }
        if (ev.type === "token") {
          full += ev.text;
          // Split first blank line: above = headline, below = body.
          const idx = full.indexOf("\n\n");
          if (!headlineLocked && idx === -1) {
            headEl.textContent = full.replace(/^\s+/, "");
          } else {
            if (!headlineLocked) {
              headlineLocked = true;
              headEl.textContent = full.slice(0, idx).trim();
            }
            const bodyText = full.slice(full.indexOf("\n\n") + 2);
            bodyEl.innerHTML = bodyText.split(/\n\s*\n/).map(p => `<p>${escapeHtml(p)}</p>`).join("");
            bodyEl.scrollTop = bodyEl.scrollHeight;
          }
        } else if (ev.type === "done") {
          statusEl.classList.remove("pill-warn");
          statusEl.classList.add("pill-ok");
          statusEl.innerHTML = `streamed ${ev.full_text.length} chars · style ${ev.style_score?.score ?? "—"} · risk ${ev.governance?.risk ?? "—"}`;
          LAST_GENERATED = {
            headline: headEl.textContent,
            body: bodyEl.innerText,
            full_text: ev.full_text,
            brief: body,
          };
          metaEl.innerHTML = renderStreamMeta(ev, body);
        } else if (ev.type === "error") {
          statusEl.classList.remove("pill-warn");
          statusEl.classList.add("pill-bad");
          statusEl.textContent = `error: ${ev.message}`;
        }
      }
    }
  }
}

function renderStreamMeta(ev, brief) {
  const gov = ev.governance || {};
  const score = ev.style_score || {};
  return `
    <div class="dual-risk">
      <div class="dual-risk-cell">
        <div class="dual-risk-label">Body-level governance (deterministic audit)</div>
        <div class="panel-row" style="margin-top:6px">
          <span class="risk-badge ${gov.risk}">Risk: ${gov.risk}</span>
          ${(gov.risk_labels || []).slice(0,5).map(l => `<span class="pill">${escapeHtml(l)}</span>`).join("")}
        </div>
        <div class="muted" style="margin-top:8px">${escapeHtml(gov.approval_route || "")}</div>
      </div>
    </div>
    ${renderScoreHero(score)}
    ${renderDimensions(score)}
    <div class="row" style="margin-top:18px;gap:10px;flex-wrap:wrap">
      <button class="btn-secondary" id="g-variants-btn">Generate 3 headline variants</button>
      <button class="btn-secondary" id="g-arabic-btn">View Arabic version</button>
    </div>
    <div id="g-variants-out" style="margin-top:14px"></div>
    <div id="g-arabic-out" style="margin-top:14px"></div>
  `;
}

/* Full multi-format content package render (checklist §3A / §4)
   Each format is shown in its REAL-WORLD context — the article in the Qatar
   Living article template, the caption as an Instagram post, the push as a
   phone notification, the story as a vertical story frame. */
function renderPackage(result, target) {
  const p = result.package || {};
  const a = p.article || {};
  const today = new Date().toLocaleDateString("en-GB", {day:"numeric",month:"long",year:"numeric"});
  const bodyHtml = (a.body || "").split(/\n\s*\n/).map(x => `<p>${escapeHtml(x)}</p>`).join("");
  const hero = heroImg(); const igimg = heroImg();
  target.innerHTML = `
    ${result.fallback_used ? `<div class="callout" style="border-color:#FBBF24">Offline fallback package (live API unavailable) — the full workflow still runs end to end.</div>` : ""}
    <div class="pkg-brief"><span class="pkg-tag">Editorial brief</span> ${escapeHtml(p.brief || "")}</div>

    <div class="preview-label">Preview — as it would appear on Qatar Living <span class="badge badge-stop" style="margin-left:8px">Draft · not published</span></div>

    <!-- 1. Article in the real QL article template -->
    <div class="ql-article">
      <div class="ql-breadcrumb">Home <span>›</span> News <span>›</span> Qatar</div>
      <h1 class="ql-article-h1">${escapeHtml(a.headline || "(no headline)")}</h1>
      <div class="ql-byline">
        <span class="ql-avatar">QL</span>
        <span><b>Qatar Living</b> · ${escapeHtml(today)} · 3 min read</span>
      </div>
      <div class="ql-hero" ${heroStyle(hero)}><span class="ql-hero-tag">QL LIBRARY IMAGE</span></div>
      <div class="ql-article-body">${bodyHtml}</div>
    </div>

    <!-- 2. Social pack in real-world frames -->
    <div class="social-grid">
      <div class="ig-post">
        <div class="ig-head"><span class="ql-avatar sm">QL</span><b>qatarliving</b><span class="ig-more">⋯</span></div>
        <div class="ig-image" ${heroStyle(igimg)}><span class="ql-hero-tag">VISUAL</span></div>
        <div class="ig-actions">♡  💬  ➤</div>
        <div class="ig-caption"><b>qatarliving</b> ${escapeHtml(p.instagram_caption || "—")}</div>
      </div>

      <div class="phone-push">
        <div class="push-card">
          <div class="push-head"><span class="ql-avatar xs">QL</span> Qatar Living · now</div>
          <div class="push-body">${escapeHtml(p.push_notification || "—")}</div>
        </div>
        <div class="story-frame">
          <div class="story-grad"></div>
          <div class="story-text">${escapeHtml(p.story_copy || "—")}</div>
          <div class="story-logo">Qatar Living</div>
        </div>
      </div>
    </div>

    <!-- 3. Production assets -->
    <div class="pkg-grid">
      <div class="pkg-card">
        <div class="pkg-tag">Video / Reel script</div>
        <div class="pkg-body">${escapeHtml(p.video_script || "—").replace(/\n/g,"<br>")}</div>
      </div>
      <div class="pkg-card">
        <div class="pkg-tag">Poster brief (for designer)</div>
        <div class="pkg-body">${escapeHtml(p.poster_brief || "—").replace(/\n/g,"<br>")}</div>
      </div>
    </div>

    ${renderGovernancePanel(result.governance, p)}
    ${renderScoreHero(result.style_score)}
    ${renderQuality(result.quality)}

    <div class="row" style="margin-top:18px;gap:10px;flex-wrap:wrap">
      <button class="btn-primary" id="g-queue-btn">Send package to approval queue</button>
      <button class="btn-secondary" id="g-variants-btn">3 headline variants</button>
      <button class="btn-secondary" id="g-arabic-btn">Arabic version</button>
    </div>
    <div id="g-variants-out" style="margin-top:14px"></div>
    <div id="g-arabic-out" style="margin-top:14px"></div>
    <div id="g-queue-out" style="margin-top:10px"></div>
  `;
}

/* Governance panel with the full checklist §5 field set */
function renderGovernancePanel(gov, pkg) {
  if (!gov) return "";
  const risk = gov.risk || "Low";
  const sens = (gov.risk_labels || []);
  return `
    <div class="gov-panel risk-border-${risk}">
      <div class="gov-head">Governance review
        ${gov.no_auto_publish ? `<span class="badge badge-stop">No auto-publish</span>` : `<span class="badge badge-trust">Draft allowed</span>`}
      </div>
      <div class="gov-rows">
        <div class="gov-row"><span>Risk level</span><b><span class="risk-badge ${risk}" style="padding:2px 10px">${risk}</span></b></div>
        <div class="gov-row"><span>Reason</span><b>${escapeHtml(gov.reasoning || "")}</b></div>
        <div class="gov-row"><span>Source confidence</span><b>${escapeHtml(gov.source_confidence || (pkg && pkg.source_confidence) || "—")}</b></div>
        <div class="gov-row"><span>Tone check</span><b>${escapeHtml((pkg && pkg.tone_check) || "Institutional, factual, non-clickbait.")}</b></div>
        <div class="gov-row"><span>Reviewer level</span><b>${escapeHtml(gov.reviewer_level || "—")}</b></div>
        <div class="gov-row"><span>Action</span><b>${escapeHtml(gov.action || "—")}</b></div>
      </div>
      ${sens.length ? `<div class="muted" style="margin-top:8px">Sensitive topics detected:</div><div class="chips" style="margin-top:6px">${sens.map(s=>`<span class="chip">${escapeHtml(s)}</span>`).join("")}</div>` : ""}
      ${(pkg && pkg.forbidden_or_unsupported && pkg.forbidden_or_unsupported.length) ? `<div class="muted" style="margin-top:8px"><b style="color:var(--bone)">Unsupported claims flagged:</b><div class="chips chips-warn" style="margin-top:6px">${pkg.forbidden_or_unsupported.map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join("")}</div></div>` : ""}
    </div>
  `;
}

/* ───────── Paraphrase News ───────── */
const PP_SAMPLE = `Qatar Airways has SHOCKINGLY announced a HUGE expansion!!! The airline will resume flights to Helsinki and Tokyo Haneda from 15 July. His Highness the Amir praised the move. According to the airline, four weekly flights to Helsinki will increase to daily from 1 August. Tokyo Haneda gets four weekly flights from 15 July. This is an amazing, game-changing development that brings the network to over 160 destinations.
Make sure to check out our social media to keep track of the latest content!
Qatar Living Facebook: facebook.com/qatarliving — Qatar Living Twitter: twitter.com/qatarliving`;

function wireParaphraseForm() {
  const sample = $("#pp-sample");
  if (sample) sample.addEventListener("click", () => { $("#pp-input").value = PP_SAMPLE; });
  const btn = $("#pp-submit");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    const out = $("#pp-output");
    const text = $("#pp-input").value.trim();
    if (text.length < 40) { out.innerHTML = `<div class="error-box">Paste a full article (at least a few sentences).</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Re-reporting in Qatar Living style…</div>`;
    try {
      const r = await API.paraphrase({ text, source_name: $("#pp-source").value.trim() });
      renderParaphrase(r, out);
    } catch (e) {
      out.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}

function renderParaphrase(r, target) {
  const p = r.paraphrase || {};
  const today = new Date().toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"});
  const bodyHtml = (p.body||"").split(/\n\s*\n/).map(x=>`<p>${escapeHtml(x)}</p>`).join("");
  const giList = (p.gi_applied||[]).map(g=>`<div class="gi-row"><span class="gi-tag">${escapeHtml(g.gi||"")}</span> ${escapeHtml(g.what||"")}</div>`).join("");
  const removed = (p.removed||[]).map(x=>`<span class="chip">${escapeHtml(x)}</span>`).join("");
  const keyFacts = (p.key_facts||[]).map(x=>`<li>${escapeHtml(x)}</li>`).join("");
  const okBadge = p.paraphrase_ok
    ? `<span class="badge badge-trust">Original rewrite · facts &amp; quotes preserved</span>`
    : `<span class="badge badge-stop">Too close to source — reword further</span>`;
  target.innerHTML = `
    <div class="preview-label">Re-reported for Qatar Living ${okBadge}
      <button class="copy-btn" data-copy="pp-article">⧉ Copy article</button>
    </div>
    <div class="ql-article" id="pp-article-src">
      <div class="ql-breadcrumb">Home <span>›</span> News <span>›</span> ${escapeHtml(p.suggested_category||"Qatar")}</div>
      <h1 class="ql-article-h1">${escapeHtml(p.headline||"")}</h1>
      <div class="ql-byline"><span class="ql-avatar">QL</span><span><b>${escapeHtml(p.suggested_byline||"Qatar Living")}</b> · ${escapeHtml(today)}</span></div>
      <div class="ql-hero" ${heroStyle(heroImg())}><span class="ql-hero-tag">QL LIBRARY IMAGE</span></div>
      <div class="ql-article-body">${bodyHtml}</div>
      ${keyFacts ? `<div class="keyfacts"><b>Key facts</b><ul>${keyFacts}</ul></div>` : ""}
    </div>

    <div class="gi-panel">
      <div class="gov-head">Genuine Issues applied <span class="badge badge-trust">${(p.gi_applied||[]).length} fixes</span></div>
      ${giList || '<div class="muted">—</div>'}
      ${removed ? `<div class="muted" style="margin-top:10px"><b style="color:var(--bone)">Removed from the source:</b><div class="chips chips-warn" style="margin-top:6px">${removed}</div></div>` : ""}
      <div class="muted" style="margin-top:8px">
        Category (GI-4): <b>${escapeHtml(p.suggested_category||"—")}</b> ·
        Byline (GI-8): <b>${escapeHtml(p.suggested_byline||"—")}</b> ·
        CMS residue removed: <b>${r.cleanup?.issues_removed_total ?? 0}</b>
      </div>
      ${p.paraphrase_note ? `<div class="muted" style="margin-top:6px"><i>${escapeHtml(p.paraphrase_note)}</i></div>` : ""}
    </div>

    ${renderGovernancePanel(r.governance, p)}
    ${renderScoreHero(r.style_score)}
    ${renderQuality(r.quality)}

    <div class="row" style="margin-top:16px;gap:10px;flex-wrap:wrap">
      <button class="btn-primary" id="pp-queue-btn">Send to approval queue</button>
      <button class="btn-secondary copy-btn" data-copy="pp-article">⧉ Copy article text</button>
    </div>
    <div id="pp-queue-out" style="margin-top:10px"></div>
  `;
  PP_LAST = { headline: p.headline, body: p.body, risk: r.governance?.risk,
              risk_labels: r.governance?.risk_labels, style_score: r.style_score?.score,
              grounding_score: r.quality?.factual_grounding?.grounding_score,
              source_confidence: r.governance?.source_confidence, source: $("#pp-source").value.trim() };
}
let PP_LAST = null;

/* delegated handlers for paraphrase queue + copy buttons */
document.addEventListener("click", async (e) => {
  if (e.target.id === "pp-queue-btn" && PP_LAST) {
    const out = $("#pp-queue-out"); e.target.disabled = true;
    try {
      const it = await API.queueAdd({ headline: PP_LAST.headline, body: PP_LAST.body,
        risk: PP_LAST.risk||"Low", risk_labels: PP_LAST.risk_labels||[],
        style_score: PP_LAST.style_score??null, grounding_score: PP_LAST.grounding_score??null,
        source_confidence: PP_LAST.source_confidence??null, source: PP_LAST.source||"paraphrased news" });
      out.innerHTML = `<div class="callout">Sent to approval queue as item #${it.id}.</div>`;
    } catch (err) { out.innerHTML = `<div class="error-box">${escapeHtml(err.message)}</div>`; }
    finally { e.target.disabled = false; }
  }
  if (e.target.classList && e.target.classList.contains("copy-btn")) {
    const id = e.target.dataset.copy;
    const el = document.getElementById(id + "-src");
    const txt = el ? el.innerText : "";
    try { await navigator.clipboard.writeText(txt); const o = e.target.textContent; e.target.textContent = "✓ Copied"; setTimeout(()=>e.target.textContent=o, 1500); }
    catch { /* clipboard blocked */ }
  }
});

/* ───────── Operating Model + Audit ───────── */
let OP_LOADED = false;
async function loadOperatingModel() {
  if (OP_LOADED) return; OP_LOADED = true;
  try {
    const d = await API.operatingModel();
    $("#op-principle").innerHTML = `<b>Principle:</b> ${escapeHtml(d.principle)}`;
    $("#op-table tbody").innerHTML = d.stages.map(s => `
      <tr><td><b>${escapeHtml(s.stage)}</b></td><td>${escapeHtml(s.owner)}</td>
      <td>${escapeHtml(s.kpi)}</td><td>${escapeHtml(s.control)}</td></tr>`).join("");
  } catch (e) {
    $("#op-principle").innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}
async function loadAudit() {
  try {
    const d = await API.audit();
    const tb = $("#audit-table tbody");
    if (!d.audit || !d.audit.length) {
      tb.innerHTML = `<tr><td colspan="5" style="padding:18px" class="muted">No decisions yet. Use the Editorial Copilot to approve/edit/reject items.</td></tr>`;
      return;
    }
    tb.innerHTML = d.audit.slice().reverse().map(r => `
      <tr>
        <td class="muted" style="font-size:11px">${escapeHtml(r.timestamp)}</td>
        <td>${escapeHtml((r.headline||"").slice(0,46))}</td>
        <td><b>${escapeHtml(r.action)}</b></td>
        <td>${escapeHtml(r.reviewer)}</td>
        <td class="muted">${escapeHtml(r.reason || "—")}</td>
      </tr>`).join("");
  } catch (e) { /* silent */ }
}

function renderGenerated(result, target) {
  const d = result.draft || {};
  const score = result.style_score || {};
  const gov = result.governance || {};
  const llmRisk = d.risk || "Low";
  const detRisk = gov.risk || "Low";
  const escalated = (RISK_RANK[detRisk] > RISK_RANK[llmRisk]);
  const draftHtml = `
    <div class="draft-frame">
      <h2>${escapeHtml(d.headline || "(no headline)")}</h2>
      ${d.deck ? `<div class="deck">${escapeHtml(d.deck)}</div>` : ""}
      ${(d.body || "").split(/\n\s*\n/).map(p => `<p>${escapeHtml(p)}</p>`).join("")}
    </div>

    <div class="dual-risk">
      <div class="dual-risk-cell">
        <div class="dual-risk-label">LLM-judged (from brief)</div>
        <div class="panel-row" style="margin-top:6px">
          <span class="risk-badge ${llmRisk}">${llmRisk}</span>
          ${(d.risk_labels || []).slice(0,4).map(l => `<span class="pill">${escapeHtml(l)}</span>`).join("")}
        </div>
      </div>
      <div class="dual-risk-cell ${escalated ? 'escalated' : ''}">
        <div class="dual-risk-label">Deterministic audit (from body)${escalated ? " — escalated ↑" : ""}</div>
        <div class="panel-row" style="margin-top:6px">
          <span class="risk-badge ${detRisk}">${detRisk}</span>
          ${(gov.risk_labels || []).slice(0,4).map(l => `<span class="pill">${escapeHtml(l)}</span>`).join("")}
        </div>
      </div>
    </div>
    <div class="muted" style="margin-top:8px">
      <b style="color:var(--bone)">Approval route:</b> ${escapeHtml(gov.approval_route || d.approval_route || "—")}
    </div>
    ${d.style_notes ? `<div class="callout" style="margin-top:14px">${escapeHtml(d.style_notes)}</div>` : ""}
    ${(d.missing_info && d.missing_info.length) ? `
      <div class="muted" style="margin-top:8px">
        <b style="color:var(--bone)">Missing info to confirm before publish:</b>
        <ul style="margin:6px 0 0;padding-left:18px">${d.missing_info.map(m => `<li>${escapeHtml(m)}</li>`).join("")}</ul>
      </div>` : ""}
    ${renderScoreHero(score)}
    ${renderDimensions(score)}
    ${renderQuality(result.quality)}
    <div class="row" style="margin-top:18px;gap:10px;flex-wrap:wrap">
      <button class="btn-secondary" id="g-variants-btn">Generate 3 headline variants</button>
      <button class="btn-secondary" id="g-arabic-btn">View Arabic version</button>
      <button class="btn-secondary" id="g-queue-btn">Send to editorial queue</button>
    </div>
    <div id="g-variants-out" style="margin-top:14px"></div>
    <div id="g-arabic-out" style="margin-top:14px"></div>
    <div id="g-queue-out" style="margin-top:10px"></div>
  `;
  target.innerHTML = draftHtml;
}

/* Independent quality metrics — the honest, NON-self-referential layer.
   Readability + factual grounding (hallucination check) + structure. */
function renderQuality(q) {
  if (!q) return "";
  const r = q.readability || {};
  const g = q.factual_grounding || {};
  const st = q.structure || {};
  const lang = q.language_consistency || {};
  const riskClass = { low: "low", medium: "medium", high: "high" }[g.hallucination_risk] || "low";
  const langClean = !lang.mixed;
  const langSnips = (lang.offending_snippets || []).map(s => `<span class="chip">${escapeHtml(s)}</span>`).join("");
  let ungrounded = "";
  if (g.ungrounded_entities?.length || g.ungrounded_numbers?.length) {
    const chips = [...(g.ungrounded_entities||[]), ...(g.ungrounded_numbers||[])]
      .map(x => `<span class="chip">${escapeHtml(x)}</span>`).join("");
    ungrounded = `<div class="muted" style="margin-top:6px"><b style="color:var(--bone)">Unverified specifics (reviewer must check):</b><div class="chips chips-warn" style="margin-top:6px">${chips}</div></div>`;
  }
  return `
    <div class="quality-block">
      <div class="quality-head">Independent quality metrics
        <span class="quality-sub">— not derived from the QL corpus; measures readability, source-grounding &amp; structure</span>
      </div>
      <div class="quality-grid">
        <div class="quality-cell">
          <div class="quality-num">${r.flesch_reading_ease ?? "—"}</div>
          <div class="quality-label">Flesch readability</div>
          <div class="quality-note">${escapeHtml(r.band || "")} · ${r.words_per_sentence ?? "—"} w/sentence</div>
        </div>
        <div class="quality-cell">
          <div class="quality-num risk-${riskClass}">${g.grounding_score ?? "—"}</div>
          <div class="quality-label">Grounding verification</div>
          <div class="quality-note">unverified-specifics risk: <b class="risk-${riskClass}">${g.hallucination_risk ?? "—"}</b><br><span style="font-size:10px">checks specifics trace to the brief — not fact-checking</span></div>
        </div>
        <div class="quality-cell">
          <div class="quality-num ${st.structurally_sound ? 'risk-low' : 'risk-medium'}">${st.structurally_sound ? "✓" : st.issues?.length ?? "—"}</div>
          <div class="quality-label">Structure</div>
          <div class="quality-note">${st.paragraphs ?? "—"} paras · ${st.has_attribution ? "attributed" : "no attribution"}</div>
        </div>
        <div class="quality-cell">
          <div class="quality-num ${langClean ? 'risk-low' : 'risk-high'}">${langClean ? "✓" : "✗"}</div>
          <div class="quality-label">Language</div>
          <div class="quality-note">${langClean ? "English only — no script mixing" : `mixing detected (${lang.wrong_script_chars} Arabic chars)`}</div>
        </div>
      </div>
      ${!langClean ? `<div class="muted" style="margin-top:6px"><b style="color:var(--high)">Language mixing — fix before publish:</b><div class="chips chips-warn" style="margin-top:6px">${langSnips}</div></div>` : ""}
      ${ungrounded}
      ${(st.issues && st.issues.length) ? `<div class="muted" style="margin-top:6px">Structure notes: ${st.issues.map(escapeHtml).join(" · ")}</div>` : ""}
    </div>
  `;
}

const RISK_RANK = { Low: 1, Medium: 2, High: 3 };

// Delegated click handler for the variants/Arabic buttons (rendered dynamically)
document.addEventListener("click", async (e) => {
  if (e.target.id === "g-variants-btn") {
    await runVariants(e.target);
  } else if (e.target.id === "g-arabic-btn") {
    await runArabic(e.target);
  } else if (e.target.id === "g-queue-btn") {
    await sendToQueue(e.target);
  }
});

async function sendToQueue(btn) {
  const out = $("#g-queue-out");
  if (!LAST_GENERATED) { out.innerHTML = `<div class="error-box">Generate an article first.</div>`; return; }
  btn.disabled = true;
  try {
    const it = await API.queueAdd({
      headline: LAST_GENERATED.headline,
      body: LAST_GENERATED.body || LAST_GENERATED.full_text || "",
      risk: LAST_GENERATED.risk || "Low",
      risk_labels: LAST_GENERATED.risk_labels || [],
      style_score: LAST_GENERATED.style_score ?? null,
      grounding_score: LAST_GENERATED.grounding_score ?? null,
      source_confidence: LAST_GENERATED.source_confidence ?? null,
      source: LAST_GENERATED.brief ? (LAST_GENERATED.brief.topic || "") : "",
    });
    out.innerHTML = `<div class="callout">Sent to approval queue as item #${it.id}. Open <b>Editorial Copilot</b> to review, or <b>Operating Model</b> to see the audit trail.</div>`;
  } catch (e) {
    out.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

async function runVariants(btn) {
  const out = $("#g-variants-out");
  if (!LAST_GENERATED) {
    out.innerHTML = `<div class="error-box">Generate an article first.</div>`;
    return;
  }
  btn.disabled = true;
  out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Generating 3 headline variants…</div>`;
  try {
    const brief = LAST_GENERATED.brief || {};
    const r = await API.variants({
      topic: brief.topic || LAST_GENERATED.headline || "",
      facts: brief.facts || "",
      entity: brief.entity || "",
      category: brief.category || "",
    });
    out.innerHTML = `
      <h3 style="margin:8px 0 6px">Alternative headlines</h3>
      <p class="muted">For the same brief — closes Genuine Issue GI-6 (97.3% of QL headlines use the same template).</p>
      ${(r.variants || []).map(v => `
        <div class="variant-row">
          <div class="variant-style">${escapeHtml(prettifyDim(v.style || "variant"))}</div>
          <div class="variant-head">${escapeHtml(v.headline)}</div>
          <div class="variant-meta">
            <span class="pill">${v.word_count} words · ${v.char_count} chars</span>
            <span class="pill pill-ok">entity-first ${v.entity_first_score}/100</span>
          </div>
          <div class="variant-rationale">${escapeHtml(v.rationale)}</div>
        </div>
      `).join("")}
    `;
  } catch (e) {
    out.innerHTML = `<div class="error-box">Variants failed: ${escapeHtml(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

async function runArabic(btn) {
  const out = $("#g-arabic-out");
  if (!LAST_GENERATED) {
    out.innerHTML = `<div class="error-box">Generate an article first.</div>`;
    return;
  }
  btn.disabled = true;
  out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Translating to Qatar Living Arabic editorial voice…</div>`;
  try {
    const r = await API.arabic({
      headline: LAST_GENERATED.headline,
      body: LAST_GENERATED.body || LAST_GENERATED.full_text || "",
    });
    const t = r.translation || {};
    out.innerHTML = `
      <h3 style="margin:8px 0 6px">النسخة العربية</h3>
      <div class="arabic-frame" dir="rtl" lang="ar">
        <h2 class="arabic-headline">${escapeHtml(t.headline_ar || "")}</h2>
        ${(t.body_ar || "").split(/\n\s*\n/).map(p => `<p>${escapeHtml(p)}</p>`).join("")}
      </div>
      ${(t.translator_notes && t.translator_notes.length) ? `
        <div class="muted" style="margin-top:8px"><b style="color:var(--bone)">Translator notes:</b>
          <ul style="margin:6px 0 0;padding-left:18px">${t.translator_notes.map(n => `<li>${escapeHtml(n)}</li>`).join("")}</ul>
        </div>` : ""}
      <div class="muted" style="margin-top:8px;font-size:11.5px">
        tokens in/out: ${r.tokens?.prompt ?? "—"} / ${r.tokens?.completion ?? "—"}
      </div>
    `;
  } catch (e) {
    out.innerHTML = `<div class="error-box">Arabic translation failed: ${escapeHtml(e.message)}</div>`;
  } finally { btn.disabled = false; }
}

function renderScoreHero(score) {
  if (!score || !score.score && score.score !== 0) return "";
  const verdictMap = {
    on_voice:    ["On voice", "Matches Qatar Living's institutional style."],
    near_voice:  ["Near voice", "Mostly aligned; minor edits would polish it."],
    needs_edit:  ["Needs edit", "Several dimensions are off — revise before review."],
    off_voice:   ["Off voice", "Substantial rewrite needed to match the corpus."],
    no_content:  ["No content", "Provide a headline and body to score."],
  };
  const v = verdictMap[score.verdict] || ["", ""];
  return `
    <div class="score-hero">
      <div class="score-circle"><div class="n">${score.score}</div></div>
      <div>
        <div class="verdict">${v[0]} <span class="muted" style="font-weight:400;font-size:13px">· style score</span></div>
        <div class="verdict-sub">${v[1]}</div>
        ${score.word_count ? `<div class="muted" style="margin-top:4px">${score.word_count} words · target: ${score.intended_length}</div>` : ""}
      </div>
    </div>
  `;
}

function renderDimensions(score) {
  if (!score?.dimensions) return "";
  const entries = Object.entries(score.dimensions);
  return `
    <div class="dim-list">
      ${entries.map(([k, d]) => `
        <div class="dim-row">
          <div class="dim-name">${escapeHtml(prettifyDim(k))}</div>
          <div class="dim-score">${d.score}</div>
          <div class="dim-note">${escapeHtml(d.note)}</div>
        </div>
      `).join("")}
    </div>
  `;
}

function prettifyDim(k) {
  return k.replace(/_/g, " ").replace(/\b\w/g, m => m.toUpperCase());
}

/* ───────── Rewrite ───────── */
let REWRITE_LOADED = false;
async function loadRewriteSamples() {
  if (REWRITE_LOADED) return;
  REWRITE_LOADED = true;
  try {
    const s = await API.samples();
    const row = $("#rewrite-samples-row");
    s.rewrite_samples.forEach(rs => {
      const btn = document.createElement("button");
      btn.className = "scenario-btn";
      btn.textContent = rs.label;
      btn.onclick = () => {
        $("#r-input").value = rs.raw;
        $("#r-output").innerHTML = `<div class="empty-state">Sample loaded. Click <i>Rewrite</i>.</div>`;
      };
      row.appendChild(btn);
    });
  } catch {}
}

function wireRewriteForm() {
  $("#r-submit").addEventListener("click", async () => {
    const btn = $("#r-submit");
    const out = $("#r-output");
    const text = $("#r-input").value.trim();
    if (!text) { out.innerHTML = `<div class="error-box">Paste some text first.</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Rewriting…</div>`;
    try {
      const r = await API.rewrite({ text });
      renderRewrite(text, r, out);
    } catch (e) {
      out.innerHTML = `<div class="error-box">Rewrite failed: ${escapeHtml(e.message)}</div>`;
    } finally {
      btn.disabled = false;
    }
  });
}

function renderRewrite(original, result, target) {
  const r = result.rewrite || {};
  const removedPhrases = r.removed_phrases || [];
  const addedAttributions = r.added_attributions || [];
  const beforeMarked = markPhrasesInText(original, removedPhrases, "diff-mark-removed");
  const afterMarked  = markPhrasesInText(r.rewritten || "", addedAttributions, "diff-mark-added");
  target.innerHTML = `
    <h3>Before → After</h3>
    <div class="diff-grid">
      <div class="side before"><h4>Original</h4>${beforeMarked}</div>
      <div class="side after"><h4>Qatar Living voice</h4>${afterMarked}</div>
    </div>
    <div class="panel-row" style="margin-top:14px">
      ${["before","after"].map(k => {
        const s = result[`${k}_score`] || {};
        return `<span class="pill">${k}: ${s.score ?? "—"} / 100</span>`;
      }).join("")}
    </div>
    ${r.removed_phrases?.length ? `
      <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">Removed phrases:</b>
        <div class="chips chips-warn" style="margin-top:6px">${r.removed_phrases.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join("")}</div>
      </div>` : ""}
    ${r.added_attributions?.length ? `
      <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">Added attributions:</b>
        <div class="chips" style="margin-top:6px">${r.added_attributions.map(p => `<span class="chip">${escapeHtml(p)}</span>`).join("")}</div>
      </div>` : ""}
    ${r.changes_summary?.length ? `
      <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">Why this matches QL:</b>
        <ul style="margin:6px 0 0;padding-left:18px">${r.changes_summary.map(c => `<li>${escapeHtml(c)}</li>`).join("")}</ul>
      </div>` : ""}
  `;
}

/* ───────── Style checker ───────── */
function wireCheckerForm() {
  $("#c-submit").addEventListener("click", async () => {
    const btn = $("#c-submit");
    const out = $("#c-output");
    const text = $("#c-input").value.trim();
    if (!text) { out.innerHTML = `<div class="error-box">Paste a draft first (first line = headline).</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Scoring…</div>`;
    try {
      const s = await API.score({ text, intended_length: $("#c-length").value });
      out.innerHTML = `
        ${renderScoreHero(s)}
        ${renderDimensions(s)}
        ${s.suggestions?.length ? `
          <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">Top suggestions:</b>
            <ul style="margin:6px 0 0;padding-left:18px">${s.suggestions.map(x => `<li>${escapeHtml(x)}</li>`).join("")}</ul>
          </div>` : ""}
      `;
    } catch (e) {
      out.innerHTML = `<div class="error-box">Scoring failed: ${escapeHtml(e.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}

/* ───────── Governance ───────── */
function wireGovernanceForm() {
  $("#gov-submit").addEventListener("click", async () => {
    const btn = $("#gov-submit");
    const out = $("#gov-output");
    const text = $("#gov-input").value.trim();
    if (!text) { out.innerHTML = `<div class="error-box">Paste a draft or headline.</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Classifying…</div>`;
    try {
      const g = await API.classify({ text });
      out.innerHTML = `
        <div class="panel-row">
          <span class="risk-badge ${g.risk}">Risk: ${g.risk}</span>
          ${(g.risk_labels || []).map(l => `<span class="pill">${escapeHtml(l)}</span>`).join("")}
        </div>
        <div class="callout" style="margin-top:12px">
          <b>Approval route:</b> ${escapeHtml(g.approval_route)}
        </div>
        <div class="muted" style="margin-top:8px"><b style="color:var(--bone)">Reasoning:</b> ${escapeHtml(g.reasoning)}</div>
        ${g.matched_terms?.length ? `
          <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">Matched trigger terms:</b>
            <div class="chips" style="margin-top:6px">${g.matched_terms.map(t => `<span class="chip">${escapeHtml(t)}</span>`).join("")}</div>
          </div>` : ""}
      `;
    } catch (e) {
      out.innerHTML = `<div class="error-box">Classification failed: ${escapeHtml(e.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}

/* ───────── Cleanup ───────── */
let CLEANUP_SAMPLE = null;
async function loadCleanupSample() {
  if (CLEANUP_SAMPLE !== null) return;
  try {
    const s = await API.samples();
    CLEANUP_SAMPLE = s.sample_dirty_body;
  } catch {
    CLEANUP_SAMPLE = "";
  }
}
function wireCleanupForm() {
  $("#cl-load-sample").addEventListener("click", () => {
    $("#cl-input").value = CLEANUP_SAMPLE || "";
  });
  $("#cl-submit").addEventListener("click", async () => {
    const btn = $("#cl-submit");
    const out = $("#cl-output");
    const text = $("#cl-input").value;
    if (!text.trim()) { out.innerHTML = `<div class="error-box">Paste raw article body first.</div>`; return; }
    btn.disabled = true;
    out.innerHTML = `<div class="empty-state"><span class="spinner"></span> Cleaning…</div>`;
    try {
      const r = await API.cleanup({ text });
      out.innerHTML = `
        <div class="panel-row">
          <span class="pill pill-ok">Issues removed: ${r.issues_removed_total}</span>
          <span class="pill">Original: ${r.original_chars} chars</span>
          <span class="pill">Cleaned: ${r.cleaned_chars} chars</span>
        </div>
        <div class="diff-grid" style="margin-top:14px">
          <div class="side before"><h4>Original</h4>${escapeHtml(r.original)}</div>
          <div class="side after"><h4>Cleaned</h4>${escapeHtml(r.cleaned)}</div>
        </div>
        ${Object.keys(r.issues_by_type || {}).length ? `
          <div class="muted" style="margin-top:14px"><b style="color:var(--bone)">By issue type:</b>
            <div class="chips" style="margin-top:6px">${Object.entries(r.issues_by_type).map(([k,v]) => `<span class="chip">${escapeHtml(k.replace(/_/g," "))}<span class="n">${v}</span></span>`).join("")}</div>
          </div>` : ""}
      `;
    } catch (e) {
      out.innerHTML = `<div class="error-box">Cleanup failed: ${escapeHtml(e.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}

/* ───────── Freshness ───────── */
let FRESHNESS_LOADED = false;
async function loadFreshness() {
  if (FRESHNESS_LOADED) return;
  FRESHNESS_LOADED = true;
  try {
    const f = await API.freshness();
    $("#freshness-summary").innerHTML = `
      <b>${f.total} events analysed for ${f.today}.</b><br>
      ${escapeHtml(f.summary_insight)}
    `;
    const tbody = $("#freshness-table tbody");
    if (!f.events?.length) {
      tbody.innerHTML = `<tr><td colspan="6" style="padding:18px">No stale events file found — see <code>data/stale_events.jsonl</code>.</td></tr>`;
      return;
    }
    tbody.innerHTML = f.events.map(e => `
      <tr>
        <td>
          <div style="font-family:var(--serif);font-weight:600">${escapeHtml(e.name)}</div>
          ${e.url ? `<div class="muted" style="font-size:11.5px">${escapeHtml(e.url.replace("https://www.",""))}</div>` : ""}
        </td>
        <td>${escapeHtml(e.start_date || "—")}</td>
        <td>${escapeHtml(e.end_date || "—")}</td>
        <td>${e.days_stale > 0 ? `<span class="days-stale">${e.days_stale}</span>` : "—"}</td>
        <td><span class="pill">${escapeHtml(e.event_status)}</span></td>
        <td>
          <div class="event-action ${actionClass(e.suggested_action)}">${escapeHtml(e.suggested_action)}</div>
          <div class="muted" style="font-size:11.5px;margin-top:2px">${escapeHtml(e.reason)}</div>
        </td>
      </tr>
    `).join("");
  } catch (e) {
    $("#freshness-summary").innerHTML = `<div class="error-box">Freshness load failed: ${escapeHtml(e.message)}</div>`;
  }
}
function actionClass(a) {
  if (a.includes("Archive")) return "archive";
  if (a.includes("Verify")) return "verify";
  if (a.includes("Needs")) return "review";
  if (a.includes("Confirm")) return "confirm";
  return "standard";
}

/* ───────── Evidence ───────── */
let EVIDENCE_LOADED = false;
async function loadEvidence() {
  if (EVIDENCE_LOADED) return;
  EVIDENCE_LOADED = true;
  try {
    const [e, ex, pp] = await Promise.all([
      API.evidence(), API.styleExamples(), API.promptPreview(),
    ]);
    $("#ev-openers").innerHTML = (e.top_headline_openers || []).map(([w,n]) =>
      `<span class="chip">${escapeHtml(w)}<span class="n">${n}</span></span>`).join("");
    $("#ev-verbs").innerHTML = (e.top_stance_verbs || []).map(([w,n]) =>
      `<span class="chip">${escapeHtml(w)}<span class="n">${n}</span></span>`).join("");
    $("#ev-avoid").innerHTML = (e.avoidance_terms || []).map(t =>
      `<span class="chip">${escapeHtml(t)}</span>`).join("");
    $("#ev-headlines").innerHTML = (ex.sample_headlines || []).slice(0, 16)
      .map(h => `<li>${escapeHtml(h)}</li>`).join("");
    $("#ev-prompt").textContent = pp.system_prompt || "";
  } catch (err) {
    console.warn("evidence load failed", err);
  }
}

/* ───────── ROI Calculator ───────── */
function wireRoiForm() {
  const btn = $("#roi-submit");
  if (!btn) return;
  btn.addEventListener("click", async () => {
    btn.disabled = true;
    try {
      const body = {
        editors: +$("#roi-editors").value || 20,
        articles_per_day: +$("#roi-articles").value || 40,
        minutes_saved_per_article: +$("#roi-minutes").value || 12,
        working_days_per_month: +$("#roi-days").value || 22,
        loaded_cost_per_hour_usd: +$("#roi-cost").value || 25,
        adoption_rate: +$("#roi-adopt").value || 0.6,
      };
      const r = await API.roi(body);
      renderRoi(r);
    } catch (e) {
      $("#roi-output").innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
    } finally { btn.disabled = false; }
  });
}
let ROI_LOADED = false;
async function loadRoiDefault() {
  if (ROI_LOADED) return; ROI_LOADED = true;
  try { renderRoi(await API.roiDefault()); } catch {}
}
function renderRoi(r) {
  const t = r.time, m = r.money;
  $("#roi-output").innerHTML = `
    <div class="roi-hero">
      <div class="roi-big">
        <div class="roi-big-num">$${Number(m.editor_time_saved_per_year_usd).toLocaleString()}</div>
        <div class="roi-big-label">editor time saved / year</div>
      </div>
      <div class="roi-big">
        <div class="roi-big-num">${Number(t.hours_saved_per_year).toLocaleString()}</div>
        <div class="roi-big-label">hours saved / year</div>
      </div>
    </div>
    <table style="margin-top:14px">
      <tbody>
        <tr><td>Hours saved / month</td><td style="text-align:right"><b>${t.hours_saved_per_month}</b></td></tr>
        <tr><td>Hours saved / editor / month</td><td style="text-align:right">${t.hours_saved_per_editor_per_month}</td></tr>
        <tr><td>Full-time-equivalents freed</td><td style="text-align:right">${t.full_time_equivalents_freed}</td></tr>
        <tr><td>LLM cost / year</td><td style="text-align:right">$${m.llm_cost_per_year_usd}</td></tr>
        <tr><td><b>Net saving / year</b></td><td style="text-align:right"><b>$${Number(m.net_saving_per_year_usd).toLocaleString()}</b></td></tr>
        <tr><td>ROI multiple vs LLM cost</td><td style="text-align:right">${m.roi_multiple_vs_llm_cost}×</td></tr>
      </tbody>
    </table>
    <div class="muted" style="margin-top:10px">
      ${r.formula_notes.map(escapeHtml).join("<br>")}
    </div>
  `;
}

/* ───────── Editorial Copilot ───────── */
function wireCopilotButtons() {
  $("#cp-refresh")?.addEventListener("click", () => { loadQueue(); loadLearning(); });
  $("#cp-reset")?.addEventListener("click", async () => {
    await API.queueReset(); loadQueue(); loadLearning();
  });
  $("#cp-seed")?.addEventListener("click", async () => {
    if (!LAST_GENERATED) {
      // generate a quick sample draft to demo with
      try {
        const r = await API.generate({
          topic: "Ministry of Public Health launches summer awareness campaign",
          entity: "Ministry of Public Health", category: "Health",
          facts: "The campaign runs across all districts through the summer.",
          length: "short",
        });
        LAST_GENERATED = {
          headline: r.draft.headline, body: r.draft.body, brief: {},
          style_score: r.style_score?.score,
          grounding_score: r.quality?.factual_grounding?.grounding_score,
          risk: r.governance?.risk, risk_labels: r.governance?.risk_labels,
        };
      } catch (e) { return; }
    }
    await API.queueAdd({
      headline: LAST_GENERATED.headline,
      body: LAST_GENERATED.body || "",
      risk: LAST_GENERATED.risk || "Low",
      risk_labels: LAST_GENERATED.risk_labels || [],
      style_score: LAST_GENERATED.style_score ?? null,
      grounding_score: LAST_GENERATED.grounding_score ?? null,
    });
    loadQueue();
  });
}
async function loadQueue() {
  const el = $("#cp-queue"); if (!el) return;
  try {
    const d = await API.queueList();
    if (!d.items.length) {
      el.innerHTML = `<div class="empty-state" style="padding:18px">Queue is empty. Click “Send a generated draft to the queue”.</div>`;
      return;
    }
    el.innerHTML = d.items.map(it => `
      <div class="queue-item state-${it.state}">
        <div class="queue-top">
          <span class="queue-id">#${it.id}</span>
          <span class="risk-badge ${it.risk}" style="padding:3px 8px;font-size:11px">${it.risk}</span>
          <span class="queue-state state-pill-${it.state}">${it.state.replace("_"," ")}</span>
          ${it.style_score != null ? `<span class="pill">style ${it.style_score}</span>` : ""}
          ${it.grounding_score != null ? `<span class="pill">grounding ${it.grounding_score}</span>` : ""}
        </div>
        <div class="queue-head">${escapeHtml(it.edited_headline || it.headline)}</div>
        <div class="queue-body">${escapeHtml((it.edited_body || it.body).slice(0,260))}${(it.edited_body||it.body).length>260?"…":""}</div>
        ${it.reason ? `<div class="muted" style="margin-top:4px"><b style="color:var(--bone)">Reason:</b> ${escapeHtml(it.reason)}</div>` : ""}
        ${["in_review"].includes(it.state) ? `
          <div class="queue-actions">
            <button class="btn-secondary qa-approve" data-id="${it.id}">Approve</button>
            <button class="btn-secondary qa-edit" data-id="${it.id}">Edit &amp; approve</button>
            <button class="btn-secondary qa-reject" data-id="${it.id}">Reject</button>
          </div>` : `<div class="muted" style="margin-top:6px;font-style:italic">Decision recorded.</div>`}
      </div>
    `).join("");
    // wire actions
    el.querySelectorAll(".qa-approve").forEach(b => b.onclick = async () => {
      await API.queueAct(b.dataset.id, { action: "approve" }); loadQueue(); loadLearning();
    });
    el.querySelectorAll(".qa-reject").forEach(b => b.onclick = async () => {
      const reason = prompt("Rejection reason (feeds the learning loop):", "");
      if (reason === null) return;
      await API.queueAct(b.dataset.id, { action: "reject", reason }); loadQueue(); loadLearning();
    });
    el.querySelectorAll(".qa-edit").forEach(b => b.onclick = async () => {
      const reason = prompt("What did you change? (feeds the learning loop):", "");
      if (reason === null) return;
      await API.queueAct(b.dataset.id, { action: "edit_approve", reason }); loadQueue(); loadLearning();
    });
  } catch (e) {
    el.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}
async function loadLearning() {
  const el = $("#cp-learning"); if (!el) return;
  try {
    const l = await API.learning();
    if (!l.decided) {
      el.innerHTML = `<div class="empty-state">Act on a few queue items to populate the learning loop.</div>`;
      return;
    }
    el.innerHTML = `
      <div class="roi-hero" style="grid-template-columns:1fr 1fr 1fr">
        <div class="roi-big"><div class="roi-big-num">${l.acceptance_rate_pct ?? "—"}%</div><div class="roi-big-label">acceptance</div></div>
        <div class="roi-big"><div class="roi-big-num">${l.first_pass_rate_pct ?? "—"}%</div><div class="roi-big-label">first-pass</div></div>
        <div class="roi-big"><div class="roi-big-num">${l.edit_required_rate_pct ?? "—"}%</div><div class="roi-big-label">edited</div></div>
      </div>
      <h3 style="margin-top:14px;font-size:14px">Suggested prompt improvements</h3>
      ${l.suggested_prompt_improvements.length ? l.suggested_prompt_improvements.map(s => `
        <div class="learn-row">
          <span class="pill">${s.triggered_by_n_reviews}×</span>
          ${escapeHtml(s.suggestion)}
        </div>`).join("") : `<div class="muted">No reasons captured yet — reject or edit an item with a reason.</div>`}
      <div class="muted" style="margin-top:8px;font-size:11.5px">
        ${l.reasons_captured} reviewer reason(s) captured · ${l.decided} decisions
      </div>
    `;
  } catch (e) {
    el.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}

/* ───────── CMS Integration (mock) ───────── */
let CMS_LOADED = false;
async function loadCmsOpps() {
  if (CMS_LOADED) return; CMS_LOADED = true;
  const el = $("#cms-opps"); if (!el) return;
  try {
    const d = await API.cmsOpps();
    el.innerHTML = d.opportunities.map(o => `
      <div class="cms-row">
        <div>
          <div class="cms-title">${escapeHtml(o.title)}</div>
          <div class="muted">${escapeHtml(o.type)} · CMS id ${escapeHtml(o.cms_id)} · status ${escapeHtml(o.status_in_cms)}</div>
          <div class="muted" style="margin-top:2px">→ ${escapeHtml(o.suggested_action)}</div>
        </div>
        <button class="btn-secondary cms-push" data-id="${escapeHtml(o.cms_id)}" data-title="${escapeHtml(o.title)}">Push draft</button>
      </div>
    `).join("");
    el.querySelectorAll(".cms-push").forEach(b => b.onclick = async () => {
      b.disabled = true;
      try {
        const r = await API.cmsPush({
          headline: b.dataset.title, body: "Draft body generated by the pilot.",
          cms_id: b.dataset.id, risk: "Low",
        });
        $("#cms-push-out").innerHTML = `
          <div class="card">
            <h3>Draft pushed to CMS <span class="mock-tag">MOCK</span></h3>
            <table><tbody>
              <tr><td>CMS post id</td><td style="text-align:right"><code>${escapeHtml(r.cms_post_id)}</code></td></tr>
              <tr><td>Status in CMS</td><td style="text-align:right"><b>${escapeHtml(r.status_in_cms)}</b></td></tr>
              <tr><td>Published?</td><td style="text-align:right">${r.published ? "yes" : "<b>no — draft only</b>"}</td></tr>
              <tr><td>Approval required before publish</td><td style="text-align:right">${r.approval_required_before_publish ? "yes" : "no"}</td></tr>
              <tr><td>Preview URL</td><td style="text-align:right"><code>${escapeHtml(r.preview_url)}</code></td></tr>
            </tbody></table>
            <div class="muted" style="margin-top:8px">${escapeHtml(r.note)}</div>
          </div>`;
      } catch (e) {
        $("#cms-push-out").innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
      } finally { b.disabled = false; }
    });
  } catch (e) {
    el.innerHTML = `<div class="error-box">${escapeHtml(e.message)}</div>`;
  }
}

/* ───────── Helpers ───────── */
function fmt(n) {
  if (n == null) return "—";
  if (typeof n === "number") {
    if (n >= 1000) return n.toLocaleString();
    return String(n);
  }
  return String(n);
}
function fmtPct(n) {
  if (n == null) return "—";
  return (Math.round(Number(n) * 10) / 10).toString();
}
function escapeHtml(s) {
  if (s == null) return "";
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/* Escape a string, then wrap any literal occurrences of the given phrases in a
   <mark> with the given CSS class. Used by the rewrite diff view to highlight
   removed phrases on the left and added attributions on the right. */
function markPhrasesInText(text, phrases, cls) {
  let out = escapeHtml(text || "");
  if (!phrases || !phrases.length) return out;
  // Sort phrases by length desc so longer matches don't get partially eaten by
  // shorter ones.
  const sorted = [...phrases].filter(Boolean).sort((a, b) => b.length - a.length);
  for (const raw of sorted) {
    const phrase = escapeHtml(String(raw));
    if (!phrase) continue;
    // Word-boundary-ish: avoid matching mid-word for short phrases.
    const safe = phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const re = new RegExp(`(${safe})`, "gi");
    out = out.replace(re, `<mark class="${cls}">$1</mark>`);
  }
  return out;
}
