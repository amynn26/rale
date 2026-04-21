// ================================================================
// Association RALE — main.js
// Toute la logique front-end du site
// ================================================================

document.addEventListener("DOMContentLoaded", () => {
  // ──────────────────────────────────────────
  // 1. ANNÉE DYNAMIQUE
  // ──────────────────────────────────────────
  const yearEl = document.getElementById("current-year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ──────────────────────────────────────────
  // 2. EN-TÊTE COLLANT (classe is-scrolled)
  // ──────────────────────────────────────────
  const header = document.getElementById("header");
  const SCROLL_THRESHOLD = 60;

  function updateHeader() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > SCROLL_THRESHOLD);
  }
  updateHeader();
  window.addEventListener("scroll", updateHeader, { passive: true });

  // ──────────────────────────────────────────
  // 3. MENU HAMBURGER MOBILE
  // ──────────────────────────────────────────
  const hamburger = document.getElementById("hamburger");
  const nav = document.getElementById("nav");

  if (hamburger && nav) {
    hamburger.addEventListener("click", () => {
      const isOpen = hamburger.classList.toggle("is-open");
      nav.classList.toggle("is-open", isOpen);
      document.body.classList.toggle("menu-open", isOpen);
      hamburger.setAttribute("aria-expanded", String(isOpen));
    });

    // Fermer le menu quand on clique sur un lien
    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        hamburger.classList.remove("is-open");
        nav.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        hamburger.setAttribute("aria-expanded", "false");
      });
    });

    // Fermer avec Escape
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && nav.classList.contains("is-open")) {
        hamburger.classList.remove("is-open");
        nav.classList.remove("is-open");
        document.body.classList.remove("menu-open");
        hamburger.setAttribute("aria-expanded", "false");
        hamburger.focus();
      }
    });
  }

  // ──────────────────────────────────────────
  // 4. SLIDER HÉROS
  // ──────────────────────────────────────────
  const slides = document.querySelectorAll(".hero__slide");
  const dots = document.querySelectorAll(".hero__dot");
  const prevBtn = document.getElementById("hero-prev");
  const nextBtn = document.getElementById("hero-next");
  let current = 0;
  let autoTimer = null;
  const AUTO_DELAY = 5500;

  function goToSlide(idx) {
    if (!slides.length) return;
    slides[current].classList.remove("hero__slide--active");
    slides[current].setAttribute("aria-hidden", "true");
    dots[current]?.classList.remove("hero__dot--active");
    dots[current]?.setAttribute("aria-selected", "false");

    current = (idx + slides.length) % slides.length;

    slides[current].classList.add("hero__slide--active");
    slides[current].setAttribute("aria-hidden", "false");
    dots[current]?.classList.add("hero__dot--active");
    dots[current]?.setAttribute("aria-selected", "true");
  }

  function startAuto() {
    stopAuto();
    autoTimer = setInterval(() => goToSlide(current + 1), AUTO_DELAY);
  }

  function stopAuto() {
    clearInterval(autoTimer);
  }

  if (slides.length > 1) {
    prevBtn?.addEventListener("click", () => {
      goToSlide(current - 1);
      startAuto();
    });
    nextBtn?.addEventListener("click", () => {
      goToSlide(current + 1);
      startAuto();
    });

    dots.forEach((dot) => {
      dot.addEventListener("click", () => {
        goToSlide(Number(dot.dataset.slide));
        startAuto();
      });
    });

    // Pause au survol
    const slider = document.getElementById("hero-slider");
    slider?.addEventListener("mouseenter", stopAuto);
    slider?.addEventListener("mouseleave", startAuto);

    // Swipe tactile
    let touchStartX = 0;
    slider?.addEventListener(
      "touchstart",
      (e) => {
        touchStartX = e.touches[0].clientX;
      },
      { passive: true },
    );
    slider?.addEventListener("touchend", (e) => {
      const delta = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(delta) > 50) {
        goToSlide(delta < 0 ? current + 1 : current - 1);
        startAuto();
      }
    });

    startAuto();
  }

  // ──────────────────────────────────────────
  // 5. ACCESSIBILITÉ — taille de texte & contraste
  // ──────────────────────────────────────────
  const PREF_KEY_SIZE = "rale-text-size";
  const PREF_KEY_CONTRAST = "rale-high-contrast";

  const btnNormal = document.getElementById("text-normal");
  const btnLarge = document.getElementById("text-large");
  const btnContrast = document.getElementById("contrast-toggle");

  function applyTextSize(size) {
    document.body.classList.remove("text-lg", "text-xl");
    btnNormal?.classList.remove("is-active");
    btnLarge?.classList.remove("is-active");

    if (size === "lg") {
      document.body.classList.add("text-lg");
      btnLarge?.classList.add("is-active");
    } else if (size === "xl") {
      document.body.classList.add("text-xl");
      btnLarge?.classList.add("is-active");
    } else {
      btnNormal?.classList.add("is-active");
    }
    localStorage.setItem(PREF_KEY_SIZE, size || "normal");
  }

  function applyContrast(on) {
    document.body.classList.toggle("high-contrast", on);
    btnContrast?.classList.toggle("is-active", on);
    localStorage.setItem(PREF_KEY_CONTRAST, String(on));
  }

  // Restaurer les préférences
  applyTextSize(localStorage.getItem(PREF_KEY_SIZE) || "normal");
  applyContrast(localStorage.getItem(PREF_KEY_CONTRAST) === "true");

  btnNormal?.addEventListener("click", () => applyTextSize("normal"));
  btnLarge?.addEventListener("click", () => {
    const current = document.body.classList.contains("text-xl")
      ? "normal"
      : document.body.classList.contains("text-lg")
        ? "xl"
        : "lg";
    applyTextSize(current);
  });
  btnContrast?.addEventListener("click", () =>
    applyContrast(!document.body.classList.contains("high-contrast")),
  );

  // ──────────────────────────────────────────
  // 6. BOUTON RETOUR EN HAUT
  // ──────────────────────────────────────────
  const backToTop = document.getElementById("back-to-top");
  if (backToTop) {
    function updateBackToTop() {
      backToTop.classList.toggle("is-visible", window.scrollY > 400);
    }
    updateBackToTop();
    window.addEventListener("scroll", updateBackToTop, { passive: true });
    backToTop.addEventListener("click", () => {
      window.scrollTo({ top: 0, behavior: "smooth" });
    });
  }

  // ──────────────────────────────────────────
  // 7. ANIMATION AU DÉFILEMENT (Intersection Observer)
  // ──────────────────────────────────────────
  const animatedEls = document.querySelectorAll("[data-animate]");

  if (animatedEls.length) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -48px 0px" },
    );
    animatedEls.forEach((el) => observer.observe(el));
  }

  // ──────────────────────────────────────────
  // 8. LIEN ACTIF DANS LA NAVIGATION (scroll spy)
  // ──────────────────────────────────────────
  const sections = document.querySelectorAll("section[id], div[id]");
  const navLinks = document.querySelectorAll(".nav__link");

  const spyObserver = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          const id = entry.target.id;
          navLinks.forEach((link) => {
            const href = link.getAttribute("href");
            const active =
              href === `#${id}` ||
              (id === "about" && href === "#about") ||
              (id === "team" && href === "#about") ||
              (id === "values" && href === "#about") ||
              (id === "join" && href === "#events") ||
              (id === "volunteer" && href === "#events") ||
              (id === "donate" && href === "#donate");
            link.classList.toggle("is-active", active);
          });
        }
      });
    },
    {
      threshold: 0.35,
      rootMargin: `-${parseInt(getComputedStyle(document.documentElement).getPropertyValue("--header-height") || "72")}px 0px 0px 0px`,
    },
  );

  sections.forEach((s) => spyObserver.observe(s));

  // ──────────────────────────────────────────
  // 9. FORMULAIRE DE CONTACT
  // ──────────────────────────────────────────
  const form = document.getElementById("contact-form");
  const submitBtn = document.getElementById("submit-btn");
  const successEl = document.getElementById("form-success");

  const FIELDS = [
    {
      id: "c-nom",
      errId: "err-nom",
      label: "Le nom",
      validate: (v) => v.trim().length >= 2,
    },
    {
      id: "c-prenom",
      errId: "err-prenom",
      label: "Le prénom",
      validate: (v) => v.trim().length >= 2,
    },
    {
      id: "c-email",
      errId: "err-email",
      label: "L'email",
      validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()),
    },
    {
      id: "c-sujet",
      errId: "err-sujet",
      label: "Le sujet",
      validate: (v) => v.trim() !== "",
    },
    {
      id: "c-message",
      errId: "err-message",
      label: "Le message",
      validate: (v) => v.trim().length >= 10,
    },
  ];

  function showError(field) {
    const el = document.getElementById(field.id);
    const err = document.getElementById(field.errId);
    if (!el || !err) return;
    el.classList.add("is-invalid");
    el.classList.remove("is-valid");
    err.textContent = `${field.label} est requis et doit être valide.`;
  }

  function clearError(field) {
    const el = document.getElementById(field.id);
    const err = document.getElementById(field.errId);
    if (!el || !err) return;
    el.classList.remove("is-invalid");
    el.classList.add("is-valid");
    err.textContent = "";
  }

  function validateForm() {
    let ok = true;
    FIELDS.forEach((field) => {
      const el = document.getElementById(field.id);
      if (!el) return;
      if (field.validate(el.value)) {
        clearError(field);
      } else {
        showError(field);
        ok = false;
      }
    });

    // Checkbox RGPD
    const rgpd = document.getElementById("c-rgpd");
    const rgpdErr = document.getElementById("err-rgpd");
    if (rgpd && !rgpd.checked) {
      if (rgpdErr)
        rgpdErr.textContent =
          "Vous devez accepter notre politique de confidentialité.";
      ok = false;
    } else if (rgpdErr) {
      rgpdErr.textContent = "";
    }

    return ok;
  }

  // Validation en temps réel
  FIELDS.forEach((field) => {
    const el = document.getElementById(field.id);
    el?.addEventListener("blur", () => {
      if (field.validate(el.value)) clearError(field);
      else showError(field);
    });
  });

  const serverErrorEl    = document.getElementById("form-server-error");
  const serverErrorMsgEl = document.getElementById("form-server-error-msg");

  function showServerError(msg) {
    if (!serverErrorEl || !serverErrorMsgEl) return;
    serverErrorMsgEl.textContent = msg;
    serverErrorEl.hidden = false;
    serverErrorEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function hideServerError() {
    if (serverErrorEl) serverErrorEl.hidden = true;
  }

  if (form && submitBtn && successEl) {
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateForm()) return;

      submitBtn.classList.add("is-loading");
      hideServerError();

      const data = {
        nom:       document.getElementById("c-nom")?.value.trim(),
        prenom:    document.getElementById("c-prenom")?.value.trim(),
        email:     document.getElementById("c-email")?.value.trim(),
        telephone: document.getElementById("c-tel")?.value.trim(),
        sujet:     document.getElementById("c-sujet")?.value,
        message:   document.getElementById("c-message")?.value.trim(),
      };

      try {
        const res    = await fetch("/api/contact", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(data),
        });
        const result = await res.json();

        if (!res.ok) {
          const msg = result.errors?.[0] || result.error || "Une erreur est survenue. Veuillez réessayer.";
          showServerError(msg);
          return;
        }

        // Succès
        form.querySelectorAll("input, textarea, select").forEach((el) => {
          el.value = "";
          el.classList.remove("is-valid", "is-invalid");
        });
        const rgpd = document.getElementById("c-rgpd");
        if (rgpd) rgpd.checked = false;

        successEl.classList.add("is-visible");
        successEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
      } catch {
        showServerError("Impossible de joindre le serveur. Vérifiez votre connexion et réessayez, ou contactez-nous au 07 49 96 63 33.");
      } finally {
        submitBtn.classList.remove("is-loading");
      }
    });
  }

  // ──────────────────────────────────────────
  // 10. WIDGET DE DON — HELLOASSO
  // ──────────────────────────────────────────
  const donateAmountBtns = document.querySelectorAll(".donate-amount-btn");
  const donateCustomInput = document.getElementById("donate-custom-amount");
  const donateImpactMsg   = document.getElementById("donate-impact-msg");
  const donateBtn         = document.getElementById("donate-btn");

  // Montant courant sélectionné (en euros)
  let selectedAmount = 0;

  function setImpactMessage(msg) {
    if (!donateImpactMsg) return;
    if (msg) {
      donateImpactMsg.style.background = "var(--color-primary-lighter)";
      donateImpactMsg.style.color      = "var(--color-primary)";
      donateImpactMsg.textContent      = `✓ ${msg}`;
    } else {
      donateImpactMsg.style.background = "";
      donateImpactMsg.style.color      = "";
      donateImpactMsg.textContent      = "Sélectionnez un montant pour voir l'impact de votre don.";
    }
  }

  function setSelectedAmount(euros) {
    selectedAmount = euros;
    if (donateBtn) {
      donateBtn.disabled = euros <= 0;
    }
  }

  function selectAmountBtn(btn) {
    donateAmountBtns.forEach((b) => b.classList.remove("is-selected"));
    if (btn) {
      btn.classList.add("is-selected");
      setImpactMessage(btn.dataset.impact || null);
      setSelectedAmount(parseInt(btn.dataset.amount, 10));
    }
    if (donateCustomInput) donateCustomInput.value = "";
  }

  donateAmountBtns.forEach((btn) => {
    btn.addEventListener("click", () => selectAmountBtn(btn));
  });

  if (donateCustomInput) {
    donateCustomInput.addEventListener("input", () => {
      const val = parseInt(donateCustomInput.value, 10);
      donateAmountBtns.forEach((b) => b.classList.remove("is-selected"));
      if (val > 0) {
        const net = Math.round(val * 0.34);
        setImpactMessage(`Votre don de ${val} € ne vous coûte que ${net} € après déduction fiscale.`);
        setSelectedAmount(val);
      } else {
        setImpactMessage(null);
        setSelectedAmount(0);
      }
    });
  }

  // ── MODAL HELLOASSO ───────────────────────────────────────────────
  const donateModal    = document.getElementById("donate-modal");
  const modalOverlay   = document.getElementById("donate-modal-overlay");
  const modalClose     = document.getElementById("donate-modal-close");
  const haForm         = document.getElementById("donate-helloasso-form");
  const haSubmitBtn    = document.getElementById("donate-helloasso-submit");
  const haErrors       = document.getElementById("donate-errors");
  const modalAmountVal = document.getElementById("modal-amount-value");
  const modalAmountNet = document.getElementById("modal-amount-net");
  const modalSubmitAmt = document.getElementById("modal-submit-amount");

  function openDonateModal(euros) {
    if (!donateModal) return;
    const net = Math.round(euros * 0.34);
    if (modalAmountVal) modalAmountVal.textContent = `${euros} €`;
    if (modalAmountNet) modalAmountNet.textContent = `${net} €`;
    if (modalSubmitAmt) modalSubmitAmt.textContent = `${euros} €`;
    donateModal.hidden = false;
    document.body.style.overflow = "hidden";
    setTimeout(() => document.getElementById("donate-card-name")?.focus(), 100);
  }

  function closeDonateModal() {
    if (!donateModal) return;
    donateModal.hidden = true;
    document.body.style.overflow = "";
    if (haErrors) haErrors.textContent = "";
    if (haForm) haForm.querySelectorAll("input").forEach((el) => (el.value = ""));
    if (haSubmitBtn) {
      haSubmitBtn.classList.remove("is-loading");
      haSubmitBtn.disabled = false;
    }
  }

  if (donateBtn) donateBtn.addEventListener("click", () => openDonateModal(selectedAmount));
  modalOverlay?.addEventListener("click", closeDonateModal);
  modalClose?.addEventListener("click", closeDonateModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && donateModal && !donateModal.hidden) closeDonateModal();
  });

  // Soumission → appel API backend → redirection vers HelloAsso
  if (haForm) {
    haForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const name  = document.getElementById("donate-card-name")?.value.trim();
      const email = document.getElementById("donate-card-email")?.value.trim();

      haSubmitBtn.classList.add("is-loading");
      haSubmitBtn.disabled = true;
      if (haErrors) haErrors.textContent = "";

      try {
        const res = await fetch("/api/donation/create-checkout", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({
            amountCents: selectedAmount * 100,
            donorName:   name  || undefined,
            donorEmail:  email || undefined,
          }),
        });
        const data = await res.json();

        if (!data.success || !data.redirectUrl) {
          if (haErrors) haErrors.textContent = data.error || "Une erreur est survenue. Veuillez réessayer.";
          return;
        }

        // Redirection vers HelloAsso pour le paiement sécurisé
        window.location.href = data.redirectUrl;

      } catch {
        if (haErrors) haErrors.textContent = "Impossible de joindre le serveur. Vérifiez votre connexion et réessayez.";
      } finally {
        haSubmitBtn.classList.remove("is-loading");
        haSubmitBtn.disabled = false;
      }
    });
  }

  // Retour depuis HelloAsso avec ?don=merci → afficher un toast de remerciement
  const urlParams  = new URLSearchParams(window.location.search);
  if (urlParams.get("don") === "merci") {
    history.replaceState({}, "", window.location.pathname + window.location.hash);
    const toast      = document.getElementById("donate-toast");
    const toastClose = document.getElementById("donate-toast-close");
    if (toast) {
      toast.hidden = false;
      setTimeout(() => toast.classList.add("is-visible"), 50);
      const hideToast = () => {
        toast.classList.remove("is-visible");
        setTimeout(() => (toast.hidden = true), 400);
      };
      setTimeout(hideToast, 7000);
      toastClose?.addEventListener("click", hideToast);
    }
    document.getElementById("donate")?.scrollIntoView({ behavior: "smooth" });
  }

  // ──────────────────────────────────────────
  // 11. FORMULAIRE NEWSLETTER
  // ──────────────────────────────────────────
  const nlForm      = document.getElementById("newsletter-form");
  const nlSubmitBtn = document.getElementById("nl-submit-btn");
  const nlSuccess   = document.getElementById("nl-success");
  const nlError     = document.getElementById("nl-error");

  if (nlForm && nlSubmitBtn && nlSuccess) {
    nlForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      const prenom = document.getElementById("nl-prenom")?.value.trim();
      const email  = document.getElementById("nl-email")?.value.trim();

      nlError.textContent = "";
      if (!prenom || prenom.length < 2) {
        nlError.textContent = "Veuillez saisir votre prénom.";
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        nlError.textContent = "Veuillez saisir une adresse email valide.";
        return;
      }

      nlSubmitBtn.disabled = true;
      nlSubmitBtn.textContent = "Inscription…";

      try {
        const res  = await fetch("/api/newsletter", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify({ prenom, email }),
        });
        const data = await res.json();

        if (data.success) {
          nlForm.querySelectorAll("input").forEach((el) => (el.value = ""));
          nlSuccess.hidden = false;
          nlSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          nlError.textContent = data.errors?.[0] || "Une erreur est survenue.";
          nlSubmitBtn.disabled = false;
          nlSubmitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> S'inscrire`;
        }
      } catch {
        nlError.textContent = "Impossible de joindre le serveur. Réessayez plus tard.";
        nlSubmitBtn.disabled = false;
        nlSubmitBtn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M22 2L11 13"/><path d="M22 2L15 22 11 13 2 9l20-7z"/></svg> S'inscrire`;
      }
    });
  }

  // ──────────────────────────────────────────
  // 12. SÉLECTION TYPE D'ADHÉSION (cards radio)
  // ──────────────────────────────────────────
  const typeRadios   = document.querySelectorAll(".adhesion-type-card__radio");
  const typeSelect   = document.getElementById("adh-type");

  function syncAdhesionType(val) {
    if (typeSelect) typeSelect.value = val;
    typeRadios.forEach((r) => {
      const card = r.closest(".adhesion-type-card");
      if (card) card.querySelector(".adhesion-type-card__inner")
        ?.classList.toggle("is-selected", r.value === val);
    });
  }

  typeRadios.forEach((radio) => {
    radio.addEventListener("change", () => syncAdhesionType(radio.value));
  });

  if (typeSelect) {
    typeSelect.addEventListener("change", () => {
      const matchingRadio = Array.from(typeRadios).find((r) => r.value === typeSelect.value);
      if (matchingRadio) matchingRadio.checked = true;
      syncAdhesionType(typeSelect.value);
    });
  }

  // Initialiser l'état par défaut (famille pré-coché)
  const defaultRadio = document.querySelector(".adhesion-type-card__radio[checked]");
  if (defaultRadio) syncAdhesionType(defaultRadio.value);

  // ──────────────────────────────────────────
  // 13. FORMULAIRE D'ADHÉSION
  // ──────────────────────────────────────────
  const adhForm        = document.getElementById("adhesion-form");
  const adhSubmitBtn   = document.getElementById("adh-submit-btn");
  const adhSuccess     = document.getElementById("adh-success");
  const adhServerError    = document.getElementById("adh-server-error");
  const adhServerErrorMsg = document.getElementById("adh-server-error-msg");

  function showAdhError(msg) {
    if (!adhServerError || !adhServerErrorMsg) return;
    adhServerErrorMsg.textContent = msg;
    adhServerError.hidden = false;
    adhServerError.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function hideAdhError() {
    if (adhServerError) adhServerError.hidden = true;
  }

  const ADH_FIELDS = [
    { id: "adh-nom",       errId: "adh-err-nom",    label: "Le nom",
      validate: (v) => v.trim().length >= 2 },
    { id: "adh-prenom",    errId: "adh-err-prenom", label: "Le prénom",
      validate: (v) => v.trim().length >= 2 },
    { id: "adh-email",     errId: "adh-err-email",  label: "L'email",
      validate: (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) },
    { id: "adh-tel",       errId: "adh-err-tel",    label: "Le téléphone",
      validate: (v) => /^[\d\s\+\-\.\(\)]{7,20}$/.test(v.trim()) },
    { id: "adh-adresse",   errId: "adh-err-adresse",label: "L'adresse",
      validate: (v) => v.trim().length >= 5 },
    { id: "adh-cp",        errId: "adh-err-cp",     label: "Le code postal",
      validate: (v) => /^\d{5}$/.test(v.trim()) },
    { id: "adh-ville",     errId: "adh-err-ville",  label: "La ville",
      validate: (v) => v.trim().length >= 2 },
    { id: "adh-type",      errId: "adh-err-type",   label: "Le type d'adhésion",
      validate: (v) => ["individuel","famille","bienfaiteur"].includes(v) },
  ];

  function adhShowError(field) {
    const el  = document.getElementById(field.id);
    const err = document.getElementById(field.errId);
    if (!el || !err) return;
    el.classList.add("is-invalid");
    el.classList.remove("is-valid");
    err.textContent = `${field.label} est requis et doit être valide.`;
  }
  function adhClearError(field) {
    const el  = document.getElementById(field.id);
    const err = document.getElementById(field.errId);
    if (!el || !err) return;
    el.classList.remove("is-invalid");
    el.classList.add("is-valid");
    err.textContent = "";
  }
  function validateAdhForm() {
    let ok = true;
    ADH_FIELDS.forEach((field) => {
      const el = document.getElementById(field.id);
      if (!el) return;
      if (field.validate(el.value)) adhClearError(field);
      else { adhShowError(field); ok = false; }
    });
    const rgpd    = document.getElementById("adh-rgpd");
    const rgpdErr = document.getElementById("adh-err-rgpd");
    if (rgpd && !rgpd.checked) {
      if (rgpdErr) rgpdErr.textContent = "Vous devez accepter notre politique de confidentialité.";
      ok = false;
    } else if (rgpdErr) {
      rgpdErr.textContent = "";
    }
    return ok;
  }

  ADH_FIELDS.forEach((field) => {
    document.getElementById(field.id)?.addEventListener("blur", () => {
      const el = document.getElementById(field.id);
      if (el) field.validate(el.value) ? adhClearError(field) : adhShowError(field);
    });
  });

  if (adhForm && adhSubmitBtn && adhSuccess) {
    adhForm.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!validateAdhForm()) return;

      adhSubmitBtn.classList.add("is-loading");
      adhSubmitBtn.disabled = true;
      hideAdhError();

      const payload = {
        nom:          document.getElementById("adh-nom")?.value.trim(),
        prenom:       document.getElementById("adh-prenom")?.value.trim(),
        email:        document.getElementById("adh-email")?.value.trim(),
        telephone:    document.getElementById("adh-tel")?.value.trim(),
        adresse:      document.getElementById("adh-adresse")?.value.trim(),
        codePostal:   document.getElementById("adh-cp")?.value.trim(),
        ville:        document.getElementById("adh-ville")?.value.trim(),
        typeAdhesion: document.getElementById("adh-type")?.value,
        motivation:   document.getElementById("adh-motivation")?.value.trim(),
      };

      try {
        const res  = await fetch("/api/adhesion", {
          method:  "POST",
          headers: { "Content-Type": "application/json" },
          body:    JSON.stringify(payload),
        });
        const data = await res.json();

        if (data.success) {
          adhForm.querySelectorAll("input, textarea, select").forEach((el) => {
            if (el.type === "checkbox") el.checked = false;
            else el.value = "";
            el.classList.remove("is-valid", "is-invalid");
          });
          adhSuccess.classList.add("is-visible");
          adhSuccess.scrollIntoView({ behavior: "smooth", block: "nearest" });
        } else {
          const firstErr = data.errors?.[0] || "Une erreur est survenue.";
          showAdhError(firstErr);
          adhSubmitBtn.classList.remove("is-loading");
          adhSubmitBtn.disabled = false;
        }
      } catch {
        showAdhError("Impossible de joindre le serveur. Veuillez réessayer ou nous contacter au 07 49 96 63 33.");
        adhSubmitBtn.classList.remove("is-loading");
        adhSubmitBtn.disabled = false;
      }
    });
  }

  // ──────────────────────────────────────────
  // 15. NAVIGATION SMOOTH SCROLL AVEC DÉCALAGE EN-TÊTE
  // ──────────────────────────────────────────
  document.querySelectorAll('a[href^="#"]').forEach((link) => {
    link.addEventListener("click", (e) => {
      const id = link.getAttribute("href").slice(1);
      if (!id) return;
      const target = document.getElementById(id);
      if (!target) return;

      e.preventDefault();
      const a11yH = document.querySelector(".a11y-bar")?.offsetHeight || 0;
      const headerH = header?.offsetHeight || 0;
      const top =
        target.getBoundingClientRect().top +
        window.scrollY -
        a11yH -
        headerH -
        16;
      window.scrollTo({ top, behavior: "smooth" });
    });
  });
});
