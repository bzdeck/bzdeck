<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

error_reporting(0);
include_once('static-file-list.inc.php');

define('DEBUG', $_GET['debug'] && $_GET['debug'] === 'true');

function output_link_elements ($type) {
  global $styles, $scripts;

  ob_start();

  if ($type === 'css') {
    foreach ($styles as $path) {
      echo "    <link rel=\"stylesheet\" type=\"text/css\" media=\"screen\" href=\"{$path}\">\n";
    }
  }

  if ($type === 'js') {
    foreach ($scripts as $path) {
      echo "    <script src=\"{$path}\"></script>\n";
    }
  }

  ob_end_flush();
}
