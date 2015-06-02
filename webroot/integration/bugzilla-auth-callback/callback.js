/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

// Once the user is redirected back from Bugzilla's auth.cgi, notify the retrieved user name and API key to the main app
// window and close this window. See http://bugzilla.readthedocs.org/en/latest/integrating/auth-delegation.html for how
// it works.

window.addEventListener('DOMContentLoaded', event => {
  let bc = new BroadcastChannel('BugzillaAuthCallback'),
      params = new URLSearchParams(location.search.substr(1));

  bc.postMessage({ email: params.get('client_api_login'), key: params.get('client_api_key') });
  bc.close();
  window.close();
});
