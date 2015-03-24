<?php
/**
 * BzDeck JavaScript List -> HTML <script>
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

error_reporting(0);
include_once('script-list.inc.php');
ob_start();

if ($_GET['debug'] && $_GET['debug'] === 'true') {
  foreach ($scripts as $script) {
    echo "    <script type=\"application/javascript;version=1.8\" src=\"{$script}\"></script>\n";
  }
} else {
  echo "    <script type=\"application/javascript;version=1.8\" src=\"/static/scripts/combined.js\"></script>\n";
}

ob_end_flush();
