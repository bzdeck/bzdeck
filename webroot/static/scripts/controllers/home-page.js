/**
 * BzDeck Home Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.HomePage = function HomePageController (folder_id) {
  BzDeck.views.HomePage.connect(folder_id);
};

BzDeck.controllers.HomePage.route = '/home/(\\w+)';

BzDeck.controllers.HomePage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.HomePage.prototype.constructor = BzDeck.controllers.HomePage;
