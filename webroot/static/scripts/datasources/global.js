/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global DataSource that stores Bugzilla instances and user accounts.
 * @extends BzDeck.BaseDataSource
 */
BzDeck.GlobalDataSource = class GlobalDataSource extends BzDeck.BaseDataSource {
  /**
   * Preload the app-wide database.
   * @param {undefined}
   * @returns {Promise.<IDBDatabase>} database - Target IndexedDB database.
   */
  load () {
    return this.open_database('global', 1);
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
  }
}
