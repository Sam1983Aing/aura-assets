/* ============================================================================
   KAYA. Scroll choreography
   ----------------------------------------------------------------------------
   ONE motion personality, set here and mirrored as --ease in styles.css:
   expo.out, a 1.15s reveal, and a Lenis duration of 1.4 so the scroll carries
   real weight. Nothing in this file uses a different ease.

   The three authored moments:
     0  the dive: the hero pins, the scene's camera flies forward into the
        blossom, the hero's own interface is thrown outward past the lens, and
        chapter 01 comes up through the canopy as the ground goes transparent
     A  the bath-house plan that draws itself over the photograph (initPlan)
     B  the pinned day, where scroll scrubs the light from afternoon through
        the night to the next dawn (initDay)

   Where to adjust, in one place each:
     SCROLL_WEIGHT   how heavy the scroll feels
     DIVE_LENGTH     how long the hero holds while the camera flies in
     DIVE_Z_END      how far in it flies. Lower goes deeper into the blossom
     EASE / REVEAL   the motion personality
     DAY_LENGTH      how long the pinned day holds
     PARALLAX        depth of the image parallax
     --grain-opacity in styles.css
   ========================================================================== */

gsap.registerPlugin(ScrollTrigger, SplitText);

const EASE = 'expo.out';
const REVEAL = 1.15;
const SCROLL_WEIGHT = 1.4;
const DAY_LENGTH = 420;   // percent of viewport height the day section holds
const PARALLAX = 7;       // percent an image drifts inside its frame
const ROOM_SCRUB = 0.6;   // seconds the room masks lag the scroll. 0 pins them to it
const DIVE_LENGTH = 330;  // percent of viewport the hero holds: dive, headline, house copy, exit
const DIVE_Z_END = 600;   // camera z at the end of the push; the scene starts it at 1400

const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
const coarse = matchMedia('(pointer: coarse)').matches;
const narrow = () => matchMedia('(max-width: 900px)').matches;

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n);
/* smootherstep: the same curve as the easing, used where a tween would be
   the wrong tool because the value is driven directly by scroll progress */
const smooth = (n) => { const t = clamp01(n); return t * t * t * (t * (t * 6 - 15) + 10); };
const lerp = (a, b, t) => a + (b - a) * t;

