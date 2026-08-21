// FreelanceOS Landing Page Client Interactions
// Pure vanilla JS: handles mobile navigation and accessible FAQ accordion without external network calls.

document.addEventListener("DOMContentLoaded", () => {
  // 1. Mobile Navigation Toggle
  const mobileToggle = document.getElementById("mobile-menu-toggle");
  const mainNav = document.getElementById("main-nav");

  if (mobileToggle && mainNav) {
    mobileToggle.addEventListener("click", () => {
      const isExpanded = mobileToggle.getAttribute("aria-expanded") === "true";
      const nextState = !isExpanded;

      mobileToggle.setAttribute("aria-expanded", String(nextState));
      mainNav.classList.toggle("nav-open", nextState);
    });

    // Close menu when a navigation anchor is clicked
    const navLinks = mainNav.querySelectorAll("a");
    navLinks.forEach((link) => {
      link.addEventListener("click", () => {
        if (mainNav.classList.contains("nav-open")) {
          mainNav.classList.remove("nav-open");
          mobileToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  // 2. Accessible FAQ Accordion
  const faqButtons = document.querySelectorAll(".faq-question");

  faqButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const isExpanded = button.getAttribute("aria-expanded") === "true";
      const answerId = button.getAttribute("aria-controls");
      const answerEl = answerId ? document.getElementById(answerId) : null;

      // Close other accordion items for clean single-expand behavior
      faqButtons.forEach((otherBtn) => {
        if (otherBtn !== button) {
          otherBtn.setAttribute("aria-expanded", "false");
          const otherAnsId = otherBtn.getAttribute("aria-controls");
          const otherAns = otherAnsId ? document.getElementById(otherAnsId) : null;
          if (otherAns) {
            otherAns.classList.add("hidden");
          }
          const otherIcon = otherBtn.querySelector(".faq-icon");
          if (otherIcon) {
            otherIcon.textContent = "+";
          }
        }
      });

      // Toggle current accordion item
      const nextState = !isExpanded;
      button.setAttribute("aria-expanded", String(nextState));
      if (answerEl) {
        answerEl.classList.toggle("hidden", !nextState);
      }

      const icon = button.querySelector(".faq-icon");
      if (icon) {
        icon.textContent = nextState ? "−" : "+";
      }
    });
  });
});
