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
   * @returns {QuickSearchPresenter} New QuickSearchPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    // Subscribe to events
    this.on('AnyView#RecentSearchesRequested', data => this.provide_recent_searches(), true);
    this.on('AnyView#QuickSearchRequested', data => this.exec_quick_search(data), true);
    this.on('AnyView#AdvancedSearchRequested', data => this.exec_advanced_search(data.input), true);
  }

  /**
   * Provide recent searches done by the user. Notify the results with an event.
   * @listens AnyView#RecentSearchesRequested
   * @fires QuickSearchPresenter#ResultsAvailable
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
      this.trigger('#ResultsAvailable', { category: 'recent', remote: false, input: '', results });
    }
  }

  /**
   * Execute a quick search and notify the results with an event.
   * @listens AnyView#QuickSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   * @param {String} [product] - Product query, e.g. `Core`.
   * @param {String} [status] - Status query, e.g. `__open__` or 'NEW'.
   * @fires QuickSearchPresenter#ResultsAvailable
   * @todo Add support for other objects like assignee and components (#326).
   */
  exec_quick_search ({ input, product = '', status = '' } = {}) {
    input = input.trim();

    if (!input) {
      return;
    }

    const params_bugs = new URLSearchParams();
    const params_users = new URLSearchParams();

    const return_bugs = async (remote, bugs) => {
      const results = await Promise.all(bugs.map(bug => this.get_bug_result(bug)));

      this.trigger('#ResultsAvailable', { category: 'bugs', remote, input, product, status, results });
    };

    const return_users = async (remote, users) => {
      const results = await Promise.all(users.map(user => this.get_user_result(user)));

      this.trigger('#ResultsAvailable', { category: 'users', remote, input, product, status, results });
    };

    // Use the same query as https://bugzilla.mozilla.org/query.cgi?format=specific for a faster response
    params_bugs.append('query_format', 'specific');
    params_bugs.append('comments', '0');
    params_bugs.append('content', input);
    params_bugs.append('product', product);
    params_bugs.append('status', status);
    (async () => return_bugs(false, await BzDeck.collections.bugs.search_local(params_bugs)))();

    /*
    params_users.append('match', input);
    params_users.append('limit', 10);
    (async () => return_users(false, await BzDeck.collections.users.search_local(params_users)))();
    */

    // Remote searches require at least 3 characters
    if (input.length >= 3) {
      // Use a .5 second timer not to send requests so frequently while the user is typing
      window.clearTimeout(this.searchers);
      this.searchers = window.setTimeout(async () => {
        return_bugs(true, await BzDeck.collections.bugs.search_remote(params_bugs));
        /*
        return_users(true, await BzDeck.collections.users.search_remote(params_users));
        */
      }, 500);
    }
  }

  /**
   * Extract some bug properties for a quick search result.
   * @param {Proxy} bug - BugModel instance.
   * @returns {Promise.<Object>} Bug search result.
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
   * @returns {Promise.<Object>} User search result.
   */
  async get_user_result (user) {
    return Object.assign({ type: 'user', id: user.email }, user.properties);
  }

  /**
   * Execute an advanced search by opening a new search page.
   * @listens AnyView#AdvancedSearchRequested
   * @param {String} input - Original search terms, may contain spaces.
   */
  exec_advanced_search (input) {
    const params = new URLSearchParams();

    if (input.trim()) {
      params.append('short_desc', input.trim());
      params.append('short_desc_type', 'allwordssubstr');
      params.append('resolution', '---'); // Search only open bugs
    }

    BzDeck.router.navigate('/search/' + FlareTail.util.Misc.hash(), { 'params' : params.toString() });
  }
}
