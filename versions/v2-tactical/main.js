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
  initStageFocus();
  initFaq();
  initCopyButton();
  initMobileMenu();
  initPlaceholderNotice();
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
      threshold: 0.16,
      rootMargin: "0px 0px -8% 0px",
    },
  );

  sections.forEach((section) => observer.observe(section));
}

function initStageFocus() {
  const stage = document.querySelector(".telemetry-board");
  const focusTriggers = Array.from(document.querySelectorAll("[data-focus]")).filter(
    (element) => element !== stage,
  );

  if (!stage || focusTriggers.length === 0) {
    return;
  }

  const defaultFocus = stage.dataset.focus || "runtime";

  const setFocus = (value) => {
    stage.dataset.focus = value;
  };

  const resetFocus = () => {
    stage.dataset.focus = defaultFocus;
  };

  focusTriggers.forEach((trigger) => {
    const focus = trigger.dataset.focus;
    if (!focus) {
      return;
    }

    trigger.addEventListener("mouseenter", () => setFocus(focus));
    trigger.addEventListener("focus", () => setFocus(focus));
    trigger.addEventListener("mouseleave", resetFocus);
    trigger.addEventListener("blur", resetFocus);
  });
}

function initFaq() {
  const questions = Array.from(document.querySelectorAll(".faq-question"));

  questions.forEach((question) => {
    question.addEventListener("click", () => {
      const isExpanded = question.getAttribute("aria-expanded") === "true";

      questions.forEach((item) => {
        const answer = item.nextElementSibling;
        item.setAttribute("aria-expanded", "false");
        if (answer) {
          answer.hidden = true;
        }
      });

      if (!isExpanded) {
        const answer = question.nextElementSibling;
        question.setAttribute("aria-expanded", "true");
        if (answer) {
          answer.hidden = false;
        }
      }
    });
  });
}

function initCopyButton() {
  const button = document.querySelector(".copy-button");
  const targetId = button?.dataset.copyTarget;
  const codeTarget = targetId ? document.getElementById(targetId) : null;

  if (!button || !codeTarget) {
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
    if (window.innerWidth > 980) {
      closeMenu();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeMenu();
    }
  });
}

function initPlaceholderNotice() {
  const openers = Array.from(document.querySelectorAll("[data-open-placeholder]"));
  const closers = Array.from(document.querySelectorAll("[data-close-placeholder]"));
  const notice = document.getElementById("placeholder-notice");
  const mobileSheet = document.getElementById("mobile-menu");
  const mobileToggle = document.querySelector(".menu-toggle");

  if (!notice || openers.length === 0) {
    return;
  }

  const closeNotice = () => {
    document.body.classList.remove("notice-open");
    notice.hidden = true;
  };

  const openNotice = () => {
    document.body.classList.remove("menu-open");
    if (mobileToggle) {
      mobileToggle.setAttribute("aria-expanded", "false");
    }
    if (mobileSheet) {
      mobileSheet.hidden = true;
    }
    document.body.classList.add("notice-open");
    notice.hidden = false;
  };

  openers.forEach((opener) => {
    opener.addEventListener("click", openNotice);
  });

  closers.forEach((closer) => {
    closer.addEventListener("click", closeNotice);
  });

  notice.addEventListener("click", (event) => {
    if (event.target === notice) {
      closeNotice();
    }
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !notice.hidden) {
      closeNotice();
    }
  });
}
