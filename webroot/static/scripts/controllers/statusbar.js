/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Statusbar Controller that controls everything on the global application statusbar.
 * @extends BzDeck.BaseController
 */
BzDeck.StatusbarController = class StatusbarController extends BzDeck.BaseController {
  /**
   * Get a StatusbarController instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} controller - New StatusbarController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    BzDeck.views.statusbar = new BzDeck.StatusbarView();
  }
}
