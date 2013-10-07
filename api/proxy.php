<?php

header('Content-type: application/json');

$url = preg_replace('#^/api/#', 'https://api-dev.bugzilla.mozilla.org/', $_SERVER['REQUEST_URI']);

$ch = curl_init($url);
curl_setopt($ch, CURLOPT_HEADER, false);
curl_setopt($ch, CURLOPT_HTTPHEADER, array(
  'Accept: application/json',
  'Content-Type: application/json'
));
curl_exec($ch);
curl_close($ch);
