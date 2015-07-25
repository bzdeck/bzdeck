<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// Validate the API key
function validate_api_key ($value) {
  return preg_match('/^[a-zA-Z0-9]{40}$/', $value) === 1 ? $value : '';
}

// Obtain the user credentials: The initial Bugzilla Auth Delegation implementation was using URL params to pass the
// user name and API key to this callback page, but later updated to use the POST method for a better security practice
// (Bug 1175643). This code supports both POST and GET for backward compatibility.
$client_api_login = filter_var($_POST['client_api_login'] ? $_POST['client_api_login'] : $_GET['client_api_login'],
                               FILTER_VALIDATE_EMAIL, array('options' => array('default' => '')));
$client_api_key = filter_var($_POST['client_api_key'] ? $_POST['client_api_key'] : $_GET['client_api_key'],
                             FILTER_CALLBACK, array('options' => 'validate_api_key'));
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
