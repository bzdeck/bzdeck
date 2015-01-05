/**
 * BzDeck Profile Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.ProfilePage = function ProfilePageController (name) {
  BzDeck.views.toolbar.open_tab({
    'page_category': 'profile',
    'page_id': name,
    'page_constructor': BzDeck.views.ProfilePage,
    'page_constructor_args': [name],
    'tab_label': 'Profile', // l10n
    'tab_desc': 'User Profile', // l10n
  });
};

BzDeck.controllers.ProfilePage.route = '/profile/(.+)';

BzDeck.controllers.ProfilePage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.ProfilePage.prototype.constructor = BzDeck.controllers.ProfilePage;
