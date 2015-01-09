/**
 * BzDeck Home Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.HomePage = function HomePageController (folder_id) {
  if (!BzDeck.views.pages.home) {
    BzDeck.views.pages.home = new BzDeck.views.HomePage();
  }

  BzDeck.views.pages.home.connect(folder_id);
};

BzDeck.controllers.HomePage.route = '/home/(\\w+)';

BzDeck.controllers.HomePage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.HomePage.prototype.constructor = BzDeck.controllers.HomePage;
