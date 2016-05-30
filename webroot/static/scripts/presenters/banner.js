/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Banner Presenter that controls everything on the global application header.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.BannerPresenter = class BannerPresenter extends BzDeck.BasePresenter {
  /**
   * Get a BannerPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New BannerPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    // Subscribe to events
    this.subscribe('V#BackButtonClicked');
    this.subscribe('V#TabSelected');
  }

  /**
   * Called whenever the Back button is clicked on the mobile view. Navigate backward when possible or just show Inbox.
   * @listens BannerView#BackButtonClicked
   * @param {undefined}
   * @returns {undefined}
   */
  on_back_button_clicked () {
    if (history.state && history.state.previous) {
      history.back();
    } else {
      BzDeck.router.navigate('/home/inbox');
    }
  }

  /**
   * Called whenever a tab in the global tablist is selected. Navigate to the specified location.
   * @listens BannerView#TabSelected
   * @param {String} path - Location pathname that corresponds to the tab.
   * @returns {undefined}
   */
  on_tab_selected ({ path } = {}) {
    if (location.pathname + location.search !== path) {
      BzDeck.router.navigate(path);
    }
  }
}
