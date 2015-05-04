/**
 * BzDeck Home Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.HomePage = function HomePageController (folder_id) {
  if (BzDeck.controllers.homepage) {
    BzDeck.views.pages.home.connect(folder_id);

    return BzDeck.controllers.homepage;
  }

  this.data = new Proxy({
    'bugs': new Map(),
    'preview_id': null
  },
  {
    'get': (obj, prop) => {
      if (prop === 'bugs') {
        // Return a sorted bug list
        return this.view.get_shown_bugs(obj.bugs);
      }

      return obj[prop];
    },
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        // Show the bug preview only when the preview pane is visible (on desktop and tablet)
        if (this.view.preview_is_hidden) {
          BzDeck.router.navigate('/bug/' + newval, { 'ids': [...this.data.bugs.keys()] });

          return true; // Do not save the value
        }

        if (oldval !== newval) {
          this.prep_preview(oldval, newval);
          BzDeck.controllers.bugzfeed.subscribe([newval]);
        }
      }

      obj[prop] = newval;

      return true;
    }
  });

  this.on('V:OpeningTabRequested', data => {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { 'ids': [...this.data.bugs.keys()] });
  });

  BzDeck.controllers.homepage = this;
  this.view = BzDeck.views.pages.home = new BzDeck.views.HomePage(this);
  this.view.connect(folder_id);

  return this;
};

BzDeck.controllers.HomePage.route = '/home/(\\w+)';

BzDeck.controllers.HomePage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.HomePage.prototype.constructor = BzDeck.controllers.HomePage;

BzDeck.controllers.HomePage.prototype.prep_preview = function (oldval, newval) {
  if (!newval) {
    this.trigger(':BugDataUnavailable');
  } else {
    let bug = BzDeck.collections.bugs.get(newval);

    if (bug) {
      bug.unread = false;
      bug._last_viewed = Date.now();
      this.trigger(':BugDataAvailable', { bug });
    } else {
      this.trigger(':BugDataUnavailable');
    }
  }
};
