/**
 * BzDeck Details Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.DetailsPage = function DetailsPageController () {
  this.id = Number.parseInt(arguments[0]);

  BzDeck.views.toolbar.open_tab({
    'page_category': 'details',
    'page_id': this.id,
    'page_constructor': BzDeck.views.DetailsPage,
    'page_constructor_args': [this.id, history.state ? history.state.ids : []],
    'tab_label': this.id,
    'tab_position': 'next',
  }, this);

  BzDeck.models.bugs.get_bug_by_id(this.id).then(bug => {
    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      this.fetch_bug();
      bug = { 'id': this.id };
    }

    this.trigger(':BugDataReady', { bug });
    BzDeck.controllers.bugs.toggle_unread(this.id, false);
  });

  BzDeck.controllers.bugzfeed.subscribe([this.id]);
};

BzDeck.controllers.DetailsPage.route = '/bug/(\\d+)';

BzDeck.controllers.DetailsPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.DetailsPage.prototype.constructor = BzDeck.controllers.DetailsPage;

BzDeck.controllers.DetailsPage.prototype.fetch_bug = function () {
  if (!navigator.onLine) {
    this.trigger(':Offline');

    return;
  }

  this.trigger(':LoadingStarted');

  BzDeck.controllers.bugs.fetch_bug(this.id).then(bug => {
    // Save in DB
    BzDeck.models.bugs.save_bug(bug);
    this.trigger(':LoadingComplete', { bug });
  }).catch(bug => {
    this.trigger(':LoadingError');
  });
};
