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
  './models/account.js',
  './models/bugs.js',
  './models/global.js',
  './models/prefs.js',
  './models/server.js',
  './models/users.js',
  './views/base.js',
  './views/bug.js',
  './views/bug-details.js', // extends bug.js
  './views/details-page.js',
  './views/global.js',
  './views/home-page.js',
  './views/login-form.js',
  './views/profile-page.js',
  './views/search-page.js',
  './views/session.js',
  './views/settings-page.js',
  './views/sidebar.js',
  './views/statusbar.js',
  './views/thread.js',
  './views/timeline-comment-form.js',
  './views/timeline-entry.js',
  './views/timeline.js',
  './views/toolbar.js',
  './views/tooltip.js',
  './controllers/base.js',
  './controllers/bug.js',
  './controllers/bugs.js',
  './controllers/bugzfeed.js',
  './controllers/details-page.js',
  './controllers/global.js',
  './controllers/home-page.js',
  './controllers/profile-page.js',
  './controllers/search-page.js',
  './controllers/session.js',
  './controllers/settings-page.js',
  './controllers/sidebar.js',
  './controllers/statusbar.js',
  './controllers/thread.js',
  './controllers/timeline-comment-form.js',
  './controllers/timeline-entry.js',
  './controllers/timeline.js',
  './controllers/toolbar.js',
  './controllers/user.js',
  './controllers/users.js',
];

error_reporting(0);
header('Content-Type: application/javascript; charset=utf-8', true);
define('SCRIPT_DIR', $_SERVER['DOCUMENT_ROOT'] . '/static/scripts/');
ob_start();

// Use strict mode; this comment should go first
echo "'use strict';\n";

foreach ($scripts as $script) {
  if ($contents = file_get_contents(SCRIPT_DIR . $script)) {
    // Remove block comments
    $contents = preg_replace('/\/\*[\s\S]+\*\/\n/mU', '', $contents);
    echo $contents;
  }
}

ob_end_flush();
