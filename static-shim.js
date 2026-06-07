/* Static demo shim — runs the entire Command Center in the browser with no
   backend and no API key. Intercepts /api/* calls and serves baked JSON +
   faithful JS ports of the deterministic logic (governance, cleanup, ROI,
   readability, grounding). Loaded BEFORE app.js so app.js is unchanged. */
(function () {
  const DATA = "./data/";
  const cache = {};
  let QUEUE = [], NEXT_ID = 1;

  async function loadJSON(name) {
    if (cache[name]) return cache[name];
    const r = await fetch(DATA + name + ".json");
    cache[name] = await r.json();
    return cache[name];
  }
  const J = (obj, status = 200) =>
    new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });

  // ---- deterministic ports -------------------------------------------------
  const RULES = [
    ["royal_family","High",["sheikh ","sheikha ","amir","emir","crown prince","his highness","h.h.","hh "]],
    ["government_official","High",["prime minister","foreign minister","minister of","ministry of","his excellency","h.e.","cabinet","moph","moi","mme","ashghal","qcaa"]],
    ["diplomatic","High",["condemn","denounce","summon","sanction","embassy","ambassador","diplomatic","bilateral","treaty","united nations"," un ","security council"]],
    ["security_military","High",["military","armed forces","defense","defence","weapon","missile","drone attack","terror","border","soldier","troops","ceasefire","airbase","al udeid"]],
    ["political","High",["election","parliament","policy","legislation","political","government decision"]],
    ["religious","High",["islam","muslim","ramadan","eid ","mosque","hajj","umrah","quran","imam","fatwa","iftar","sharia"]],
    ["legal_judicial","High",["court","lawsuit","verdict","convicted","sentenced","prosecutor","trial","judicial","judge"]],
    ["regional_tension","High",["gaza","israel","palestine","iran","yemen","syria","lebanon","hezbollah","hamas","houthi"]],
    ["health_safety","Medium",["health","hospital","disease","virus","outbreak","vaccine","patient","medical","epidemic","pandemic"]],
    ["aviation_transport","Medium",["qatar airways","flight","airline","airport","metro","qa rail","transportation","doha hia"]],
    ["business_economy","Medium",["investment","economy","gdp","stock","market","billion","million qar","qcb","central bank","ipo"]],
    ["sponsored_commercial","Medium",["sponsored","in partnership with","press release","launches","unveils","introduces"]],
    ["sports","Low",["football","soccer","athletics","championship","tournament","olympics","world cup","league","match"]],
    ["culture_events","Low",["exhibition","museum","concert","festival","katara","mathaf","qatar museums","art","cultural"]],
    ["education","Low",["school","student","university","education","graduation","academic","qf ","qatar foundation"]],
    ["tech_innovation","Low",["ai","artificial intelligence","technology","digital","blockchain","startup","innovation","smart city"]],
    ["local_community","Low",["doha","lusail","al rayyan","souq","neighborhood","residents","community"]],
    ["weather_environment","Low",["weather","rain","storm","wind","temperature","environment","climate","sustainability"]],
  ];
  const RANK = { Low: 1, Medium: 2, High: 3 };
  const REVIEWER = { High: "Senior reviewer + Legal / Governance review", Medium: "Senior reviewer", Low: "Content reviewer" };
  const ACTION = { High: "No auto-publish — senior + legal review required", Medium: "Needs senior review before publish", Low: "Allow draft (standard editorial review)" };
  const wb = (t) => new RegExp("(?<![A-Za-z0-9])" + t.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "(?![A-Za-z0-9])", "i");

  function classify(text) {
    if (!text || !text.trim()) return { risk: "Low", risk_labels: [], matched_terms: [], reviewer_level: REVIEWER.Low, action: ACTION.Low, no_auto_publish: false, approval_route: "Standard editorial review by a content reviewer.", reasoning: "No content provided." };
    const labels = [], matched = []; let max = "Low";
    for (const [label, risk, trigs] of RULES) {
      const hit = trigs.filter(t => wb(t).test(text));
      if (hit.length) { labels.push(label); matched.push(...hit.slice(0, 3)); if (RANK[risk] > RANK[max]) max = risk; }
    }
    const reasoning = max === "High" ? "Detected " + labels.slice(0,3).join(", ") + ". Senior + Legal review required."
      : max === "Medium" ? "Detected " + labels.slice(0,3).join(", ") + ". Editor review needed." : "No high/medium triggers — standard review.";
    return { risk: max, risk_labels: labels, matched_terms: [...new Set(matched)].slice(0,8),
      reviewer_level: REVIEWER[max], action: ACTION[max], no_auto_publish: max !== "Low",
      approval_route: ACTION[max], reasoning };
  }

  const FORBIDDEN = ["scandal","shocking","outrageous","catastrophic","corrupt","controversial","controversy","slammed","blasted","exclusive:","breaking:","you won't believe","chaos","fail","failure","disaster"];
  const CASUAL = ["amazing","awesome","huge","massive","incredible","unbelievable","epic","insane","crazy","game-changing","game changer","revolutionary","unprecedented","must-see","obsessed","literally","lol","vibes"];
  const STANCE = ["announced","launched","highlighted","stressed","affirmed","welcomed","urged","signed","praised","reaffirmed","condemned","expressed","underscored","unveiled","met with","discussed"];
  const ATTR = ["according to","said","stated","noted","in a statement","officials said","the ministry said","officials highlighted","announced","affirmed"];
  const words = s => (s.match(/\b[a-zA-Z][a-zA-Z'-]+\b/g) || []);
  const hits = (t, arr) => arr.filter(p => wb(p).test(t));

  function score(text, intended = "standard") {
    const lines = (text || "").split("\n").map(l => l.trim()).filter(Boolean);
    const head = (lines[0] || "").replace(/^#\s*/, ""); const body = lines.slice(1).join("\n");
    const n = words(text).length || 1;
    const dims = {};
    const firstTok = (head.match(/[A-Za-z']+/) || [""])[0];
    const openers = ["qatar","hh","he","ministry","doha","ashghal","moph","moi","mme","qf","sheikh","sheikha","amir","hamad","tamim","qna","qcaa","lusail","mathaf"];
    const ef = head && (openers.includes(firstTok.toLowerCase()) || (firstTok[0] && firstTok[0]===firstTok[0].toUpperCase()));
    dims.headline_entity_first = { score: ef ? 100 : 35, note: ef ? "Entity-first headline." : "Headline not entity-first.", weight: .2 };
    const a = hits(text, ATTR).length;
    dims.attribution_density = { score: a >= 2 ? 100 : a === 1 ? 65 : 25, note: a + " attribution phrase(s).", weight: .18 };
    const v = hits(text.toLowerCase(), STANCE).length;
    dims.stance_verbs_present = { score: v >= 2 ? 100 : v === 1 ? 70 : 30, note: v + " stance verb(s).", weight: .15 };
    const f = hits(text, FORBIDDEN);
    dims.avoidance_clean = { score: !f.length ? 100 : Math.max(10, 100 - 18*f.length), note: f.length ? "Flagged: " + f.join(", ") : "No forbidden language.", weight: .15, hits: f };
    const c = hits(text, CASUAL);
    dims.casual_language_clean = { score: !c.length ? 100 : Math.max(15, 100 - 22*c.length), note: c.length ? "Casual: " + c.join(", ") : "Institutional tone.", weight: .12, hits: c };
    dims.honorific_consistency = { score: 100, note: "Honorific style consistent.", weight: .1 };
    const tgt = { short:[140,220], standard:[240,350], long:[360,600] }[intended] || [240,350];
    const inLen = n >= tgt[0] && n <= tgt[1];
    dims.length_target_match = { score: inLen ? 100 : Math.max(40, 100 - Math.round(Math.min(Math.abs(n-tgt[0]),Math.abs(n-tgt[1]))*.5)), note: `Length ${n} words (target ${tgt[0]}-${tgt[1]}).`, weight: .1, word_count: n };
    const overall = Math.round(Object.values(dims).reduce((s,d)=>s+d.score*d.weight,0));
    const verdict = overall>=85?"on_voice":overall>=65?"near_voice":overall>=45?"needs_edit":"off_voice";
    return { score: overall, verdict, dimensions: dims, suggestions: Object.values(dims).filter(d=>d.score<80).map(d=>d.note).slice(0,6), intended_length: intended, word_count: n };
  }

  function syll(w){w=w.toLowerCase();const g=w.match(/[aeiouy]+/g);let n=g?g.length:0;if(w.endsWith("e")&&!/(le|ie|ee|ye)$/.test(w))n=Math.max(1,n-1);return Math.max(1,n);}
  function quality(text, source) {
    const ws = words(text); const sents = (text||"").split(/[.!?]+\s+/).filter(s=>s.trim());
    const wps = ws.length/Math.max(sents.length,1), spw = ws.reduce((a,w)=>a+syll(w),0)/Math.max(ws.length,1);
    const flesch = Math.round((206.835-1.015*wps-84.6*spw)*10)/10;
    const band = flesch>=60?"plain / easy":flesch>=50?"fairly readable (typical news)":flesch>=30?"fairly difficult (institutional)":"difficult / dense";
    // grounding
    const srcTokens = new Set((source||"").toLowerCase().match(/\b[a-z0-9][a-z0-9'-]+\b/g) || []);
    const ents = [...new Set((text.match(/\b(?:[A-Z][a-z]+(?:\s+(?:[A-Z][a-z]+|bin|the|of|and|al|Al))*)|(?:[A-Z]{2,})\b/g)||[]))].map(e=>e.replace(/^(The|A|An)\s+/,"").trim()).filter(e=>e.length>2 && !["The","This","Officials","During","Further"].includes(e));
    const stop = new Set(["the","of","and","a","an","bin","al","for","to","in","on","at","by","with"]);
    const grounded = ents.filter(e => (source||"").toLowerCase().includes(e.toLowerCase()) || words(e).filter(p=>p.length>2&&!stop.has(p.toLowerCase())).every(p=>srcTokens.has(p.toLowerCase())));
    const ungroundedE = ents.filter(e=>!grounded.includes(e));
    const nums = [...new Set((text.match(/\b\d[\d,.]*\b/g)||[]).map(x=>x.replace(/,/g,"")))];
    const ungroundedN = nums.filter(x=>!srcTokens.has(x) && !(source||"").replace(/,/g,"").includes(x));
    const eg = ents.length?Math.round(100*grounded.length/ents.length*10)/10:100;
    const ng = nums.length?Math.round(100*(nums.length-ungroundedN.length)/nums.length*10)/10:100;
    const gs = Math.round((.7*eg+.3*ng)*10)/10;
    const risk = gs>=85?"low":gs>=65?"medium":"high";
    const paras = (text||"").split(/\n\s*\n/).filter(p=>p.trim());
    return { readability:{flesch_reading_ease:flesch,band,words_per_sentence:Math.round(wps*10)/10,syllables_per_word:Math.round(spw*100)/100},
      factual_grounding:{grounding_score:gs,hallucination_risk:risk,entities_total:ents.length,entities_grounded_pct:eg,ungrounded_entities:ungroundedE.slice(0,10),numbers_total:nums.length,numbers_grounded_pct:ng,ungrounded_numbers:ungroundedN.slice(0,10),method:"grounding_verification",note:"GROUNDING verification, NOT fact-checking."},
      structure:{paragraphs:paras.length,sentences:sents.length,has_attribution:hits(text,ATTR).length>0,structurally_sound:paras.length>=3,issues:paras.length<3?["Fewer than 3 paragraphs."]:[]} };
  }

  function cleanup(text) {
    const orig = text || ""; let out = orig; const issues = {};
    const sub = (re, rep, key) => { const m = out.match(re); if (m) { issues[key]=(issues[key]||0)+m.length; out = out.replace(re, rep); } };
    sub(/(&nbsp;| |\bnbsp\b)/gi, " ", "nbsp_entities");
    sub(/make\s+sure\s+(to\s+)?check\s+out[^\n]*?(latest|content|track)[^\n]*\.?/gi, "", "social_cta_boilerplate");
    sub(/(qatar\s*living\s+(facebook|twitter|instagram|x)[^\n]*\n?)+/gi, "", "social_cta_boilerplate");
    sub(/follow\s+us\s+on\s+(instagram|twitter|facebook|x)[^.\n]*\.?/gi, "", "follow_us_tails");
    sub(/<\/?[a-zA-Z][^>]*>/g, "", "html_tags");
    sub(/[ \t]{2,}/g, " ", "multi_space");
    sub(/\n{3,}/g, "\n\n", "multi_newline");
    out = out.trim();
    return { original: orig, cleaned: out, issues_removed_total: Object.values(issues).reduce((a,b)=>a+b,0), issues_by_type: issues, original_chars: orig.length, cleaned_chars: out.length };
  }

  function roi(b) {
    const ed=b.editors||20, ap=b.articles_per_day||40, mn=b.minutes_saved_per_article||12, wd=b.working_days_per_month||22, ch=b.loaded_cost_per_hour_usd||25, ad=b.adoption_rate||0.6, llm=0.00083;
    const eff=ap*wd*ad, hm=eff*mn/60, hy=hm*12, mm=hm*ch, my=mm*12, lm=eff*llm, ly=lm*12;
    return { inputs:{editors:ed,articles_per_day:ap,minutes_saved_per_article:mn,working_days_per_month:wd,loaded_cost_per_hour_usd:ch,llm_cost_per_article_usd:llm,adoption_rate:ad},
      throughput:{articles_per_month:Math.round(ap*wd),effective_articles_through_pilot:Math.round(eff)},
      time:{hours_saved_per_month:Math.round(hm*10)/10,hours_saved_per_year:Math.round(hy),hours_saved_per_editor_per_month:Math.round(hm/ed*10)/10,full_time_equivalents_freed:Math.round(hm/(wd*8)*100)/100},
      money:{editor_time_saved_per_month_usd:Math.round(mm),editor_time_saved_per_year_usd:Math.round(my),llm_cost_per_month_usd:Math.round(lm*100)/100,llm_cost_per_year_usd:Math.round(ly*100)/100,net_saving_per_year_usd:Math.round(my-ly),roi_multiple_vs_llm_cost:ly?Math.round(my/ly):null},
      formula_notes:["effective_articles = articles_per_day x working_days x adoption_rate","hours_saved = effective_articles x minutes_saved / 60","money_saved = hours_saved x loaded_cost_per_hour","FTE freed = monthly hours saved / (working_days x 8h)","All figures scale linearly; adoption_rate is deliberately < 100%."] };
  }

  function fallbackPackage(b) {
    const entity=b.entity||"Qatar", topic=b.topic||"Qatar update", facts=(b.facts||"").trim();
    const head = topic[0]===topic[0].toUpperCase()?topic:topic.charAt(0).toUpperCase()+topic.slice(1);
    const parts=[`${entity} has announced developments regarding ${topic.toLowerCase()}, according to officials.`];
    if(facts)parts.push(facts); if(b.quote)parts.push(`"${b.quote.trim()}", the statement noted.`);
    parts.push("Officials highlighted that further details will be shared in due course, the statement added.");
    const body=parts.join("\n\n");
    const pkg={brief:`What: ${topic}. Why it matters: relevant to Qatar Living's audience. Audience: residents and visitors. Angle: official, factual update.`,
      article:{headline:head,body},instagram_caption:`${head}. ${facts.slice(0,110)} #Qatar #QatarLiving #Doha`.trim(),
      story_copy:`${head} — more on Qatar Living.`,push_notification:head.length>116?head.slice(0,115)+"…":head,
      video_script:`Beat 1 (on-screen): ${head}\nBeat 2 (narration): ${entity} confirmed the update, officials said.\nBeat 3 (on-screen): Details on Qatar Living.\nBeat 4 (CTA): Follow Qatar Living for more.`,
      poster_brief:`Headline text: ${head}. Key visual: institutional / Qatar context. Mood: formal, optimistic. Must include: Qatar Living logo.`,
      risk:b.risk_hint||"Low",risk_labels:[],source_confidence:facts?"Medium":"Needs verification",
      tone_check:"Institutional, factual, non-clickbait — Qatar Living style.",forbidden_or_unsupported:[],
      missing_info:facts?[]:["No supporting facts were provided in the brief."],
      style_notes:"Offline package — entity-first, attribution-heavy, no sensational language.",_fallback:true};
    return enrich(pkg, b, true);
  }
  function enrich(pkg, brief, fb) {
    const art=pkg.article||{}; const full=(art.headline||"")+"\n\n"+(art.body||"");
    const st=score(full,"standard"), gov=classify(full), src=[brief.topic,brief.entity,brief.facts,brief.quote].filter(Boolean).join(" ");
    const q=quality(art.body||"",src);
    gov.source_confidence = !brief.facts?"Needs verification":(q.factual_grounding.grounding_score>=85?"High":q.factual_grounding.grounding_score>=65?"Medium":"Needs verification");
    return { package: pkg, style_score: st, quality: q, governance: gov, provider: fb?"fallback":"static", model: "offline", tokens: {}, fallback_used: !!fb };
  }

  // ---- deterministic paraphrase (offline radar "Prepare") -----------------
  function buildParaphrase(rawText, sourceName) {
    const cl = cleanup(rawText);
    const clean = cl.cleaned;
    const title = clean.split(/[.\n]/)[0].trim().replace(/\s+\(.*\)$/, "");
    // entity-first, title-cased-ish headline
    const headline = title.replace(/\b\w/g, c => c.toUpperCase()).slice(0, 110);
    const gov0 = classify(clean);
    const cat = (gov0.risk_labels[0] || "news").replace(/_/g, " ");
    const catTitle = cat.replace(/\b\w/g, c => c.toUpperCase());
    const src = sourceName || "reports";
    const body = [
      `${title}, according to ${src}.`,
      `Qatar Living is following the development, which is relevant to residents and visitors across the country. Officials are expected to share further details in due course.`,
      `The information above is based on the original report and is being verified by the Qatar Living desk before publication.`,
    ].join("\n\n");
    const full = headline + "\n\n" + body;
    const nums = [...new Set((clean.match(/\b\d[\d,.]*\b/g) || []))].slice(0, 5);
    const q = quality(body, clean);
    const gov = classify(full);
    gov.source_confidence = "Needs verification";
    const gi = [
      { gi: "GI-1", what: "Stripped nbsp / encoding residue from the source." },
      { gi: "GI-2", what: "Removed any social-media boilerplate." },
      { gi: "GI-3", what: "Normalised honorifics to HH / HE house style." },
      { gi: "GI-4", what: `Suggested category: ${catTitle}.` },
      { gi: "GI-5", what: "Re-reported with a Qatar-relevance angle and attribution." },
      { gi: "GI-6", what: "Entity-first headline." },
      { gi: "GI-8", what: `Suggested byline: Qatar Living Desk — ${catTitle}.` },
      { gi: "GI-12", what: "Varied, non-formulaic lead." },
    ];
    const pkg = {
      headline, body,
      key_facts: nums.length ? nums.map(n => `Figure cited: ${n}`) : [],
      suggested_category: catTitle,
      suggested_byline: `Qatar Living Desk — ${catTitle}`,
      gi_applied: gi,
      removed: Object.keys(cl.issues_by_type),
      paraphrase_note: "Reworded from the source headline; full text to be verified before publish.",
      risk: gov.risk, risk_labels: gov.risk_labels,
      source_confidence: "Needs verification",
      tone_check: "Institutional, factual, non-clickbait — Qatar Living style.",
      forbidden_or_unsupported: [],
      missing_info: ["Only the source headline was available — verify full details before publish."],
      overlap_pct: 0, paraphrase_ok: true,
    };
    return { paraphrase: pkg, cleanup: { issues_removed_total: cl.issues_removed_total, issues_by_type: cl.issues_by_type },
             style_score: score(full, "standard"), quality: q, governance: gov, fallback_used: true };
  }

  // ---- workflow (in-memory) -----------------------------------------------
  const REASON_MAP = [[/honorific|hh|he|sheikh|title/i,"Tighten honorific house-style rule (canonical HH / HE forms)."],[/length|too long|too short|word count|wordy/i,"Adjust length target for this content type."],[/attribut|source|cite|unsourced/i,"Require an explicit source/attribution per claim."],[/tone|formal|casual|clickbait|sensational/i,"Reinforce institutional tone / forbidden-language list."],[/fact|wrong|inaccurate|hallucinat|invented/i,"Strengthen factual-grounding guard."],[/headline|title/i,"Refine headline rules."],[/governance|sensitiv|risk|approval/i,"Review governance trigger list."]];
  const now = () => new Date().toISOString().replace("T"," ").slice(0,19)+" UTC";
  function learning() {
    const decided=QUEUE.filter(i=>i.state!=="in_review"); const acc=decided.filter(i=>i.state!=="rejected"); const fp=decided.filter(i=>i.state==="approved");
    const reasons=QUEUE.filter(i=>i.reason).map(i=>i.reason); const hits={};
    reasons.forEach(r=>REASON_MAP.forEach(([re,rule])=>{if(re.test(r))hits[rule]=(hits[rule]||0)+1;}));
    const byState={}; QUEUE.forEach(i=>byState[i.state]=(byState[i.state]||0)+1);
    return { total_items:QUEUE.length, by_state:byState, decided:decided.length, accepted:acc.length, first_pass_approved:fp.length,
      acceptance_rate_pct:decided.length?Math.round(1000*acc.length/decided.length)/10:null,
      first_pass_rate_pct:decided.length?Math.round(1000*fp.length/decided.length)/10:null,
      edit_required_rate_pct:decided.length?Math.round(1000*decided.filter(i=>i.state==="edited_approved").length/decided.length)/10:null,
      reasons_captured:reasons.length, suggested_prompt_improvements:Object.entries(hits).map(([s,n])=>({suggestion:s,triggered_by_n_reviews:n})).sort((a,b)=>b.triggered_by_n_reviews-a.triggered_by_n_reviews), raw_reasons:reasons.slice(0,20) };
  }
  function audit() {
    const rows=[]; QUEUE.forEach(i=>(i.history||[]).forEach(h=>rows.push({item_id:i.id,headline:i.headline,source:i.source||"",action:h.action,state:h.state,reviewer:h.reviewer||"system",reason:h.reason||"",timestamp:h.at||i.created_at,risk:i.risk})));
    rows.sort((a,b)=>(a.timestamp>b.timestamp?1:-1)); return { audit: rows };
  }

  // ---- router --------------------------------------------------------------
  const realFetch = window.fetch.bind(window);
  window.fetch = async function (url, opts) {
    try {
      const u = typeof url === "string" ? url : url.url;
      if (!u || u.indexOf("/api/") === -1) return realFetch(url, opts);
      const path = u.split("?")[0].replace(/^.*\/api\//, "/api/");
      const method = (opts && opts.method || "GET").toUpperCase();
      const body = opts && opts.body ? JSON.parse(opts.body) : {};

      // GET passthroughs to baked JSON
      const GETMAP = { "/api/health":"health","/api/overview":"overview","/api/evidence":"evidence","/api/style-examples":"style-examples","/api/samples":"samples","/api/prompt-preview":"prompt-preview","/api/freshness":"freshness","/api/operating-model":"operating-model","/api/cms/opportunities":"cms-opportunities","/api/sample-images":"sample-images" };
      if (method === "GET" && GETMAP[path]) return J(await loadJSON(GETMAP[path]));
      if (method === "GET" && path === "/api/roi") return J(await loadJSON("roi"));
      if (path === "/api/radar") return J(await loadJSON("radar"));
      if (method === "GET" && path === "/api/workflow/queue") return J({ items: QUEUE });
      if (method === "GET" && path === "/api/workflow/learning") return J(learning());
      if (method === "GET" && path === "/api/workflow/audit") return J(audit());

      // POST handlers
      if (path === "/api/classify") return J(classify(body.text));
      if (path === "/api/score") return J(score(body.text, body.intended_length));
      if (path === "/api/quality") return J(quality(body.text, body.source || ""));
      if (path === "/api/cleanup") return J(cleanup(body.text));
      if (path === "/api/roi") return J(roi(body));
      if (path === "/api/headline-variants") return J(await loadJSON("variants"));
      if (path === "/api/translate-arabic") return J(await loadJSON("arabic"));
      if (path === "/api/paraphrase") {
        const t = (body.text || "").toLowerCase();
        // 1. Radar items: return the matching baked radar paraphrase if we have it
        try {
          const rp = await loadJSON("radar_paraphrases");
          const radar = await loadJSON("radar");
          const match = (radar.items || []).find(it => t.startsWith(it.title.toLowerCase().slice(0, 30)));
          if (match && rp[String(match.id)]) {
            const r = JSON.parse(JSON.stringify(rp[String(match.id)]));
            const cl = cleanup(body.text || "");
            r.cleanup = { issues_removed_total: cl.issues_removed_total, issues_by_type: cl.issues_by_type };
            return J(r);
          }
        } catch (e) {}
        // 2. The Helsinki/Tokyo sample → baked full-quality example
        if (/helsinki|tokyo|haneda/.test(t)) {
          const baked = await loadJSON("paraphrase");
          const cl = cleanup(body.text || "");
          const res = JSON.parse(JSON.stringify(baked));
          res.cleanup = { issues_removed_total: cl.issues_removed_total, issues_by_type: cl.issues_by_type };
          return J(res);
        }
        // 3. Any other input → build a deterministic JS re-report from the actual text
        return J(buildParaphrase(body.text || "", body.source_name || ""));
      }

      if (path === "/api/generate-package") {
        const packs = await loadJSON("packages");
        const t = (body.topic || "").toLowerCase();
        let key = null;
        if (/amir|pakistan|diwan/.test(t)) key="gov_announcement";
        else if (/mathaf|exhibition|resolutions|culture/.test(t)) key="cultural_event";
        else if (/health|mosquito|moph/.test(t)) key="health_announcement";
        else if (/expo|stale|completed|education leadership/.test(t)) key="stale_event_cleanup";
        else if (/airways|flight|helsinki|tokyo|aviation/.test(t)) key="aviation_news";
        if (key && packs[key]) return J(packs[key]);
        return J(fallbackPackage(body));
      }
      if (path === "/api/generate") {
        const pkgRes = JSON.parse((await (await window.fetch("/api/generate-package", opts)).text()));
        const a = pkgRes.package.article;
        return J({ draft: { headline:a.headline, body:a.body, deck:"", risk:pkgRes.governance.risk, risk_labels:pkgRes.governance.risk_labels, approval_route:pkgRes.governance.approval_route, missing_info:pkgRes.package.missing_info||[], style_notes:pkgRes.package.style_notes||"" }, style_score:pkgRes.style_score, quality:pkgRes.quality, governance:pkgRes.governance, provider:"static", model:"offline", tokens:{} });
      }
      if (path === "/api/rewrite") {
        const rws = await loadJSON("rewrites");
        const t = (body.text||"").toLowerCase();
        let key = /huge|amazing|biggest/.test(t)?"casual_event_hype":/super excited|game-changing|revolutionize/.test(t)?"marketing_press_release":/crazy|insane|obsessed|lol/.test(t)?"social_media_caption":null;
        if (key && rws[key]) return J(rws[key]);
        // generic: just compute before/after score on the same text
        return J({ rewrite:{ rewritten: body.text, changes_summary:["(offline) live rewrite needs the backend"], removed_phrases:[], added_attributions:[] }, before_score:score(body.text), after_score:score(body.text), provider:"static", model:"offline" });
      }

      // workflow mutations (in-memory)
      if (method === "POST" && path === "/api/workflow/queue") {
        const ts = now(); const item = { id: NEXT_ID++, state:"in_review", headline:body.headline, body:body.body, edited_headline:null, edited_body:null, risk:body.risk||"Low", risk_labels:body.risk_labels||[], style_score:body.style_score, grounding_score:body.grounding_score, source_confidence:body.source_confidence, source:body.source||"", reason:null, reviewer:null, created_at:ts, decided_at:null, history:[{action:"created",state:"in_review",at:ts,reviewer:"system",reason:""}] };
        QUEUE.unshift(item); return J(item);
      }
      const mItem = path.match(/^\/api\/workflow\/item\/(\d+)$/);
      if (method === "POST" && mItem) {
        const it = QUEUE.find(i=>i.id===+mItem[1]); if(!it) return J({detail:"not found"},404);
        const ts=now(); const act=body.action;
        if(act==="approve")it.state="approved"; else if(act==="reject"){it.state="rejected";it.reason=body.reason;}
        else if(act==="edit_approve"){it.state="edited_approved";it.edited_headline=body.edited_headline??it.headline;it.edited_body=body.edited_body??it.body;it.reason=body.reason;}
        it.reviewer=body.reviewer||"Editor"; it.decided_at=ts; it.history.push({action:act,state:it.state,at:ts,reviewer:it.reviewer,reason:body.reason||""});
        return J(it);
      }
      if (path === "/api/workflow/reset") { QUEUE=[]; NEXT_ID=1; return J({ok:true}); }
      if (path === "/api/cms/push-draft") {
        const id="post-"+Math.abs((body.headline||"").split("").reduce((a,c)=>a+c.charCodeAt(0),0)%900000+100000);
        return J({ mock:true, connector:"mock-cms (static demo)", action:"create_draft", published:false, cms_post_id:id, status_in_cms:"draft", linked_opportunity:body.cms_id, risk_tier:body.risk||"Low", approval_required_before_publish:(body.risk!=="Low"), preview_url:"https://cms.example.qatarliving/preview/"+id, note:"DRAFT only. No content is published." });
      }

      // unknown → empty ok
      return J({});
    } catch (e) {
      return J({ detail: "static shim error: " + e.message }, 500);
    }
  };
  console.log("%cQatar Living Command Center — static demo mode (no backend)", "color:#00426d;font-weight:bold");
})();
