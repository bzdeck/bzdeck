/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Called by the app router and initialize the Home Page Controller. Select the specified Sidebar folder.
 *
 * @constructor
 * @extends BaseController
 * @argument {String} folder_id - One of the folder identifiers defined in the app config.
 * @return {Object} controller - New HomePageController instance.
 */
BzDeck.controllers.HomePage = function HomePageController (folder_id) {
  if (BzDeck.controllers.homepage) {
    BzDeck.views.pages.home.connect(folder_id);

    return BzDeck.controllers.homepage;
  }

  this.data = new Proxy({
    bugs: new Map(),
    preview_id: null
  },
  {
    get: (obj, prop) => {
      if (prop === 'sorted_bugs') {
        // Return a sorted bug list
        return this.view.get_shown_bugs(obj.bugs);
      }

      return obj[prop];
    },
    set: (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        // Show the bug preview only when the preview pane is visible (on desktop and tablet)
        if (this.view.preview_is_hidden) {
          BzDeck.router.navigate('/bug/' + newval, { ids: [...this.data.sorted_bugs.keys()] });

          return true; // Do not save the value
        }

        if (oldval !== newval) {
          this.prep_preview(newval);
          BzDeck.controllers.bugzfeed.subscribe([newval]);
        }
      }

      obj[prop] = newval;

      return true;
    }
  });

  this.on('V:UnknownFolderSelected', data => BzDeck.router.navigate('/home/inbox'));

  this.on('V:OpeningTabRequested', data => {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { ids: [...this.data.sorted_bugs.keys()] });
  });

  BzDeck.controllers.homepage = this;
  this.view = BzDeck.views.pages.home = new BzDeck.views.HomePage(this);
  this.view.connect(folder_id);

  return this;
};

BzDeck.controllers.HomePage.route = '/home/(\\w+)';

BzDeck.controllers.HomePage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.HomePage.prototype.constructor = BzDeck.controllers.HomePage;

/**
 * Prepare a bug preview displayed in the Preview Pane by loading the bug data.
 *
 * @argument {Number} id - Bug ID to show.
 * @return {undefined}
 */
BzDeck.controllers.HomePage.prototype.prep_preview = function (id) {
  if (!id) {
    this.trigger(':BugDataUnavailable');
  } else {
    let bug = BzDeck.collections.bugs.get(id);

    if (bug) {
      bug.unread = false;
      this.trigger(':BugDataAvailable', { bug, controller: new BzDeck.controllers.Bug('home', bug) });
    } else {
      this.trigger(':BugDataUnavailable');
    }
  }
};
