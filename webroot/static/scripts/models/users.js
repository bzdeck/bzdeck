/**
 * BzDeck Users Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Users = function UsersModel () {
  Object.defineProperties(this, {
    'store': { 'enumerable': true, 'get': () => this.get_store('account', 'users') },
  });
};

BzDeck.models.Users.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Users.prototype.constructor = BzDeck.models.Users;

BzDeck.models.Users.prototype.init = function () {
  // Load all users from database and provide the data as a Map for easier access
  return this.store.get_all().then(users => {
    this.data = new Map([for (user of users || []) [user.name, user]]);
  });
};

BzDeck.models.Users.prototype.has = function (email) {
  return this.data.has(email);
};

BzDeck.models.Users.prototype.get = function (email) {
  return this.data.get(email);
};

BzDeck.models.Users.prototype.save = function (user) {
  this.store.save(user);
};
