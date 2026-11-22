const navToggle = document.querySelector("[data-nav-toggle]");
const sidebar = document.querySelector("#site-sidebar");

if (navToggle && sidebar) {
  navToggle.addEventListener("click", () => {
    const isOpen = sidebar.classList.toggle("is-open");
    navToggle.setAttribute("aria-expanded", String(isOpen));
  });

  window.matchMedia("(min-width: 961px)").addEventListener("change", () => {
    sidebar.classList.remove("is-open");
    navToggle.setAttribute("aria-expanded", "false");
  });
}

// 文章页侧栏：目录 / 关于 两个标签
const tabsBox = document.querySelector("[data-sidebar-tabs]");

if (tabsBox) {
  const tabs = tabsBox.querySelectorAll("[data-tab]");
  const panes = tabsBox.querySelectorAll("[data-pane]");

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const name = tab.dataset.tab;
      tabs.forEach((item) => {
        const on = item === tab;
        item.classList.toggle("is-active", on);
        item.setAttribute("aria-selected", String(on));
      });
      panes.forEach((pane) => {
        const on = pane.dataset.pane === name;
        pane.classList.toggle("is-active", on);
        pane.hidden = !on;
      });
    });
  });

  // 阅读进度
  const bar = tabsBox.querySelector("[data-progress-bar]");
  const label = tabsBox.querySelector("[data-progress-label]");
  const content = document.querySelector(".article-content");

  if (bar && label && content) {
    const update = () => {
      const rect = content.getBoundingClientRect();
      const scrollable = content.offsetHeight - window.innerHeight;
      const passed = -rect.top;
      const percent = scrollable > 200 ? (passed / scrollable) * 100 : 0;
      const clamped = Math.max(0, Math.min(100, percent));
      bar.style.width = clamped + "%";
      label.textContent = Math.round(clamped) + "%";
    };

    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", update);
  }
}
