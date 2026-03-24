const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.addEventListener("DOMContentLoaded", () => {
  if (!prefersReducedMotion) {
    requestAnimationFrame(() => {
      document.body.classList.add("is-loaded");
    });
  } else {
    document.body.classList.add("is-loaded");
  }

  initSectionReveal();
  initMobileMenu();
  initFocusSync();
  initAnswerTabs();
  initCopyButtons();
  initSurfaceGlints();
});

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
      rootMargin: "0px 0px -8% 0px",
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

  links.forEach((link) => link.addEventListener("click", closeMenu));

  window.addEventListener("resize", () => {
    if (window.innerWidth > 1180) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function initFocusSync() {
  const roots = Array.from(document.querySelectorAll("[data-focus-root]"));
  const triggers = Array.from(document.querySelectorAll("[data-focus]")).filter(
    (element) => !element.hasAttribute("data-focus-root"),
  );

  if (roots.length === 0 || triggers.length === 0) {
    return;
  }

  const defaultFocus = roots[0].dataset.focus || "shared";
  let lockedFocus = null;

  const applyFocus = (value) => {
    roots.forEach((root) => {
      root.dataset.focus = value;
    });

    triggers.forEach((trigger) => {
      const isActive = trigger.dataset.focus === value;
      trigger.classList.toggle("is-active", isActive);

      if (trigger.tagName === "BUTTON") {
        trigger.setAttribute("aria-pressed", String(isActive));
      }
    });
  };

  const resetFocus = () => {
    applyFocus(lockedFocus || defaultFocus);
  };

  applyFocus(defaultFocus);

  triggers.forEach((trigger) => {
    const focus = trigger.dataset.focus;
    if (!focus) {
      return;
    }

    trigger.addEventListener("mouseenter", () => applyFocus(focus));
    trigger.addEventListener("focus", () => applyFocus(focus));
    trigger.addEventListener("mouseleave", resetFocus);
    trigger.addEventListener("blur", resetFocus);
    trigger.addEventListener("click", () => {
      lockedFocus = focus;
      applyFocus(focus);
    });
  });
}

function initAnswerTabs() {
  const tabs = Array.from(document.querySelectorAll(".answer-tab"));

  if (tabs.length === 0) {
    return;
  }

  const activateTab = (activeTab) => {
    const targetId = activeTab.dataset.answerTarget;

    tabs.forEach((tab) => {
      const panelId = tab.dataset.answerTarget;
      const panel = panelId ? document.getElementById(panelId) : null;
      const isActive = tab === activeTab;

      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
      tab.tabIndex = isActive ? 0 : -1;

      if (panel) {
        panel.hidden = !isActive;
        panel.classList.toggle("is-active", isActive);
      }
    });
  };

  tabs.forEach((tab, index) => {
    tab.addEventListener("click", () => activateTab(tab));

    tab.addEventListener("keydown", (event) => {
      if (
        event.key !== "ArrowDown" &&
        event.key !== "ArrowUp" &&
        event.key !== "ArrowRight" &&
        event.key !== "ArrowLeft"
      ) {
        return;
      }

      event.preventDefault();
      const delta = event.key === "ArrowDown" || event.key === "ArrowRight" ? 1 : -1;
      const nextIndex = (index + delta + tabs.length) % tabs.length;
      tabs[nextIndex].focus();
      activateTab(tabs[nextIndex]);
    });
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

function initSurfaceGlints() {
  if (prefersReducedMotion) {
    return;
  }

  const surfaces = Array.from(document.querySelectorAll("[data-surface-glint]"));

  surfaces.forEach((surface) => {
    const reset = () => {
      surface.style.setProperty("--pointer-x", "50%");
      surface.style.setProperty("--pointer-y", "24%");
    };

    reset();

    surface.addEventListener("pointermove", (event) => {
      const rect = surface.getBoundingClientRect();
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;

      surface.style.setProperty("--pointer-x", `${x.toFixed(2)}%`);
      surface.style.setProperty("--pointer-y", `${y.toFixed(2)}%`);
    });

    surface.addEventListener("pointerleave", reset);
  });
}
