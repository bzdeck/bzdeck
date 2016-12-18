/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// Cache version: this has to be updated whenever a file is modified
const version = '2016-12-07';

// Files need to be cached
const files = [
  '/app/',
  // Images
  '/static/images/logo/icon-256-white.png',
  '/static/images/themes/dark/sprite.png',
  '/static/images/themes/light/sprite.png',
  // Fonts
  '/vendor/Fira/fonts/FiraMono-Regular.woff2?v=3.206',
  '/vendor/Fira/fonts/FiraSans-Book.woff2?v=4.106',
  '/vendor/Fira/fonts/FiraSans-LightItalic.woff2?v=4.106',
  '/vendor/Fira/fonts/FiraSans-Medium.woff2?v=4.106',
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
  '/static/styles/views/bug-container.css',
  '/static/styles/views/bug-details.css',
  '/static/styles/views/bug-flags.css',
  '/static/styles/views/bug-history.css',
  '/static/styles/views/bug-participant-list.css',
  '/static/styles/views/bug-timeline.css',
  '/static/styles/views/bug-timeline-entry.css',
  '/static/styles/views/bug.css',
  '/static/styles/views/home.css',
  '/static/styles/views/login-form.css',
  '/static/styles/views/main.css',
  '/static/styles/views/markdown-editor.css',
  '/static/styles/views/navigator.css',
  '/static/styles/views/person-finder.css',
  '/static/styles/views/profile-page.css',
  '/static/styles/views/qrcode-auth-overlay.css',
  '/static/styles/views/quick-search.css',
  '/static/styles/views/search-page.css',
  '/static/styles/views/settings-page.css',
  '/static/styles/views/thread.css',
  '/static/styles/views/tooltip.css',
  // Theme styles
  '/static/styles/themes/dark.css',
  '/static/styles/themes/light.css',
  // Scripts (should be the same as the list in static-file-list.inc.php)
  '/vendor/JavaScript-MD5/scripts/md5.min.js',
  '/vendor/showdown/dist/showdown.min.js',
  '/vendor/flaretail.js/scripts/util.js',
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
  '/static/scripts/models/bugzfeed.js',
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
  '/static/scripts/views/bug-container.js',
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
  '/static/scripts/views/markdown-editor.js',
  '/static/scripts/views/navigator.js',
  '/static/scripts/views/person-finder.js',
  '/static/scripts/views/profile-page.js',
  '/static/scripts/views/quick-search.js',
  '/static/scripts/views/search-page.js',
  '/static/scripts/views/session.js',
  '/static/scripts/views/settings-page.js',
  '/static/scripts/views/statusbar.js',
  '/static/scripts/views/thread.js',
  '/static/scripts/views/tooltip.js',
  '/static/scripts/presenters/base.js',
  '/static/scripts/presenters/attachment-page.js',
  '/static/scripts/presenters/attachment.js',
  '/static/scripts/presenters/banner.js',
  '/static/scripts/presenters/bug-container.js',
  '/static/scripts/presenters/bug.js',
  '/static/scripts/presenters/details-page.js',
  '/static/scripts/presenters/global.js',
  '/static/scripts/presenters/home-page.js',
  '/static/scripts/presenters/navigator.js',
  '/static/scripts/presenters/profile-page.js',
  '/static/scripts/presenters/quick-search.js',
  '/static/scripts/presenters/search-page.js',
  '/static/scripts/presenters/session.js',
  '/static/scripts/presenters/settings-page.js',
  '/static/scripts/presenters/statusbar.js',
  // Worker scripts
  '/static/scripts/workers/tasks.js',
];

// Virtual URLs to be resolved to the app's static base URL. This list should be synced with .htaccess
const pattern = /^\/((attachment|bug|home|profile|search|settings).*)?$/;

let font_url;

/**
 * Generate a fallback avatar image in the SVG format.
 * @param {URL} url - The URL used for the original request.
 * @returns {Promise.<Response>} New 200 response that contains a blob of SVG.
 */
