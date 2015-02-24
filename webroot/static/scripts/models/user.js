/**
 * BzDeck User Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.User = function UserModel () {};

BzDeck.models.User.prototype = Object.create(BzDeck.models.BaseModel.prototype);
BzDeck.models.User.prototype.constructor = BzDeck.models.User;

BzDeck.models.User.prototype.init = function () {
  // Load all users from database and provide the data as a Map for easier access
  return this.get_store('users').get_all().then(users => {
    this.data = new Map([for (user of users || []) [user.name, user]]);
  });
};

BzDeck.models.User.prototype.has = function (email) {
  return this.data.has(email);
};

BzDeck.models.User.prototype.get = function (email) {
  return this.data.get(email);
};

BzDeck.models.User.prototype.save = function (user) {
  this.get_store('users').save(user);
};
