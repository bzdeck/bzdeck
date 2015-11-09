/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.datasources.Global = function GlobalDataSource () {};

BzDeck.datasources.Global.prototype = Object.create(BzDeck.datasources.Base.prototype);
BzDeck.datasources.Global.prototype.constructor = BzDeck.datasources.Global;

/**
 * Preload the app-wide database.
 *
 * [argument] none
 * [return] database (Promise -> IDBDatabase or Error) the target IndexedDB database
 */
BzDeck.datasources.Global.prototype.load = function () {
  return this.open_database('global', 1);
};

/**
 * Create object stores when the database is created or upgraded.
 *
 * [argument] event (IDBVersionChangeEvent) the upgradeneeded event
 * [return] database (IDBDatabase) the target IndexedDB database
 */
BzDeck.datasources.Global.prototype.onupgradeneeded = function (event) {
  let database = event.target.result;

  // Create the initial stores
  if (event.oldVersion < 1) {
    // Delete the old database if exists
    indexedDB.deleteDatabase('BzDeck');

    database.createObjectStore('bugzilla', { keyPath: 'host' });

    {
      let store = database.createObjectStore('accounts', { keyPath: 'loaded' });

      store.createIndex('host', 'host', { unique: false });
      store.createIndex('id', 'id', { unique: false });
      store.createIndex('name', 'name', { unique: false });
    }
  }

  return database;
};
