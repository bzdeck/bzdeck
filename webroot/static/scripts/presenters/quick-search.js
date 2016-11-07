/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Quick Search Presenter that controls the Quick Search functionality on the application header.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.QuickSearchPresenter = class QuickSearchPresenter extends BzDeck.BasePresenter {
  /**
   * Get a QuickSearchPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New QuickSearchPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    // Subscribe to events. TEMP: Use the global option to hear from HomePageView.
    this.on('V#RecentSearchesRequested', data => this.provide_recent_searches());
    this.on('V#QuickSearchRequested', data => this.exec_quick_search(data.input), true);
    this.on('V#AdvancedSearchRequested', data => this.exec_advanced_search(data.input), true);
    this.subscribe('V#ResultSelected');
  }

  /**
   * Provide recent searches done by the user. Notify the results with an event.
   * @listens QuickSearchView#RecentSearchesRequested
   * @param {undefined}
   * @fires QuickSearchPresenter#ResultsAvailable
   * @returns {Promise.<undefined>}
   */
  async provide_recent_searches () {
    const history = await BzDeck.prefs.get('search.quick.history');

    const results = await Promise.all((history || []).map(async ({ type, id } = {}) => {
      if (type === 'bug') {
        const bug = await BzDeck.collections.bugs.get(id);
        const result = bug ? await this.get_bug_result(bug) : undefined

        return result;
      }

      if (type === 'user') {
        const user = await BzDeck.collections.users.get(id);
        const result = user ? await this.get_user_result(user) : undefined;

        return result;
      }
    }));

    // Remove any `undefined` from the list
    results = new Set(results);
    results.delete(undefined);
    results = [...results];

    if (results.length) {
      this.trigger('#ResultsAvailable', { category: 'recent', input: '', results });
    }
  }

  /**
   * Execute a quick search and notify the results with an event.
   * @listens QuickSearchView#QuickSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   * @fires QuickSearchPresenter#ResultsAvailable
   * @returns {undefined}
   * @todo Add support for other objects like products and components (#326).
   */
  exec_quick_search (input) {
    input = input.trim();

    if (!input) {
      return;
    }

    const params_bugs = new URLSearchParams();
    const params_users = new URLSearchParams();

    const return_bugs = async bugs => {
      const results = await Promise.all(bugs.map(bug => this.get_bug_result(bug)));

      this.trigger('#ResultsAvailable', { category: 'bugs', input, results });
    };

    const return_users = async users => {
      const results = await Promise.all(users.map(user => this.get_user_result(user)));

      this.trigger('#ResultsAvailable', { category: 'users', input, results });
    };

    params_bugs.append('short_desc', input);
    params_bugs.append('short_desc_type', 'allwordssubstr');
    params_bugs.append('resolution', '---'); // Search only open bugs
    (async () => return_bugs(await BzDeck.collections.bugs.search_local(params_bugs)))();

    params_users.append('match', input);
    params_users.append('limit', 10);
    (async () => return_users(await BzDeck.collections.users.search_local(params_users)))();

    // Remote searches require at least 3 characters
    if (input.length >= 3) {
      // Use a .5 second timer not to send requests so frequently while the user is typing
      window.clearTimeout(this.searchers);
      this.searchers = window.setTimeout(async () => {
        return_bugs(await BzDeck.collections.bugs.search_remote(params_bugs));
        return_users(await BzDeck.collections.users.search_remote(params_users));
      }, 500);
    }
  }

  /**
   * Extract some bug properties for a quick search result.
   * @param {Proxy} bug - BugModel instance.
   * @returns {Promise.<Object>} result - Promise to be resolved in bug search result.
   */
  async get_bug_result (bug) {
    const contributor = await bug.get_contributor();

    return {
      type: 'bug',
      id: bug.id,
      summary: bug.summary,
      last_change_time: bug.last_change_time,
      contributor,
    };
  }

  /**
   * Extract some user properties for a quick search result.
   * @param {Proxy} user - UserModel instance.
   * @returns {Promise.<Object>} result - Promise to be resolved in user search result.
   */
  async get_user_result (user) {
    return Object.assign({ type: 'user', id: user.email }, user.properties);
  }

  /**
   * Execute an advanced search by opening a new search page.
   * @listens QuickSearchView#AdvancedSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   * @returns {undefined}
   */
  exec_advanced_search (input) {
    const params = new URLSearchParams();

    if (input.trim()) {
      params.append('short_desc', input.trim());
      params.append('short_desc_type', 'allwordssubstr');
      params.append('resolution', '---'); // Search only open bugs
    }

    BzDeck.router.navigate('/search/' + FlareTail.helpers.misc.hash(), { 'params' : params.toString() });
  }

  /**
   * Called whenever a search result is selected. Show the result in a new tab, and update the search history.
   * @listens QuickSearchView#ResultSelected
   * @param {{String|Number)} id - Item name, such as bug ID or user name.
   * @param {String} type - Item type, such as 'bug' or 'user'.
   * @returns {undefined}
   */
  on_result_selected ({ id, type } = {}) {
    (async () => {
      const value = await BzDeck.prefs.get('search.quick.history');
      const history = value || [];
      // Find an existing item
      const index = history.findIndex(item => item.type === type && item.id === id);
      // If the same item exists, update the timestamp and reorder the history. Otherwise, create a new object
      const item = index > -1 ? history.splice(index, 1)[0] : { type, id };

      item.timestamp = Date.now();
      history.unshift(item);
      history.length = 25; // Max quick history items
      BzDeck.prefs.set('search.quick.history', history);
    })();

    BzDeck.router.navigate(`/${type.replace('user', 'profile')}/${id}`);
  }
}
