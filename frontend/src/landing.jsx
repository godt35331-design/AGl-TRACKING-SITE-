import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  Truck, Plane, Ship, MapPin, Search, ArrowRight, ArrowUpRight, Pause, Play, X, Menu, Plus, Layers, Radar
} from 'lucide-react';

/* ------------------------------------------------------------------ */
/*  Hero footage: ship -> plane -> truck, looping with a crossfade     */
/* ------------------------------------------------------------------ */

const MAX_CLIP_SECONDS = 9;

const HERO_MODES = [
  {
    key: 'ship',
    label: 'Ocean Freight',
    Icon: Ship,
    from: { city: 'Rotterdam (RTM)', note: 'Netherlands Hub' },
    to: { city: 'New York (NYC)', note: 'United States' },
    progress: 58,
    eta: 'Oct 18, 09:00 EST',
    speed: '21 kn • Open Sea',
    status: 'In Transit (58%)'
  },
  {
    key: 'plane',
    label: 'Air Cargo',
    Icon: Plane,
    from: { city: 'Frankfurt (FRA)', note: 'Germany Hub' },
    to: { city: 'New York (JFK)', note: 'United States' },
    progress: 74,
    eta: 'Today, 16:30 EST',
    speed: '540 mph • 34k ft',
    status: 'In Transit (74%)'
  },
  {
    key: 'truck',
    label: 'Road Freight',
    Icon: Truck,
    from: { city: 'Chicago (CHI)', note: 'Illinois Hub' },
    to: { city: 'Denver (DEN)', note: 'Colorado' },
    progress: 41,
    eta: 'Tomorrow, 11:15 MST',
    speed: '62 mph • I-80 W',
    status: 'In Transit (41%)'
  }
];

const prefersReducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const useLightVideo = () => {
  // Phones and data-saver users get the 360p renditions.
  const [light] = useState(() => {
    if (typeof window === 'undefined') return false;
    const small = window.matchMedia && window.matchMedia('(max-width: 768px)').matches;
    const saveData = !!(navigator.connection && navigator.connection.saveData);
    return small || saveData;
  });
  return light;
};

