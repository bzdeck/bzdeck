<?php
/**
 * BzDeck Scripts Combiner
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

$scripts = [
  '../vendor/JavaScript-MD5/scripts/md5.min.js',
  '../vendor/flaretail.js/scripts/util.js',
  '../vendor/flaretail.js/scripts/widget.js',
  '../vendor/flaretail.js/scripts/app.js',
  './config/app.js',
  './models/base.js',
  './models/bugs.js',
  './views/base.js',
  './views/bug.js',
  './views/details-page.js',
  './views/home-page.js',
  './views/profile-page.js',
  './views/search-page.js',
  './views/session.js',
  './views/settings-page.js',
  './views/sidebar.js',
  './views/thread.js',
  './views/timeline-comment-form.js',
  './views/timeline-entry.js',
  './views/timeline.js',
  './views/toolbar.js',
  './controllers/base.js',
  './controllers/bug.js',
  './controllers/bugs.js',
  './controllers/bugzfeed.js',
  './controllers/details-page.js',
  './controllers/home-page.js',
  './controllers/profile-page.js',
  './controllers/search-page.js',
  './controllers/session.js',
  './controllers/settings-page.js',
  './controllers/sidebar.js',
  './controllers/thread.js',
  './controllers/timeline-comment-form.js',
  './controllers/timeline-entry.js',
  './controllers/timeline.js',
  './controllers/toolbar.js',
  './controllers/users.js',
];

error_reporting(0);
header('Content-Type: application/javascript; charset=utf-8', true);
ob_start();

foreach ($scripts as $script) {
  if ($contents = file_get_contents($script)) {
    echo $contents;
  }
}

ob_end_flush();