/* ---------------------------------------------------------------------------
   1) Lenis <-> ScrollTrigger. One scroll position, one loop, driven by the
   GSAP ticker. Never add a second requestAnimationFrame here.
   ------------------------------------------------------------------------ */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({
    duration: SCROLL_WEIGHT,
    easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),  // expo-out, matches EASE
    smoothWheel: true,
  });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((time) => lenis.raf(time * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();                                                // held until the loader lifts
}

/* ---------------------------------------------------------------------------
   MOMENT 0
   2) The dive. The hero pins and the scroll flies the scene's camera forward
   from z 1400 into the canopy.

   Three things make this possible, all of them already true in the authored
   ThreeUI document:

   - its render loop writes camera.position.x and .y from the pointer every
     frame but never touches .z, and its resize handler derives fov from the
     constant DIST rather than the live z. So z is free to drive from here and
     the authored pointer parallax keeps running underneath.
   - its renderer is alpha:true with a transparent clear colour, so the plum is
     CSS, not the scene. build.mjs moves that ground onto .hero::before keyed to
     --kaya-ground, and winding it to 0 makes the frame genuinely transparent.
   - every hero layer already declares its own parallax depth as --pd. That is
     the depth ordering the fly-out needs, so near things leave the frame first
     and fastest without inventing a hierarchy.

   The travel is bounded by the scene's own geometry, measured off it rather
   than guessed: the near boughs occupy z -271 to +232, the far grove sits
   around -260, and the falling petals span -378 to +617. Ending at 600 keeps
   the lens clear of the bough by nearly 370 units, so it never punches through
   solid wood, while putting it inside the petal field for the whole descent.
   The canopy itself magnifies past the edges of the frame at about z 950,
   which is why the ground starts opening shortly after that.
   ------------------------------------------------------------------------ */
/* .wordmark and .dock are deliberately absent: build.mjs hides the hero's own
   pair when embedded, because the page carries a fixed topbar that has to
   outlive the dive. */
const HERO_LAYERS =
  '.headline,.lede,.pill-clip,.pill-glass,' +
  '.stat--a,.stat--b,.card--about,.knob-float,.card--stove';

/* the two control plates are outside the parallax set, so they borrow the
   depth of the control they sit behind */
const LAYER_DEPTH = { 'pill-clip': 15, 'pill-glass': 15 };

let setHeroPaused = () => {};

/* Under reduced motion the dive never runs, so the track stays exactly one
   screen tall and the hero behaves like an ordinary section. */
function sizeDiveTrack() {
  const track = document.querySelector('.hero-track');
  if (!track) return;
  track.style.height = reduced ? '' : `${100 + (narrow() ? DIVE_LENGTH * 0.7 : DIVE_LENGTH)}svh`;
}

function initDive() {
  const track = document.querySelector('.hero-track');
  const hero = document.querySelector('.hero');
  const frame = document.querySelector('.hero__frame');
  const into = document.querySelector('.hero__into');
  if (!track || !hero || !frame || !into) return;

  setHeroPaused = (paused) => {
    try { if (frame.contentWindow) frame.contentWindow.__kayaPaused = paused; } catch (_) { /* cross-origin */ }
  };

  const bits = [...into.querySelectorAll('[data-into]')];
  const more = [...into.querySelectorAll('[data-more]')];
  const rule = into.querySelector('.into__more .rule-draw i');
  const headline = into.querySelector('[data-lines]');
  const lines = () => splits.get(headline)?.lines || [];

  if (reduced) {
    gsap.set([...bits, ...more], { opacity: 1, y: 0 });
    gsap.set(lines(), { yPercent: 0, opacity: 1 });
    if (rule) gsap.set(rule, { scaleX: 1 });
    return;
  }
  gsap.set(bits, { opacity: 0, y: 26 });
  gsap.set(more, { opacity: 0, y: 34 });
  /* the track is what the hero sticks through, so its height IS the dive length */
  sizeDiveTrack();

  let doc = null, win = null, cam = null, dist = 1400, layers = [], ready = false;

  function collect() {
    try { doc = frame.contentDocument; win = frame.contentWindow; } catch (_) { return false; }
    if (!doc || !win || !win.__kayaCamera) return false;
    const stage = doc.getElementById('stage');
    if (!stage) return false;

    cam = win.__kayaCamera;
    dist = win.__kayaDist || 1400;

    const s = stage.getBoundingClientRect();
    const cx = s.left + s.width / 2, cy = s.top + s.height / 2;
    /* the floating knob shares the About card's parallax origin, so it has to
       share its escape vector too, or the two come apart mid-flight */
    const card = doc.querySelector('.card--about');
    const cardBox = card && card.getBoundingClientRect();

    layers = [...doc.querySelectorAll(HERO_LAYERS)].map((el) => {
      const key = [...el.classList].find((c) => c in LAYER_DEPTH);
      const box = el.classList.contains('knob-float') && cardBox ? cardBox : el.getBoundingClientRect();
      return {
        el,
        depth: key ? LAYER_DEPTH[key] : parseFloat(getComputedStyle(el).getPropertyValue('--pd')) || 8,
        dx: box.left + box.width / 2 - cx,
        dy: box.top + box.height / 2 - cy,
      };
    });
    fitControlPlate();
    ready = layers.length > 0;
    return ready;
  }

  /* The chrome's frosted plate sits behind the Explore control and has to be
     exactly its size and position. It cannot be placed in design units,
     because the liquid stage is not centred in its own reveal clip and the
     offset moves with viewport width. So it is measured off the button. */
  function fitControlPlate() {
    if (!doc) return false;
    const btn = doc.querySelector('.liquid-button--explore');
    const plate = doc.querySelector('.pill-glass');
    const stage = doc.getElementById('stage');
    if (!btn || !plate || !stage) return false;
    const b = btn.getBoundingClientRect(), s = stage.getBoundingClientRect();
    if (!b.width) return false;
    const w = b.width + 2, h = b.height + 2;   // the authored 1u overshoot
    plate.style.left = `${b.left - s.left + b.width / 2}px`;
    plate.style.top = `${b.top - s.top + b.height / 2}px`;
    plate.style.width = `${w}px`;
    plate.style.height = `${h}px`;
    plate.style.margin = `${-h / 2}px 0 0 ${-w / 2}px`;
    return true;
  }

  function rest() {
    /* at the top of the page the authored pointer parallax owns these
       transforms again, so the inline overrides have to come off entirely */
    layers.forEach((L) => { L.el.style.transform = ''; L.el.style.opacity = ''; });
    if (doc) doc.documentElement.style.setProperty('--kaya-ground', '1');
    frame.style.opacity = '';
  }

  const DIVE_SHARE = 0.58;   // how much of the track the dive itself owns

  /* ── the arrival, which the scroll does not drive ──────────────────────
     Everything else on this track is scrubbed, and that is wrong for this one
     thing. Scrubbed, a fast scroll is over before the sentence has been read:
     the reveal is only ever as slow as the visitor's wheel. So the dive
     triggers this and then has no further say in it. It runs on its own clock
     at its own pace, once, and the hold in the middle is a real hold. */
  const ARRIVE_AT = 0.46;      // the dive sub-progress that fires it
  const LOCK_FROM = 0.56;      // track progress past which the page waits for it
  const LOCK_CEIL = 0.92;      // furthest up the track the hold will let it sit
  const LINE_DUR = 1.6;        // seconds a headline line takes to rise
  const LINE_STAGGER = 0.62;   // seconds between one line and the next
  const LINE_FOG = 20;         // px of blur each line comes out of
  /* The perceived gap runs longer than this number. `expo.out` has a long
     asymptotic tail, so the lines look settled about 0.4s before their tween
     nominally ends, and the hold only starts counting after that. At 1.0 the
     gap read as 1.4s, which stalled. */
  const ARRIVE_HOLD = 0.4;     // held beat once the last line has landed

  let arrivalTl = null, arrivalDone = false, held = false, holdCeil = 0;

  /* The page waits for the sentence to finish. Lenis is stopped rather than
     the scroll position being clamped: clamping fights the wheel and reads as
     a stutter, where a stopped Lenis simply ignores the input.

     It cannot start at ARRIVE_AT. The dive is scrubbed, so freezing the scroll
     freezes the camera with it, and at 0.46 the canopy is still half
     dissolved. LOCK_FROM sits past the end of that dissolve, so the scene is
     resolved before anything is held. A slow reader reaches the end of the
     sentence before the lock and never meets it at all. */
  function holdScroll() {
    if (held || !lenis) return;
    held = true;
    const span = Math.max(1, track.offsetHeight - innerHeight);
    holdCeil = track.getBoundingClientRect().top + window.scrollY + span * LOCK_CEIL;
    lenis.stop();
    clampToHold();
  }

  /* Stopping the input is not enough on its own. One wheel frame can carry the
     page thousands of pixels, and by the time this runs the scroll can already
     be past the hero entirely: measured, a hard flick took the track from 0.15
     to 1.33 between two samples, so the hold engaged after the arrival screen
     had left. Stopping is what keeps it still. This is what keeps it somewhere
     the arrival is still on screen. */
  function clampToHold() {
    if (!held || !lenis) return;
    if (window.scrollY > holdCeil) lenis.scrollTo(holdCeil, { immediate: true, force: true });
  }

  function releaseScroll() {
    if (!held || !lenis) return;
    held = false;
    lenis.start();
  }

  function restArrival() {
    if (arrivalTl) { arrivalTl.kill(); arrivalTl = null; }
    releaseScroll();
    arrivalDone = false;
    gsap.set(lines(), { yPercent: 108, opacity: 0, filter: `blur(${LINE_FOG}px)` });
    gsap.set(bits, { opacity: 0, y: 26 });
    gsap.set(more, { opacity: 0, y: 34 });
    if (rule) gsap.set(rule, { scaleX: 0 });
  }

  function playArrival() {
    const L = lines();
    if (arrivalTl || !L.length) return;
    arrivalTl = gsap.timeline({
      /* asserted every frame, not just when the hold starts, so a wheel that
         is still coasting cannot walk the page out from under it */
      onUpdate: clampToHold,
      onComplete: () => { arrivalDone = true; releaseScroll(); },
    })
      /* the line still rises out of its mask. What is new is that it comes out
         of a fog as it goes, so the sentence resolves rather than sliding in */
      .to(L, {
        yPercent: 0, opacity: 1, filter: 'blur(0px)',
        duration: LINE_DUR, ease: EASE, stagger: LINE_STAGGER,
      })
      .to(bits, { opacity: 1, y: 0, duration: REVEAL, ease: EASE, stagger: 0.14 }, 0.4)
      /* The held beat. Nothing arrives for a second whatever the scroll is
         doing, so the film behind the type gets a moment with nothing
         competing with it. This is the whole point of the sequence. */
      .to({}, { duration: ARRIVE_HOLD })
      .to(more, { opacity: 1, y: 0, duration: REVEAL, ease: EASE, stagger: 0.16 })
      .to(rule, { scaleX: 1, duration: 1.1, ease: EASE }, '<0.15');
  }

  restArrival();   // the fog has to be on the lines before the first frame

  function render(p) {
    if (!ready && !collect()) return;
    if (p <= 0.0015) { rest(); }

    /* The hero holds three beats on one track, so everything the dive itself
       does is expressed against `d`, its own sub-progress, and the house copy
       gets the stretch after it. DIVE_SHARE moves the boundary without
       re-timing anything inside the dive. */
    const d = clamp01(p / DIVE_SHARE);

    /* one long smootherstep: it leans in, carries through the canopy, and
       settles rather than stopping */
    cam.position.z = lerp(dist, DIVE_Z_END, smooth(clamp01((d - 0.04) / 0.78)));

    if (p > 0.0015) {
      const gone = smooth(clamp01(d / 0.58));
      const fade = smooth(clamp01(d / 0.48));
      layers.forEach((L) => {
        const k = gone * (0.5 + L.depth / 22);
        L.el.style.transform =
          `translate3d(${L.dx * k * 1.3}px, ${L.dy * k * 1.3}px, 0) scale(${1 + k * 0.95})`;
        L.el.style.opacity = `${1 - fade}`;
      });

      /* Two separate dissolves, and the order matters. The ground goes first,
         so the chapter is already behind the canopy while the canopy is still
         there. Then the canopy itself goes, slowly, over a third of the dive
         rather than the last sliver of it, and it is fully gone by 0.9 so the
         last stretch is a held beat on the chapter before the hero releases
         and the page starts moving again. */
      const open = smooth(clamp01((d - 0.42) / 0.30));
      doc.documentElement.style.setProperty('--kaya-ground', `${1 - open}`);
      frame.style.opacity = `${1 - smooth(clamp01((d - 0.60) / 0.30))}`;
    }

    /* The arrival is fired here and owned by its own timeline from then on.

       Scrolling back up past the trigger winds it off again, because the
       canopy comes back with it and the chapter has no business sitting on
       top of that. The margin is what stops a jitter around the trigger point
       from replaying it over and over.

       Re-asserting the resting state once it is finished is what keeps it
       correct across a resize, which re-splits the headline into fresh line
       elements the timeline has never seen. */
    if (arrivalTl && d < ARRIVE_AT - 0.08) restArrival();
    else if (arrivalDone) gsap.set(lines(), { yPercent: 0, opacity: 1, filter: 'blur(0px)' });
    else if (d >= ARRIVE_AT) playArrival();

    /* and the page waits here until the last of it is on screen */
    if (!arrivalDone && arrivalTl && p >= LOCK_FROM) holdScroll();
  }

  /* ── the exit ───────────────────────────────────────────────────────────
     The arrival screen leaves at EXIT_SPEED of page speed, so the water
     chapter riding up over it does the moving and this lags behind. That is
     the parallax, and it is ONE plane: the photograph and the type travel
     together, because two rates over this distance read as a wobble rather
     than as depth.

     It runs across the hero's whole departure rather than the tail of the dive
     track. Compressed into the last few percent it was a burst that fired and
     was immediately overtaken by the section change behind it, and it dimmed
     the type to 55% while it was still on screen, which reads as the page
     giving up rather than as distance. */
  const EXIT_SPEED = 0.62;

  ScrollTrigger.create({
    trigger: track,
    start: 'bottom bottom',
    end: 'bottom top',
    scrub: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => {
      gsap.set(into, { yPercent: self.progress * (1 - EXIT_SPEED) * 100 });
    },
  });

  /* No pin: the hero is already held by position:sticky, and this trigger only
     reads progress across the track. Pinning would reparent the iframe. */
  ScrollTrigger.create({
    trigger: track,
    start: 'top top',
    end: 'bottom bottom',
    invalidateOnRefresh: true,
    onRefresh: () => { ready = false; fitControlPlate(); },
    onUpdate: (self) => render(self.progress),
    onLeave: () => setHeroPaused(true),
    onEnterBack: () => setHeroPaused(false),
  });

  /* Tuning handle. `__kayaDive(0.45)` previews any point of the dive without
     scrolling to it, which is the only practical way to judge the flight path
     and where the canopy passes the lens. Disable the trigger first:
     ScrollTrigger.getAll().find(t => t.trigger.classList.contains('hero')).disable(false) */
  window.__kayaDive = render;

  /* the scene boots asynchronously behind its own intro, so keep reaching for
     the camera until it exists rather than assuming it does at load */
  frame.addEventListener('load', () => { ready = false; });
  /* the label sets the button's width, so re-fit once the real face lands */
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fitControlPlate);
  let tries = 0, fitted = false;
  const poll = setInterval(() => {
    const got = collect();
    if (!fitted) fitted = fitControlPlate();
    if ((got && fitted) || ++tries > 80) { clearInterval(poll); ScrollTrigger.refresh(); }
  }, 120);
}

