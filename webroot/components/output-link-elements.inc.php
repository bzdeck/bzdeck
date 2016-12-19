<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

error_reporting(0);
include_once('static-resource-list.inc.php');

define('DEBUG', $_GET['debug'] && $_GET['debug'] === 'true');

/**
 * Output <link> elements for CSS and <script> elements for JavaScript files.
 * @param string $type Type of resources, either `css` or `js`.
 * @see https://httpd.apache.org/docs/2.4/howto/http2.html
 */
function output_link_elements ($type) {
  global $resources;

  ob_start();

  if ($type === 'css') {
    foreach ($resources->styles as $path) {
      // Theme styles are hardcoded in HTML as those require the title attribute on <link>
      if (strpos($path, '/static/styles/themes/') === 0) {
        continue;
      }

      echo "    <link rel=\"stylesheet\" type=\"text/css\" media=\"screen\" href=\"{$path}\">\n";
    }
  }

  if ($type === 'js') {
    foreach ($resources->scripts as $path) {
      // Skip worker scripts
      if (strpos($path, '/static/scripts/workers/') === 0) {
        continue;
      }

      echo "    <script src=\"{$path}\"></script>\n";
    }
  }

  ob_end_flush();
}
