import { icon } from "../utils/icons.js";

let activeModal = null;
let previousFocus = null;

export function closeModal() {
  if (!activeModal) return;
  activeModal.remove();
  activeModal = null;
  document.body.style.overflow = "";
  previousFocus?.focus?.();
  previousFocus = null;
}

export function openModal({ title, content, onOpen, labelledBy = "modal-title" }) {
  closeModal();
  previousFocus = document.activeElement;
  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop";
  backdrop.innerHTML = `
    <section class="modal" role="dialog" aria-modal="true" aria-labelledby="${labelledBy}">
      <div class="modal-header">
        <h2 id="${labelledBy}">${title}</h2>
        <button class="icon-button" type="button" data-close-modal aria-label="Close dialog">${icon("x")}</button>
      </div>
      <div class="modal-body">${content}</div>
    </section>`;
  backdrop.addEventListener("click", (event) => {
    if (event.target === backdrop || event.target.closest("[data-close-modal]")) closeModal();
  });
  backdrop.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closeModal();
    if (event.key === "Tab") {
      const focusables = [...backdrop.querySelectorAll('button, a, input, select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
        (element) => !element.disabled
      );
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
  document.body.append(backdrop);
  document.body.style.overflow = "hidden";
  activeModal = backdrop;
  requestAnimationFrame(() => {
    backdrop.querySelector("button, input, textarea, select, a")?.focus();
    onOpen?.(backdrop);
  });
  return backdrop;
}
