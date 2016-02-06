/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Search Page Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.SearchPageController = class SearchPageController extends BzDeck.BaseController {
  /**
   * Called by the app router and initialize the Search Page Controller. Unlike other pages, this controller doesn't
   * check existing tabs, because the user can open multiple search tabs at the same time.
   * @constructor
   * @argument {Number} id - 13-digit identifier for a new instance, generated with Date.now().
   * @return {Object} controller - New SearchPageController instance.
   */
  constructor (id) {
    super(); // This does nothing but is required before using `this`

    this.id = id;

    this.data = new Proxy({
      bugs: new Map(),
      preview_id: null
    },
    {
      get: (obj, prop) => {
        if (prop === 'bugs') {
          // Return a sorted bug list
          return this.view.get_shown_bugs(new Map(obj.bugs.map(bug => [bug.id, bug])));
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
            BzDeck.controllers.bugzfeed._subscribe([newval]);
          }
        }

        obj[prop] = newval;

        return true;
      }
    });

    let params = new URLSearchParams(location.search.substr(1) || (history.state ? history.state.params : undefined));

    BzDeck.views.banner.open_tab({
      page_category: 'search',
      page_id: this.id,
      page_constructor: BzDeck.SearchPageView,
      page_constructor_args: [this.id, params, BzDeck.host.data.config],
      tab_label: 'Search', // l10n
      tab_desc: 'Search & Browse Bugs', // l10n
    }, this);

    if (params.toString()) {
      this.exec_search(params);
    }

    this.on('V:SearchRequested', data => this.exec_search(data.params));
    this.on('V:OpeningTabRequested', data => this.open_tab());
  }

  /**
   * Prepare a bug preview displayed in the Preview Pane.
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
        bug.unread = false;
        this.trigger(':BugDataAvailable', { bug, controller: new BzDeck.BugController('search', bug) });
      } else {
        this.trigger(':BugDataUnavailable');
      }
    });
  }

  /**
   * Called by SearchPageView whenever a previewed bug is selected for details. Open the bug in a new tab with a list of
   * the same search resuts so the user can easily navigate through those bugs.
   * @argument {undefined}
   * @return {undefined}
   */
  open_tab () {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { ids: [...this.data.bugs.keys()] });
  }

  /**
   * Search bugs from the remote Bugzilla instance, and provide the results as event data.
   * @argument {URLSearchParams} params - Search query.
   * @return {undefined}
   */
  exec_search (params) {
    if (!navigator.onLine) {
      this.trigger(':Offline');

      return;
    }

    this.trigger(':SearchStarted');

    BzDeck.collections.bugs.search_remote(params).then(bugs => {
      bugs = this.data.bugs = new Map(bugs.map(bug => [bug.id, bug]));
      this.trigger(':SearchResultsAvailable', { bugs });
    }).catch(error => {
      this.trigger(':SearchError', { error });
    }).then(() => {
      this.trigger(':SearchComplete');
    });
  }
}

BzDeck.SearchPageController.prototype.route = '/search/(\\d{13,})';
