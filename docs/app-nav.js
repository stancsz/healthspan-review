(function () {
  "use strict";
  // Relative files work under the Pages repository prefix and /docs/.
  // The Vercel root uses clean routes; its evidence archive lives in /docs/.
  var atRoot = /^\/(?:workbench|manual|clinic-companion)?(?:\.html)?\/?$/.test(location.pathname);
  var files = { companion: "clinic-companion.html", workbench: "workbench.html", manual: "manual.html", evidence: atRoot ? "docs/index.html#evidence" : "index.html#evidence" };
  document.querySelectorAll("[data-app-route]").forEach(function (link) {
    var key = link.dataset.appRoute;
    if (!files[key]) return;
    link.href = files[key];
    var current = document.body.dataset.appPage === key;
    if (current) link.setAttribute("aria-current", "page");
  });
})();
