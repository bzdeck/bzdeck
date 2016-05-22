/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Statusbar Presenter that controls everything on the global application statusbar.
 * @extends BzDeck.BasePresenter
 */
BzDeck.StatusbarPresenter = class StatusbarPresenter extends BzDeck.BasePresenter {
  /**
   * Get a StatusbarPresenter instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} presenter - New StatusbarPresenter instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    BzDeck.views.statusbar = new BzDeck.StatusbarView();
  }
}