/* ---------------------------------------------------------------------------
   2b) The films. Two of them: the arrival screen behind chapter 01, and the
   06:00 beat of the day. Each sits inside the box its section already
   animates, so nothing about the surrounding choreography changed, and each
   keeps a still behind it that is both its poster and its fallback.

   There is no sound to manage. The audio track is stripped out of both files
   rather than only being muted in the markup, so there is nothing to play.
   The muted attribute stays anyway, because autoplay depends on it.
   ------------------------------------------------------------------------ */
const FILMS = [
  ['.hero__photo video', '.hero-track'],
  ['.day__shots video', '.day'],
];

function initFilms() {
  FILMS.forEach(([sel, triggerSel]) => {
    const film = document.querySelector(sel);
    const section = document.querySelector(triggerSel);
    if (!film || !section) return;
    film.muted = true;

    /* degrade to the still rather than to a hole */
    film.addEventListener('error', () => { film.style.display = 'none'; }, { once: true });

    if (reduced) { film.removeAttribute('autoplay'); film.pause(); return; }

    /* no point decoding a 1440p frame for the whole page. Each runs while its
       own section is anywhere near the viewport and holds still otherwise. */
    ScrollTrigger.create({
      trigger: section,
      start: 'top bottom',
      end: 'bottom top',
      onToggle: (self) => {
        if (self.isActive) film.play().catch(() => {});
        else film.pause();
      },
    });
  });
}

