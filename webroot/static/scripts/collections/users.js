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
