(function () {
  "use strict";
  // Relative files work under the Pages repository prefix and /docs/.
  // The Vercel root uses clean routes; its evidence archive lives in /docs/.
  var atRoot = /^\/(?:workbench|manual|clinic-companion|agent)?(?:\.html)?\/?$/.test(location.pathname);
  var files = { companion: "clinic-companion.html", workbench: "workbench.html", manual: "manual.html", agent: "agent.html", evidence: atRoot ? "docs/index.html#evidence" : "index.html#evidence" };
  document.querySelectorAll("[data-app-route]").forEach(function (link) {
    var key = link.dataset.appRoute;
    if (!files[key]) return;
    link.href = files[key];
    var current = document.body.dataset.appPage === key;
    if (current) link.setAttribute("aria-current", "page");
  });

  // Keep the install action in the shared top navigation without requiring
  // each product page to duplicate its browser-specific installation logic.
  var header = document.querySelector("header");
  var actions = header && (header.querySelector(".header-meta, .top-actions, .masthead-inner") || header);
  if (actions && !actions.querySelector("[data-install-app]")) {
    var button = document.createElement("button");
    button.type = "button";
    button.className = "app-install-button";
    button.dataset.installApp = "";
    button.textContent = "Install app";
    button.setAttribute("aria-describedby", "install-app-status");
    actions.appendChild(button);
    var status = document.createElement("span");
    status.id = "install-app-status";
    status.className = "app-install-status";
    status.setAttribute("role", "status");
    status.setAttribute("aria-live", "polite");
    actions.appendChild(status);
  }

  var base = /^\/docs\/?$/.test(location.pathname)
    ? new URL("/docs/", window.location.origin)
    : new URL("./", window.location.href);
  var manifest = document.querySelector('link[rel="manifest"]') || document.createElement("link");
  manifest.rel = "manifest";
  manifest.href = new URL("manifest.webmanifest", base).href;
  if (!manifest.parentNode) document.head.appendChild(manifest);

  if ("serviceWorker" in navigator && window.isSecureContext) {
    navigator.serviceWorker.register(new URL("service-worker.js", base).href, {
      scope: base.pathname
    }).catch(function () {
      // Installation can still be offered by the browser's own menu.
    });
  }

  var installPrompt = null;
  var installButton = document.querySelector("[data-install-app]");
  var installStatus = document.getElementById("install-app-status");
  var standalone = window.matchMedia("(display-mode: standalone)").matches ||
    window.navigator.standalone === true;
  if (installButton) {
    installButton.addEventListener("click", async function () {
      if (standalone) {
        if (installStatus) installStatus.textContent = "App is already installed.";
        return;
      }
      if (!installPrompt) {
        if (installStatus) {
          installStatus.textContent = /iphone|ipad|ipod/i.test(navigator.userAgent)
            ? "Open Share in Safari, then choose Add to Home Screen."
            : "Use your browser menu and choose Install app or Add to Home Screen.";
        }
        return;
      }
      installPrompt.prompt();
      var choice = await installPrompt.userChoice;
      installPrompt = null;
      if (installStatus) {
        installStatus.textContent = choice && choice.outcome === "accepted"
          ? "App installed."
          : "Install dismissed.";
      }
    });
  }
  window.addEventListener("beforeinstallprompt", function (event) {
    event.preventDefault();
    installPrompt = event;
  });
  window.addEventListener("appinstalled", function () {
    standalone = true;
    installPrompt = null;
    if (installStatus) installStatus.textContent = "App installed.";
  });
})();
