<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

error_reporting(0);
include_once('static-file-list.inc.php');

$type = $_GET['type'] ? $_GET['type'] : '';
$paths = [];

ob_start();

if ($type == 'main.js') {
  header('Content-Type: application/javascript; charset=utf-8', true);
  $paths = $main_scripts;
}

if ($type == 'worker.js') {
  header('Content-Type: application/javascript; charset=utf-8', true);
  $paths = $worker_scripts;
}

if ($type == 'css') {
  header('Content-Type: text/css; charset=utf-8', true);
  $paths = $styles;
}

foreach ($paths as $path) {
  if ($contents = file_get_contents($_SERVER['DOCUMENT_ROOT'] . $path)) {
    // Remove block comments
    $contents = preg_replace('/\/\*[\s\S]+\*\/\n/mU', '', $contents);
    echo $contents;
  }
}

ob_end_flush();
