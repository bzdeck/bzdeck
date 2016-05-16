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
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {Object} controller - New HomePageController instance.
   * @listens HomePageView:UnknownFolderSelected
   */
  constructor (folder_id) {
    super(); // This does nothing but is required before using `this`

    if (BzDeck.controllers.homepage) {
      BzDeck.views.pages.home.connect(folder_id);

      return BzDeck.controllers.homepage;
    }

    this.id = Date.now();
    this.container = new BzDeck.BugContainerController(this.id);

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
            this.data.sorted_bugs.then(bugs => {
              this.container.sibling_bug_ids = [...bugs.keys()];
              this.container.add_bug(newval);
            });
          }
        }

        obj[prop] = newval;

        return true;
      }
    });

    this.on('V:UnknownFolderSelected', data => BzDeck.router.navigate('/home/inbox'));

    BzDeck.controllers.homepage = this;
    this.view = BzDeck.views.pages.home = new BzDeck.HomePageView(this);
    this.view.connect(folder_id);

    return this;
  }
}

BzDeck.HomePageController.prototype.route = '/home/(\\w+)';
