const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {
  initUnicornScene();
  initSectionReveal();
  initMobileMenu();
  initCopyButtons();
  initStageTilt();
});

function markPageReady() {
  window.requestAnimationFrame(() => {
    document.body.classList.add("is-ready");
  });
}

function initUnicornScene() {
  const scene = document.getElementById("unicorn-scene");

  window.setTimeout(markPageReady, prefersReducedMotion ? 0 : 120);

  if (!scene) {
    return;
  }

  if (prefersReducedMotion) {
    document.body.classList.add("is-fallback");
    return;
  }

  const hasCanvas = () => Boolean(scene.querySelector("canvas"));

  const maybeInit = () => {
    if (hasCanvas() || scene.dataset.usInitialized === "true") {
      document.body.classList.add("has-scene");
      return;
    }

    if (!window.UnicornStudio || typeof window.UnicornStudio.init !== "function") {
      return;
    }

    try {
      window.UnicornStudio.init();
    } catch {
      document.body.classList.add("is-fallback");
    }
  };

  if (hasCanvas()) {
    document.body.classList.add("has-scene");
  }

  const observer = new MutationObserver(() => {
    if (!hasCanvas()) {
      return;
    }

    document.body.classList.add("has-scene");
    observer.disconnect();
  });

  observer.observe(scene, {
    childList: true,
    subtree: true,
  });

  if (window.UnicornStudio && typeof window.UnicornStudio.init === "function") {
    maybeInit();
  } else {
    window.addEventListener("load", maybeInit, { once: true });
  }

  window.setTimeout(() => {
    if (hasCanvas()) {
      return;
    }

    document.body.classList.add("is-fallback");
    observer.disconnect();
  }, 2600);
}

function initSectionReveal() {
  const sections = Array.from(document.querySelectorAll(".section"));

  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    sections.forEach((section) => section.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) {
          return;
        }

        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      });
    },
    {
      threshold: 0.14,
      rootMargin: "0px 0px -10% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function initMobileMenu() {
  const toggle = document.querySelector(".menu-toggle");
  const sheet = document.getElementById("mobile-menu");
  const links = Array.from(document.querySelectorAll(".mobile-nav a"));

  if (!toggle || !sheet) {
    return;
  }

  const closeMenu = () => {
    document.body.classList.remove("menu-open");
    toggle.setAttribute("aria-expanded", "false");
    sheet.hidden = true;
  };

  const openMenu = () => {
    document.body.classList.add("menu-open");
    toggle.setAttribute("aria-expanded", "true");
    sheet.hidden = false;
  };

  closeMenu();

  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";

    if (expanded) {
      closeMenu();
      return;
    }

    openMenu();
  });

  links.forEach((link) => {
    link.addEventListener("click", closeMenu);
  });

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1220) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function initCopyButtons() {
  const buttons = Array.from(document.querySelectorAll("[data-copy-target]"));

  buttons.forEach((button) => {
    const targetId = button.dataset.copyTarget;
    const codeTarget = targetId ? document.getElementById(targetId) : null;

    if (!codeTarget) {
      return;
    }

    button.addEventListener("click", async () => {
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

      window.setTimeout(() => {
        button.textContent = "Copy command";
        button.classList.remove("is-copied");
      }, 1600);
    });
  });
}

function initStageTilt() {
  if (prefersReducedMotion || !window.matchMedia("(hover: hover)").matches) {
    return;
  }

  const roots = Array.from(document.querySelectorAll("[data-tilt-root]"));

  roots.forEach((root) => {
    root.addEventListener("pointermove", (event) => {
      const rect = root.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      const y = ((event.clientY - rect.top) / rect.height) * 2 - 1;

      root.style.setProperty("--tilt-x", (x * 5).toFixed(2));
      root.style.setProperty("--tilt-y", (y * -3.5).toFixed(2));
    });

    root.addEventListener("pointerleave", () => {
      root.style.setProperty("--tilt-x", "0");
      root.style.setProperty("--tilt-y", "0");
    });
  });
}
