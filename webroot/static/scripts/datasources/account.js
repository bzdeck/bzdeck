/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Account DataSource that contains the bugs, users, and prefs of each user account.
 * @extends BzDeck.BaseDataSource
 */
BzDeck.AccountDataSource = class AccountDataSource extends BzDeck.BaseDataSource {
  /**
   * Preload the account-specific database.
   * @param {undefined}
   * @returns {Promise.<IDBDatabase>} database - Target IndexedDB database.
   */
  load () {
    return this.open_database(`${BzDeck.host.name}::${BzDeck.account.data.name}`, 2);
  }

  /**
   * Called whenever the database is created or upgraded. Create object stores and handle upgrades.
   * @param {IDBVersionChangeEvent} event - The upgradeneeded event.
   * @returns {IDBDatabase} database - Target IndexedDB database.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/onupgradeneeded}
   */
  onupgradeneeded (event) {
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
  }
}
