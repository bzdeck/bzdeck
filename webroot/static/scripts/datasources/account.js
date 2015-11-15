/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Account DataSource that contains the bugs, users, and prefs of each user account.
 *
 * @constructor
 * @extends BaseDataSource
 * @argument {undefined}
 * @return {Object} datasource - New AccountDataSource instance.
 */
BzDeck.datasources.Account = function AccountDataSource () {};

BzDeck.datasources.Account.prototype = Object.create(BzDeck.datasources.Base.prototype);
BzDeck.datasources.Account.prototype.constructor = BzDeck.datasources.Account;

/**
 * Preload the account-specific database.
 *
 * @argument {undefined}
 * @return {Promise.<IDBDatabase>} database - Target IndexedDB database.
 */
BzDeck.datasources.Account.prototype.load = function () {
  return this.open_database(`${BzDeck.models.server.name}::${BzDeck.models.account.data.name}`, 2);
};

/**
 * Called whenever the database is created or upgraded. Create object stores and handle upgrades.
 *
 * @argument {IDBVersionChangeEvent} event - The upgradeneeded event.
 * @return {IDBDatabase} database - Target IndexedDB database.
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/onupgradeneeded}
 */
BzDeck.datasources.Account.prototype.onupgradeneeded = function (event) {
  let database = event.target.result;

  // Create the initial stores
  if (event.oldVersion < 1) {
    database.createObjectStore('bugs', { keyPath: 'id' })
            .createIndex('alias', 'alias', { unique: true });

    database.createObjectStore('users', { keyPath: 'name' })
            .createIndex('id', 'id', { unique: true });

    database.createObjectStore('prefs', { keyPath: 'name' });
  }

  if (event.oldVersion < 2) {
    // On Bugzilla 5.0 and later, the alias field is array and it's no longer unique
    event.target.transaction.objectStore('bugs').deleteIndex('alias');
  }

  return database;
};
