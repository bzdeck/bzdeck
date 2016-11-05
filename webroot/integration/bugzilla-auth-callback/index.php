<?php
/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// The current Bugzilla Auth Delegation implementation involves 2 calls for a better security practice, therefore we
// need a database to retain the data. See Bug 1175643 for details.
$db = new SQLite3($_SERVER['DOCUMENT_ROOT'] . '/../private/bzdeck.sqlite');
$db->exec('CREATE TABLE IF NOT EXISTS auth (id TEXT PRIMARY KEY, client_api_login TEXT, client_api_key TEXT)');

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
    // Generate a random ID
    $id = md5(strval(mt_rand()));

    // Save the Bugzilla user name and API key temporarily in the database
    $_client_api_login = $db->escapeString($client_api_login);
    $_client_api_key = $db->escapeString($client_api_key);
    $db->exec("INSERT INTO auth VALUES ('{$id}', '{$_client_api_login}', '{$_client_api_key}')");

    // Return a JSON object
    header('Content-Type: application/json');
    echo json_encode(array('result' => $id));
  }

  exit;
}

// Second call
if ($_SERVER['REQUEST_METHOD'] === 'GET' && isset($_GET['client_api_login']) && isset($_GET['callback_result'])) {
  $id = $_GET['callback_result'];
  $client_api_login = $_GET['client_api_login'];

  // Query the database
  $_id = $db->escapeString($id);
  $_client_api_login = $db->escapeString($client_api_login);
  $client_api_key = $db->querySingle("SELECT client_api_key FROM auth " .
                                     "WHERE id='{$_id}' AND client_api_login='{$_client_api_login}'");

  if ($client_api_key) {
    // Delete the data
    $db->exec("DELETE FROM auth WHERE id='{$_id}'");

?>
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8">
    <title>Bugzilla Authentication</title>
  </head>
  <body>
    <script>
      window.addEventListener('DOMContentLoaded', event => {
        const bc = new BroadcastChannel('BugzillaAuthCallback');
        const client_api_login = '<?php echo $client_api_login ?>';
        const client_api_key = '<?php echo $client_api_key ?>';

        // Notify the credentials to the main window over a BroadcastChannel and close this sub window
        bc.postMessage({ client_api_login, client_api_key });
        bc.close();
        window.close();
      });
    </script>
  </body>
</html>
<?php
  }
}
