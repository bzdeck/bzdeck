/**
 * BzDeck Users Collection
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Users Collection.
 *
 * [argument] none
 * [return] users (Object) new instance of the UsersCollection object, when an instance is created
 */
BzDeck.collections.Users = function UsersCollection () {
};

BzDeck.collections.Users.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Users.prototype.constructor = BzDeck.collections.Users;

BzDeck.collections.Users.prototype.model = BzDeck.models.User;
BzDeck.collections.Users.prototype.db_name = 'account';
BzDeck.collections.Users.prototype.store_name = 'users';
BzDeck.collections.Users.prototype.key_name = 'name';

/*
 * Add users participating in a bug.
 *
 * [argument] bug (Proxy) a BugCollection object
 * [return] users (Map(String, Proxy)) new instances of the UserCollection object
 */
BzDeck.collections.Users.prototype.add_from_bug = function (bug) {
  let users = new Map();

  for (let [name, person] of bug.participants) {
    users.set(name, this.get(name) || this.add({ 'bugzilla': person }));
  }

  return users;
};