/* ---------------------------------------------------------------------------
   3) Cursor. A thin ring with lerped weight. Fine pointers only.
   ------------------------------------------------------------------------ */
function initCursor() {
  if (reduced || coarse) return;
  const cursor = document.querySelector('.cursor');
  let mx = innerWidth / 2, my = innerHeight / 2, cx = mx, cy = my;

  addEventListener('pointermove', (e) => {
    mx = e.clientX; my = e.clientY;
    cursor.classList.add('is-visible');
  });
  gsap.ticker.add(() => {
    cx += (mx - cx) * 0.16;
    cy += (my - cy) * 0.16;
    cursor.style.transform = `translate(${cx}px, ${cy}px)`;
  });
  document.querySelectorAll('a, button, [data-magnetic]').forEach((el) => {
    el.addEventListener('pointerenter', () => cursor.classList.add('is-hover'));
    el.addEventListener('pointerleave', () => cursor.classList.remove('is-hover'));
  });
  document.body.classList.add('has-cursor');
}

/* ---------------------------------------------------------------------------
   3b) The topbar. The bar itself is the authored dock, lifted into
   assets/dock.{css,js} by the build, so the proximity magnify, the specular
   rim, the keyboard path and the active pill are all the authored ones. This
   only starts it, points its links at real sections, and flips the wordmark
   over the paper chapters.
   ------------------------------------------------------------------------ */
