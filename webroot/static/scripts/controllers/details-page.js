/**
 * BzDeck Details Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.DetailsPage = function DetailsPageController () {
  let bug_id = Number.parseInt(arguments[0]),
      $$tablist = BzDeck.views.toolbar.$$tablist;

  // Find an existing tab
  for (let [page_id, page_view] of BzDeck.views.pages.details_list || []) {
    if (page_view.bug_id === bug_id) {
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
  BzDeck.models.bugs.get(this.bug_id).then(bug => {
    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      this.fetch_bug();
      bug = { 'id': this.bug_id };
    }

    this.trigger(':BugDataReady', { bug });
    BzDeck.controllers.bugs.toggle_unread(this.bug_id, false);
  });

  BzDeck.controllers.bugzfeed.subscribe([this.bug_id]);
};

BzDeck.controllers.DetailsPage.prototype.fetch_bug = function () {
  if (!navigator.onLine) {
    this.trigger(':Offline');

    return;
  }

  this.trigger(':LoadingStarted');

  BzDeck.controllers.bugs.fetch_bug(this.bug_id).then(bug => {
    // Save in DB
    BzDeck.models.bugs.save(bug);
    this.trigger(':LoadingComplete', { bug });
  }).catch(bug => {
    this.trigger(':LoadingError');
  });
};
