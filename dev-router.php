<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// This file is used for testing BzDeck with PHP's built-in web server.
// Usage: 
// 1. php -S localhost:8000 dev-router.php
// 2. Visit http://localhost:8000

if (strpos($_SERVER['REQUEST_URI'], '.woff2') !== false) {
  // Serve WOFF2 files properly
  header('Content-Type: application/font-woff2');
  return false;
}

if (file_exists(__DIR__ . '/webroot' . $_SERVER['REQUEST_URI'])) {
  // Serve the requested resource as-is.
  return false;
}

if ($_SERVER['REQUEST_URI'] === '/static/scripts/combined.js') {
  // Map combined.js to PHP
  include('webroot/components/combine-scripts.php');
} else {
  // Handle everything else
  include('webroot/index.php');
}