function initTopbar() {
  const bar = document.querySelector('[data-topbar]');
  if (!bar) return;

  /* the dock steps itself off one function per frame; the page already has a
     ticker, so it rides that rather than opening a second loop */
  if (window.KayaDock) {
    const step = window.KayaDock.init();
    if (step && !reduced) gsap.ticker.add(step);
  }

  /* anchors go through Lenis or the page jumps out from under the smooth
     scroll. The authored click handler has already called preventDefault and
     moved its own active pill by the time this runs. */
  bar.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const target = document.querySelector(link.getAttribute('href'));
    if (!target) return;
    e.preventDefault();

    /* The finale is sticky inside a wrapper pulled up over the day by a
       negative margin, so its own box sits a screen and a half above where it
       comes to rest and scrolling to it landed on the day. The floor of the
       page is the only position where it is actually in place. */
    const dest = target.closest('.stay-wrap')
      ? document.documentElement.scrollHeight - window.innerHeight
      : target;

    /* No offset. Every destination is a full-bleed ground with its own top
       padding, and the topbar floats over it, so landing anything short of the
       section top just leaves a band of the previous chapter on screen. */
    if (lenis) lenis.scrollTo(dest, { offset: 0 });
    else if (typeof dest === 'number') window.scrollTo(0, dest);
    else target.scrollIntoView();
  });

  if (reduced) { gsap.set(bar, { opacity: 1 }); return; }

  document.querySelectorAll('.chapter--paper').forEach((sec) => {
    ScrollTrigger.create({
      trigger: sec,
      /* asymmetric on purpose: the wordmark only goes dark once the cream is
         behind the whole bar, and only goes light again once the dark is */
      start: 'top 72px',
      end: 'bottom 28px',
      onToggle: (self) => bar.classList.toggle('is-light', self.isActive),
    });
  });

  /* the authored active pill, moved by scroll position as well as by click */
  const items = [...bar.querySelectorAll('.dock-item[href^="#"]:not(.dock-mark)')];
  items.forEach((item) => {
    const target = document.querySelector(item.getAttribute('href'));
    if (!target) return;
    ScrollTrigger.create({
      /* same sticky problem as the click: measure the wrapper, not the finale */
      trigger: target.closest('.stay-wrap') || target,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => {
        if (!self.isActive) return;
        items.forEach((other) => other.classList.remove('is-active'));
        item.classList.add('is-active');
      },
    });
  });
}

/* ---------------------------------------------------------------------------
   4) Display headlines. SplitText lines rising out of their own mask.
   Re-split on resize so the masks follow the rewrap.
   ------------------------------------------------------------------------ */
const splits = new Map();

function splitHeadline(el) {
  const old = splits.get(el);
  if (old) old.revert();
  const split = new SplitText(el, { type: 'lines', mask: 'lines', linesClass: 'split-line-inner' });
  splits.set(el, split);
  return split.lines;
}

function initHeadlines() {
  document.querySelectorAll('[data-lines]').forEach((el) => {
    const lines = splitHeadline(el);
    if (reduced) return;
    gsap.set(lines, { yPercent: 108, opacity: 0 });

    /* the hero's headline is driven by its own scrubbed timeline */
    if (el.closest('.hero')) return;

    ScrollTrigger.create({
      trigger: el,
      start: 'top 82%',
      once: true,
      onEnter: () => gsap.to(lines, {
        yPercent: 0, opacity: 1, duration: REVEAL, ease: EASE, stagger: 0.09,
      }),
    });
  });
}

/* ---------------------------------------------------------------------------
   5) The workhorse reveal, batched
   ------------------------------------------------------------------------ */
function initReveals() {
  if (reduced) return;
  ScrollTrigger.batch('[data-reveal]', {
    start: 'top 88%',
    once: true,
    onEnter: (els) => gsap.to(els, {
      y: 0, opacity: 1, duration: REVEAL, ease: EASE, stagger: 0.08, overwrite: true,
    }),
  });
}

/* ---------------------------------------------------------------------------
   6) The accent rule that draws itself across the page
   ------------------------------------------------------------------------ */
function initRule() {
  if (reduced) return;
  document.querySelectorAll('.rule-draw i').forEach((el) => {
    gsap.to(el, {
      scaleX: 1, duration: 1.8, ease: EASE,
      scrollTrigger: { trigger: el, start: 'top 88%', once: true },
    });
  });
}

/* ---------------------------------------------------------------------------
   7) Parallax depth inside the image frames. The image is oversized so the
   drift never exposes an edge.
   ------------------------------------------------------------------------ */
