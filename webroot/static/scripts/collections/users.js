/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the User Collection that represents Bugzilla users. Each user is a UserModel.
 * @extends BzDeck.BaseCollection
 * @see {@link https://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
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
   * @return {Promise.<Array.<Proxy>>} users - Promise to be resolved in proxified UserModel instances.
   */
  add_from_bug (bug) {
    let missing = new Set();

    Promise.all([...bug.participants.values()].map(person => {
      let { name } = person;

      return this.get(name).then(user => {
        if (!user) {
          missing.add(name);
        }
      });
    })).then(() => {
      if (missing.size) {
        this.fetch(missing);
      }
    });
  }

  /**
   * Refresh user profiles if the data is older than 10 days
   * @argument {undefined}
   * @return {undefined}
   */
  refresh () {
    this.get_all().then(users => {
      users = [...users.values()].filter(user => user.updated && user.updated < Date.now() - 864000000);

      if (users.length) {
        this.fetch(users.map(user => user.email));
      }
    });
  }

  /**
   * Retrieve multiple users from Bugzilla with specific user names, and return user objects.
   * @argument {(Array|Set)} _names - List of user names (email addresses) to retrieve.
   * @return {Promise.<Array.<Proxy>>} users - Promise to be resolved in proxified UserModel instances.
   */
  fetch (_names) {
    let names = [..._names].sort();

    // Due to Bug 1169040, the Bugzilla API returns an error even if one of the users is not found. To work around the
    // issue, divide the array into chunks to retrieve 10 users per request, then divide each chunk again if failed.
    let names_chunks = FlareTail.helpers.array.chunk(names, 10);

    let _fetch = names => new Promise((resolve, reject) => {
      let params = new URLSearchParams();

      names.forEach(name => params.append('names', name));
      BzDeck.host.request('user', params).then(result => resolve(result.users), event => reject(new Error()));
    });

    return Promise.all(names_chunks.map(names => {
      return _fetch(names).catch(error => {
        // Retrieve the users one by one if failed
        return Promise.all(names.map(name => _fetch([name]).catch(error => ({ name, error: true }))));
      });
    })).then(users_chunks => {
      // Flatten an array of arrays
      return users_chunks.reduce((a, b) => a.concat(b), []);
    }).then(_users => {
      // _users is an Array of raw user objects. Convert them to UserModel instances
      return Promise.all(_users.map(_user => {
        let name = _user.name,
            obj;

        return this.get(name).then(user => {
          obj = _user.error ? { name, error: 'Not Found' } : Object.assign(user ? user.data : {}, { bugzilla: _user });
          obj.updated = Date.now();

          return this.set(name, obj);
        });
      }));
    }).then(users => {
      users.forEach(user => {
        user.get_gravatar_image();

        // Refresh the Gravatar profile if already exists, or fetch later on demand
        if (user.gravatar) {
          user.get_gravatar_profile();
        }
      });

      return users;
    });
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

    return BzDeck.host.request('user', params).then(result => {
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
