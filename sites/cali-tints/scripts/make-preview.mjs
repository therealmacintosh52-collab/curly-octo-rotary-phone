/**
 * Bundle the built site into ONE self-contained HTML file.
 *
 *   node scripts/make-preview.mjs                      -> preview.html
 *   node scripts/make-preview.mjs out.html --fragment  -> no <html>/<head>/<body>
 *
 * For showing the owner the whole site before a domain exists: every page, the
 * CSS and the images in a single file with a hash router, no server needed.
 *
 * The motion bundle (GSAP/Lenis) is intentionally dropped — it is progressive
 * enhancement, it dynamically imports chunks that cannot exist in one file, and
 * nothing on the page depends on it. Nav, forms and the hero all still work.
 */
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const DIST = path.join(ROOT, 'dist');
const args = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const FRAGMENT = process.argv.includes('--fragment');
const OUT = args[0] || path.join(ROOT, 'preview.html');
const S = JSON.parse(readFileSync(path.join(ROOT, 'src/data/site.json'), 'utf8')).site;

if (!existsSync(DIST)) { console.error('Run npm run build first.'); process.exit(1); }

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml', '.webp': 'image/webp', '.avif': 'image/avif' };

function walk(dir, out = []) {
  for (const e of readdirSync(dir)) {
    const f = path.join(dir, e);
    if (statSync(f).isDirectory()) { if (!['static', 'fonts'].includes(e)) walk(f, out); }
    else if (e === 'index.html') out.push(f);
  }
  return out;
}

const files = walk(DIST).sort();
let css = '';
const assets = {};
const templates = [];

const MAP_PLACEHOLDER =
  '<div class="map-frame" style="display:grid;place-items:center;text-align:center;padding:32px;color:#c3cbe8">' +
  '<div><strong style="display:block;font-size:1.05rem;color:#fff;margin-bottom:6px">Google map of ' +
  S.street + '</strong>The live site embeds the real map here. This preview is a single offline file, ' +
  'so it cannot load one.</div></div>';

for (const file of files) {
  const html = readFileSync(file, 'utf8');
  const route = '/' + path.relative(DIST, file).replace(/\\/g, '/').replace(/index\.html$/, '');

  if (!css) css = (html.match(/<style>([\s\S]*?)<\/style>/) || [, ''])[1];

  let body = html.split('<body>')[1].split('</body>')[0];
  body = body.replace(/<script[^>]*type="module"[^>]*><\/script>/g, '');
  body = body.replace(/<iframe class="map-frame"[\s\S]*?<\/iframe>/g, MAP_PLACEHOLDER);
  // The hero video is inlined as a data URI further down, so the preview
  // actually plays rather than looking like a still. The tap-to-play cue is
  // dropped: the preview has no retry logic behind it.
  body = body.replace(/<button class="hero-v__tap"[\s\S]*?<\/button>/g, '');
  // <picture> sources cannot be rewritten per-format cheaply; keep the img only.
  body = body.replace(/<source[^>]*>/g, '');
  // hand images to the router as data-src so each data URI is stored once
  body = body.replace(/src="\/assets\/img\//g, 'data-src="/assets/img/');
  templates.push(`<template data-route="${route}">${body}</template>`);
}

// collect every referenced image once
for (const t of templates) {
  for (const m of t.matchAll(/data-src="(\/assets\/img\/[^"]+)"/g)) {
    const ref = m[1];
    if (assets[ref]) continue;
    const f = path.join(DIST, ref.slice(1));
    const ext = path.extname(ref).toLowerCase();
    if (existsSync(f) && MIME[ext]) {
      assets[ref] = `data:${MIME[ext]};base64,${readFileSync(f).toString('base64')}`;
    }
  }
}

// Both formats, negotiated at runtime exactly as the live site does. Inlining
// only the MP4 would be untestable here (this Chromium has no H.264 decoder)
// and inlining only the WebM would risk Safari. Base64 adds about a third; the
// pair still lands well inside the 16 MB page budget.
const videoSources = [
  ['assets/video/shop.webm', 'video/webm', 'video/webm; codecs="vp9"'],
  ['assets/video/shop.mp4', 'video/mp4', 'video/mp4; codecs="avc1.42E01E"'],
]
  .map(([rel, mime, canPlay]) => {
    const f = path.join(DIST, rel);
    if (!existsSync(f)) return null;
    return { canPlay, uri: `data:${mime};base64,${readFileSync(f).toString('base64')}` };
  })
  .filter(Boolean);

