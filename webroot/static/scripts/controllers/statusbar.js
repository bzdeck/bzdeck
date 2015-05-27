/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.Statusbar = function StatusbarController () {
  BzDeck.views.statusbar = new BzDeck.views.Statusbar();
};

BzDeck.controllers.Statusbar.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Statusbar.prototype.constructor = BzDeck.controllers.Statusbar;
