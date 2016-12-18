/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the AppBodyView that contains the sidebar and main regions.
 * @extends BzDeck.BaseView
 */
BzDeck.AppBodyView = class AppBodyView extends BzDeck.BaseView {
  /**
   * Get a AppBodyView instance.
   * @constructor
   * @returns {AppBodyView} New AppBodyView instance.
   */
  constructor () {
    super(); // Assign this.id

    // Initiate the corresponding presenter and sub-views
    BzDeck.views.sidebar = new BzDeck.SidebarView();
    BzDeck.views.main = new BzDeck.MainView();
  }
}
