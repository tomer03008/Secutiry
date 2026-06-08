/* Core interactions + optional GSAP (desktop only). Mobile uses lite mode. */
(function () {
  "use strict";

  const docEl = document.documentElement;
  const isLite = docEl.classList.contains("lite");
  const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---- Nav scrolled state + mobile menu ---- */
  const nav = document.getElementById("nav");
  const navToggle = document.getElementById("nav-toggle");
  const navBackdrop = document.getElementById("nav-backdrop");
  const navMenu = document.getElementById("nav-menu");

  function closeNav() {
    if (!nav) return;
    nav.classList.remove("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "false");
    if (navBackdrop) {
      navBackdrop.classList.remove("is-visible");
      navBackdrop.hidden = true;
    }
    document.body.style.overflow = "";
  }

  function openNav() {
    if (!nav) return;
    nav.classList.add("is-open");
    if (navToggle) navToggle.setAttribute("aria-expanded", "true");
    if (navBackdrop) {
      navBackdrop.hidden = false;
      requestAnimationFrame(() => navBackdrop.classList.add("is-visible"));
    }
    document.body.style.overflow = "hidden";
  }

  if (nav) {
    const onScroll = () => nav.classList.toggle("is-scrolled", window.scrollY > 40);
    window.addEventListener("scroll", onScroll, { passive: true });
    onScroll();
  }

  if (navToggle && navMenu) {
    navToggle.addEventListener("click", () => {
      if (nav.classList.contains("is-open")) closeNav();
      else openNav();
    });
    navMenu.querySelectorAll("a").forEach((link) => link.addEventListener("click", closeNav));
    if (navBackdrop) navBackdrop.addEventListener("click", closeNav);
    window.addEventListener("resize", () => {
      if (window.innerWidth > 900) closeNav();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeNav();
    });
  }

  /* ---- Ticker + marquees ---- */
  const ticker = document.getElementById("ticker");
  if (ticker && !prefersReduced) ticker.innerHTML += ticker.innerHTML;

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
    counters.forEach((el) => {
      if (!el.dataset.plain) io.observe(el);
    });
  }

  function countUp(el) {
    const target = parseInt(el.dataset.count, 10) || 0;
    const suffix = el.dataset.suffix || "";
    const dur = isLite ? 900 : 1300;
    const t0 = performance.now();
    function step(t) {
      const p = Math.min((t - t0) / dur, 1);
      const e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(target * e) + suffix;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---- Mobile lite: skip heavy animation libs ---- */
  if (isLite || prefersReduced) {
    docEl.classList.remove("js");
    return;
  }

  /* ---- Magnetic buttons (desktop pointer only) ---- */
  if (window.matchMedia("(pointer:fine)").matches) {
    document.querySelectorAll(".magnetic").forEach((el) => {
      el.addEventListener("pointermove", (e) => {
        const rct = el.getBoundingClientRect();
        const mx = e.clientX - (rct.left + rct.width / 2);
        const my = e.clientY - (rct.top + rct.height / 2);
        el.style.transform = `translate(${mx * 0.22}px, ${my * 0.34}px)`;
      });
      el.addEventListener("pointerleave", () => {
        el.style.transform = "";
      });
    });
  }

  /* ---- GSAP (desktop only, loaded on demand) ---- */
  loadScript("https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/gsap.min.js")
    .then(() => loadScript("https://cdn.jsdelivr.net/npm/gsap@3.12.5/dist/ScrollTrigger.min.js"))
    .then(initGSAP)
    .catch(() => docEl.classList.remove("js"));

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = src;
      s.async = true;
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
  }

  function initGSAP() {
    if (!window.gsap) {
      docEl.classList.remove("js");
      return;
    }

    gsap.registerPlugin(ScrollTrigger);

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

    gsap.utils.toArray("[data-marquee]").forEach((el) => {
      gsap.from(el, {
        opacity: 0,
        y: 36,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: { trigger: el, start: "top 88%" },
      });
    });

    gsap.utils.toArray("[data-img-wrap]").forEach((w) => {
      const img = w.querySelector("img");
      const tl = gsap.timeline({ scrollTrigger: { trigger: w, start: "top 84%" } });
      tl.to(w, { clipPath: "inset(0 0 0% 0)", duration: 1.1, ease: "power3.out" });
      if (img) tl.to(img, { scale: 1, duration: 1.3, ease: "power3.out" }, 0);
    });

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

    const heroContent = document.querySelector("[data-hero]");
    if (heroContent && window.matchMedia("(min-width: 901px)").matches) {
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

    const floats = gsap.utils.toArray("[data-float]");
    floats.forEach((el, i) => {
      gsap.from(el, {
        opacity: 0,
        duration: 0.8,
        ease: "power2.out",
        delay: i * 0.06,
        scrollTrigger: { trigger: ".system", start: "top 72%" },
      });
      if (window.matchMedia("(min-width: 761px)").matches) {
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

    window.addEventListener("load", () => ScrollTrigger.refresh());
  }
})();
