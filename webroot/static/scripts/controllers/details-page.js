/**
 * BzDeck Details Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.DetailsPage = function DetailsPageController () {
  let id = Number.parseInt(arguments[0]);

  BzDeck.views.toolbar.open_tab({
    'page_category': 'details',
    'page_id': id,
    'page_constructor': BzDeck.views.DetailsPage,
    'page_constructor_args': [id, history.state ? history.state.ids : []],
    'tab_label': id,
    'tab_position': 'next',
  });
};

BzDeck.controllers.DetailsPage.route = '/bug/(\\d+)';

BzDeck.controllers.DetailsPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.DetailsPage.prototype.constructor = BzDeck.controllers.DetailsPage;