function HeroStage({ onModeChange }) {
  const light = useLightVideo();
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(() => prefersReducedMotion());
  const [inView, setInView] = useState(true);
  const [ready, setReady] = useState([false, false, false]);
  const [progress, setProgress] = useState(0);
  const rootRef = useRef(null);
  const videoRefs = useRef([]);

  useEffect(() => { onModeChange(active); }, [active, onModeChange]);

  // Only spend CPU / bandwidth while the hero is on screen.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return undefined;
    const io = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.05 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Switching clip: restart the new one, park the old one after the fade.
  useEffect(() => {
    setProgress(0);
    const timers = [];
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === active) {
        try { v.currentTime = 0; } catch { /* metadata not loaded yet */ }
      } else {
        timers.push(setTimeout(() => v.pause(), 1300));
      }
    });
    return () => timers.forEach(clearTimeout);
  }, [active]);

  // Play / pause the active clip.
  useEffect(() => {
    const v = videoRefs.current[active];
    if (!v) return;
    if (paused || !inView) {
      v.pause();
    } else {
      const p = v.play();
      if (p && typeof p.catch === 'function') p.catch(() => setPaused(true));
    }
  }, [active, paused, inView, ready]);

  const next = useCallback(() => setActive(a => (a + 1) % HERO_MODES.length), []);

  const handleTime = (i) => (e) => {
    if (i !== active) return;
    const v = e.currentTarget;
    const limit = Math.min(v.duration || MAX_CLIP_SECONDS, MAX_CLIP_SECONDS);
    const p = Math.min(1, v.currentTime / limit);
    setProgress(p);
    if (p >= 1) next();
  };

  const markReady = (i) => () => setReady(r => (r[i] ? r : r.map((x, idx) => (idx === i ? true : x))));

  return (
    <>
      <div className="mx-hero-media" ref={rootRef} aria-hidden="true">
        <div className="mx-hero-poster" />
        {HERO_MODES.map((m, i) => (
          <video
            key={m.key}
            ref={el => { videoRefs.current[i] = el; }}
            className={`mx-hero-video ${i === active && ready[i] ? 'is-active' : ''}`}
            src={`/videos/${m.key}-${light ? 360 : 720}.mp4`}
            muted
            playsInline
            loop={false}
            preload={i === active || i === (active + 1) % HERO_MODES.length ? 'auto' : 'metadata'}
            onLoadedData={markReady(i)}
            onTimeUpdate={handleTime(i)}
            onEnded={() => { if (i === active) next(); }}
            onError={() => { if (i === active) setTimeout(next, 600); }}
          />
        ))}
        <div className="mx-hero-shade" />
        <div className="mx-hero-grid" />
      </div>

      <div className="mx-hero-controls">
        <div className="mx-mode-tabs" role="tablist" aria-label="Freight footage">
          {HERO_MODES.map((m, i) => (
            <button
              key={m.key}
              type="button"
              role="tab"
              aria-selected={i === active}
              className={`mx-mode-tab ${i === active ? 'active' : ''}`}
              onClick={() => { setActive(i); if (paused && !prefersReducedMotion()) setPaused(false); }}
            >
              <span className="mx-mode-bar"><span style={{ width: `${i === active ? progress * 100 : i < active ? 100 : 0}%` }} /></span>
              <span className="mx-mode-label"><m.Icon size={13} /> {m.label}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mx-pause-btn"
          onClick={() => setPaused(p => !p)}
          aria-label={paused ? 'Play background video' : 'Pause background video'}
        >
          {paused ? <Play size={14} /> : <Pause size={14} />}
        </button>
      </div>
    </>
  );
}

function TelemetryCard({ modeIndex, onOpen }) {
  const m = HERO_MODES[modeIndex] || HERO_MODES[0];
  return (
    <div className="mx-hud" key={m.key}>
      <div className="mx-hud-top">
        <span className="mx-mono mx-hud-live"><span className="mx-live-dot" /> Live</span>
        <span className="mx-mono mx-hud-mode"><m.Icon size={12} /> {m.label}</span>
      </div>
      <div className="mx-hud-route">
        <strong>{m.from.city}</strong>
        <m.Icon className="mx-hud-icon" size={18} />
        <strong>{m.to.city}</strong>
      </div>
      <div className="mx-hud-bar"><span style={{ width: `${m.progress}%` }} /></div>
      <div className="mx-hud-bottom">
        <span className="mx-mono">ETA {m.eta}</span>
        <button type="button" className="mx-hud-go" onClick={onOpen} aria-label="Open the tracking portal">
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  );
}
/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

export function Brand({ onClick, onLight = false }) {
  return (
    <button type="button" className={`mx-brand ${onLight ? 'on-light' : ''}`} onClick={onClick} aria-label="Apex Global Logistics home">
      <img src="/favicon.svg" alt="" width="30" height="30" />
      <span className="mx-brand-word">APEX<sup>™</sup></span>
    </button>
  );
}

const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: prefersReducedMotion() ? 'auto' : 'smooth', block: 'start' });
};

const NAV_ITEMS = [
  { id: 'home-top', label: 'Home' },
  { id: 'solutions', label: 'Solutions' },
  { id: 'journey', label: 'Process' },
  { id: 'reviews', label: 'Reviews' },
  { id: 'faq', label: 'FAQ' }
];

function MovexNav({ onTrack, trackLabel }) {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 40);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  const go = (id) => { setOpen(false); setTimeout(() => scrollToId(id), open ? 220 : 0); };

  return (
    <>
      <header className={`mx-nav ${solid ? 'solid' : ''}`}>
        <Brand onClick={() => go('home-top')} />
        <nav className="mx-nav-pill" aria-label="Primary">
          {NAV_ITEMS.map(item => (
            <button key={item.id} type="button" className="mx-nav-link" onClick={() => go(item.id)}>
              {item.label}{item.count && <span className="mx-nav-count">({item.count})</span>}
            </button>
          ))}
          <button type="button" className="mx-nav-track" onClick={onTrack}>{trackLabel}</button>
        </nav>
        <button
          type="button"
          className="mx-burger"
          aria-label={open ? 'Close menu' : 'Open menu'}
          aria-expanded={open}
          onClick={() => setOpen(o => !o)}
        >
          {open ? <X size={18} /> : <Menu size={18} />}
        </button>
      </header>

      <div className={`mx-drawer ${open ? 'open' : ''}`} aria-hidden={!open}>
        <div className="mx-drawer-inner">
          {NAV_ITEMS.map((item, i) => (
            <button key={item.id} type="button" className="mx-drawer-link" onClick={() => go(item.id)} tabIndex={open ? 0 : -1}>
              <span className="mx-mono">0{i + 1}</span>{item.label}
            </button>
          ))}
          <button type="button" className="mx-btn mx-btn-red" onClick={() => { setOpen(false); onTrack(); }} tabIndex={open ? 0 : -1}>
            {trackLabel} <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </>
  );
}

