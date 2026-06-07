/* Interaction & motion layer — premium, cohesive, with safe fallbacks.
   Plain-JS features (rotator, drag, counters, magnetic) work without GSAP.
   GSAP drives the scroll-linked reveals / parallax when available. */
(function () {
  "use strict";

  const docEl = document.documentElement;
  const prefersReduced = window.matchMedia(
    "(prefers-reduced-motion: reduce)"
  ).matches;
  const hasGSAP = !!window.gsap;

  /* ---- Nav scrolled state ---- */
  const nav = document.getElementById("nav");
  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  /* ---- Seamless loops: ticker + auto marquees (no manual scroll) ---- */
  const ticker = document.getElementById("ticker");
  if (ticker) ticker.innerHTML += ticker.innerHTML;

  document.querySelectorAll("[data-marquee] .marquee__track").forEach((track) => {
    track.innerHTML += track.innerHTML;
  });

  /* ---- Rotating hero kicker ---- */
  if (!prefersReduced) {
    const r = document.getElementById("rotator");
    if (r) {
      const items = Array.from(r.querySelectorAll("span"));
      if (items.length > 1) {
        let i = 0;
        setInterval(() => {
          const cur = items[i];
          const ni = (i + 1) % items.length;
          const nxt = items[ni];
          cur.classList.remove("is-active");
          cur.classList.add("is-out");
          nxt.classList.remove("is-out");
          nxt.classList.add("is-active");
          setTimeout(() => cur.classList.remove("is-out"), 600);
          i = ni;
        }, 2600);
      }
    }
  }

  /* ---- Count-up stats ---- */
  const counters = document.querySelectorAll("[data-count]");
  if (counters.length) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((en) => {
          if (en.isIntersecting) {
            countUp(en.target);
            io.unobserve(en.target);
          }
        });
      },
      { threshold: 0.4 }
    );
    counters.forEach((el) => { if (!el.dataset.plain) io.observe(el); });
  }
  function countUp(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || "";
    const dur = 1300;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- Magnetic buttons (subtle, single signature micro-interaction) ---- */
  if (!prefersReduced && window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rct = el.getBoundingClientRect();
        const mx = e.clientX - (rct.left + rct.width / 2);
        const my = e.clientY - (rct.top + rct.height / 2);
        el.style.transform = `translate(${mx * 0.22}px, ${my * 0.34}px)`;
      });
      el.addEventListener("pointerleave", () => { el.style.transform = ""; });
    });
  }

  /* ---- GSAP scroll-linked reveals / parallax ---- */
  if (!hasGSAP || prefersReduced) {
    // Fallback: cancel CSS initial hidden states so everything is visible.
    docEl.classList.remove("js");
    return;
  }

  gsap.registerPlugin(ScrollTrigger);

  // Generic reveals (text, blocks) — services get a dedicated stagger below
  gsap.utils.toArray("[data-reveal]").forEach((el) => {
    if (el.classList.contains("service")) return;
    gsap.to(el, {
      opacity: 1,
      y: 0,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 86%" },
    });
  });

  // Services: cascade in one after another
  const servicesList = document.querySelector(".services__list");
  if (servicesList) {
    gsap.to(".service", {
      opacity: 1,
      y: 0,
      duration: 0.75,
      stagger: 0.08,
      ease: "power3.out",
      scrollTrigger: { trigger: servicesList, start: "top 82%" },
    });
  }

  // Marquee sections fade/slide in when they enter view
  gsap.utils.toArray("[data-marquee]").forEach((el) => {
    gsap.from(el, {
      opacity: 0,
      y: 36,
      duration: 1,
      ease: "power3.out",
      scrollTrigger: { trigger: el, start: "top 88%" },
    });
  });

  // Image clip reveals + de-scale
  gsap.utils.toArray("[data-img-wrap]").forEach((w) => {
    const img = w.querySelector("img");
    const tl = gsap.timeline({ scrollTrigger: { trigger: w, start: "top 84%" } });
    tl.to(w, { clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: "power3.out" });
    if (img) tl.to(img, { scale: 1, duration: 1.3, ease: "power3.out" }, 0);
  });

  // Parallax on full-bleed background images
  gsap.utils.toArray("img[data-parallax]").forEach((img) => {
    gsap.fromTo(
      img,
      { yPercent: -8 },
      {
        yPercent: 8,
        ease: "none",
        scrollTrigger: {
          trigger: img.closest("section") || img,
          start: "top bottom",
          end: "bottom top",
          scrub: true,
        },
      }
    );
  });

  // Hero content drifts up + fades as you scroll past (parent only — children
  // keep their own entrance animation, so no conflict)
  const heroContent = document.querySelector("[data-hero]");
  if (heroContent) {
    gsap.to(heroContent, {
      yPercent: -16,
      opacity: 0,
      ease: "none",
      scrollTrigger: {
        trigger: ".hero",
        start: "top top",
        end: "bottom top",
        scrub: true,
      },
    });
  }

  // Floating system components: gentle scroll parallax (desktop) + fade-in.
  const floats = gsap.utils.toArray("[data-float]");
  const allowFloatParallax = window.matchMedia("(min-width: 761px)").matches;
  floats.forEach((el, i) => {
    gsap.from(el, {
      opacity: 0,
      duration: 0.8,
      ease: "power2.out",
      delay: i * 0.06,
      scrollTrigger: { trigger: ".system", start: "top 72%" },
    });
    if (allowFloatParallax) {
      const dir = i % 2 === 0 ? -1 : 1;
      gsap.fromTo(
        el,
        { yPercent: dir * -16 },
        {
          yPercent: dir * 16,
          ease: "none",
          scrollTrigger: {
            trigger: ".system",
            start: "top bottom",
            end: "bottom top",
            scrub: true,
          },
        }
      );
    }
  });

  // Recompute after fonts / lazy images settle
  window.addEventListener("load", () => ScrollTrigger.refresh());
})();
