/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// Cache version: this has to be updated whenever a file is modified
const version = '2016-02-19-09-12';

// Files need to be cached
const files = [
  '/app/',
  // Images
  '/static/images/logo/icon-256-white.png',
  '/static/images/themes/dark/sprite.png',
  '/static/images/themes/light/sprite.png',
  // Fonts
  '/vendor/Fira/fonts/FiraMono-Regular.woff2?v=3.206',
  '/vendor/Fira/fonts/FiraSans-LightItalic.woff2?v=4.106',
  '/vendor/Fira/fonts/FiraSans-Medium.woff2?v=4.106',
  '/vendor/Fira/fonts/FiraSans-Regular.woff2?v=4.106',
  '/vendor/Font-Awesome/fonts/fontawesome-webfont.woff2?v=4.4.0',
  // Styles (should be the same as the list in static-file-list.inc.php)
  '/vendor/flaretail.js/styles/widgets.css',
  '/static/styles/base/fonts.css',
  '/static/styles/base/base.css',
  '/static/styles/base/widgets.css',
  '/static/styles/base/animations.css',
  '/static/styles/views/app-body.css',
  '/static/styles/views/attachment-page.css',
  '/static/styles/views/attachment.css',
  '/static/styles/views/banner.css',
  '/static/styles/views/bug-attachments.css',
  '/static/styles/views/bug-comment-form.css',
  '/static/styles/views/bug-details.css',
  '/static/styles/views/bug-flags.css',
  '/static/styles/views/bug-history.css',
  '/static/styles/views/bug-participant-list.css',
  '/static/styles/views/bug-preview.css',
  '/static/styles/views/bug-timeline.css',
  '/static/styles/views/bug-timeline-entry.css',
  '/static/styles/views/bug.css',
  '/static/styles/views/home.css',
  '/static/styles/views/login-form.css',
  '/static/styles/views/main.css',
  '/static/styles/views/person-finder.css',
  '/static/styles/views/profile-page.css',
  '/static/styles/views/qrcode-auth-overlay.css',
  '/static/styles/views/quick-search.css',
  '/static/styles/views/search-page.css',
  '/static/styles/views/settings-page.css',
  '/static/styles/views/sidebar.css',
  '/static/styles/views/thread.css',
  '/static/styles/views/tooltip.css',
  // Scripts (should be the same as the list in static-file-list.inc.php)
  '/vendor/JavaScript-MD5/scripts/md5.min.js',
  '/vendor/flaretail.js/scripts/helpers.js',
  '/vendor/flaretail.js/scripts/widgets.js',
  '/vendor/flaretail.js/scripts/app.js',
  '/static/scripts/config/app.js',
  '/static/scripts/datasources/base.js',
  '/static/scripts/datasources/account.js',
  '/static/scripts/datasources/global.js',
  '/static/scripts/models/base.js',
  '/static/scripts/models/account.js',
  '/static/scripts/models/attachment.js',
  '/static/scripts/models/bug.js',
  '/static/scripts/models/host.js',
  '/static/scripts/models/user.js',
  '/static/scripts/collections/base.js',
  '/static/scripts/collections/accounts.js',
  '/static/scripts/collections/attachments.js',
  '/static/scripts/collections/bugs.js',
  '/static/scripts/collections/hosts.js',
  '/static/scripts/collections/prefs.js',
  '/static/scripts/collections/subscriptions.js',
  '/static/scripts/collections/users.js',
  '/static/scripts/views/base.js',
  '/static/scripts/views/attachment.js',
  '/static/scripts/views/attachment-page.js',
  '/static/scripts/views/banner.js',
  '/static/scripts/views/bug.js',
  '/static/scripts/views/bug-attachments.js',
  '/static/scripts/views/bug-comment-form.js',
  '/static/scripts/views/bug-details.js', // extends bug.js
  '/static/scripts/views/bug-flags.js',
  '/static/scripts/views/bug-history.js',
  '/static/scripts/views/bug-participant-list.js',
  '/static/scripts/views/bug-timeline.js',
  '/static/scripts/views/bug-timeline-entry.js',
  '/static/scripts/views/details-page.js',
  '/static/scripts/views/global.js',
  '/static/scripts/views/home-page.js',
  '/static/scripts/views/login-form.js',
  '/static/scripts/views/patch-viewer.js',
  '/static/scripts/views/person-finder.js',
  '/static/scripts/views/profile-page.js',
  '/static/scripts/views/quick-search.js',
  '/static/scripts/views/search-page.js',
  '/static/scripts/views/session.js',
  '/static/scripts/views/settings-page.js',
  '/static/scripts/views/sidebar.js',
  '/static/scripts/views/statusbar.js',
  '/static/scripts/views/thread.js',
  '/static/scripts/views/tooltip.js',
  '/static/scripts/controllers/base.js',
  '/static/scripts/controllers/attachment-page.js',
  '/static/scripts/controllers/banner.js',
  '/static/scripts/controllers/bug.js',
  '/static/scripts/controllers/bugzfeed.js',
  '/static/scripts/controllers/details-page.js',
  '/static/scripts/controllers/global.js',
  '/static/scripts/controllers/home-page.js',
  '/static/scripts/controllers/profile-page.js',
  '/static/scripts/controllers/quick-search.js',
  '/static/scripts/controllers/search-page.js',
  '/static/scripts/controllers/session.js',
  '/static/scripts/controllers/settings-page.js',
  '/static/scripts/controllers/sidebar.js',
  '/static/scripts/controllers/statusbar.js',
  // Worker scripts
  '/static/scripts/workers/bugzfeed.js',
  '/static/scripts/workers/tasks.js',
];

// Virtual URLs to be resolved to the app's static base URL. This list should be synced with .htaccess
const pattern = /^\/((attachment|bug|home|profile|search|settings).*)?$/;

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(version)
        // Cache the files
        .then(cache => cache.addAll(files))
        // Activate the worker immediately
        .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
        // Delete old caches
        .then(keys => Promise.all(keys.filter(key => key !== version).map(key => caches.delete(key))))
        // Activate the worker for the main thread
        .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  let request = event.request;

  // Rewrite in-app requests as .htaccess does
  if (pattern.test((new URL(event.request.url)).pathname)) {
    request = new Request('/app/');
  }

  event.respondWith(
    // Proxy requests and cache files when needed
    // TODO: Provide custom 404 page
    caches.match(request).then(response => {
      // Return cache if found
      if (response) {
        return response;
      }

      // Request remote resource
      return fetch(request).then(response => {
        caches.open(version).then(cache => cache.put(request, response));

        return response.clone();
      });
    })
    .catch(error => new Response('404 Not Found', { status: 404 }))
  );
});
