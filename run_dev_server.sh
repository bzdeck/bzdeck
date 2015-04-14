#!/bin/bash
# Require PHP 5.x
port=8000
php -S localhost:$port -t webroot dev-router.php
