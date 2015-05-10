/**
 * BzDeck Details Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.DetailsPage = function DetailsPageController (bug_id) {
  let $$tablist = BzDeck.views.toolbar.$$tablist;

  // Find an existing tab
  for (let [page_id, page_view] of BzDeck.views.pages.details_list || []) {
    if (page_view.bug_id === bug_id && page_view.$tab.parentElement) {
      $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;

      return page_view.controller;
    }
  }

  this.id = Date.now();
  this.bug_id = bug_id;
  this.bug_ids = history.state ? history.state.ids : [];

  BzDeck.views.toolbar.open_tab({
    'page_category': 'details',
    'page_id': this.id,
    'page_constructor': BzDeck.views.DetailsPage,
    'page_constructor_args': [this.id, this.bug_id, this.bug_ids],
    'tab_label': this.bug_id,
    'tab_position': 'next',
  }, this);

  this.init();

  this.on('V:NavigationRequested', data => {
    this.bug_id = data.id;

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
  let bug = BzDeck.collections.bugs.get(this.bug_id, { 'id': this.bug_id, '_unread': true });

  if (!bug.data) {
    // If no cache found, try to retrieve it from Bugzilla
    if (!navigator.onLine) {
      this.trigger(':Offline');
    } else {
      this.trigger(':LoadingStarted');
      bug.fetch().then(bug => this.trigger(':LoadingComplete', { bug }), error => this.trigger(':LoadingError'));
    }
  }

  this.trigger(':BugDataAvailable', { bug });
  bug.unread = false;
  bug._last_viewed = Date.now();

  BzDeck.controllers.bugzfeed.subscribe([this.bug_id]);
};