function initParallax() {
  if (reduced) return;
  /* the room photographs are deliberately absent: their reveal is a mask
     opening across a still image, and a drifting picture fought it */
  const targets = document.querySelectorAll('.plan__sheet img, .seasons__media img');
  targets.forEach((img) => {
    gsap.set(img, { scale: 1 + PARALLAX / 100 * 2 });
    gsap.fromTo(img,
      { yPercent: -PARALLAX },
      {
        yPercent: PARALLAX, ease: 'none',
        scrollTrigger: {
          trigger: img.closest('figure, section, div'),
          start: 'top bottom', end: 'bottom top', scrub: true,
        },
      });
  });
}

/* ---------------------------------------------------------------------------
   SIGNATURE MOMENT A
   8) The bath-house plan draws itself over the photograph as the section
   passes. Every stroke is a dash the length of the path, wound back to
   nothing and let out on scrub. The centre line keeps its authored dash
   pattern, so it fades instead of drawing.
   ------------------------------------------------------------------------ */
function initPlan() {
  const svg = document.querySelector('.plan__svg');
  if (!svg || reduced) return;

  const strokes = [...svg.querySelectorAll('[data-draw]')];
  const drawn = [];
  const faded = [];

  strokes.forEach((el) => {
    if (el.hasAttribute('stroke-dasharray')) { faded.push(el); return; }
    const len = el.getTotalLength();
    el.style.strokeDasharray = `${len}`;
    el.style.strokeDashoffset = `${len}`;
    drawn.push(el);
  });
  gsap.set(faded, { opacity: 0 });
  gsap.set(svg.querySelectorAll('text'), { opacity: 0 });

  gsap.timeline({
    scrollTrigger: {
      trigger: '.plan',
      start: 'top 78%',
      end: 'bottom 62%',
      scrub: 1.1,
    },
  })
    .to(drawn, { strokeDashoffset: 0, ease: 'none', stagger: 0.035 })
    .to(faded, { opacity: 1, ease: 'none' }, '<0.35')
    .to(svg.querySelectorAll('text'), { opacity: 1, ease: 'none', stagger: 0.05 }, '<0.2');
}

/* ---------------------------------------------------------------------------
   8b) One frame, three baths. Hovering a bath in the water section brings its
   own photograph up. Yumori is what the frame rests on, so the section still
   says something with no pointer at all, and every image keeps its alt text in
   the document rather than being swapped in and out.
   ------------------------------------------------------------------------ */
function initBathSwap() {
  const list = document.querySelector('.waters');
  const frame = document.querySelector('.water__photo');
  const quotes = document.querySelector('.water__quotes');
  if (!list || !frame || !quotes) return;

  /* photograph, caption and quote all key off the same attribute, so adding a
     fourth bath is markup only */
  const layers = [...frame.querySelectorAll('img[data-bath]'),
                  ...frame.querySelectorAll('.water__cap span[data-bath]'),
                  ...quotes.querySelectorAll('[data-bath]')];
  const rows = [...list.querySelectorAll('[data-bath]')];
  const REST = 'yumori';

  /* the rows carry an inline opacity from their own reveal, so the dim is set
     the same way rather than from a stylesheet rule that could never win */
  const show = (bath, dim) => {
    layers.forEach((el) => el.classList.toggle('is-on', el.dataset.bath === bath));
    if (reduced) return;
    rows.forEach((r) => gsap.to(r, {
      opacity: !dim || r.dataset.bath === bath ? 1 : 0.4,
      duration: 0.4, ease: EASE, overwrite: 'auto',
    }));
  };

  rows.forEach((row) => {
    const enter = () => show(row.dataset.bath, true);
    row.addEventListener('pointerenter', enter);
    row.addEventListener('pointerdown', enter);       /* touch gets it on tap */
  });
  list.addEventListener('pointerleave', () => show(REST, false));

  show(REST, false);
}

/* ---------------------------------------------------------------------------
   9) The rooms. Each photograph bleeds off one edge of the page and sits
   perfectly still behind a clip-path that opens across it on scrub. The mask
   always travels away from the edge the picture runs off, so 01 and 03 open
   right to left and 02 mirrors them. The window is short on purpose: the
   reveal finishes as the room arrives at reading height rather than dragging
   the length of the section.
   ------------------------------------------------------------------------ */
const ROOM_OPEN = 'inset(0% 0% 0% 0%)';

function initRooms() {
  const medias = [...document.querySelectorAll('[data-room-media]')];
  if (!medias.length) return;
  if (reduced) { gsap.set(medias, { clipPath: ROOM_OPEN }); return; }

  medias.forEach((media) => {
    const fromLeft = media.closest('.room').classList.contains('room--b');
    gsap.fromTo(media,
      { clipPath: fromLeft ? 'inset(0% 100% 0% 0%)' : 'inset(0% 0% 0% 100%)' },
      {
        clipPath: ROOM_OPEN, ease: 'none',
        scrollTrigger: { trigger: media, start: 'top 88%', end: 'top 34%', scrub: ROOM_SCRUB },
      });
  });
}

