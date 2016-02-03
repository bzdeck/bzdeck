/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Declare the BzDeck app namespace. Use `var` to define as a global variable.
 * @namespace
 */
var BzDeck = new FlareTail.app.AbstractWorker('BzDeck');

self.addEventListener('connect', event => {
  event.ports[0].start();

  // Initialize the SessionHandler
  BzDeck.handlers.session = new BzDeck.SessionHandler();
});
