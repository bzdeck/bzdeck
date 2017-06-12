/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Account DataSource that contains the bugs, users, and prefs of each user account.
 * @extends BzDeck.BaseDataSource
 * @todo Move this to the worker thread.
 */
BzDeck.AccountDataSource = class AccountDataSource extends BzDeck.BaseDataSource {
  /**
   * Get an AccountDataSource instance. This is necessary to call the constructor of the base Event class.
   * @returns {AccountDataSource} New AccountDataSource instance.
   */
  constructor () {
    super(); // Assign this.id
  }

  /**
   * Preload the account-specific database.
   * @returns {Promise.<IDBDatabase>} Target IndexedDB database.
   */
  async load () {
    return this.open_database(`${BzDeck.host.name}::${BzDeck.account.data.name}`, 3);
  }

  /**
   * Called whenever the database is created or upgraded. Create object stores and handle upgrades.
   * @param {IDBVersionChangeEvent} event - The upgradeneeded event.
   * @returns {IDBDatabase} Target IndexedDB database.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/IDBOpenDBRequest/onupgradeneeded MDN}
   */
  onupgradeneeded (event) {
    const database = event.target.result;
    const transaction = event.target.transaction;

    // Create the initial stores
    if (event.oldVersion < 1) {
      database.createObjectStore('bugs', { keyPath: 'id' });
      database.createObjectStore('users', { keyPath: 'name' });
      database.createObjectStore('prefs', { keyPath: 'name' });
    }

    if (event.oldVersion < 2) {
      const store = transaction.objectStore('bugs');

      // On Bugzilla 5.0 and later, the alias field is array and it's no longer unique
      if (store.indexNames.contains('alias')) {
        store.deleteIndex('alias');
      }
    }

    if (event.oldVersion < 3) {
      const store = transaction.objectStore('users');

      // User's ID can be undefined when they are not found in Bugzilla, so delete the index
      if (store.indexNames.contains('id')) {
        store.deleteIndex('id');
      }
    }

    return database;
  }
}
