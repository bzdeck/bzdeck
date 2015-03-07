/**
 * BzDeck Account Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Account = function AccountModel (account) {
  this.data = account;

  Object.defineProperties(this, {
    'store': { 'enumerable': true, 'get': () => this.get_store('global', 'accounts') },
  });
};

BzDeck.models.Account.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Account.prototype.constructor = BzDeck.models.Account;

BzDeck.models.Account.prototype.get_database = function () {
  let req = indexedDB.open(`${BzDeck.models.server.data.name}::${this.data.name}`);

  req.addEventListener('upgradeneeded', event => {
    let db = event.target.result,
        store;

    // Create stores when the database is created
    if (event.oldVersion < 1) {
      store = db.createObjectStore('bugs', { 'keyPath': 'id' });
      store.createIndex('alias', 'alias', { 'unique': true });

      store = db.createObjectStore('users', { 'keyPath': 'name' });
      store.createIndex('id', 'id', { 'unique': true });

      store = db.createObjectStore('prefs', { 'keyPath': 'name' });
    }
  });

  req.addEventListener('success', event => {
    this.database = event.target.result;
  });

  return this.open_database(req); // Promise
};

BzDeck.models.Account.prototype.save = function () {
  return new Promise((resolve, reject) => {
    this.store.save(this.data)
        .then(result => resolve(result))
        .catch(error => reject(new Error('Failed to save the account.'))); // l10n
  });
};

BzDeck.models.Account.prototype.clear = function () {
  delete this.data;

  return this.store.clear().then(() => Promise.resolve());
};
