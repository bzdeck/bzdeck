/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Details Page View that represents the Bug Details page's tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.DetailsPageView = class DetailsPageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Details Page View. If the specified bug has an existing tab, switch to
   * it. Otherwise, open a new tab and try to load the bug.
   * @constructor
   * @param {Number} bug_id - ID of the bug to display.
   * @returns {DetailsPageView} New DetailsPageView instance.
   */
  constructor (bug_id) {
    super(); // Assign this.id

    this.bug_id = bug_id;

    // Subscribe to events
    this.on('BugPresenter#BugDataAvailable');

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.DetailsPagePresenter(this.id);

    this.activate();
  }

  /**
   * Called by the app router to reuse the presenter.
   * @param {Number} bug_id - Bug ID to show.
   */
  reactivate (bug_id) {
    const $$tablist = BzDeck.views.banner.$$tablist;

    // Find an existing tab. To enable navigation within a tab, the bug ID is not included to the tab's id attribute,
    // that's why the tab look-up in BzDeck.views.banner.open_tab() is not working and we are doing it here instead.
    // TODO: Refactor tabs and router relationship (#232)
    for (const [page_id, page_view] of BzDeck.views.pages.details_list || []) {
      if (page_view.bug_id === bug_id && page_view.$tab.parentElement) {
        $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;
        BzDeck.views.global.update_window_title(page_view.$tab);

        return;
      }
    }

    this.activate();
  }

  /**
   * Connect to the view.
   */
  activate () {
    const siblings = history.state ? history.state.siblings : [];

    BzDeck.views.banner.open_tab({
      label: `Bug ${this.bug_id}`, // l10n
      category: 'details',
    }, this);

    if (!this.container_view) {
      this.$tab = document.querySelector(`#tab-details-${this.id}`);
      this.$tabpanel = document.querySelector(`#tabpanel-details-${this.id}`);
      this.container_view = new BzDeck.BugContainerView(this.id, this.$tabpanel);
    }

    this.container_view.on_adding_bug_requested({ bug_id: this.bug_id, siblings });
  }

  /**
   * Called when the bug data is found.
   * @listens BugPresenter#BugDataAvailable
   * @param {Number} id - Bug ID.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   */
  async on_bug_data_available ({ id, siblings = [] } = {}) {
    if (id !== this.bug_id) {
      return;
    }

    const bug = await BzDeck.collections.bugs.get(id);

    this.$tab.title = `Bug ${bug.id}\n${bug.summary || 'Loading...'}`; // l10n
    BzDeck.views.global.update_window_title(this.$tab);
  }
}