function FaqItem({ q, a, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={`mx-faq-item ${open ? 'open' : ''}`}>
      <button type="button" className="mx-faq-q" aria-expanded={open} onClick={() => setOpen(o => !o)}>
        <span>{q}</span>
        <span className="mx-faq-plus"><Plus size={16} /></span>
      </button>
      <div className="mx-faq-a"><div><p>{a}</p></div></div>
    </div>
  );
}

/* Fade/slide elements in as they scroll into view. */
function useReveal(rootRef) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root || prefersReducedMotion() || typeof IntersectionObserver === 'undefined') return undefined;
    root.classList.add('mx-anim');
    const io = new IntersectionObserver((entries) => {
      entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    root.querySelectorAll('.mx-reveal').forEach(el => io.observe(el));
    return () => io.disconnect();
  }, [rootRef]);
}

const delay = (i) => ({ '--d': `${i * 90}ms` });

/* ------------------------------------------------------------------ */
/*  Landing page                                                       */
/* ------------------------------------------------------------------ */

const SOLUTIONS = [
  { Icon: MapPin, title: 'Shipment Tracking', text: 'Get instantaneous updates on your package location with centimeter-level precision.' },
  { Icon: Radar, title: 'Live Monitoring', text: '24/7 telemetry and environmental monitoring for sensitive or high-value cargo.' },
  { Icon: Layers, title: 'Fast & Secure', text: 'Redundant security protocols and expedited handling for priority shipments.' },
  { Icon: ArrowUpRight, title: 'Logistics Solutions', text: 'Custom enterprise workflows and API integrations for seamless operations.' }
];

const JOURNEY = ['Shipment Registered', 'Tracking Code Issued', 'Live Satellite Tracking', 'Live Tracking', 'Delivered'];

const METRICS = [
  { num: '15.2M+', label: 'Daily Packages Delivered' },
  { num: '220+', label: 'Countries & Territories' },
  { num: '99.8%', label: 'On-Time Delivery Rate' },
  { num: '12,000+', label: 'Smart Fleet Vehicles' }
];

const REVIEWS = [
  {
    img: '/review-1.jpg', name: 'Marcus Vance', role: 'Shipper • Chicago, IL',
    text: 'Honestly impressed. Had to ship three crates of auto parts across states last week and was super nervous about delays. I watched the truck move on the live map the whole way. Package arrived a day early.'
  },
  {
    img: '/review-2.jpg', name: 'Dave Miller', role: 'Recipient • Denver, CO',
    text: 'I kept checking the live tracking link on my phone every couple hours. The email update came in as soon as it hit the local warehouse. 5 stars all day.'
  },
  {
    img: '/review-3.jpg', name: 'Chloe Sterling', role: 'Store Manager • Seattle, WA',
    text: "We switch shipping companies all the time for our online store, but Apex has been by far the most reliable. Our customers stop emailing support asking 'where is my package'."
  }
];

const FAQS = [
  { q: 'How do I track my Apex package live?', a: "Enter your Tracking ID into the top search bar, or log in to your Customer Portal to watch your parcel's exact GPS location and route waypoints in real-time on our interactive map." },
  { q: 'Where do I get my Customer Portal login credentials?', a: 'When our logistics team creates a shipping appointment for you, an automated welcome email containing your username and password is sent to your inbox immediately.' },
  { q: 'How fast are shipping appointments registered?', a: 'Shipping appointments are processed instantaneously in our cloud database and assigned an automated tracking code immediately.' },
  { q: 'What happens if my shipment experiences a delay?', a: 'Our telemetry system detects exceptions in real-time and automatically dispatches email notifications with updated estimated delivery times.' }
];