/* ---------------------------------------------------------------------------
   SIGNATURE MOMENT B
   10) A day at Kaya. The section pins and the scroll scrubs the light from a
   mid-afternoon arrival, through dusk and the night, to the next dawn. The
   photographs dissolve one into the next; the hour numerals drift sideways
   faster than the captions underneath them, so the two layers pull against
   each other the whole way down.
   ------------------------------------------------------------------------ */
const DAY_KEYS = [
  /* progress, and the three stops of the sky behind the photographs. The disc
     and the stars that used to ride over this are gone: they were standing in
     for imagery, and there are photographs now. */
  { t: 0.00, a: [143, 166, 184], b: [228, 201, 168], c: [240, 223, 198] },
  { t: 0.25, a: [ 74,  69,  96], b: [176, 122, 130], c: [233, 169, 142] },
  { t: 0.50, a: [ 44,  35,  51], b: [ 84,  58,  72], c: [140,  90,  92] },
  { t: 0.75, a: [ 20,  17,  26], b: [ 30,  25,  38], c: [ 42,  33,  48] },
  { t: 1.00, a: [ 42,  52,  72], b: [126, 117, 144], c: [232, 187, 174] },
];

function mixKeys(p) {
  let i = 0;
  while (i < DAY_KEYS.length - 2 && p > DAY_KEYS[i + 1].t) i++;
  const k0 = DAY_KEYS[i], k1 = DAY_KEYS[i + 1];
  const t = smooth((p - k0.t) / (k1.t - k0.t));
  const rgb = (key) => k0[key].map((v, n) => Math.round(lerp(v, k1[key][n], t)));
  return { a: rgb('a'), b: rgb('b'), c: rgb('c') };
}

function initDay() {
  const section = document.querySelector('.day');
  if (!section) return;

  const sky = section.querySelector('.day__sky');
  const shots = [...section.querySelectorAll('[data-shot]')];
  const film = section.querySelector('video[data-shot]');
  const bar = section.querySelector('.day__bar i');
  const hours = [...section.querySelectorAll('[data-hour]')];
  const caps = [...section.querySelectorAll('[data-cap]')];
  const ticks = [...section.querySelectorAll('[data-tick]')];
  const steps = hours.length;

  if (reduced) { ticks.forEach((t) => t.classList.add('is-on')); return; }

  const rgb = (c) => `rgb(${c[0]},${c[1]},${c[2]})`;
  let active = -1;

  function render(p) {
    const k = mixKeys(p);
    sky.style.background = `linear-gradient(180deg, ${rgb(k.a)} 0%, ${rgb(k.b)} 62%, ${rgb(k.c)} 100%)`;
    bar.style.transform = `scaleX(${p})`;

    /* One photograph per hour, each dissolving over the one before it. They
       are stacked in order, so everything earlier stays at full opacity
       underneath and there is never a gap to see the sky through mid-fade.
       The first is always on, which is what the section rests on at p = 0. */
    const local = p * steps;
    let lastOpacity = 0;
    for (let i = 0; i < shots.length; i++) {
      const o = i === 0 ? 1 : smooth(clamp01((local - (i - 0.35)) / 0.5));
      shots[i].style.opacity = o;
      if (i === shots.length - 1) lastOpacity = o;
    }

    /* The 06:00 beat is a film, and it spends most of this scrub at opacity 0.
       Safari will not start a muted autoplay video it considers invisible, and
       an element at zero opacity qualifies, so playback is tied to the moment
       it actually becomes visible rather than left to the autoplay attribute. */
    if (film && film.paused && lastOpacity > 0.02) film.play().catch(() => {});

    /* each step owns 1/5 of the scroll. The numeral drifts across its window
       at more than twice the rate of the caption below it. */
    const step = Math.min(steps - 1, Math.floor(p * steps));
    for (let i = 0; i < steps; i++) {
      const lp = clamp01((p - i / steps) * steps);
      const inside = p >= i / steps && p < (i + 1) / steps;
      const fade = inside ? Math.min(smooth(lp / 0.26), smooth((1 - lp) / 0.24)) : 0;
      hours[i].style.opacity = fade;
      hours[i].style.transform = `translate3d(${(0.5 - lp) * 150}px, ${(0.5 - lp) * -26}px, 0)`;
      caps[i].style.opacity = fade;
      caps[i].style.transform = `translate3d(${(0.5 - lp) * -58}px, 0, 0)`;
    }
    if (step !== active) {
      active = step;
      ticks.forEach((t, i) => t.classList.toggle('is-on', i === step));
    }
  }

  ScrollTrigger.create({
    trigger: section,
    start: 'top top',
    end: () => `+=${narrow() ? DAY_LENGTH * 0.65 : DAY_LENGTH}%`,
    pin: '.day__stage',
    pinSpacing: true,
    invalidateOnRefresh: true,
    onUpdate: (self) => render(self.progress),
    onRefresh: (self) => render(self.progress),
  });
  render(0);
}

/* ---------------------------------------------------------------------------
   10b) The finale's scene. A second WebGL context is not free, so it is held
   until the section is within a screen of view and paused again the moment it
   leaves. The frame boots and builds either way; only the entrance and the
   render loop wait.
   ------------------------------------------------------------------------ */
