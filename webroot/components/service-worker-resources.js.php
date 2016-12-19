<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

include_once('static-resource-list.inc.php');
header('Content-Type: application/javascript');

?>
const files = [
  '/app/',
<?php

foreach ($resources as $type => $files) {
  foreach ($files as $path) {
    echo "  '{$path}',\n";
  }
}

?>
];