export default function LandingPage({
  heroTrackCode, setHeroTrackCode, heroTrackLoading, handleHeroTrackSubmit, goTo,
  portalHash = '#login', portalLabel = 'Track Shipment'
}) {
  const [mode, setMode] = useState(0);
  const rootRef = useRef(null);
  const handleMode = useCallback((i) => setMode(i), []);
  const openPortal = () => goTo(portalHash);
  useReveal(rootRef);

  return (
    <section className="mx-landing" ref={rootRef}>
      <MovexNav onTrack={openPortal} trackLabel={portalLabel} />

      {/* HERO */}
      <div className="mx-hero" id="home-top">
        <HeroStage onModeChange={handleMode} />

        <div className="mx-hero-content">
          <h1 className="mx-h1">
            <span className="dim">Track Your Shipment</span>
            <span>In Real-Time Worldwide</span>
          </h1>

          <form className="mx-track" onSubmit={handleHeroTrackSubmit}>
            <Search className="mx-track-icon" size={18} />
            <input
              type="text"
              placeholder="Enter 8-digit tracking number (e.g. APX-31518784)..."
              value={heroTrackCode}
              onChange={(e) => setHeroTrackCode(e.target.value)}
              aria-label="Tracking number"
              autoComplete="off"
            />
            {heroTrackCode && (
              <button type="button" className="mx-track-clear" onClick={() => setHeroTrackCode('')} title="Clear tracking input" aria-label="Clear tracking input">
                <X size={14} />
              </button>
            )}
            <button type="submit" className="mx-btn mx-btn-white" disabled={heroTrackLoading}>
              {heroTrackLoading ? (<><span className="btn-spinner" /> Locating…</>) : (<>Track Shipment <ArrowRight size={15} /></>)}
            </button>
          </form>
        </div>

        <TelemetryCard modeIndex={mode} onOpen={openPortal} />
      </div>

      {/* NUMBERS */}
      <div className="mx-section mx-metrics">
        <div className="mx-wrap mx-metrics-grid">
          {METRICS.map((m, i) => (
            <div className="mx-metric mx-reveal" style={delay(i)} key={m.label}>
              <div className="mx-metric-num">{m.num}</div>
              <div className="mx-mono mx-metric-label">{m.label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* SOLUTIONS */}
      <div className="mx-section mx-solutions" id="solutions">
        <div className="mx-wrap">
          <h2 className="mx-h2 mx-reveal">Comprehensive Logistics <span className="dim">Solutions</span></h2>
          <div className="mx-cards">
            {SOLUTIONS.map((s, i) => (
              <div className="mx-card mx-reveal" style={delay(i)} key={s.title}>
                <span className="mx-card-icon"><s.Icon size={22} /></span>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* JOURNEY */}
      <div className="mx-section mx-dark mx-journey" id="journey">
        <div className="mx-wrap">
          <h2 className="mx-h2 mx-reveal">A Streamlined <span className="dim">Journey</span></h2>
          <ol className="mx-steps">
            {JOURNEY.map((title, i) => (
              <li key={title} className="mx-step mx-reveal" style={delay(i)}>
                <span className="mx-step-n mx-mono">{String(i + 1).padStart(2, '0')}</span>
                <h4>{title}</h4>
              </li>
            ))}
          </ol>
        </div>
      </div>

      {/* REVIEWS */}
      <div className="mx-section mx-reviews" id="reviews">
        <div className="mx-wrap">
          <h2 className="mx-h2 mx-reveal">What Our <span className="dim">Customers Say</span></h2>
          <div className="mx-reviews-grid">
            {REVIEWS.map((r, i) => (
              <figure className="mx-review mx-reveal" style={delay(i)} key={r.name}>
                <blockquote>&ldquo;{r.text}&rdquo;</blockquote>
                <figcaption>
                  <img src={r.img} alt={r.name} loading="lazy" width="44" height="44" />
                  <div>
                    <strong>{r.name}</strong>
                    <span className="mx-mono">{r.role}</span>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </div>

      {/* FAQ */}
      <div className="mx-section mx-faq" id="faq">
        <div className="mx-wrap mx-faq-wrap">
          <h2 className="mx-h2 mx-reveal">Frequently Asked <span className="dim">Questions</span></h2>
          <div className="mx-faq-list mx-reveal">
            {FAQS.map((f, i) => <FaqItem key={f.q} q={f.q} a={f.a} defaultOpen={i === 0} />)}
          </div>
        </div>
      </div>

      {/* CTA */}
      <div className="mx-section mx-cta-wrap">
        <div className="mx-wrap">
          <div className="mx-cta mx-reveal">
            <span className="mx-stripes" aria-hidden="true"><i /><i /><i /></span>
            <h2>Ready to Optimize Your Logistics?</h2>
            <div className="mx-cta-row">
              <button type="button" className="mx-btn mx-btn-white" onClick={openPortal}>Create Business Account <ArrowRight size={15} /></button>
              <button type="button" className="mx-btn mx-btn-outline" onClick={openPortal}>Contact Sales Expert</button>
            </div>
          </div>
        </div>
      </div>

      {/* FOOTER */}
      <footer className="mx-footer">
        <div className="mx-wrap">
          <div className="mx-footer-top">
            <Brand onClick={() => scrollToId('home-top')} />
            <nav className="mx-footer-links" aria-label="Footer">
              <a href="#home">Services</a>
              <a href="#home">Support</a>
              <a href="#home">Company</a>
              <a href="#home">Privacy Notice</a>
              <a href="#home">Service Terms</a>
            </nav>
          </div>
          <div className="mx-footer-bottom mx-mono">
            <span>© 2026 Apex Global Logistics Portal. All rights reserved.</span>
          </div>
        </div>
      </footer>
    </section>
  );
}