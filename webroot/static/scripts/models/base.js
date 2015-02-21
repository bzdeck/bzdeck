/**
 * BzDeck Base Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models = BzDeck.models || {};
BzDeck.models.databases = {};

BzDeck.models.BaseModel = function BaseModel () {};
BzDeck.models.BaseModel.prototype = Object.create(FlareTail.app.Model.prototype);
BzDeck.models.BaseModel.prototype.constructor = BzDeck.models.BaseModel;

BzDeck.models.BaseModel.prototype.get_store = function (name) {
  let type = name.match(/^accounts|bugzilla$/) ? 'global' : 'account',
      store = BzDeck.models.databases[type].transaction(name, 'readwrite').objectStore(name),
      send = request => new Promise((resolve, reject) => {
        request.addEventListener('success', event => resolve(event.target.result));
        request.addEventListener('error', event => reject(new Error(event)));
      });

  return {
    'save': obj => send(store.put(obj)),
    'get': key => send(store.get(key)),
    'get_all': () => send(store.mozGetAll()),
    'delete': key => send(store.delete(key))
  };
};

BzDeck.models.BaseModel.prototype.open_global_db = function () {
  let req = indexedDB.open('global');

  // The database is created or upgraded
  req.addEventListener('upgradeneeded', event => {
    let db = event.target.result,
        store;

    store = db.createObjectStore('bugzilla', { 'keyPath': 'host' });

    store = db.createObjectStore('accounts', { 'keyPath': 'loaded' });
    store.createIndex('host', 'host', { 'unique': false });
    store.createIndex('id', 'id', { 'unique': false });
    store.createIndex('name', 'name', { 'unique': false });
  });

  req.addEventListener('success', event => {
    BzDeck.models.databases.global = event.target.result;
  });

  return this.open_database(req);
};

BzDeck.models.BaseModel.prototype.open_account_db = function () {
  let req = indexedDB.open(`${BzDeck.models.server.data.name}::${BzDeck.models.account.data.name}`);

  req.addEventListener('upgradeneeded', event => {
    let db = event.target.result,
        store;

    store = db.createObjectStore('bugs', { 'keyPath': 'id' });
    store.createIndex('alias', 'alias', { 'unique': true });

    store = db.createObjectStore('users', { 'keyPath': 'name' });
    store.createIndex('id', 'id', { 'unique': true });

    store = db.createObjectStore('prefs', { 'keyPath': 'name' });
  });

  req.addEventListener('success', event => {
    BzDeck.models.databases.account = event.target.result;
  });

  return this.open_database(req);
};

BzDeck.models.BaseModel.prototype.open_database = function (req) {
  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Failed to open the database. Make sure you’re not using \
                                                             private browsing mode or IndexedDB doesn’t work.')));
  });
};
