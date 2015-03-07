/**
 * BzDeck Global Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Global = function GlobalModel () {};

BzDeck.models.Global.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Global.prototype.constructor = BzDeck.models.Global;

BzDeck.models.Global.prototype.get_database = function () {
  let req = indexedDB.open('global');

  // The database is created or upgraded
  req.addEventListener('upgradeneeded', event => {
    let db = event.target.result,
        store;

    // Create stores when the database is created
    if (event.oldVersion < 1) {
      store = db.createObjectStore('bugzilla', { 'keyPath': 'host' });

      store = db.createObjectStore('accounts', { 'keyPath': 'loaded' });
      store.createIndex('host', 'host', { 'unique': false });
      store.createIndex('id', 'id', { 'unique': false });
      store.createIndex('name', 'name', { 'unique': false });

      // Delete the old database if exists
      indexedDB.deleteDatabase('BzDeck');
    }
  });

  req.addEventListener('success', event => {
    this.database = event.target.result;
  });

  return this.open_database(req); // Promise
};

BzDeck.models.Global.prototype.get_server = function (name) {
  let server = [for (server of BzDeck.config.servers) if (server.name === name) server][0];

  return new Promise((resolve, reject) => {
    if (server) {
      resolve(new BzDeck.models.Server(server));
    } else {
      reject(new Error('Server Not Found'));
    }
  });
};

BzDeck.models.Global.prototype.get_all_accounts = function () {
  return new Promise((resolve, reject) => {
    this.get_store('global', 'accounts').get_all()
        .then(accounts => resolve(accounts))
        .catch(error => reject(new Error('Failed to load accounts.'))); // l10n
  });  
};

BzDeck.models.Global.prototype.get_active_account = function () {
  return new Promise((resolve, reject) => {
    this.get_all_accounts().then(accounts => {
      let account = [for (account of accounts) if (account.active) account][0];

      if (account) {
        resolve(new BzDeck.models.Account(account));
      } else {
        reject(new Error('Account Not Found'));
      }
    });
  });
};
