/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Quick Search Controller that controls the Quick Search functionality on the application header.
 * @extends BzDeck.BaseController
 */
BzDeck.QuickSearchController = class QuickSearchController extends BzDeck.BaseController {
  /**
   * Get a QuickSearchController instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} controller - New QuickSearchController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    BzDeck.views.quick_search = new BzDeck.QuickSearchView();

    this.on('V#RecentSearchesRequested', data => this.provide_recent_searches());
    this.on('V#QuickSearchRequested', data => this.exec_quick_search(data.input));
    this.on('V#AdvancedSearchRequested', data => this.exec_advanced_search(data.input));
    this.subscribe('V#ResultSelected');
  }

  /**
   * Provide recent searches done by the user. Notify the results with an event.
   * @listens QuickSearchView#RecentSearchesRequested
   * @param {undefined}
   * @returns {undefined}
   * @fires QuickSearchController#ResultsAvailable
   */
  provide_recent_searches () {
    BzDeck.prefs.get('search.quick.history').then(history => {
      return Promise.all((history || []).map(item => {
        let { type, id } = item;

        return new Promise(resolve => {
          if (type === 'bug') {
            BzDeck.collections.bugs.get(id).then(bug => {
              bug ? this.get_bug_result(bug).then(result => resolve(result)) : resolve(undefined);
            });
          }

          if (type === 'user') {
            BzDeck.collections.users.get(id).then(user => {
              user ? this.get_user_result(user).then(result => resolve(result)) : resolve(undefined);
            });
          }
        });
      }));
    }).then(results => {
      // Remove any `undefined` from the list
      results = new Set(results);
      results.delete(undefined);
      results = [...results];

      if (results.length) {
        this.trigger('#ResultsAvailable', { category: 'recent', input: '', results });
      }
    });
  }

  /**
   * Execute a quick search and notify the results with an event.
   * @listens QuickSearchView#QuickSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   * @returns {undefined}
   * @fires QuickSearchController#ResultsAvailable
   * @todo Add support for other objects like products and components (#326).
   */
  exec_quick_search (input) {
    input = input.trim();

    if (!input) {
      return;
    }

    let params_bugs = new URLSearchParams();
    let params_users = new URLSearchParams();

    let return_bugs = bugs => Promise.all(bugs.map(bug => this.get_bug_result(bug))).then(results => {
      this.trigger_safe('#ResultsAvailable', { category: 'bugs', input, results });
    });

    let return_users = users => Promise.all(users.map(user => this.get_user_result(user))).then(results => {
      this.trigger_safe('#ResultsAvailable', { category: 'users', input, results });
    });

    params_bugs.append('short_desc', input);
    params_bugs.append('short_desc_type', 'allwordssubstr');
    params_bugs.append('resolution', '---'); // Search only open bugs
    BzDeck.collections.bugs.search_local(params_bugs).then(bugs => return_bugs(bugs));

    params_users.append('match', input);
    params_users.append('limit', 10);
    BzDeck.collections.users.search_local(params_users).then(users => return_users(users));

    // Remote searches require at least 3 characters
    if (input.length >= 3) {
      // Use a .5 second timer not to send requests so frequently while the user is typing
      window.clearTimeout(this.searchers);
      this.searchers = window.setTimeout(() => {
        BzDeck.collections.bugs.search_remote(params_bugs).then(bugs => return_bugs(bugs));
        BzDeck.collections.users.search_remote(params_users).then(users => return_users(users));
      }, 500);
    }
  }

  /**
   * Extract some bug properties for a quick search result.
   * @param {Proxy} bug - BugModel instance.
   * @returns {Promise.<Object>} result - Promise to be resolved in bug search result.
   */
  get_bug_result (bug) {
    let contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;

    return BzDeck.collections.users.get(contributor, { name: contributor }).then(_contributor => ({
      type: 'bug',
      id: bug.id,
      summary: bug.summary,
      last_change_time: bug.last_change_time,
      contributor: _contributor.properties,
    }));
  }

  /**
   * Extract some user properties for a quick search result.
   * @param {Proxy} user - UserModel instance.
   * @returns {Promise.<Object>} result - Promise to be resolved in user search result.
   */
  get_user_result (user) {
    return Promise.resolve(Object.assign({ type: 'user', id: user.email }, user.properties));
  }

  /**
   * Execute an advanced search by opening a new search page.
   * @listens QuickSearchView#AdvancedSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   * @returns {undefined}
   */
  exec_advanced_search (input) {
    let params = new URLSearchParams();

    if (input.trim()) {
      params.append('short_desc', input.trim());
      params.append('short_desc_type', 'allwordssubstr');
      params.append('resolution', '---'); // Search only open bugs
    }

    BzDeck.router.navigate(`/search/${Date.now()}`, { 'params' : params.toString() });
  }

  /**
   * Called whenever a search result is selected. Show the result in a new tab, and update the search history.
   * @listens QuickSearchView#ResultSelected
   * @param {{String|Number)} id - Item name, such as bug ID or user name.
   * @param {String} type - Item type, such as 'bug' or 'user'.
   * @returns {undefined}
   */
  on_result_selected ({ id, type } = {}) {
    BzDeck.prefs.get('search.quick.history').then(value => {
      let history = value || [];
      // Find an existing item
      let index = history.findIndex(item => item.type === type && item.id === id);
      // If the same item exists, update the timestamp and reorder the history. Otherwise, create a new object
      let item = index > -1 ? history.splice(index, 1)[0] : { type, id };

      item.timestamp = Date.now();
      history.unshift(item);
      history.length = 25; // Max quick history items
      BzDeck.prefs.set('search.quick.history', history);
    });

    BzDeck.router.navigate(`/${type.replace('user', 'profile')}/${id}`);
  }
}
