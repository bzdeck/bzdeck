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
   * @constructor
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
  async add_from_bug (bug) {
    const missing = new Set();

    await Promise.all([...bug.participants.values()].map(async ({ name } = {}) => {
      const user = await this.get(name);

      if (!user) {
        missing.add(name);
      }
    }));

    if (missing.size) {
      this.fetch(missing);
    }
  }

  /**
   * Refresh user profiles if the data is older than 10 days
   */
  async refresh () {
    const all_users = await this.get_all();
    const users = [...all_users.values()].filter(user => user.updated && user.updated < Date.now() - 864000000);

    if (users.length) {
      this.fetch(users.map(user => user.email));
    }
  }

  /**
   * Retrieve multiple users from Bugzilla with specific user names, and return user objects.
   * @param {(Array|Set)} _names - List of user names (email addresses) to retrieve.
   * @returns {Promise.<Array.<Proxy>>} Proxified UserModel instances.
   */
  async fetch (_names) {
    const names = [..._names].sort();

    // Due to Bug 1169040, the Bugzilla API returns an error even if one of the users is not found. To work around the
    // issue, divide the array into chunks to retrieve 20 users per request, then divide each chunk again if failed.
    const names_chunks = FlareTail.util.Array.chunk(names, 20);

    const _fetch = async names => {
      const params = new URLSearchParams();

      names.forEach(name => params.append('names', name));

      const result = await BzDeck.host.request('user', params);

      return result.users;
    };

    const users_chunks = await Promise.all(names_chunks.map(async names => {
      const users = await _fetch(names);

      if (users && !users.error) {
        return users;
      }

      // Retrieve the users one by one if failed
      return Promise.all(names.map(async name => {
        const users = await _fetch([name])

        return users ? users[0] : { name, error: true };
      }));
    }));

    // Flatten an array of arrays
    const _users = users_chunks.reduce((a, b) => a.concat(b), []);

    const users = await Promise.all(_users.map(async _user => {
      const name = _user.name;
      const user = await this.get(name);
      const obj = _user.error ? { name, error: 'Not Found' }
                              : Object.assign(user ? user.data : {}, { bugzilla: _user });

      obj.updated = Date.now();

      return this.set(name, obj);
    }));

    users.forEach(user => {
      // Refresh the Gravatar profile if already exists, or fetch later on demand
      if (user.gravatar) {
        user.get_gravatar_profile();
      }
    });

    return users;
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