const router = `
(function () {
  "use strict";
  var ASSETS = ${JSON.stringify(assets)};
  var HERO_SOURCES = ${JSON.stringify(videoSources)};
  var PHONE = ${JSON.stringify(S.phone_display)};
  var app = document.getElementById("app"), views = {};
  Array.prototype.forEach.call(document.querySelectorAll("template[data-route]"), function (t) {
    views[t.getAttribute("data-route")] = t.innerHTML;
  });
  function routeFor(href) {
    var p = href.split("#")[0].split("?")[0];
    if (!p) return "/";
    if (views[p]) return p;
    if (views[p + "/"]) return p + "/";
    return "/404/";
  }
  function wire() {
    Array.prototype.forEach.call(app.querySelectorAll("[data-src]"), function (el) {
      var k = el.getAttribute("data-src");
      if (ASSETS[k]) { el.setAttribute("src", ASSETS[k]); el.removeAttribute("data-src"); }
    });
    var vid = app.querySelector("[data-hero-video]");
    var pick = null;
    for (var i = 0; i < HERO_SOURCES.length; i++) {
      if (vid && vid.canPlayType(HERO_SOURCES[i].canPlay) !== "") { pick = HERO_SOURCES[i]; break; }
    }
    if (vid && pick) {
      vid.muted = true; vid.defaultMuted = true; vid.loop = true;
      vid.setAttribute("muted", ""); vid.setAttribute("playsinline", "");
      vid.src = pick.uri;
      var hero = app.querySelector("[data-hero]");
      var go = function () {
        var p = vid.play();
        if (p && p.then) p.then(function () { if (hero) hero.classList.add("is-playing"); })
                          .catch(function () {});
      };
      vid.addEventListener("canplay", go);
      go();
    }
    var t = app.querySelector(".nav-toggle"), n = app.querySelector("#primary-nav");
    if (t && n) t.addEventListener("click", function () {
      var open = n.classList.toggle("open");
      t.setAttribute("aria-expanded", open ? "true" : "false");
    });
    Array.prototype.forEach.call(app.querySelectorAll("[data-year]"), function (y) {
      y.textContent = new Date().getFullYear();
    });
    Array.prototype.forEach.call(app.querySelectorAll("form[data-quote-form]"), function (f) {
      f.addEventListener("submit", function (e) {
        e.preventDefault();
        var s = f.querySelector(".form-status");
        if (s) {
          s.textContent = "Preview only — on the live site this request goes straight to the shop. Call " + PHONE + ".";
          s.className = "form-status show ok";
        }
      });
    });
  }
  function render(p, anchor) {
    app.innerHTML = views[p] || views["/404/"];
    wire();
    var tgt = anchor && document.getElementById(anchor);
    if (tgt) tgt.scrollIntoView(); else window.scrollTo(0, 0);
  }
  document.addEventListener("click", function (e) {
    var a = e.target.closest && e.target.closest("a");
    if (!a) return;
    var href = a.getAttribute("href") || "";
    if (href.charAt(0) === "#") {
      var el = document.getElementById(href.slice(1));
      if (el) { e.preventDefault(); el.scrollIntoView({behavior:"smooth"}); }
      return;
    }
    if (href.charAt(0) !== "/") return;
    e.preventDefault();
    var hash = href.split("#")[1];
    window.location.hash = "#" + routeFor(href) + (hash ? "#" + hash : "");
  });
  function fromHash() {
    var raw = (window.location.hash || "").replace(/^#/, "").split("#");
    var p = raw[0] || "/";
    render(views[p] ? p : routeFor(p), raw[1] || null);
  }
  window.addEventListener("hashchange", fromHash);
  fromHash();
})();`;

const core = `<title>Cali Tints</title>\n<style>\n${css}\n</style>\n` +
             `<div id="app"></div>\n${templates.join('\n')}\n<script>${router}</script>\n`;

const page = FRAGMENT ? core
  : `<!DOCTYPE html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n` +
    `<meta name="viewport" content="width=device-width, initial-scale=1">\n` +
    core.replace('<div id="app"></div>', '</head>\n<body>\n<div id="app"></div>') +
    `</body>\n</html>\n`;

writeFileSync(OUT, page);
console.log(`${OUT} — ${(statSync(OUT).size / 1024 / 1024).toFixed(2)} MB, ${templates.length} pages, ` +
            `${Object.keys(assets).length} images + ${videoSources.length} video format(s) inlined` +
            `${FRAGMENT ? ', fragment' : ''}`);
