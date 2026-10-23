const themeToggle = document.querySelector("[data-theme-toggle]");
const navToggle = document.querySelector("[data-nav-toggle]");
const sidebar = document.querySelector("#site-sidebar");
const root = document.documentElement;

const savedTheme = localStorage.getItem("site-theme");
if (savedTheme === "dark" || savedTheme === "light") {
  root.dataset.theme = savedTheme;
}

if (themeToggle) {
  themeToggle.setAttribute("aria-pressed", String(root.dataset.theme === "dark"));
  themeToggle.addEventListener("click", () => {
    const isDark = root.dataset.theme !== "dark";
    root.dataset.theme = isDark ? "dark" : "light";
    themeToggle.setAttribute("aria-pressed", String(isDark));
    localStorage.setItem("site-theme", isDark ? "dark" : "light");
  });
}

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
