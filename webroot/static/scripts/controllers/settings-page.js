/**
 * BzDeck Settings Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.SettingsPage = function SettingsPageController () {
  BzDeck.views.toolbar.open_tab({
    'page_category': 'settings',
    'page_constructor': BzDeck.views.SettingsPage,
    'page_constructor_args': [history.state ? history.state.tab_id : undefined],
    'tab_label': 'Settings',
  });
};

BzDeck.controllers.SettingsPage.route = '/settings';

BzDeck.controllers.SettingsPage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.SettingsPage.prototype.constructor = BzDeck.controllers.SettingsPage;
