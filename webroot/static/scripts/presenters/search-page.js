/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Search Page Presenter.
 * @extends BzDeck.BasePresenter
 */
BzDeck.SearchPagePresenter = class SearchPagePresenter extends BzDeck.BasePresenter {
  /**
   * Called by the app router and initialize the Search Page Presenter. Unlike other pages, this presenter doesn't
   * check existing tabs, because the user can open multiple search tabs at the same time.
   * @constructor
   * @param {Number} instance_id - 13-digit identifier for a new instance, generated with Date.now().
   * @returns {Object} presenter - New SearchPagePresenter instance.
   */
  constructor (instance_id) {
    super(); // This does nothing but is required before using `this`

    this.id = instance_id;

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
          // Show the bug preview only when the preview pane is visible (on desktop and tablet)
          if (this.view.preview_is_hidden) {
            BzDeck.router.navigate('/bug/' + newval, { ids: [...this.data.bugs.keys()] });

            return true; // Do not save the value
          }

          if (oldval !== newval) {
            this.prep_preview(newval);
            BzDeck.models.bugzfeed._subscribe([newval]);
          }
        }

        obj[prop] = newval;

        return true;
      }
    });

    this.on('V#SearchRequested', data => this.exec_search(new URLSearchParams(data.params_str)));
    this.on('V#OpeningTabRequested', data => this.open_tab());

    this.connect();
  }

  /**
   * Called by the app router to reuse the presenter.
   * @param {Number} instance_id - 13-digit identifier for a new instance, generated with Date.now().
   * @returns {undefined}
   */
  reconnect (instance_id) {
    this.connect();
  }

  /**
   * Connect to the view.
   * @param {undefined}
   * @returns {undefined}
   */
  connect () {
    let params = new URLSearchParams(location.search.substr(1) || (history.state ? history.state.params : undefined));

    BzDeck.views.banner.open_tab({
      label: 'Search', // l10n
      description: 'Search & Browse Bugs', // l10n
      page: {
        category: 'search',
        id: this.id,
        constructor: BzDeck.SearchPageView,
        constructor_args: [this.id, params, BzDeck.host.data.config],
      },
    }, this);

    if (params.toString()) {
      this.exec_search(params);
    }
  }

  /**
   * Prepare a bug preview displayed in the Preview Pane.
   * @param {Number} id - Bug ID to show.
   * @returns {undefined}
   * @fires SearchPagePresenter#BugDataAvailable
   * @fires SearchPagePresenter#BugDataUnavailable
   */
  prep_preview (id) {
    if (!id) {
      this.trigger('#BugDataUnavailable');

      return;
    }

    BzDeck.collections.bugs.get(id).then(bug => {
      if (bug) {
        bug.mark_as_read();
        this.trigger_safe('#BugDataAvailable', { bug, presenter: new BzDeck.BugPresenter('search', bug) });
      } else {
        this.trigger('#BugDataUnavailable');
      }
    });
  }

  /**
   * Called whenever a previewed bug is selected for details. Open the bug in a new tab with a list of the same search
   * results so the user can easily navigate through those bugs.
   * @listens SearchPageView#OpeningTabRequested
   * @param {undefined}
   * @returns {undefined}
   */
  open_tab () {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { ids: [...this.data.bugs.keys()] });
  }

  /**
   * Search bugs from the remote Bugzilla instance, and provide the results as event data.
   * @listens SearchPageView#SearchRequested
   * @param {URLSearchParams} params - Search query.
   * @returns {undefined}
   * @fires SearchPagePresenter#Offline
   * @fires SearchPagePresenter#SearchStarted
   * @fires SearchPagePresenter#SearchResultsAvailable
   * @fires SearchPagePresenter#SearchError
   * @fires SearchPagePresenter#SearchComplete
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