function initStayScene() {
  const frame = document.querySelector('.stay__scene');
  const stay = document.querySelector('.stay');
  if (!frame || !stay) return;

  const set = (paused) => {
    try { if (frame.contentWindow) frame.contentWindow.__kayaPaused = paused; } catch (_) { /* cross-origin */ }
  };
  const wake = () => {
    try {
      const w = frame.contentWindow;
      if (!w) return false;
      if (!w.__kayaEntrance) return false;
      w.__kayaEntrance();
      set(false);
      return true;
    } catch (_) { return false; }
  };

  set(true);
  ScrollTrigger.create({
    trigger: '.stay-wrap',
    start: 'top bottom',
    end: 'bottom top',
    onToggle: (self) => {
      if (!self.isActive) { set(true); return; }
      /* the scene publishes its entrance only once it has built */
      if (!wake()) {
        let tries = 0;
        const poll = setInterval(() => {
          if (wake() || ++tries > 80) clearInterval(poll);
        }, 120);
      }
    },
  });
}

/* ---------------------------------------------------------------------------
   11) Magnetic pull on the footer address
   ------------------------------------------------------------------------ */
function initMagnetic() {
  if (reduced || coarse) return;
  document.querySelectorAll('[data-magnetic]').forEach((btn) => {
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      gsap.to(btn, {
        x: (e.clientX - (r.left + r.width / 2)) * 0.22,
        y: (e.clientY - (r.top + r.height / 2)) * 0.32,
        duration: 0.7, ease: EASE,
      });
    });
    btn.addEventListener('pointerleave', () => gsap.to(btn, { x: 0, y: 0, duration: 1.1, ease: EASE }));
  });
}

/* ---------------------------------------------------------------------------
   12) The loader: up from black, a rule that fills, a count to 100
   ------------------------------------------------------------------------ */
function runLoader() {
  const loader = document.querySelector('.loader');
  const digits = [...loader.querySelectorAll('[data-count] i')];
  const fill = loader.querySelector('.loader__rule i');

  /* The hero holds its entrance while the loader is up (see the entrance hold
     patches in build/build.mjs), so the scan pulse over the bare boughs plays
     in view instead of behind a cover. The scene publishes __kayaEntrance only
     once it is built, so wait for it rather than assuming it is there. */
  const startHeroEntrance = () => {
    const frame = document.querySelector('.hero__frame');
    let tries = 0;
    const go = () => {
      const w = frame && frame.contentWindow;
      if (w && w.__kayaEntrance) { w.__kayaEntrance(); return; }
      if (++tries < 80) setTimeout(go, 100);   // the scene has its own 6s backstop
    };
    go();
  };

  const release = () => {
    loader.remove();
    lenis && lenis.start();
    startHeroEntrance();
    gsap.to('[data-topbar]', { opacity: 1, duration: REVEAL, ease: EASE });
    ScrollTrigger.refresh();
  };

  if (reduced) { release(); return; }

  const n = { v: 0 };
  gsap.timeline()
    /* opacity only. This used to rise 16px, which read as the block sitting
       low at 000 and then nudging up the moment the count started. Nothing in
       the loader moves now: the rule fills and the digits turn over. */
    .from(loader.querySelector('.loader__inner'), { opacity: 0, duration: 1, ease: EASE })
    .to(fill, { width: '100%', duration: 1.9, ease: 'power1.inOut' }, 0.1)
    .to(n, {
      v: 100, duration: 1.9, ease: 'power1.inOut',
      onUpdate: () => {
        const v = String(Math.round(n.v)).padStart(3, '0');
        for (let i = 0; i < digits.length; i++) {
          if (digits[i].textContent !== v[i]) digits[i].textContent = v[i];
        }
      },
      /* the mark and the name take the accent the moment the count lands. The
         hold on the next line is what buys time to actually see it. */
      onComplete: () => loader.classList.add('is-done'),
    }, 0.1)
    .to(loader.querySelector('.loader__inner'), { opacity: 0, duration: .6, ease: EASE }, '+=0.55')
    .to(loader, { autoAlpha: 0, duration: 1.1, ease: EASE, onComplete: release }, '<0.2');
}

/* ---------------------------------------------------------------------------
   Boot
   ------------------------------------------------------------------------ */
function init() {
  initCursor();
  initTopbar();
  initHeadlines();   // must run before initDive: the dive drives the hero's split lines
  initDive();
  initReveals();
  initRule();
  initParallax();
  initPlan();
  initBathSwap();
  initRooms();
  initDay();
  initFilms();   // after initDay: its trigger measures a section initDay pins
  initStayScene();
  initMagnetic();
  runLoader();
  ScrollTrigger.refresh();
}

addEventListener('load', init);

/* re-split the headlines and re-measure the pins after a resize settles */
let resizeTimer;
addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    sizeDiveTrack();
    /* the blank beat's headline is held by a pinned timeline that owns those
       exact line elements, so it keeps its original split */
    document.querySelectorAll('[data-lines]:not(.hero [data-lines])').forEach((el) => {
      const lines = splitHeadline(el);
      if (!reduced) gsap.set(lines, { yPercent: 0, opacity: 1 });
    });
    ScrollTrigger.refresh();
  }, 220);
});
