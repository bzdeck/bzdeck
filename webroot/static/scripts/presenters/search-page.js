/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Search Page Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.SearchPagePresenter = class SearchPagePresenter extends BzDeck.BasePresenter {
  /**
   * Get a SearchPagePresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New SearchPagePresenter instance.
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
    this.on('V#SearchRequested', data => this.exec_search(new URLSearchParams(data.params_str)));
    this.on('V#OpeningTabRequested', data => this.open_tab());
  }

  /**
   * Called whenever a previewed bug is selected for details. Open the bug in a new tab with a list of the same search
   * results so the user can easily navigate through those bugs.
   * @listens SearchPageView#OpeningTabRequested
   * @param {undefined}
   * @returns {undefined}
   */
  open_tab () {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { siblings: [...this.data.bugs.keys()] });
  }

  /**
   * Search bugs from the remote Bugzilla instance, and provide the results as event data.
   * @listens SearchPageView#SearchRequested
   * @param {URLSearchParams} params - Search query.
   * @fires SearchPagePresenter#Offline
   * @fires SearchPagePresenter#SearchStarted
   * @fires SearchPagePresenter#SearchResultsAvailable
   * @fires SearchPagePresenter#SearchError
   * @fires SearchPagePresenter#SearchComplete
   * @returns {Promise.<undefined>}
   */
  async exec_search (params) {
    if (!navigator.onLine) {
      this.trigger('#Offline');

      return;
    }

    this.trigger('#SearchStarted');

    try {
      const _bugs = await BzDeck.collections.bugs.search_remote(params);
      const bugs = this.data.bugs = new Map(_bugs.map(bug => [bug.id, bug]));

      this.trigger('#SearchResultsAvailable', { ids: _bugs.map(bug => bug.id) });
    } catch (error) {
      this.trigger('#SearchError', { message: error.message });
    }

    this.trigger('#SearchComplete');
  }
}
