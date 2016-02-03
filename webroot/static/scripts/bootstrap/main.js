/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Declare the BzDeck app namespace. Use `var` to define as a global variable.
 * @namespace
 */
var BzDeck = new FlareTail.app.AbstractMain('BzDeck');

window.addEventListener('DOMContentLoaded', event => {
  if (FlareTail.compatible) {
    BzDeck.router = new FlareTail.app.Router(BzDeck);
    BzDeck.controllers.session = new BzDeck.SessionController();
  }
});
