/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.DetailsPage = function DetailsPageController (bug_id) {
  let $$tablist = BzDeck.views.toolbar.$$tablist;

  // Find an existing tab. To enable navigation within a tab, the bug ID is not included to the tab's id attribute,
  // that's why the tab look-up in BzDeck.views.toolbar.open_tab() is not working and we are doing it here instead.
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

  BzDeck.views.toolbar.open_tab({
    page_category: 'details',
    page_id: this.id,
    page_constructor: BzDeck.views.DetailsPage,
    page_constructor_args: [this.id, this.bug_id, this.bug_ids],
    tab_label: this.bug_id,
    tab_position: 'next',
  }, this);

  this.init();

  this.on('V:NavigationRequested', data => {
    this.bug_id = data.new_id;

    if (data.reinit) {
      this.init();
    }
  });

  return this;
};

BzDeck.controllers.DetailsPage.route = '/bug/(\\d+)';

BzDeck.controllers.DetailsPage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.DetailsPage.prototype.constructor = BzDeck.controllers.DetailsPage;

BzDeck.controllers.DetailsPage.prototype.init = function () {
  let bug = BzDeck.collections.bugs.get(this.bug_id);

  new Promise(resolve => {
    if (bug && !bug.error) {
      resolve(bug);
    } else if (!navigator.onLine) {
      this.trigger(':BugDataUnavailable', { code: 0, message: 'You have to go online to load the bug.' });
    } else {
      this.trigger(':LoadingStarted');
      bug = BzDeck.collections.bugs.get(this.bug_id, { id: this.bug_id, _unread: true });
      bug.fetch().then(bug => resolve(bug))
          .catch(error => this.trigger(':BugDataUnavailable', { code: 0, message: 'Failed to load data.' }));
    }
  }).then(bug => new Promise(resolve => {
    if (bug.data && bug.data.summary) {
      resolve(bug);
    } else {
      let code = bug.error ? bug.error.code : 0;
      let message = {
        102: 'You are not authorized to access this bug, probably because it has sensitive information such as \
              unpublished security issues or marketing-related topics. '
      }[code] || 'This bug data is not available.';

      this.trigger(':BugDataUnavailable', { code, message });
    }
  })).then(bug => {
    bug.unread = false;
    this.trigger(':BugDataAvailable', { bug });
  });

  BzDeck.controllers.bugzfeed.subscribe([this.bug_id]);
};
