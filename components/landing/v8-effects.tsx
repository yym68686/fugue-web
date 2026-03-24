"use client";

import { useEffect } from "react";

declare global {
  interface Window {
    UnicornStudio?: {
      init: () => void;
    };
  }
}

const UNICORN_SCRIPT_SRC =
  "https://cdn.jsdelivr.net/gh/hiunicornstudio/unicornstudio.js@v2.0.5/dist/unicornStudio.umd.js";

export function LandingV8Effects() {
  useEffect(() => {
    const hero = document.querySelector(".hero");

    if (!hero) {
      return;
    }

    const body = document.body;
    const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const timeouts: number[] = [];
    const cleanups: Array<() => void> = [];
    let sceneObserver: MutationObserver | null = null;
    let sectionObserver: IntersectionObserver | null = null;

    body.classList.remove("is-ready", "has-scene", "is-fallback", "menu-open");

    function trackTimeout(timeoutId: number) {
      timeouts.push(timeoutId);
    }

    function markPageReady() {
      window.requestAnimationFrame(() => {
        body.classList.add("is-ready");
      });
    }

    function ensureUnicornScript(onReady: () => void) {
      if (window.UnicornStudio && typeof window.UnicornStudio.init === "function") {
        onReady();
        return;
      }

      let script = document.querySelector(
        'script[data-unicorn-script="true"]',
      ) as HTMLScriptElement | null;

      if (!script) {
        script = document.createElement("script");
        script.src = UNICORN_SCRIPT_SRC;
        script.async = true;
        script.dataset.unicornScript = "true";
        document.head.appendChild(script);
      }

      const handleLoad = () => {
        onReady();
      };

      script.addEventListener("load", handleLoad, { once: true });
      cleanups.push(() => {
        script?.removeEventListener("load", handleLoad);
      });
    }

    function initUnicornScene() {
      const scene = document.getElementById("unicorn-scene");

      trackTimeout(window.setTimeout(markPageReady, prefersReducedMotion ? 0 : 120));

      if (!scene) {
        return;
      }

      if (prefersReducedMotion) {
        body.classList.add("is-fallback");
        return;
      }

      const hasCanvas = () => Boolean(scene.querySelector("canvas"));

      const maybeInit = () => {
        if (hasCanvas() || scene.getAttribute("data-us-initialized") === "true") {
          body.classList.add("has-scene");
          return;
        }

        if (!window.UnicornStudio || typeof window.UnicornStudio.init !== "function") {
          return;
        }

        try {
          window.UnicornStudio.init();
        } catch {
          body.classList.add("is-fallback");
        }
      };

      if (hasCanvas()) {
        body.classList.add("has-scene");
      }

      sceneObserver = new MutationObserver(() => {
        if (!hasCanvas()) {
          return;
        }

        body.classList.add("has-scene");
        sceneObserver?.disconnect();
      });

      sceneObserver.observe(scene, {
        childList: true,
        subtree: true,
      });

      ensureUnicornScript(maybeInit);

      trackTimeout(
        window.setTimeout(() => {
          if (hasCanvas()) {
            return;
          }

          body.classList.add("is-fallback");
          sceneObserver?.disconnect();
        }, 4200),
      );
    }

    function initSectionReveal() {
      const sections = Array.from(document.querySelectorAll(".section"));

      if (prefersReducedMotion || !("IntersectionObserver" in window)) {
        sections.forEach((section) => section.classList.add("is-visible"));
        return;
      }

      sectionObserver = new IntersectionObserver(
        (entries) => {
          entries.forEach((entry) => {
            if (!entry.isIntersecting) {
              return;
            }

            entry.target.classList.add("is-visible");
            sectionObserver?.unobserve(entry.target);
          });
        },
        {
          threshold: 0.14,
          rootMargin: "0px 0px -10% 0px",
        },
      );

      sections.forEach((section) => sectionObserver?.observe(section));
    }

    function initMobileMenu() {
      const toggle = document.querySelector(".menu-toggle") as HTMLButtonElement | null;
      const sheet = document.getElementById("mobile-menu");
      const links = Array.from(document.querySelectorAll(".mobile-nav a"));

      if (!toggle || !sheet) {
        return;
      }

      const closeMenu = () => {
        body.classList.remove("menu-open");
        toggle.setAttribute("aria-expanded", "false");
        sheet.hidden = true;
      };

      const openMenu = () => {
        body.classList.add("menu-open");
        toggle.setAttribute("aria-expanded", "true");
        sheet.hidden = false;
      };

      const handleToggle = () => {
        const expanded = toggle.getAttribute("aria-expanded") === "true";

        if (expanded) {
          closeMenu();
          return;
        }

        openMenu();
      };

      closeMenu();
      toggle.addEventListener("click", handleToggle);
      cleanups.push(() => toggle.removeEventListener("click", handleToggle));

      links.forEach((link) => {
        const handleClick = () => {
          closeMenu();
        };

        link.addEventListener("click", handleClick);
        cleanups.push(() => link.removeEventListener("click", handleClick));
      });

      const handleResize = () => {
        if (window.innerWidth > 1220) {
          closeMenu();
        }
      };

      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === "Escape") {
          closeMenu();
        }
      };

      window.addEventListener("resize", handleResize);
      window.addEventListener("keydown", handleKeyDown);

      cleanups.push(() => {
        window.removeEventListener("resize", handleResize);
        window.removeEventListener("keydown", handleKeyDown);
      });
    }

    function initCopyButtons() {
      const buttons = Array.from(document.querySelectorAll("[data-copy-target]"));

      buttons.forEach((button) => {
        const targetId = button.getAttribute("data-copy-target");
        const codeTarget = targetId ? document.getElementById(targetId) : null;

        if (!codeTarget) {
          return;
        }

        const handleClick = async () => {
          const text = codeTarget.innerText.replace(/\u00a0/g, " ");

          try {
            await navigator.clipboard.writeText(text);
          } catch {
            const temp = document.createElement("textarea");
            temp.value = text;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand("copy");
            temp.remove();
          }

          button.textContent = "Copied";
          button.classList.add("is-copied");

          trackTimeout(
            window.setTimeout(() => {
              button.textContent = "Copy command";
              button.classList.remove("is-copied");
            }, 1600),
          );
        };

        button.addEventListener("click", handleClick);
        cleanups.push(() => button.removeEventListener("click", handleClick));
      });
    }

    function initStageTilt() {
      if (prefersReducedMotion || !window.matchMedia("(hover: hover)").matches) {
        return;
      }

      const roots = Array.from(document.querySelectorAll<HTMLElement>("[data-tilt-root]"));

      roots.forEach((root) => {
        const handlePointerMove = (event: Event) => {
          const pointerEvent = event as PointerEvent;
          const rect = root.getBoundingClientRect();
          const x = ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1;
          const y = ((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1;

          root.style.setProperty("--tilt-x", (x * 5).toFixed(2));
          root.style.setProperty("--tilt-y", (y * -3.5).toFixed(2));
        };

        const handlePointerLeave = () => {
          root.style.setProperty("--tilt-x", "0");
          root.style.setProperty("--tilt-y", "0");
        };

        root.addEventListener("pointermove", handlePointerMove);
        root.addEventListener("pointerleave", handlePointerLeave);

        cleanups.push(() => {
          root.removeEventListener("pointermove", handlePointerMove);
          root.removeEventListener("pointerleave", handlePointerLeave);
        });
      });
    }

    initUnicornScene();
    initSectionReveal();
    initMobileMenu();
    initCopyButtons();
    initStageTilt();

    return () => {
      sceneObserver?.disconnect();
      sectionObserver?.disconnect();
      cleanups.forEach((cleanup) => cleanup());
      timeouts.forEach((timeoutId) => window.clearTimeout(timeoutId));
      body.classList.remove("is-ready", "has-scene", "is-fallback", "menu-open");

      document.querySelectorAll<HTMLElement>("[data-tilt-root]").forEach((root) => {
        root.style.removeProperty("--tilt-x");
        root.style.removeProperty("--tilt-y");
      });
    };
  }, []);

  return null;
}
