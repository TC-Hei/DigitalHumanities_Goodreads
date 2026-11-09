/* Readers vs Judges — front-end (plain JavaScript + d3 v7, no build step) */
(function () {
  "use strict";
  const DATA = window.DH_DATA;
  const R = DATA.results;
  const BOOKS = DATA.books;
  const BY_ID = new Map(BOOKS.map(b => [b.id, b]));
  const CANON = BOOKS.filter(b => b.c && b.r != null);
  const MED = R.books_meta.canon_median_rating;
  const C = { ink: "#14161B", blue: "#2453B8", orange: "#C8641A", green: "#1D7A45", grey: "#9AA0AC", line: "#E1E4EA", muted: "#4F5563" };
  const CLUSTER_COLORS = ["#2453B8", "#C8641A", "#1D7A45", "#8E44AD", "#B4442F", "#5A6070", "#0E8A8A", "#B8860B", "#444"];
  const $ = s => document.querySelector(s);
  const fmt = d3.format(",");
  const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const pctTxt = v => (v * 100).toFixed(0) + "%";
  const r2 = v => (Math.round(v * 100 + 1e-9) / 100).toFixed(2);   // half-up rounding, matches the slides
  const pTxt = p => p < 0.001 ? "p < 0.001" : "p = " + p.toFixed(3);

  // ---------------------------------------------------------------- tooltip
  const tip = $("#tip");
  function showTip(evt, html) {
    tip.innerHTML = html; tip.hidden = false;
    const x = Math.min(evt.clientX + 14, window.innerWidth - 280);
    tip.style.left = x + "px"; tip.style.top = (evt.clientY + 14) + "px";
  }
  function hideTip() { tip.hidden = true; }

  // ---------------------------------------------------------------- routing
  const PAGES = ["home", "find", "game", "genres", "map", "judges", "predict", "clusters", "method"];
  const rendered = {};
  const RENDER = {};
  function route() {
    const id = PAGES.includes(location.hash.slice(1)) ? location.hash.slice(1) : "home";
    PAGES.forEach(p => { document.getElementById("page-" + p).hidden = p !== id; });
    document.querySelectorAll("[data-nav]").forEach(a => a.classList.toggle("on", a.dataset.nav === id));
    if (!rendered[id] && RENDER[id]) { RENDER[id](); rendered[id] = true; }
    window.scrollTo(0, 0);
    setTimeout(() => window.scrollTo(0, 0), 0);   // undo the browser's jump to the section anchor
  }
  window.addEventListener("hashchange", route);
  let rsz;
  window.addEventListener("resize", () => {
    clearTimeout(rsz);
    rsz = setTimeout(() => {
      const id = location.hash.slice(1) || "home";
      if (["genres", "map", "judges", "predict", "clusters"].includes(id) && RENDER[id]) RENDER[id]();
    }, 200);
  });
  const width = sel => Math.max(300, Math.min(document.querySelector(sel).clientWidth || 800, 1060));

  // ---------------------------------------------------------------- reusable charts
  function hbar(sel, rows, { label, value, fmtV = d => d, color = C.blue, max = null, left = 170 }) {
    const el = d3.select(sel); el.selectAll("*").remove();
    const W = width(sel), rowH = 30, H = rows.length * rowH + 30, m = { t: 6, r: 56, b: 24, l: Math.min(left, W * 0.42) };
    const x = d3.scaleLinear().domain([0, max ?? d3.max(rows, value)]).nice().range([m.l, W - m.r]);
    const y = d3.scaleBand().domain(rows.map(label)).range([m.t, H - m.b]).padding(0.25);
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("role", "img");
    svg.append("g").selectAll("rect").data(rows).join("rect")
      .attr("x", m.l).attr("y", d => y(label(d))).attr("height", y.bandwidth()).attr("rx", 4)
      .attr("width", d => x(value(d)) - m.l).attr("fill", typeof color === "function" ? color : () => color);
    svg.append("g").selectAll("text").data(rows).join("text")
      .attr("x", m.l - 8).attr("y", d => y(label(d)) + y.bandwidth() / 2).attr("dy", "0.35em").attr("text-anchor", "end")
      .attr("font-size", 13).text(label);
    svg.append("g").selectAll("text").data(rows).join("text")
      .attr("x", d => x(value(d)) + 6).attr("y", d => y(label(d)) + y.bandwidth() / 2).attr("dy", "0.35em")
      .attr("font-size", 12).attr("fill", C.muted).text(d => fmtV(value(d)));
  }

  // ================================================================ HOME
  RENDER.home = function () {
    const mv = R.readers_vs_judges.major_vs_rest;
    $("#home-stats").innerHTML = [
      [fmt(R.overview.raw_rows), "books in the Goodreads Best Books Ever list (scraped 2020)"],
      [fmt(R.overview.canon_books), `books in our “reader canon” (${R.overview.canon_min_votes}+ reader votes each)`],
      [R.overview.major_winners_canon, "canon books that won the Booker, Pulitzer or National Book Award"],
      [`${mv.mean_major.toFixed(2)} vs ${mv.mean_rest.toFixed(2)}`, "average reader rating: prize winners vs everything else"],
    ].map(([b, s]) => `<div class="stat"><b>${b}</b><span>${s}</span></div>`).join("");
    const cl = R.clusters.clusters;
    const best = cl.slice().sort((a, b) => b.mean_rating - a.mean_rating).slice(0, 2);
    const lift = R.classifier.genre_lift_among_winners;
    $("#home-findings").innerHTML = [
      ["Readers don't rate prize winners higher",
        `Only ${R.readers_vs_judges.major_in_top_half.toFixed(0)}% of major-prize winners land in the top half of the canon by reader rating.`, "#judges"],
      ["Judges and readers love different genres",
        `Prize winners are ${lift["Classics"].toFixed(1)}× more likely to be tagged Classics, but ${Math.round(1 / lift["Young Adult"])}× less likely to be Young Adult. The readers' highest-rated groups — ${best.map(b => b.name.toLowerCase()).join(" and ")} — contain ${best.reduce((s, b) => s + b.major_winners, 0)} major winners.`, "#clusters"],
      ["Reader data can't predict a prize",
        `Our best model using only reader data scored an F1 of ${r2(R.classifier.reader_only[R.classifier.best_reader_only].test_f1)} out of 1. Adding genre tags helps more than any reader signal.`, "#predict"],
    ].map(([h, p, href]) => `<article class="card"><h3>${h}</h3><p>${p}</p><a class="more" href="${href}">See the evidence →</a></article>`).join("");
  };

  // ================================================================ FIND
  const COVER_COLORS = ["#3B4252", "#7A2E2E", "#1F4E5A", "#2E3A7A", "#5A4A1E", "#8A4B1C", "#2A2A2A", "#4B2E5A"];
  const VERDICT = {
    judges: ["Judges’ favourite", "#FDF1E5", "#7A3A08", "Prize judges crowned this book, but readers are cooler on it: it rates below the middle of the canon. Prize winners often reach readers who would not normally choose them, and those readers tend to rate them lower."],
    readers: ["Readers’ favourite", "#EDF2FC", "#163A86", "Readers rate this book above the middle of the canon, but it never won one of the three major literary prizes. Many of the most-loved books are young-adult, fantasy and children's titles that these prizes rarely consider."],
    both: ["Everyone agrees", "#E6F4EC", "#1D5B38", "A book that won a major prize and is also rated above the middle of the canon. Only about a third of major-prize winners reach this corner."],
    neither: ["Popular, but divisive", "#EEEFF2", "#2D313A", "Many readers know it, but its average rating is below the middle of the canon and it won no major literary prize. Being popular is not the same as being highly rated."],
  };
  function bookCard(b) {
    const v = VERDICT[b.q];
    const color = COVER_COLORS[Math.abs([...b.t].reduce((s, ch) => s + ch.charCodeAt(0), 0)) % COVER_COLORS.length];
    const cells = [["judges", "Judges’ favourite"], ["both", "Everyone agrees"], ["neither", "Popular, but divisive"], ["readers", "Readers’ favourite"]]
      .map(([k, l]) => `<div class="cell${k === b.q ? " on" : ""}">${l}</div>`).join("");
    const prize = b.m ? `${b.m}${b.my ? ", " + b.my : ""}` : "No major literary prize";
    const prizeNote = b.m ? "One of the three major English-language fiction prizes we compare against (checked against the official winners lists)."
      : (b.nw > 0 ? `It won ${b.nw} other award${b.nw > 1 ? "s" : ""}${b.gc ? ", including a Goodreads Choice Award voted by readers" : ""}, but not the Booker, Pulitzer or National Book Award.` : "No award wins are listed for this book on Goodreads.");
    const other = b.aw.length ? `<p class="note" style="margin-top:8px">Award wins listed on Goodreads: ${b.aw.map(esc).join("; ")}${b.nw > b.aw.length ? "…" : ""}</p>` : "";
    const pct = b.p ?? 0;
    return `<article class="book">
      <div class="book-head">
        <div class="cover" style="background:${color}" aria-hidden="true">${esc(b.t)}</div>
        <div class="book-title">
          <div class="kicker">${b.c ? "#" + fmt(b.rk) + " on the Best Books Ever list" : "On the list, outside our canon (fewer than 100 votes)"}</div>
          <h2>${esc(b.t)}</h2>
          <div>${esc(b.a)}${b.y != null ? " · first published " + (b.y < 0 ? Math.abs(b.y) + " BCE (approx.)" : b.y) : ""}</div>
          <div class="tags">${b.g.map(t => `<span class="tag">${esc(t)}</span>`).join("")}${b.s.length ? `<span class="tag">Set in: ${b.s.map(esc).join(", ").replace(" of America", "")}</span>` : ""}</div>
          <span class="verdict" style="background:${v[1]};color:${v[2]}">${v[0]}</span>
        </div>
      </div>
      <div class="two-col">
        <div class="side r"><div class="lbl">What readers think</div>
          <div style="display:flex;align-items:baseline;gap:10px;margin:8px 0"><span class="big">${b.r != null ? b.r.toFixed(2) : "–"}</span><span class="note" style="margin:0">out of 5, from ${fmt(b.n)} ratings</span></div>
          <div>Readers rate it higher than <strong>${pct}%</strong> of the books in the canon.</div>
          <div class="bar" aria-hidden="true"><div class="track"></div><div class="fill" style="width:${pct}%"></div><div class="knob" style="left:${pct}%"></div></div>
          <div class="bar-l"><span>Lowest-rated in canon</span><span>Highest-rated</span></div>
        </div>
        <div class="side j"><div class="lbl">What prize judges said</div>
          <div style="font-family:var(--display);font-weight:700;font-size:24px;line-height:1.2;margin:8px 0">${esc(prize)}</div>
          <div>${prizeNote}</div>${other}
        </div>
      </div>
      <div class="quad-wrap">
        <div class="quad"><div class="ylab">Prize judges ↑</div><div class="grid">${cells}</div><div class="xlab">Readers →</div></div>
        <div class="quad-text"><h3>${v[0]}</h3><p>${v[3]}</p><p class="note">“Above the middle” means a rating above the canon median of ${MED.toFixed(2)}.</p></div>
      </div>
    </article>`;
  }
  function showBook(id) {
    const b = BY_ID.get(id); if (!b) return;
    $("#find-card").innerHTML = bookCard(b);
    $("#find-results").innerHTML = "";
    $("#q").value = b.t;
  }
  RENDER.find = function () {
    const examples = ["The Road", "The Book Thief", "All the Light We Cannot See", "Twilight", "Beloved", "Harry Potter and the Sorcerer's Stone"];
    const chips = $("#find-chips");
    examples.forEach(t => {
      const b = BOOKS.find(x => x.t === t); if (!b) return;
      const btn = document.createElement("button"); btn.type = "button"; btn.className = "chip"; btn.textContent = t;
      btn.addEventListener("click", () => showBook(b.id)); chips.appendChild(btn);
    });
    const index = BOOKS.map(b => ({ b, key: (b.t + " " + b.a).toLowerCase() }));
    const q = $("#q");
    q.addEventListener("input", () => {
      const s = q.value.trim().toLowerCase();
      const ul = $("#find-results"); ul.innerHTML = "";
      if (s.length < 2) return;
      const terms = s.split(/\s+/);
      const hits = index.filter(x => terms.every(t => x.key.includes(t))).map(x => x.b)
        .sort((a, b) => (b.c - a.c) || (a.rk - b.rk)).slice(0, 8);
      if (!hits.length) { ul.innerHTML = `<li class="note">No match among the ${fmt(BOOKS.length)} best-known books on the list.</li>`; return; }
      hits.forEach(b => {
        const li = document.createElement("li"); const btn = document.createElement("button"); btn.type = "button";
        btn.innerHTML = `<span><strong>${esc(b.t)}</strong> <small>by ${esc(b.a)}</small></span><small>${b.r != null ? "★ " + b.r.toFixed(2) : ""}${b.m ? " · prize winner" : ""}</small>`;
        btn.addEventListener("click", () => showBook(b.id)); li.appendChild(btn); ul.appendChild(li);
      });
    });
    $("#search-form").addEventListener("submit", e => { e.preventDefault(); const first = $("#find-results button"); if (first) first.click(); });
    showBook(BOOKS.find(x => x.t === "The Road")?.id);
  };

  // ================================================================ GAME
  const ROUNDS = 5;
  let game = null;
  function newGame() {
    const winners = d3.shuffle(CANON.filter(b => b.m));
    const others = CANON.filter(b => !b.m);
    const rounds = winners.slice(0, ROUNDS).map(w => {
      const pool = others.filter(o => Math.abs(o.r - w.r) >= 0.15);
      const o = pool[Math.floor(Math.random() * pool.length)];
      return Math.random() < 0.5 ? [w, o] : [o, w];
    });
    game = { rounds, i: 0, picked: null, score: 0, prizeHigher: 0 };
    drawGame();
  }
  function drawGame() {
    const root = $("#game-root");
    if (game.i >= ROUNDS) {
      const mv = R.readers_vs_judges.major_vs_rest;
      root.innerHTML = `<div class="panel" style="max-width:780px">
        <div class="kicker">Your score</div><div class="big" style="font-size:64px">${game.score} / ${ROUNDS}</div>
        <h2 style="margin-top:14px">Prizes don't predict what readers love</h2>
        <p>In your game the prize winner was the reader favourite in ${game.prizeHigher} of ${ROUNDS} rounds. Across the whole canon, the ${mv.n_major} books that won the Pulitzer, Booker or National Book Award average <strong>${mv.mean_major.toFixed(2)}</strong> stars; the other ${mv.n_rest} average <strong>${mv.mean_rest.toFixed(2)}</strong>.</p>
        <div style="display:flex;flex-wrap:wrap;gap:12px;margin-top:10px"><button class="btn" id="g-again" type="button">Play again</button><a class="btn ghost" style="display:inline-flex;align-items:center;text-decoration:none" href="#judges">See the full analysis</a></div></div>`;
      $("#g-again").addEventListener("click", newGame);
      return;
    }
    const pair = game.rounds[game.i];
    const ans = game.picked !== null;
    const best = pair[0].r > pair[1].r ? 0 : 1;
    root.innerHTML = `
      <div style="display:flex;flex-wrap:wrap;justify-content:space-between;gap:10px;align-items:center">
        <div class="kicker" style="margin:0">Round ${game.i + 1} of ${ROUNDS}</div>
        <div class="progress">${d3.range(ROUNDS).map(k => `<i class="${k < game.i || (k === game.i && ans) ? "done" : ""}"></i>`).join("")}</div>
      </div>
      <h1 style="margin-top:8px">Which book do readers rate higher?</h1>
      <p class="lead">One of these won a major literary prize. Do readers agree with the judges?</p>
      <div class="game-cards">${pair.map((b, k) => `
        <button type="button" class="gcard ${ans ? (k === best ? "right" : (k === game.picked ? "wrong" : "")) : ""}" data-k="${k}" ${ans ? "disabled" : ""}>
          <span style="font-family:var(--display);font-weight:700;font-size:26px;line-height:1.15">${esc(b.t)}</span>
          <span class="note" style="margin:0">${esc(b.a)}${b.y != null && b.y > 0 ? " · " + b.y : ""}</span>
          <span class="badge ${b.m ? "major" : "none"}">${b.m ? esc(b.m) + (b.my ? " " + b.my : "") : "No major prize"}</span>
          <span class="tags">${b.g.slice(0, 3).map(t => `<span class="tag">${esc(t)}</span>`).join("")}</span>
          <span class="foot-row">${ans ? `<span><span class="big" style="font-size:34px;color:var(--blue)">${b.r.toFixed(2)}</span> <span class="note">reader rating</span></span><strong style="color:${k === best ? C.green : C.red}">${k === best ? "Readers’ pick" : (k === game.picked ? "Your guess" : "")}</strong>` : `<strong style="color:var(--blue)">Readers rate this one higher →</strong>`}</span>
        </button>`).join("")}</div>
      ${ans ? `<div class="result-bar"><div><strong style="font-family:var(--display);font-size:22px;color:${game.picked === best ? "#8FD9AE" : "#F2A65A"}">${game.picked === best ? "You read the readers right." : "Not this time."}</strong>
        <p>${pair[best].m ? "This time the judges' choice is also the readers' favourite." : "The prize winner is rated lower by Goodreads readers than a book that won no major prize."}</p></div>
        <button class="btn light" type="button" id="g-next">${game.i === ROUNDS - 1 ? "See your score" : "Next round"}</button></div>` : ""}`;
    root.querySelectorAll(".gcard").forEach(btn => btn.addEventListener("click", () => {
      if (game.picked !== null) return;
      game.picked = +btn.dataset.k;
      if (game.picked === best) game.score++;
      if (pair[best].m) game.prizeHigher++;
      drawGame();
    }));
    const nx = $("#g-next"); if (nx) nx.addEventListener("click", () => { game.i++; game.picked = null; drawGame(); });
  }
  RENDER.game = newGame;

  // ================================================================ GENRES
  RENDER.genres = function () {
    const ys = R.year_sources;
    $("#genres-lead").textContent = `Our canon is the ${fmt(R.overview.canon_books)} books that at least ${R.overview.canon_min_votes} people voted for. Classics and fantasy dominate, but which one depends on when the book was written.`;
    hbar("#chart-genres", R.genres_top, { label: d => d.genre, value: d => d.share, fmtV: d => d.toFixed(0) + "%" });
    const ge = R.genre_era;
    const el = d3.select("#chart-era"); el.selectAll("*").remove();
    const W = width("#chart-era"), m = { t: 44, r: 10, b: 10, l: Math.min(150, W * 0.3) };
    const cw = (W - m.l - m.r) / ge.eras.length, ch = 30, H = m.t + ge.genres.length * ch + m.b;
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    const max = d3.max(ge.share.flat());
    const col = d3.scaleSequential([0, max], d3.interpolateBlues);
    ge.eras.forEach((e, j) => {
      svg.append("text").attr("x", m.l + j * cw + cw / 2).attr("y", 16).attr("text-anchor", "middle").attr("font-size", 12).attr("font-weight", 600).text(e);
      svg.append("text").attr("x", m.l + j * cw + cw / 2).attr("y", 32).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", C.muted).text("n=" + ge.n_per_era[j]);
    });
    ge.genres.forEach((g, i) => {
      svg.append("text").attr("x", m.l - 8).attr("y", m.t + i * ch + ch / 2).attr("dy", "0.35em").attr("text-anchor", "end").attr("font-size", 13).text(g);
      ge.share[i].forEach((v, j) => {
        svg.append("rect").attr("x", m.l + j * cw + 1).attr("y", m.t + i * ch + 1).attr("width", cw - 2).attr("height", ch - 2).attr("rx", 3).attr("fill", col(v))
          .on("mousemove", e => showTip(e, `<strong>${esc(g)}</strong><br>${v.toFixed(0)}% of canon books from ${ge.eras[j]}`)).on("mouseleave", hideTip);
        svg.append("text").attr("x", m.l + j * cw + cw / 2).attr("y", m.t + i * ch + ch / 2).attr("dy", "0.35em").attr("text-anchor", "middle")
          .attr("font-size", 11).attr("pointer-events", "none").attr("fill", v > max * 0.55 ? "#fff" : C.ink).text(v.toFixed(0));
      });
    });
    const inferred = ys["firstPublishDate (century inferred)"] || 0, fb = ys["edition year (fallback)"] || 0, man = ys["manual check"] || 0;
    $("#era-note").textContent = `Percentage of canon books from each era carrying the tag. Era = first publication. The dataset stores most first-publication years without the century (“01/28/13” for Pride and Prejudice), so we inferred the century for ${inferred} books, checked ${man} classics by hand, and used the edition year for ${fb} books with no first-publication date.`;
    const gi = g => ge.genres.indexOf(g), last = ge.eras.length - 1;
    $("#era-takeaway").innerHTML = `Almost every pre-1950 canon book is tagged <strong>Classics</strong> (${ge.share[gi("Classics")][0].toFixed(0)}% before 1900), but from 2010 the canon is ${ge.share[gi("Young Adult")][last].toFixed(0)}% <strong>Young Adult</strong>, ${ge.share[gi("Fantasy")][last].toFixed(0)}% <strong>Fantasy</strong> and ${ge.share[gi("Romance")][last].toFixed(0)}% <strong>Romance</strong>. The reader canon is two canons: inherited school classics and the genre fiction readers choose for themselves.`;
  };

  // ================================================================ MAP
  const WORLD_URL = "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json";
  const NAME_FIX = { "Democratic Republic of the Congo": "Dem. Rep. Congo", "Bosnia and Herzegovina": "Bosnia and Herz.", "Dominican Republic": "Dominican Rep.",
    "Central African Republic": "Central African Rep.", "Ivory Coast": "Côte d'Ivoire", "North Macedonia": "Macedonia" };
  let world = null, mapSet = "canon";
  function topoFeatures(topo, name) {
    const tf = topo.transform;
    const arcs = topo.arcs.map(a => { let x = 0, y = 0; return a.map(p => tf ? (x += p[0], y += p[1], [x * tf.scale[0] + tf.translate[0], y * tf.scale[1] + tf.translate[1]]) : p); });
    const arc = i => i < 0 ? arcs[~i].slice().reverse() : arcs[i];
    const ring = r => { const out = []; r.forEach((i, k) => { const a = arc(i); (k ? a.slice(1) : a).forEach(p => out.push(p)); }); return out; };
    return topo.objects[name].geometries.map(g => ({ type: "Feature", properties: g.properties || {},
      geometry: g.type === "Polygon" ? { type: "Polygon", coordinates: g.arcs.map(ring) } : g.type === "MultiPolygon" ? { type: "MultiPolygon", coordinates: g.arcs.map(p => p.map(ring)) } : null }))
      .filter(f => f.geometry);
  }
  function drawMap() {
    const rows = R.settings[mapSet];
    const counts = new Map(rows.map(d => [NAME_FIX[d.country] || d.country, d.books]));
    hbar("#chart-countries", rows.slice(0, 15), { label: d => d.country.replace(" of America", ""), value: d => d.books, fmtV: fmt, color: C.orange, left: 150 });
    if (!world) return;
    const el = d3.select("#chart-map"); el.selectAll("*").remove();
    const W = width("#chart-map"), H = Math.round(W * 0.5);
    const proj = d3.geoNaturalEarth1().fitSize([W, H], { type: "Sphere" });
    const path = d3.geoPath(proj);
    const max = d3.max(rows, d => d.books);
    const col = d3.scaleSequentialLog([1, max], t => d3.interpolateOranges(0.15 + t * 0.85));
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H).attr("role", "img").attr("aria-label", "World map of book settings");
    svg.append("path").attr("d", path({ type: "Sphere" })).attr("fill", "#F8FAFC").attr("stroke", C.line);
    svg.append("g").selectAll("path").data(world).join("path").attr("d", path)
      .attr("fill", f => counts.has(f.properties.name) ? col(counts.get(f.properties.name)) : "#E9ECF1").attr("stroke", "#fff").attr("stroke-width", 0.5)
      .on("mousemove", (e, f) => showTip(e, `<strong>${esc(f.properties.name)}</strong><br>${counts.has(f.properties.name) ? fmt(counts.get(f.properties.name)) + " books set here" : "no books"}`))
      .on("mouseleave", hideTip);
  }
  RENDER.map = function () {
    const s = R.settings;
    $("#map-lead").textContent = `Goodreads readers can tag where a book is set. ${s.canon_with_country} of the ${R.overview.canon_books} canon books have a usable country. ${s.us_uk_share_canon.toFixed(0)}% of all country tags in the canon point to the United States or the United Kingdom — this is an English-language readers' canon.`;
    document.querySelectorAll(".tg").forEach(b => b.onclick = () => {
      mapSet = b.dataset.set; document.querySelectorAll(".tg").forEach(x => x.classList.toggle("on", x === b)); drawMap();
    });
    drawMap();
    if (!world) {
      $("#map-status").textContent = "Loading world map outline…";
      fetch(WORLD_URL).then(r => r.json()).then(t => { world = topoFeatures(t, "countries"); $("#map-status").textContent = "Darker = more books set there (log scale). Map outline: Natural Earth via world-atlas."; drawMap(); })
        .catch(() => { d3.select("#chart-map").style("min-height", "0px"); $("#map-status").textContent = "The world map outline could not be loaded (it needs an internet connection). The ranked list below shows the same data."; });
    }
  };

  // ================================================================ JUDGES
  function groupOf(b) { return b.m ? 0 : b.nw > 0 ? 1 : b.ga ? 2 : 3; }
  RENDER.judges = function () {
    const J = R.readers_vs_judges, mv = J.major_vs_rest;
    $("#judges-lead").innerHTML = `We compared the ${mv.n_major} canon books that won the <strong>Booker Prize</strong>, the <strong>Pulitzer Prize for Fiction</strong> or the <strong>National Book Award for Fiction</strong> with the other ${mv.n_rest}. Readers do not rate the judges' choices higher. If anything, they rate them slightly lower.`;
    // strip plot
    const G = J.groups.map(g => g.group);
    const el = d3.select("#chart-groups"); el.selectAll("*").remove();
    const W = width("#chart-groups"), rowH = 78, m = { t: 10, r: 20, b: 40, l: Math.min(200, W * 0.36) }, H = m.t + G.length * rowH + m.b;
    const x = d3.scaleLinear().domain(d3.extent(CANON, d => d.r)).nice().range([m.l, W - m.r]);
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6)).call(g => g.select(".domain").attr("stroke", C.line));
    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 6).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", C.muted).text("Goodreads average rating");
    const cols = [C.orange, "#E8A66B", "#8FA6DC", C.blue];
    G.forEach((g, i) => {
      const cy = m.t + i * rowH + rowH / 2;
      const pts = CANON.filter(b => groupOf(b) === i);
      const st = J.groups[i];
      svg.append("text").attr("x", m.l - 10).attr("y", cy - 6).attr("text-anchor", "end").attr("font-size", 13).attr("font-weight", 600).text(g);
      svg.append("text").attr("x", m.l - 10).attr("y", cy + 12).attr("text-anchor", "end").attr("font-size", 12).attr("fill", C.muted).text(`n=${st.books} · median ${st.median.toFixed(2)}`);
      svg.append("g").selectAll("circle").data(pts).join("circle")
        .attr("cx", d => x(d.r)).attr("cy", () => cy + (Math.random() - 0.5) * rowH * 0.6).attr("r", i === 0 ? 5 : 3.2)
        .attr("fill", cols[i]).attr("fill-opacity", i === 0 ? 0.9 : 0.55)
        .on("mousemove", (e, d) => showTip(e, `<strong>${esc(d.t)}</strong><br>${esc(d.a)}<br>★ ${d.r.toFixed(2)}${d.m ? "<br>" + esc(d.m) : ""}`)).on("mouseleave", hideTip)
        .on("click", (e, d) => { location.hash = "#find"; setTimeout(() => showBook(d.id), 30); });
      svg.append("line").attr("x1", x(st.median)).attr("x2", x(st.median)).attr("y1", cy - rowH * 0.38).attr("y2", cy + rowH * 0.38).attr("stroke", C.ink).attr("stroke-width", 3);
    });
    $("#groups-takeaway").innerHTML = `Major-prize winners have the <strong>lowest median rating</strong> of the four groups (${J.groups[0].median.toFixed(2)} vs ${J.groups[1].median.toFixed(2)}–${Math.max(J.groups[2].median, J.groups[3].median).toFixed(2)}). Only ${J.major_in_top_half.toFixed(0)}% of them are rated above the canon's middle value.`;

    // votes vs rating scatter
    const el2 = d3.select("#chart-votes"); el2.selectAll("*").remove();
    const W2 = width("#chart-votes"), H2 = Math.min(420, W2 * 0.6), m2 = { t: 10, r: 20, b: 44, l: 52 };
    const x2 = d3.scaleLog().domain(d3.extent(CANON, d => d.v)).nice().range([m2.l, W2 - m2.r]);
    const y2 = d3.scaleLinear().domain(d3.extent(CANON, d => d.r)).nice().range([H2 - m2.b, m2.t]);
    const s2 = el2.append("svg").attr("viewBox", `0 0 ${W2} ${H2}`).attr("width", W2).attr("height", H2);
    s2.append("g").attr("transform", `translate(0,${H2 - m2.b})`).call(d3.axisBottom(x2).ticks(5, "~s"));
    s2.append("g").attr("transform", `translate(${m2.l},0)`).call(d3.axisLeft(y2).ticks(6));
    s2.append("text").attr("x", (m2.l + W2) / 2).attr("y", H2 - 8).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", C.muted).text("Votes on the Best Books Ever list");
    s2.append("text").attr("transform", "rotate(-90)").attr("x", -(H2 - m2.b) / 2).attr("y", 14).attr("text-anchor", "middle").attr("font-size", 12).attr("fill", C.muted).text("Average rating");
    s2.append("g").selectAll("circle").data(CANON.slice().sort((a, b) => !!a.m - !!b.m)).join("circle")
      .attr("cx", d => x2(d.v)).attr("cy", d => y2(d.r)).attr("r", d => d.m ? 5 : 3)
      .attr("fill", d => d.m ? C.orange : C.blue).attr("fill-opacity", d => d.m ? 0.95 : 0.35)
      .on("mousemove", (e, d) => showTip(e, `<strong>${esc(d.t)}</strong><br>${fmt(d.v)} votes · ★ ${d.r.toFixed(2)}`)).on("mouseleave", hideTip);
    const sp = J.votes_vs_rating_spearman;
    $("#votes-takeaway").innerHTML = `There is almost no link between how many people voted a book onto the list and how highly it is rated (Spearman's ρ = ${sp.rho.toFixed(2)}). <em>Twilight</em> is in the top five by votes but near the bottom by rating.`;

    const cv = J.choice_vs_juried;
    $("#choice-box").innerHTML = `
      <div class="side r"><div class="lbl">Readers' prize</div><div class="big">${cv.mean_choice.toFixed(2)}</div><div>average rating of the ${cv.n_choice_winners} canon books that won a <strong>Goodreads Choice Award</strong> (voted by readers)</div></div>
      <div class="side j"><div class="lbl">Judges' prizes</div><div class="big">${cv.mean_major.toFixed(2)}</div><div>average rating of the ${mv.n_major} canon books that won the Booker, Pulitzer or National Book Award (chosen by judges)</div></div>
      <p class="note" style="grid-column:1/-1;margin:0">The readers' prize winners are rated higher, but with so few books the difference is not statistically reliable (${pTxt(cv.p)}). Treat it as a pattern to test with more data.</p>`;

    const pop = J.popularity_major_vs_rest, wc = J.wide_check;
    $("#judges-stats").innerHTML = `
      <p>Ratings are not normally distributed and the groups are very different in size, so we used the <strong>Mann–Whitney U test</strong> (does one group tend to have higher values?) and <strong>Cliff's delta</strong> as the effect size (−1 to +1; below 0.147 is negligible, below 0.33 small).</p>
      <div class="tablebox"><table><thead><tr><th>Comparison</th><th class="num">Group A</th><th class="num">Group B</th><th class="num">p-value</th><th class="num">Cliff's δ</th></tr></thead><tbody>
      <tr><td>Rating: major winners vs rest of canon (n=${mv.n_major} vs ${mv.n_rest})</td><td class="num">${mv.mean_major.toFixed(2)}</td><td class="num">${mv.mean_rest.toFixed(2)}</td><td class="num">${mv.p.toFixed(3)}</td><td class="num">${mv.cliffs_delta.toFixed(2)} (${mv.effect})</td></tr>
      <tr><td>Same test on all ${fmt(wc.n_books)} books with 10,000+ ratings (${wc.n_major} winners)</td><td class="num">${wc.mean_major.toFixed(2)}</td><td class="num">${wc.mean_rest.toFixed(2)}</td><td class="num">${pTxt(wc.p).replace("p = ", "").replace("p ", "")}</td><td class="num">${wc.cliffs_delta.toFixed(2)} (${wc.effect})</td></tr>
      <tr><td>Number of ratings: major winners vs rest (median)</td><td class="num">${fmt(pop.median_ratings_major)}</td><td class="num">${fmt(pop.median_ratings_rest)}</td><td class="num">${pop.p.toFixed(3)}</td><td class="num">${pop.cliffs_delta.toFixed(2)} (${pop.effect})</td></tr>
      <tr><td>Goodreads Choice winners vs major-prize winners</td><td class="num">${cv.mean_choice.toFixed(2)}</td><td class="num">${cv.mean_major.toFixed(2)}</td><td class="num">${cv.p.toFixed(3)}</td><td class="num">${cv.cliffs_delta.toFixed(2)} (${cv.effect})</td></tr>
      </tbody></table></div>
      <p>Inside the 905-book canon the gap is small and not significant at the 5% level. On the wider set of ${fmt(wc.n_books)} popular books it is significant: prize winners are rated slightly <em>lower</em>. Either way, winning a major prize does not mean readers rate a book higher.</p>`;
  };

  // ================================================================ PREDICT
  RENDER.predict = function () {
    const K = R.classifier;
    const ro = K.reader_only, wg = K.with_genre;
    $("#predict-lead").innerHTML = `We trained three scikit-learn models on ${fmt(K.n_books)} popular fiction books (1,000+ ratings), ${K.n_winners} of which won a major prize. First the models saw only <strong>reader data</strong> (rating, number of ratings, share of 5-star and 1–2-star ratings, % liked, length). Then we added each book's <strong>genre tags</strong>. If readers and judges valued the same things, reader data alone should find the winners.`;
    const rows = Object.keys(ro).map(k => `<tr><td>${k}</td><td class="num">${r2(ro[k].test_f1)}</td><td class="num">${r2(wg[k].test_f1)}</td><td class="num">${pctTxt(wg[k].precision)}</td><td class="num">${pctTxt(wg[k].recall)}</td></tr>`).join("");
    $("#model-table").innerHTML = `<div class="tablebox"><table><thead><tr><th>Model (tuned with GridSearchCV)</th><th class="num">F1 — reader data only</th><th class="num">F1 — + genre tags</th><th class="num">Precision (+ genres)</th><th class="num">Recall (+ genres)</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="takeaway">Reader data alone almost cannot tell winners apart (best F1 ${r2(ro[K.best_reader_only].test_f1)}). Adding genre tags raises the score (best F1 ${r2(wg[K.best_with_genre].test_f1)}) — what kind of book it is matters more to the judges than how much readers like it. Even the best model is weak, which is itself the finding.</p>`;
    const cm = wg[K.best_with_genre].confusion;
    $("#confusion").innerHTML = `<p class="note">${K.best_with_genre} with genre tags, on the ${fmt(cm[0][0] + cm[0][1] + cm[1][0] + cm[1][1])} test books.</p>
      <div class="confusion"><div class="h"></div><div class="h">Model said: no prize</div><div class="h">Model said: prize</div>
      <div class="h">Really no prize</div><div class="good"><b>${fmt(cm[0][0])}</b>correct</div><div class="bad"><b>${fmt(cm[0][1])}</b>false alarms</div>
      <div class="h">Really won</div><div class="bad"><b>${cm[1][0]}</b>missed</div><div class="good"><b>${cm[1][1]}</b>found</div></div>`;
    const READER = new Set(["rating", "log_ratings", "likedPercent", "share_5star", "share_1_2star", "pages"]);
    const NICE = { rating: "Average rating", log_ratings: "Number of ratings (log)", likedPercent: "% who liked it", share_5star: "Share of 5★ ratings", share_1_2star: "Share of 1–2★ ratings", pages: "Length (pages)" };
    hbar("#chart-importance", K.top_features, { label: d => NICE[d.feature] || "Genre: " + d.feature, value: d => d.importance, fmtV: d3.format(".3f"), color: d => READER.has(d.feature) ? C.blue : C.orange, left: 190 });
    const lift = Object.entries(K.genre_lift_among_winners).map(([g, v]) => ({ g, v })).sort((a, b) => b.v - a.v);
    const el = d3.select("#chart-lift"); el.selectAll("*").remove();
    const W = width("#chart-lift"), rowH = 34, m = { t: 24, r: 70, b: 10, l: Math.min(160, W * 0.32) }, H = m.t + lift.length * rowH + m.b;
    const x = d3.scaleLog().domain([0.03, 4]).range([m.l, W - m.r]);
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H);
    svg.append("line").attr("x1", x(1)).attr("x2", x(1)).attr("y1", m.t - 6).attr("y2", H - m.b).attr("stroke", C.ink);
    svg.append("text").attr("x", x(1)).attr("y", 12).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", C.muted).text("same as average");
    lift.forEach((d, i) => {
      const y = m.t + i * rowH;
      svg.append("rect").attr("x", Math.min(x(1), x(d.v))).attr("y", y + 5).attr("height", rowH - 12).attr("width", Math.abs(x(d.v) - x(1))).attr("rx", 4).attr("fill", d.v >= 1 ? C.orange : C.blue);
      svg.append("text").attr("x", m.l - 8).attr("y", y + rowH / 2).attr("dy", "0.2em").attr("text-anchor", "end").attr("font-size", 13).text(d.g);
      svg.append("text").attr("x", d.v >= 1 ? x(d.v) + 6 : x(1) + 6).attr("y", y + rowH / 2).attr("dy", "0.2em").attr("font-size", 12).attr("fill", C.muted)
        .text(d.v >= 1 ? `${d.v.toFixed(1)}× more likely` : `${(1 / d.v).toFixed(0)}× less likely`);
    });
    $("#lift-takeaway").innerHTML = `Judges reward <strong>classic and historical fiction</strong>; the genres that dominate readers' recent canon — <strong>young adult, fantasy and romance</strong> — almost never win these prizes.`;
  };

  // ================================================================ CLUSTERS
  RENDER.clusters = function () {
    const CL = R.clusters, byId = new Map(CL.clusters.map(c => [c.id, c]));
    $("#clusters-lead").textContent = `Goodreads genres are not set by publishers or librarians: readers add them as personal “shelves”. We grouped the canon by these tags with K-means clustering to see which genres readers themselves recognise.`;
    $("#clusters-note").innerHTML = `Each dot is a canon book. PCA squeezes each book's ${CL.vocab_size} genre tags into two numbers (the axes), so books with similar tags sit close together; the axis values themselves have no unit. K-means with k=${CL.k} was chosen by silhouette score (${CL.silhouette[CL.k].toFixed(2)}). Scores this low mean the groups overlap — readers' genres blur into each other. Hover a dot to see the book.`;
    const pts = CL.points;
    const el = d3.select("#chart-clusters"); el.selectAll("*").remove();
    const ev = CL.explained_variance;
    const W = width("#chart-clusters"), narrow = W < 600, H = Math.min(540, Math.max(320, W * 0.68)), m = { t: 12, r: 16, b: 52, l: narrow ? 50 : 58 };
    const x = d3.scaleLinear().domain(d3.extent(pts, d => d.x)).nice().range([m.l, W - m.r]);
    const y = d3.scaleLinear().domain(d3.extent(pts, d => d.y)).nice().range([H - m.b, m.t]);
    const svg = el.append("svg").attr("viewBox", `0 0 ${W} ${H}`).attr("width", W).attr("height", H)
      .attr("role", "img").attr("aria-label", "Scatter plot of canon books by PCA component 1 and 2, coloured by K-means cluster");
    // light grid + axes
    svg.append("g").attr("stroke", C.line).attr("stroke-opacity", 0.7)
      .call(g => g.selectAll("line.v").data(x.ticks(6)).join("line").attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", m.t).attr("y2", H - m.b))
      .call(g => g.selectAll("line.h").data(y.ticks(6)).join("line").attr("y1", d => y(d)).attr("y2", d => y(d)).attr("x1", m.l).attr("x2", W - m.r));
    svg.append("g").attr("transform", `translate(0,${H - m.b})`).call(d3.axisBottom(x).ticks(6)).call(g => g.selectAll("text").attr("font-size", 12).attr("fill", C.muted));
    svg.append("g").attr("transform", `translate(${m.l},0)`).call(d3.axisLeft(y).ticks(6)).call(g => g.selectAll("text").attr("font-size", 12).attr("fill", C.muted));
    svg.append("text").attr("x", (m.l + W - m.r) / 2).attr("y", H - 10).attr("text-anchor", "middle").attr("font-size", 13).attr("fill", C.ink)
      .text(narrow ? `Component 1 (${Math.round(ev[0] * 100)}%)` : `Principal component 1 (${Math.round(ev[0] * 100)}% of variation in genre tags)`);
    svg.append("text").attr("transform", "rotate(-90)").attr("x", -(m.t + H - m.b) / 2).attr("y", 16).attr("text-anchor", "middle").attr("font-size", 13).attr("fill", C.ink)
      .text(narrow ? `Component 2 (${Math.round(ev[1] * 100)}%)` : `Principal component 2 (${Math.round(ev[1] * 100)}%)`);
    svg.append("g").selectAll("circle").data(pts).join("circle")
      .attr("cx", d => x(d.x) + (Math.random() - 0.5) * 6).attr("cy", d => y(d.y) + (Math.random() - 0.5) * 6).attr("r", 4.2)
      .attr("fill", d => CLUSTER_COLORS[d.c]).attr("fill-opacity", 0.75)
      .on("mousemove", (e, d) => { const b = BY_ID.get(d.id); showTip(e, `<strong>${esc(b ? b.t : d.id)}</strong><br>${esc(byId.get(d.c).name)}`); }).on("mouseleave", hideTip);
    // colour key
    d3.select("#chart-clusters").append("div").attr("class", "legend")
      .html(CL.clusters.slice().sort((a, b) => b.books - a.books).map(c => `<span><i style="background:${CLUSTER_COLORS[c.id]}"></i>${esc(c.name)}</span>`).join(""));
    $("#cluster-cards").innerHTML = CL.clusters.slice().sort((a, b) => b.books - a.books).map(c => `
      <article class="card" style="border-top:6px solid ${CLUSTER_COLORS[c.id]}">
        <h3>${esc(c.name)}</h3>
        <p class="note" style="margin:0">${c.books} books · average rating ${c.mean_rating.toFixed(2)} · <strong>${c.major_winners}</strong> major-prize winner${c.major_winners === 1 ? "" : "s"}</p>
        <div class="tags">${c.top_tags.map(t => `<span class="tag">${esc(t.tag)} ${t.share}%</span>`).join("")}</div>
        <p style="font-size:14px">e.g. ${c.examples.slice(0, 3).map(t => "<em>" + esc(t) + "</em>").join(", ")}</p>
      </article>`).join("");
  };

  // ================================================================ METHOD
  RENDER.method = function () {
    const log = R.overview.cleaning_log.map(esc).join("\n");
    $("#method-root").innerHTML = `
      <p class="lead">Every number on this site comes from three Python scripts that anyone can re-run. Here is what they do, and what the data cannot tell us.</p>
      <div class="panel"><h2>The pipeline</h2><ol class="steps">
        <li><strong>Collect.</strong> We reuse a published dataset: 52,478 books scraped from Goodreads' “Best Books Ever” list on 1–3 November 2020 (Zenodo, CC BY-NC 4.0). We did not scrape Goodreads ourselves; its terms of use forbid it.</li>
        <li><strong>Scrape the prize lists</strong> (<code>01_scrape_prizes.py</code>, BeautifulSoup). We collected the official winners of the Booker Prize, Pulitzer Prize for Fiction and National Book Award for Fiction from Wikipedia, to check the Goodreads awards field against an independent source.</li>
        <li><strong>Clean</strong> (<code>02_clean.py</code>, pandas). Remove duplicates, turn list-like text into real lists, replace placeholder values with “missing”, repair dates, build long tables for genres, awards and settings, and save everything to a SQLite database.</li>
        <li><strong>Analyse</strong> (<code>03_analysis.py</code>, pandas pivot tables, SciPy, scikit-learn, Matplotlib). Genre and era tables, setting map, Mann–Whitney tests, three classifiers tuned with GridSearchCV, and K-means + PCA.</li>
        <li><strong>Publish</strong> this website (HTML, CSS, JavaScript and d3), which reads one data file exported by step 4.</li></ol></div>
      <div class="panel"><h2>Cleaning log</h2><p class="note">Printed by <code>02_clean.py</code> on the original file.</p><div class="log">${log}</div></div>
      <div class="panel"><h2>Checking the awards field</h2>
        <p>We matched Goodreads books to the official winners lists by title and author surname: ${R.validation.matched_wins} prize wins matched, and for ${R.validation.field_agrees_pct.toFixed(0)}% of them the Goodreads awards field agreed. Going the other way, ${R.validation.unconfirmed_claims} books claim a major win that the official lists do not confirm. Each has an explanation: a 1930s bookseller award also called the “National Book Award”, the special “Lost Booker” of 2010, the Russian and Arabic Booker prizes, and collections published under a different title. One true win (<em>Schindler's Ark</em>, sold in the US as <em>Schindler's List</em>) needed a title alias to match.</p></div>
      <div class="panel"><h2>Limits of this data</h2><ul>
        <li><strong>Whose canon?</strong> Goodreads is used mainly by English-speaking readers, and its reviewers are mostly women in most genres (Thelwall 2019). This is one online community's canon, not “everyone's”.</li>
        <li><strong>A snapshot from 2020.</strong> Votes and ratings keep changing; the list rewards books that were popular on Goodreads early.</li>
        <li><strong>Three prizes stand in for “judges”.</strong> All three are English-language prizes from the US and UK. Other prizes, other languages and other judging cultures might give different answers.</li>
        <li><strong>Dates.</strong> First-publication years lost their century in the source file. We inferred it with rules and checked ${R.year_sources["manual check"] || 0} classics by hand; era results for individual books may still be off.</li>
        <li><strong>Settings</strong> are tagged for only part of the canon (${R.settings.canon_with_country} of ${R.overview.canon_books} books), so the map shows what readers chose to tag.</li>
        <li><strong>Prize winners read differently.</strong> Kovács &amp; Sharkey (2014) found that winning a prize brings in new readers who rate the book lower, so a lower rating does not simply mean a “worse” book.</li></ul></div>
      <div class="panel"><h2>Sources</h2><ul>
        <li>Casanova Lozano, L. &amp; Costa Planells, S. (2020). Best Books Ever Dataset. Zenodo. <a href="https://doi.org/10.5281/zenodo.4265096">doi:10.5281/zenodo.4265096</a></li>
        <li>Wikipedia: <a href="https://en.wikipedia.org/wiki/Booker_Prize">Booker Prize</a>, <a href="https://en.wikipedia.org/wiki/Pulitzer_Prize_for_Fiction">Pulitzer Prize for Fiction</a>, <a href="https://en.wikipedia.org/wiki/National_Book_Award_for_Fiction">National Book Award for Fiction</a> (accessed 31 October 2026).</li>
        <li>Kovács, B. &amp; Sharkey, A. J. (2014). The Paradox of Publicity: How Awards Can Negatively Affect the Evaluation of Quality. <em>Administrative Science Quarterly</em> 59(1).</li>
        <li>Walsh, M. &amp; Antoniak, M. (2021). The Goodreads “Classics”: A Computational Study of Readers, Amazon, and Crowdsourced Amateur Criticism. <em>Journal of Cultural Analytics</em>.</li>
        <li>English, J. F. (2005). <em>The Economy of Prestige: Prizes, Awards, and the Circulation of Cultural Value</em>. Harvard University Press.</li>
        <li>Map outline: Natural Earth via the world-atlas package. Charts: d3.js (ISC licence).</li></ul></div>`;
  };

  route();
  window.addEventListener("load", () => window.scrollTo(0, 0));
})();
