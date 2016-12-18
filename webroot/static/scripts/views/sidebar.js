/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar View.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarView = class SidebarView extends BzDeck.BaseView {
  /**
   * Get a SidebarView instance.
   * @constructor
   * @returns {SidebarView} New SidebarView instance.
   */
  constructor () {
    super(); // Assign this.id

    // Initiate the corresponding presenter and sub-view
    BzDeck.views.sidebar_list = new BzDeck.SidebarListView(this.id);
  }
}
