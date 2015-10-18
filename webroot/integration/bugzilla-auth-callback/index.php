<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The current Bugzilla Auth Delegation implementation involves 2 calls for a better security practice, therefore we
// need a session to retain the data. See Bug 1175643 for details.
session_start();

// Validate the API key
function validate_api_key ($value) {
  return preg_match('/^[a-zA-Z0-9]{40}$/', $value) === 1 ? $value : '';
}

// First call
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
  // Decode the POSTed content
  $content = json_decode(file_get_contents('php://input'));

  if ($content) {
    // Validate the values
    $client_api_login = filter_var($content->client_api_login, FILTER_VALIDATE_EMAIL,
                                   array('options' => array('default' => '')));
    $client_api_key   = filter_var($content->client_api_key, FILTER_CALLBACK,
                                   array('options' => 'validate_api_key'));
  }

  if ($client_api_login && $client_api_key) {
    // Save the user name and API key as session data
    $_SESSION['client_api_login'] = $client_api_login;
    $_SESSION['client_api_key'] = $client_api_key;

    // Return a JSON object
    header('Content-Type: application/json');
    echo json_encode(array('result' => session_id()));
  }

  exit;
}

// Second call
if ($_SERVER['REQUEST_METHOD'] === 'GET' &&
    $_SESSION['client_api_login'] && $_SESSION['client_api_key'] &&
    $_GET['client_api_login'] === $_SESSION['client_api_login'] &&
    $_GET['callback_result'] === session_id()) {
  // Retrieve session data
  $client_api_login = $_SESSION['client_api_login'];
  $client_api_key = $_SESSION['client_api_key'];
?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Bugzilla Authentication</title>
  </head>
  <body>
    <script type="application/javascript;version=1.8">
      window.addEventListener('DOMContentLoaded', event => {
        let bc = new BroadcastChannel('BugzillaAuthCallback'),
            client_api_login = '<?php echo $client_api_login ?>',
            client_api_key = '<?php echo $client_api_key ?>';

        // window.open doesn't work on the Android WebAppRT (Bug 1183897) so this page is *not* in a sub window. In that
        // case, store the user credentials in a temporary local storage and transition to the app's landing page.
        // Otherwise, notify the credentials to the main window over a BroadcastChannel and close this sub window.
        if (navigator.userAgent.includes('Android')) {
          sessionStorage.setItem('client_api_login', client_api_login);
          sessionStorage.setItem('client_api_key', client_api_key);
          location.replace(location.origin);
        } else {
          bc.postMessage({ client_api_login, client_api_key });
          bc.close();
          window.close();
        }
      });
    </script>
  </body>
</html>
<?php

  // End the session
  session_abort();
}
