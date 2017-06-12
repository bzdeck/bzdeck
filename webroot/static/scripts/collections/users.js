/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the User Collection that represents Bugzilla users. Each user is a UserModel.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 * @see {@link https://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user Bugzilla API}
 */
BzDeck.UserCollection = class UserCollection extends BzDeck.BaseCollection {
  /**
   * Get a UserCollection instance.
   * @returns {UserCollection} New UserCollection instance.
   */
  constructor () {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'users';
    this.model = BzDeck.UserModel;
  }

  /**
   * Add bug participants, including Cc members, assignee, QA and mentors, to the user database, and return the models
   * of those users.
   * @param {Proxy} bug - BugModel object.
   */
  add_from_bug (bug) {
    for (const [name, bugzilla] of bug.participants) {
      // Get user or create new user
      this.get(name, { name, bugzilla });
    }
  }

  /**
   * Search users from the local database and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Array.<Proxy>>} Search results.
   */
  async search_local (params) {
    const words = params.get('match').trim().split(/\s+/).map(word => word.toLowerCase());
    const match = (str, word) => !!str.match(new RegExp(`\\b${FlareTail.util.RegExp.escape(word)}`, 'i'));

    // If the search string starts with a colon, remove it so a nick name may match
    if (words.length === 1 && words[0].startsWith(':')) {
      words[0] = words[0].substr(1);
    }

    const all_users = await this.get_all();
    const users = [...all_users.values()].filter(user => {
      return words.every(word => match(user.name, word)) ||
             words.every(word => user.nick_names.some(nick => match(nick, word)));
    });

    return this.get_search_results(users);
  }

  /**
   * Search users from the remote Bugzilla instance and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Array.<Proxy>>} Search results.
   */
  async search_remote (params) {
    const result = await BzDeck.host.request('user', params);
    // Raw data objects
    const _users = new Map(result.users && result.users.length ? result.users.map(user => [user.name, user]) : []);
    // Custom data objects
    const some_users = await this.get_some(_users.keys());

    const users = await Promise.all([...some_users].map(async ([name, user]) => {
      return user || await this.set(name, { name, bugzilla: _users.get(name) });
    }));

    return this.get_search_results(users);
  }

  /**
   * Sort descending (new to old) and return search results.
   * @param {Array.<Proxy>} users - List of found users.
   * @returns {Promise.<Array.<Proxy>>} Search results.
   * @todo Improve the sorting algorithm. Another possible factors: How active the person is? How often the person has
   *  interacted with the user?
   */
  async get_search_results (users) {
    // Sort by the last active time
    users.sort((a, b) => new Date(a.last_activity) < new Date(b.last_activity));

    return users;
  }
}
