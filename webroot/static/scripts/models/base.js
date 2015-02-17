/**
 * BzDeck Main Models
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.models = BzDeck.models || {};
BzDeck.models.data = {};
BzDeck.models.databases = {};

/* ------------------------------------------------------------------------------------------------------------------
 * Base Model
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.BaseModel = function BaseModel () {};
BzDeck.models.BaseModel.prototype = Object.create(FlareTail.app.Model.prototype);
BzDeck.models.BaseModel.prototype.constructor = BzDeck.models.BaseModel;

/* ------------------------------------------------------------------------------------------------------------------
 * Core
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.get_store = function (name) {
  let type = name.match(/^accounts|bugzilla$/) ? 'global' : 'account',
      store = this.databases[type].transaction(name, 'readwrite').objectStore(name),
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

BzDeck.models.open_global_db = function () {
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

  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Failed to open the database.'))); // l10n
  });
};

BzDeck.models.open_account_db = function () {
  let req = indexedDB.open(`${this.data.server.name}::${this.data.account.name}`);

  req.addEventListener('upgradeneeded', event => {
    let db = this.databases.account = event.target.result,
        store;

    store = db.createObjectStore('bugs', { 'keyPath': 'id' });
    store.createIndex('alias', 'alias', { 'unique': true });

    store = db.createObjectStore('users', { 'keyPath': 'name' });
    store.createIndex('id', 'id', { 'unique': true });

    store = db.createObjectStore('prefs', { 'keyPath': 'name' });
  });

  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Failed to open the database.'))); // l10n
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * Accounts
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.accounts = {};

BzDeck.models.accounts.get_all = function () {
  return new Promise((resolve, reject) => {
    BzDeck.models.get_store('accounts').get_all()
        .then(accounts => resolve(accounts))
        .catch(error => reject(new Error('Failed to load accounts.'))); // l10n
  });  
};

BzDeck.models.accounts.get_active_account = function () {
  return new Promise((resolve, reject) => {
    this.get_all().then(accounts => {
      let account = [for (account of accounts) if (account.active) account][0];

      account ? resolve(account) : reject(new Error('Account Not Found'));
    });
  });
};

BzDeck.models.accounts.save_account = function (account) {
  return new Promise((resolve, reject) => {
    BzDeck.models.get_store('accounts').save(account)
        .then(result => resolve(result))
        .catch(error => reject(new Error('Failed to save the account.'))); // l10n
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * Servers
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.servers = {};

BzDeck.models.servers.get_server = function (name) {
  let server = [for (server of BzDeck.config.servers) if (server.name === name) server][0];

  return new Promise((resolve, reject) => {
    server ? resolve(server) : reject(new Error('Server Not Found'));
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * Prefs
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.prefs = {};

BzDeck.models.prefs.load = function () {
  let prefs = {};

  return new Promise(resolve => {
    BzDeck.models.get_store('prefs').get_all().then(result => {
      for (let pref of result) {
        prefs[pref.name] = pref.value;
      }

      BzDeck.models.data.prefs = new Proxy(prefs, {
        'set': (obj, key, value) => {
          obj[key] = value;
          BzDeck.models.get_store('prefs').save({ 'name': key, value });
        }
      });

      resolve();
    });
  });
};

/* ------------------------------------------------------------------------------------------------------------------
 * config
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.config = {};

BzDeck.models.config.load = function () {
  return new Promise((resolve, reject) => {
    BzDeck.models.get_store('bugzilla').get(BzDeck.models.data.server.name).then(server => {
      server ? resolve(server.config) : reject(new Error('Config cache could not be found.'));
    });
  });
};
