"use strict";

var CACHE_NAME = "healthspan-review-shell-v1";
var APP_FILES = [
  "workbench.html",
  "workbench.css",
  "workbench.js",
  "app-design.css",
  "app-nav.js",
  "manifest.webmanifest",
  "icons/app-icon-192.png",
  "icons/app-icon-512.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
    var scope = self.registration.scope;
    return cache.addAll(APP_FILES.map(function (file) {
      return new Request(new URL(file, scope).href, { cache: "reload" });
    }));
  }).then(function () { return self.skipWaiting(); }));
});

self.addEventListener("activate", function (event) {
  event.waitUntil(caches.keys().then(function (keys) {
    return Promise.all(keys.filter(function (key) {
      return key.indexOf("healthspan-review-shell-") === 0 && key !== CACHE_NAME;
    }).map(function (key) { return caches.delete(key); }));
  }).then(function () { return self.clients.claim(); }));
});

self.addEventListener("fetch", function (event) {
  var request = event.request;
  var url = new URL(request.url);
  if (request.method !== "GET" || url.origin !== self.location.origin ||
      url.pathname.indexOf("/api/") === 0 || request.headers.has("range")) return;

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).then(function (response) {
      if (response.ok && response.headers.get("content-type") &&
          response.headers.get("content-type").indexOf("text/html") !== -1) {
        var copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
          return cache.put(request, copy);
        }));
      }
      return response;
    }).catch(function () {
      return caches.match(request).then(function (cached) {
        return cached || caches.match(new URL("workbench.html", self.registration.scope));
      });
    }));
    return;
  }

  if (/\.(?:css|js|mjs|svg|png|webmanifest)$/.test(url.pathname)) {
    event.respondWith(caches.match(request).then(function (cached) {
      if (cached) return cached;
      return fetch(request).then(function (response) {
        if (response.ok) {
          var copy = response.clone();
          event.waitUntil(caches.open(CACHE_NAME).then(function (cache) {
            return cache.put(request, copy);
          }));
        }
        return response;
      });
    }));
  }
});
