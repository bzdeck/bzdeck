/**
 * BzDeck Base View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views = BzDeck.views || {};
BzDeck.views.pages = {};

BzDeck.views.Base = function BaseView () {};

BzDeck.views.Base.prototype = Object.create(FlareTail.app.View.prototype);
BzDeck.views.Base.prototype.constructor = BzDeck.views.Base;

BzDeck.views.Base.prototype.update_window_title = function ($tab) {
  if ($tab.id === 'tab-home') {
    BzDeck.views.pages.home.update_title($tab.title);
  } else {
    document.title = $tab.title.replace('\n', ' – ');
  }
};
