/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Quick Search Controller that controls the Quick Search functionality on the application header.
 *
 * @constructor
 * @extends BaseController
 * @argument {undefined}
 * @return {Object} controller - New QuickSearchController instance.
 */
BzDeck.controllers.QuickSearch = function QuickSearchController () {
  BzDeck.views.quick_search = new BzDeck.views.QuickSearch();

  this.on('V:RecentSearchesRequested', data => this.provide_recent_searches());
  this.on('V:QuickSearchRequested', data => this.exec_quick_search(data.input));
  this.on('V:AdvancedSearchRequested', data => this.exec_advanced_search(data.input));
  this.subscribe('V:ResultSelected');
};

BzDeck.controllers.QuickSearch.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.QuickSearch.prototype.constructor = BzDeck.controllers.QuickSearch;

/**
 * Provide recent searches done by the user.
 *
 * @argument {undefined}
 * @return {Boolean} provided - Whether the results are provided.
 */
BzDeck.controllers.QuickSearch.prototype.provide_recent_searches = function () {
  let history = BzDeck.prefs.get('search.quick.history') || [],
      results = [];

  for (let item of history) {
    let { type, id } = item;

    if (type === 'bug') {
      let bug = BzDeck.collections.bugs.get(id);

      if (bug) {
        results.push(bug.search_result);
      }
    }

    if (type === 'user') {
      let user = BzDeck.collections.users.get(id);

      if (user) {
        results.push(Object.assign({ type: 'user' }, user.properties));
      }
    }
  }

  if (!results.length) {
    return false;
  }

  this.trigger(':ResultsAvailable', { category: 'recent', input: '', results });

  return true;
};

/**
 * Execute a quick search. TODO: Add support for other objects like products/components and attachments.
 *
 * @argument {String} input - Original search terms, may contain spaces.
 * @return {undefined}
 */
BzDeck.controllers.QuickSearch.prototype.exec_quick_search = function (input) {
  let words = input.trim().split(/\s+/).map(word => word.toLowerCase()),
      trigger = (category, results) => this.trigger(':ResultsAvailable', { category, input, results });

  if (words.length) {
    BzDeck.collections.bugs.search_local(input, words).then(results => trigger('bugs', results));
    BzDeck.collections.users.search_local(input, words).then(results => trigger('users', results));
  }

  // Remote searches require at learst 3 characters
  if (input.trim().length >= 3) {
    // Use a .5 second timer not to send requests so frequently while the user is typing
    window.clearTimeout(this.searchers);
    this.searchers = window.setTimeout(() => {
      BzDeck.collections.bugs.search_remote(input, words).then(results => trigger('bugs', results));
      BzDeck.collections.users.search_remote(input, words).then(results => trigger('users', results));
    }, 500);
  }
};

/**
 * Execute an advanced search by opening a new search page.
 *
 * @argument {String} input - Original search terms, may contain spaces.
 * @return {undefined}
 */
BzDeck.controllers.QuickSearch.prototype.exec_advanced_search = function (input) {
  let words = input.trim().split(/\s+/).map(word => word.toLowerCase()),
      params = new URLSearchParams();

  if (words.length) {
    params.append('short_desc', words.join(' '));
    params.append('short_desc_type', 'allwordssubstr');
    params.append('resolution', '---'); // Search only open bugs
  }

  BzDeck.router.navigate(`/search/${Date.now()}`, { 'params' : params.toString() });
};

/**
 * Called by QuickSearchView whenever a search result is selected. Show the result in a new tab, and update the search
 * history.
 *
 * @argument {Object} data - Passed data.
 * @argument {{String|Number)} data.id - Item name, such as bug ID or user name.
 * @argument {String} data.type - Item type, such as 'bug' or 'user'.
 * @return {undefined}
 */
BzDeck.controllers.QuickSearch.prototype.on_result_selected = function (data) {
  let { id, type } = data,
      history = BzDeck.prefs.get('search.quick.history') || [],
      // Find an existing item
      index = history.findIndex(item => item.type === type && item.id === id),
      // If the history has the same item, update the timestamp and reorder the history. Otherwise, create a new object
      item = index > -1 ? history.splice(index, 1)[0] : { type, id };

  BzDeck.router.navigate(`/${type.replace('user', 'profile')}/${id}`);

  item.timestamp = Date.now();
  history.unshift(item);
  history.length = 25; // Max quick history items
  BzDeck.prefs.set('search.quick.history', history);
};
