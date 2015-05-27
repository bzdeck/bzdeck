#!/bin/bash

# This Source Code Form is subject to the terms of the Mozilla Public
# License, v. 2.0. If a copy of the MPL was not distributed with this
# file, You can obtain one at http://mozilla.org/MPL/2.0/.

# Require PHP 5.x

PORT=8000
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
php -S localhost:$PORT -t $SCRIPT_DIR/../webroot $SCRIPT_DIR/dev-router.php
