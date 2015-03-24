<?php
/**
 * BzDeck Scripts Combiner
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

error_reporting(0);
include_once('script-list.inc.php');
header('Content-Type: application/javascript; charset=utf-8', true);
ob_start();

// Use strict mode; this comment should go first
echo "'use strict';\n";

foreach ($scripts as $script) {
  if ($contents = file_get_contents($_SERVER['DOCUMENT_ROOT'] . $script)) {
    // Remove block comments
    $contents = preg_replace('/\/\*[\s\S]+\*\/\n/mU', '', $contents);
    echo $contents;
  }
}

ob_end_flush();
