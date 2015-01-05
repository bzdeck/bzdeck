/**
 * BzDeck Search Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.SearchPage = function SearchPageController (search_id) {
  BzDeck.views.toolbar.open_tab({
    'page_category': 'search',
    'page_id': search_id,
    'page_constructor': BzDeck.views.SearchPage,
    'page_constructor_args': [search_id],
    'tab_label': 'Search', // l10n
    'tab_desc': 'Search & Browse Bugs', // l10n
  });
};

BzDeck.controllers.SearchPage.route = '/search/(\\d{13,})';

BzDeck.controllers.SearchPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.SearchPage.prototype.constructor = BzDeck.controllers.SearchPage;
