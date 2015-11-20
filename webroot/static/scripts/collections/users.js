/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the User Collection that represents Bugzilla users. Each user is a UserModel.
 *
 * @constructor
 * @extends BaseCollection
 * @argument {undefined}
 * @return {Object} users - New UserCollection instance.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.collections.Users = function UserCollection () {
  this.datasource = BzDeck.datasources.account;
  this.store_name = 'users';
  this.model = BzDeck.models.User;
};

BzDeck.collections.Users.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Users.prototype.constructor = BzDeck.collections.Users;

/**
 * Add bug participants, including Cc members, assignee, QA and menters, to the user database, and return the models of
 * those users.
 *
 * @argument {Proxy} bug - BugModel object.
 * @return {Map.<String, Proxy>} users - Map of the added user names and UserModel instances.
 */
BzDeck.collections.Users.prototype.add_from_bug = function (bug) {
  let users = new Map();

  for (let [name, person] of bug.participants) {
    users.set(name, this.get(name) || this.set(name, { name, bugzilla: person }));
  }

  return users;
};

/**
 * Search users from the local database and return the results.
 *
 * @argument {String} input - Original search terms, may contain spaces.
 * @argument {Array} words - Search terms in an array, without spaces.
 * @return {undefined}
 */
BzDeck.collections.Users.prototype.search_local = function (input, words) {
  let match = (str, word) => !!str.match(new RegExp(`\\b${this.helpers.regexp.escape(word)}`, 'i'));

  // If the search string starts with a colon, remove it so a nick name may match
  if (words.length === 1 && words[0].startsWith(':')) {
    words[0] = words[0].substr(1);
  }

  let users = [...this.get_all().values()].filter(user => {
    return words.every(word => match(user.name, word)) ||
           words.every(word => user.nick_names.some(nick => match(nick, word)));
  });

  return this.get_search_results(users);
};

/**
 * Search users from the remote Bugzilla instnace and return the results.
 *
 * @argument {String} input - Original search terms, may contain spaces.
 * @argument {Array} words - Search terms in an array, without spaces.
 * @return {Promise.<Object>} results - Promise to be resolved in the search results.
 */
BzDeck.collections.Users.prototype.search_remote = function (input, words) {
  let params = new URLSearchParams(),
      users = [];

  params.append('match', words.join(' ')); // Require auth
  params.append('limit', 10);

  return BzDeck.controllers.global.request('user', params, { auth: true }).then(result => {
    if (!result.users || !result.users.length) {
      return Promise.resolve([]);
    }

    let _users = new Map(result.users.map(user => [user.name, user]));

    for (let [name, user] of this.get_some(_users.keys())) {
      let retrieved = _users.get(name); // Raw data object

      if (!user) {
        user = this.set(name, { name, bugzilla: retrieved });
      }

      users.push(user);
    }

    return this.get_search_results(users);
  });
};

/**
 * Sort and return search results. TODO: Improve the sorting algorithm.
 *
 * @argument {Array.<Proxy>} users - List of found users.
 * @return {Promise.<Object>} results - Promise to be resolved in the search results.
 */
BzDeck.collections.Users.prototype.get_search_results = function (users) {
  users.sort((a, b) => {
    // Descending (new to old)
    return new Date(a.last_activity) < new Date(b.last_activity);
  });

  return Promise.resolve(users.map(user => Object.assign({ type: 'user', id: user.email }, user.properties)));
};
