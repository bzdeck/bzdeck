/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Statusbar Presenter that controls everything on the global application statusbar.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.StatusbarPresenter = class StatusbarPresenter extends BzDeck.BasePresenter {
  /**
   * Get a StatusbarPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {StatusbarPresenter} New StatusbarPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id
  }
}
