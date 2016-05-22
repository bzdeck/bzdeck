/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Home Page Presenter.
 * @extends BzDeck.BasePresenter
 */
BzDeck.HomePagePresenter = class HomePagePresenter extends BzDeck.BasePresenter {
  /**
   * Called by the app router and initialize the Home Page Presenter. Select the specified Sidebar folder.
   * @constructor
   * @listens HomePageView#UnknownFolderSelected
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {Object} presenter - New HomePagePresenter instance.
   */
  constructor (folder_id) {
    super(); // This does nothing but is required before using `this`

    this.id = Date.now();
    this.container = new BzDeck.BugContainerPresenter(this.id);

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
            this.data.sorted_bugs.then(bugs => this.container.add_bug(newval, [...bugs.keys()]));
          }
        }

        obj[prop] = newval;

        return true;
      }
    });

    this.on('V#UnknownFolderSelected', data => BzDeck.router.navigate('/home/inbox'));

    BzDeck.presenters.homepage = this;
    this.view = BzDeck.views.pages.home = new BzDeck.HomePageView(this);
    this.view.connect(folder_id);
  }

  /**
   * Called by the app router to reuse the presenter.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {undefined}
   */
  reconnect (folder_id) {
    this.view.connect(folder_id);
  }
}
