/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Home Page Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.HomePageController = class HomePageController extends BzDeck.BaseController {
  /**
   * Called by the app router and initialize the Home Page Controller. Select the specified Sidebar folder.
   * @constructor
   * @argument {String} folder_id - One of the folder identifiers defined in the app config.
   * @return {Object} controller - New HomePageController instance.
   */
  constructor (folder_id) {
    super(); // This does nothing but is required before using `this`

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
          // Return a sorted bug list (Promise)
          return this.view.get_shown_bugs(obj.bugs);
        }

        return obj[prop];
      },
      set: (obj, prop, newval) => {
        let oldval = obj[prop];

        if (prop === 'preview_id') {
          // Show the bug preview only when the preview pane is visible (on desktop and tablet)
          if (this.view.preview_is_hidden) {
            this.data.sorted_bugs.then(bugs => {
              BzDeck.router.navigate('/bug/' + newval, { ids: [...bugs.keys()] });
            });

            return true; // Do not save the value
          }

          if (oldval !== newval) {
            this.prep_preview(newval);
            BzDeck.controllers.bugzfeed._subscribe([newval]);
          }
        }

        obj[prop] = newval;

        return true;
      }
    });

    this.on('V:UnknownFolderSelected', data => BzDeck.router.navigate('/home/inbox'));
    this.on('V:OpeningTabRequested', data => this.open_tab());

    BzDeck.controllers.homepage = this;
    this.view = BzDeck.views.pages.home = new BzDeck.HomePageView(this);
    this.view.connect(folder_id);

    return this;
  }

  /**
   * Prepare a bug preview displayed in the Preview Pane by loading the bug data.
   * @argument {Number} id - Bug ID to show.
   * @return {undefined}
   */
  prep_preview (id) {
    if (!id) {
      this.trigger(':BugDataUnavailable');

      return;
    }

    BzDeck.collections.bugs.get(id).then(bug => {
      if (bug) {
        bug.mark_as_read();
        this.trigger(':BugDataAvailable', { bug, controller: new BzDeck.BugController('home', bug) });
      } else {
        this.trigger(':BugDataUnavailable');
      }
    });
  }

  /**
   * Called by HomePageView whenever a previewed bug is selected for details. Open the bug in a new tab with a list of
   * the home page thread so the user can easily navigate through those bugs.
   * @argument {undefined}
   * @return {undefined}
   */
  open_tab () {
    this.data.sorted_bugs.then(bugs => {
      BzDeck.router.navigate('/bug/' + this.data.preview_id, { ids: [...bugs.keys()] });
    });
  }
}

BzDeck.HomePageController.prototype.route = '/home/(\\w+)';
