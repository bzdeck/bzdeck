/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Main Presenter that controls everything on the main application region.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.MainPresenter = class MainPresenter extends BzDeck.BasePresenter {
  /**
   * Get a MainPresenter instance.
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {MainPresenter} New MainPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    // Subscribe to events
    this.subscribe('V#TabSelected');
  }

  /**
   * Called whenever a tab in the global tablist is selected. Navigate to the specified location.
   * @listens MainView#TabSelected
   * @param {String} path - Location pathname that corresponds to the tab.
   */
  on_tab_selected ({ path } = {}) {
    if (location.pathname + location.search !== path) {
      BzDeck.router.navigate(path);
    }
  }
}
