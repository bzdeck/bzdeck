/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Banner Controller that controls everything on the global application header.
 * @extends BzDeck.BaseController
 */
BzDeck.BannerController = class BannerController extends BzDeck.BaseController {
  /**
   * Get a BannerController instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} controller - New BannerController instance.
   * @listens BannerView:BackButtonClicked
   * @listens BannerView:TabSelected
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    BzDeck.views.banner = new BzDeck.BannerView();

    // Subcontrollers
    BzDeck.controllers.quick_search = new BzDeck.QuickSearchController();

    this.subscribe('V:BackButtonClicked');
    this.subscribe('V:TabSelected');
  }

  /**
   * Called by BannerView whenever the Back button is clicked on the mobile view. Navigate backward when possible or
   * just show Inbox.
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
   * Called by BannerView whenever a tab in the global tablist is selected. Navigate to the specified location.
   * @param {Object} data - Passed data.
   * @param {String} data.path - Location pathname that corresponds to the tab.
   * @returns {undefined}
   */
  on_tab_selected (data) {
    if (location.pathname + location.search !== data.path) {
      BzDeck.router.navigate(data.path);
    }
  }
}
