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
   * @param {Object} config - Bugzilla server configuration that contains products, components and more.
   * @returns {Object} presenter - New SearchPagePresenter instance.
   */
  constructor (id, config) {
    super(id); // Assign this.id

    this.data = new Proxy({
      bugs: new Map(),
      preview_id: null
    },
    {
      get: (obj, prop) => {
        if (prop === 'bugs') {
          // Return a sorted bug list
          return this.view.get_shown_bugs(obj.bugs);
        }

        return obj[prop];
      },
      set: (obj, prop, newval) => {
        let oldval = obj[prop];

        if (oldval === newval && !this.view.preview_is_hidden) {
          return true;
        }

        if (prop === 'preview_id') {
          let siblings = [...this.data.bugs.keys()];

          // Show the bug preview only when the preview pane is visible (on desktop and tablet)
          if (this.view.preview_is_hidden) {
            BzDeck.router.navigate('/bug/' + newval, { siblings });

            return true; // Do not save the value
          }

          if (oldval !== newval && newval) {
            BzDeck.router.navigate(location.pathname, { bug_id: newval, siblings }, true);
            BzDeck.models.bugzfeed._subscribe([newval]);
          }
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
   * @returns {undefined}
   */
  exec_search (params) {
    if (!navigator.onLine) {
      this.trigger('#Offline');

      return;
    }

    this.trigger('#SearchStarted');

    BzDeck.collections.bugs.search_remote(params).then(bugs => {
      bugs = this.data.bugs = new Map(bugs.map(bug => [bug.id, bug]));
      this.trigger_safe('#SearchResultsAvailable', { bugs });
    }).catch(error => {
      this.trigger('#SearchError', { message: error.message });
    }).then(() => {
      this.trigger('#SearchComplete');
    });
  }
}
