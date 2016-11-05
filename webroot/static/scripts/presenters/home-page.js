/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Home Page Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.HomePagePresenter = class HomePagePresenter extends BzDeck.BasePresenter {
  /**
   * Get a HomePagePresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New HomePagePresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.data = new Proxy({
      bugs: new Map(),
      preview_id: null
    },
    {
      set: (obj, prop, newval) => {
        const oldval = obj[prop];

        if (prop === 'preview_id') {
          BzDeck.router.navigate(location.pathname, { preview_id: newval }, true);
        }

        obj[prop] = newval;

        return true;
      }
    });

    // Subscribe to events
    this.subscribe('V#UnknownFolderSelected');

    BzDeck.presenters.homepage = this;
  }

  /**
   * Called whenever an unknown folder is selected in the sidebar.
   * @listens HomePageView#UnknownFolderSelected
   * @param {undefined}
   * @returns {undefined}
   */
  on_unknown_folder_selected () {
    BzDeck.router.navigate('/home/inbox');
  }
}
