/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the User Collection that represents Bugzilla users. Each user is a UserModel.
 * @extends BzDeck.BaseCollection
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.UserCollection = class UserCollection extends BzDeck.BaseCollection {
  /**
   * Get a UserCollection instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} users - New UserCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'users';
    this.model = BzDeck.UserModel;
  }

  /**
   * Add bug participants, including Cc members, assignee, QA and menters, to the user database, and return the models
   * of those users.
   * @argument {Proxy} bug - BugModel object.
   * @return {undefined}
   */
  add_from_bug (bug) {
    for (let [name, person] of bug.participants) {
      this.get(name).then(user => {
        if (!user) {
          this.set(name, { name, bugzilla: person });
        }
      });
    }
  }

  /**
   * Search users from the local database and return the results.
   * @argument {URLSearchParams} params - Search query.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   */
  search_local (params) {
    let words = params.get('match').trim().split(/\s+/).map(word => word.toLowerCase()),
        match = (str, word) => !!str.match(new RegExp(`\\b${this.helpers.regexp.escape(word)}`, 'i'));

    // If the search string starts with a colon, remove it so a nick name may match
    if (words.length === 1 && words[0].startsWith(':')) {
      words[0] = words[0].substr(1);
    }

    return this.get_all().then(users => [...users.values()].filter(user => {
      return words.every(word => match(user.name, word)) ||
             words.every(word => user.nick_names.some(nick => match(nick, word)));
    })).then(users => this.get_search_results(users));
  }

  /**
   * Search users from the remote Bugzilla instnace and return the results.
   * @argument {URLSearchParams} params - Search query.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   */
  search_remote (params) {
    let _users;

    return BzDeck.controllers.global.request('user', params).then(result => {
      if (!result.users || !result.users.length) {
        return Promise.resolve([]);
      }

      _users = new Map(result.users.map(user => [user.name, user])); // Raw data objects
    }).then(() => {
      return this.get_some(_users.keys());
    }).then(__users => {
      return Promise.all([...__users].map(entry => new Promise(resolve => {
        let [name, user] = entry,
            retrieved = _users.get(name); // Raw data object

        if (user) {
          resolve(user);
        } else {
          this.set(name, { name, bugzilla: retrieved }).then(user => resolve(user));
        }
      })));
    }).then(users => {
      return this.get_search_results(users);
    });
  }

  /**
   * Sort descending (new to old) and return search results.
   * @argument {Array.<Proxy>} users - List of found users.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   * @todo Improve the sorting algorithm.
   */
  get_search_results (users) {
    // Sort by the last active time
    users.sort((a, b) => new Date(a.last_activity) < new Date(b.last_activity));
    // Another possible factors: How active the person is? How often the person has interacted with the user?

    return Promise.resolve(users);
  }
}