const generate_avatar = async url => {
  const color = url.searchParams.get('color') || '#666';
  const initial = url.searchParams.get('initial') || '';

  // Create a Blob URL for the Fira Sans font to use it in SVG. This is a workaround for the security restrictions in
  // Gecko. See https://developer.mozilla.org/docs/Web/SVG/SVG_as_an_Image
  if (!font_url) {
    const response = await fetch('/vendor/Fira/fonts/FiraSans-Book.woff2?v=4.106');
    const blob = await response.blob();

    font_url = URL.createObjectURL(blob);
  }

  // Create a Blob with SVG data, embedding the defined color and initial of the user as well as the font's Blob URL.
  // https://developer.mozilla.org/docs/Web/API/Canvas_API/Drawing_DOM_objects_into_a_canvas
  const blob = new Blob([
    `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="160"><style><![CDATA[@font-face{font-family:` +
    `FiraSans;src:url(${font_url})}div{display:flex;width:160px;height:160px;justify-content:center;align-items:` +
    `center;font-family:FiraSans,sans-serif;font-size:110px;color:#FFF;background-color:${color}}]]></style>` +
    `<foreignObject width="160" height="160"><div xmlns="http://www.w3.org/1999/xhtml">${initial}</div>` +
    `</foreignObject></svg>`
  ], { type: 'image/svg+xml;charset=utf-8' });

  // Use the in-memory cache instead of cache storage, because the Blob URL expires once the page is closed
  const headers = new Headers({ 'Expires': (new Date(Date.now())).toUTCString(), 'Cache-Control': 'no-store' });

  return new Response(blob, { status: 200, statusText: 'OK', headers });
};

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(version);

    // Cache the files
    await cache.addAll(files);

    // Activate the worker immediately
    return self.skipWaiting();
  })());
}, { once: true });

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();

    // Delete old caches
    await Promise.all(keys.filter(key => key !== version).map(key => caches.delete(key)));

    // Activate the worker for the main thread
    return self.clients.claim();
  })());
}, { once: true });

self.addEventListener('fetch', event => {
  let request = event.request;
  const url = new URL(request.url);
  const path = url.pathname;
  const is_gravatar_avatar = path.startsWith('/api/gravatar/avatar/');
  // TODO: The URL may vary with the Bugzilla instance. Retrieve this from the configuration.
  const is_bugzilla = url.origin.startsWith('https://bugzilla');
  const is_bugzilla_attachment = is_bugzilla && path.startsWith('/rest/bug/attachment/')
                                             && url.search === '?include_fields=data';

  // Rewrite in-app requests as .htaccess does
  if (pattern.test(path)) {
    request = new Request('/app/');
  }

  event.respondWith((async () => {
    // Proxy requests and cache files when needed
    let response = await caches.match(request);

    // Return cache if found
    if (response) {
      return response;
    }

    let _request = request;
    let cache_name = 'misc';
    let cache_enabled = true;

    // Proxy Gravatar requests
    if (is_gravatar_avatar) {
      _request = new Request(`https://secure.gravatar.com/avatar/${path.substr(21)}?s=160&d=404`, { mode: 'cors' });
      cache_name = 'gravatar';
    }

    // For Bugzilla API requests, only cache permanent attachment data
    if (is_bugzilla) {
      cache_name = 'bugzilla';
      cache_enabled = is_bugzilla_attachment;
    }

    try {
      // Request remote resource
      response = await fetch(_request);

      if (is_gravatar_avatar && !response.ok) {
        response = await generate_avatar(url);
        cache_enabled = false;
      }

      const cache = await caches.open(cache_name);

      // Cache the response
      if (cache_enabled) {
        cache.put(request, response.clone());
      }
    } catch (ex) {
      // TODO: Provide custom 404 page
      response = new Response('404 Not Found', { status: 404 });
    }

    return response;
  })());
});
