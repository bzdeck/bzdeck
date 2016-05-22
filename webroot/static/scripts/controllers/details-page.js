/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Details Page Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.DetailsPageController = class DetailsPageController extends BzDeck.BaseController {
  /**
   * Called by the app router and initialize the Details Page Controller. If the specified bug has an existing tab,
   * switch to it. Otherwise, open a new tab and try to load the bug.
   * @constructor
   * @param {Number} bug_id - Bug ID to show.
   * @returns {Object} controller - New DetailsPageController instance.
   */
  constructor (bug_id) {
    super(); // This does nothing but is required before using `this`

    this.id = Date.now();
    this.bug_id = bug_id;
    this.container = new BzDeck.BugContainerController(this.id);

    this.connect();
  }

  /**
   * Called by the app router to reuse the controller.
   * @param {Number} bug_id - Bug ID to show.
   * @returns {undefined}
   */
  reconnect (bug_id) {
    let $$tablist = BzDeck.views.banner.$$tablist;

    // Find an existing tab. To enable navigation within a tab, the bug ID is not included to the tab's id attribute,
    // that's why the tab look-up in BzDeck.views.banner.open_tab() is not working and we are doing it here instead.
    // TODO: Refactor tabs and router relationship (#232)
    for (let [page_id, page_view] of BzDeck.views.pages.details_list || []) {
      if (page_view.bug_id === bug_id && page_view.$tab.parentElement) {
        $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;
        BzDeck.views.global.update_window_title(page_view.$tab);

        return;
      }
    }

    this.connect();
  }

  /**
   * Connect to the view.
   * @param {undefined}
   * @returns {undefined}
   */
  connect () {
    BzDeck.views.banner.open_tab({
      label: `Bug ${this.bug_id}`,
      position: 'next',
      page: {
        category: 'details',
        id: this.id,
        constructor: BzDeck.DetailsPageView,
        constructor_args: [this.id, this.bug_id],
      },
    }, this);

    this.container.add_bug(this.bug_id, history.state ? history.state.ids : []);
  }
}
