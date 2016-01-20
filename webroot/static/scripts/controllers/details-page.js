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
   * @argument {Number} bug_id - Bug ID to show.
   * @return {Object} controller - New DetailsPageController instance.
   */
  constructor (bug_id) {
    super(); // This does nothing but is required before using `this`

    let $$tablist = BzDeck.views.banner.$$tablist;

    // Find an existing tab. To enable navigation within a tab, the bug ID is not included to the tab's id attribute,
    // that's why the tab look-up in BzDeck.views.banner.open_tab() is not working and we are doing it here instead.
    // TODO: Refactor tabs and router relationship (#232)
    for (let [page_id, page_view] of BzDeck.views.pages.details_list || []) {
      if (page_view.bug_id === bug_id && page_view.$tab.parentElement) {
        $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;
        BzDeck.views.global.update_window_title(page_view.$tab);

        return page_view.controller;
      }
    }

    this.id = Date.now();
    this.bug_id = bug_id;
    this.bug_ids = history.state ? history.state.ids : [];

    BzDeck.views.banner.open_tab({
      page_category: 'details',
      page_id: this.id,
      page_constructor: BzDeck.views.DetailsPage,
      page_constructor_args: [this.id, this.bug_id, this.bug_ids],
      tab_label: `Bug ${this.bug_id}`,
      tab_position: 'next',
    }, this);

    this.get_bug();

    this.subscribe('V:NavigationRequested');

    return this;
  }

  /**
   * Called by DetailsPageView whenever navigating to other bug within the same tabpanel is requested.
   * @argument {Object} data - Passed data.
   * @argument {Number} data.id - New bug ID to navigate.
   * @argument {Array}  data.ids - List of bugs in the same navigation session.
   * @argument {String} data.old_path - Previous location path.
   * @argument {String} data.new_path - New location path.
   * @argument {Boolean} data.reinit - Whether there's an existing tabpanel content for the new bug.
   * @return {undefined}
   */
  on_navigation_requested (data) {
    let { id, ids, old_path, new_path, reinit } = data;

    this.bug_id = id;
    window.history.replaceState({ ids, previous: old_path }, '', new_path);

    if (reinit) {
      this.get_bug();
    }
  }

  /**
   * Prepare bug data for the view. Find it from the local database or remote Bugzilla instance, then notify the result
   * regardless of the availability.
   * @argument {undefined}
   * @return {undefined}
   */
  get_bug () {
    if (!navigator.onLine) {
      this.trigger(':BugDataUnavailable', { code: 0, message: 'You have to go online to load the bug.' });

      return;
    }

    BzDeck.collections.bugs.get(this.bug_id).then(bug => {
      if (bug && !bug.error) {
        return bug;
      }

      this.trigger(':LoadingStarted');

      return BzDeck.collections.bugs.get(this.bug_id, { id: this.bug_id, _unread: true }).then(bug => {
        return bug.fetch();
      }).catch(error => this.trigger(':BugDataUnavailable', { code: 0, message: 'Failed to load data.' }));
    }).then(bug => new Promise((resolve, reject) => {
      if (bug.data && bug.data.summary) {
        resolve(bug);
      } else {
        let code = bug.error ? bug.error.code : 0;
        let message = {
          102: 'You are not authorized to access this bug, probably because it has sensitive information such as \
                unpublished security issues or marketing-related topics. '
        }[code] || 'This bug data is not available.';

        this.trigger(':BugDataUnavailable', { code, message });
        reject(new Error(message));
      }
    })).then(bug => {
      bug.unread = false;
      this.trigger(':BugDataAvailable', { bug, controller: new BzDeck.BugController('details', bug) });
    });

    BzDeck.controllers.bugzfeed._subscribe([this.bug_id]);
  }
}

BzDeck.DetailsPageController.prototype.route = '/bug/(\\d+)';
