/**
 * BzDeck Search Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.SearchPage = function SearchPageController (search_id) {
  this.search_id = search_id;

  let params = new URLSearchParams(location.search.substr(1) || history.state ? history.state.params : undefined);

  BzDeck.views.toolbar.open_tab({
    'page_category': 'search',
    'page_id': this.search_id,
    'page_constructor': BzDeck.views.SearchPage,
    'page_constructor_args': [this.search_id, params],
    'tab_label': 'Search', // l10n
    'tab_desc': 'Search & Browse Bugs', // l10n
  });

  if (params) {
    this.exec_search(params);
  }

  this.subscribe('V:SearchRequested:' + this.search_id, data => this.exec_search(data.params));
};

BzDeck.controllers.SearchPage.route = '/search/(\\d{13,})';

BzDeck.controllers.SearchPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.SearchPage.prototype.constructor = BzDeck.controllers.SearchPage;

BzDeck.controllers.SearchPage.prototype.exec_search = function (params) {
  if (!navigator.onLine) {
    this.publish('C:Offline:' + this.search_id);

    return;
  }

  this.publish('C:SearchStarted:' + this.search_id);

  BzDeck.controllers.core.request('GET', 'bug', params).then(result => {
    if (result.bugs.length > 0) {
      this.data.bugs = result.bugs;

      // Save data
      BzDeck.models.bugs.get_all().then(bugs => {
        let saved_ids = [for (bug of bugs) bug.id];

        BzDeck.models.bugs.save_bugs([for (bug of result.bugs) if (!saved_ids.includes(bug.id)) bug]);
      });
    }

    // Show results
    this.publish('C:SearchResultsAvailable:' + this.search_id, { 'bugs': result.bugs });
  }).catch(error => {
    this.publish('C:SearchError:' + this.search_id, { error });
  }).then(() => {
    this.publish('C:SearchComplete:' + this.search_id);
  });
};
