<?php
// This file is used for testing BzDeck with PHP's built-in web server.
// Usage: 
// 1. php -S localhost:8000 dev-router.php
// 2. Visit http://localhost:8000

if (file_exists(__DIR__ . '/webroot' . $_SERVER['REQUEST_URI'])) {
  // Serve the requested resource as-is.
  return false;
}

if ($_SERVER['REQUEST_URI'] === '/static/scripts/combined.js') {
  // Map combined.js to PHP
  include('components/combine-scripts.php');
} else {
  // Handle everything else
  include('index.php');
}
