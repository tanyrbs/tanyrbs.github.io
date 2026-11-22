const navToggle = document.querySelector("[data-nav-toggle]");
const sidebar = document.querySelector("#site-sidebar");

if (navToggle && sidebar) {
  navToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  window.matchMedia("(min-width: 761px)").addEventListener("change", () => {
    sidebar.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
}
