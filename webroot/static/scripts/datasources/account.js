/**
 * BzDeck Account DataSource
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.datasources.Account = function AccountDataSource () {};

BzDeck.datasources.Account.prototype = Object.create(BzDeck.datasources.Base.prototype);
BzDeck.datasources.Account.prototype.constructor = BzDeck.datasources.Account;

/*
 * Preload the account-specific database.
 *
 * [argument] none
 * [return] database (Promise -> IDBDatabase or Error) the target IndexedDB database
 */
BzDeck.datasources.Account.prototype.load = function () {
  return this.open_database(`${BzDeck.models.server.name}::${BzDeck.models.account.data.name}`, 1);
};

/*
 * Create object stores when the database is created or upgraded.
 *
 * [argument] event (IDBVersionChangeEvent) the upgradeneeded event
 * [return] database (IDBDatabase) the target IndexedDB database
 */
BzDeck.datasources.Account.prototype.onupgradeneeded = function (event) {
  let database = event.target.result;

  // Create the initial stores
  if (event.oldVersion < 1) {
    database.createObjectStore('bugs', { 'keyPath': 'id' })
            .createIndex('alias', 'alias', { 'unique': true });

    database.createObjectStore('users', { 'keyPath': 'name' })
            .createIndex('id', 'id', { 'unique': true });

    database.createObjectStore('prefs', { 'keyPath': 'name' });
  }

  return database;
};
