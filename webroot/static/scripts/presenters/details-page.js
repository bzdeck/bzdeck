/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Details Page Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.DetailsPagePresenter = class DetailsPagePresenter extends BzDeck.BasePresenter {
  /**
   * Get a DetailsPagePresenter instance.
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {DetailsPagePresenter} New DetailsPagePresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id
  }
}
