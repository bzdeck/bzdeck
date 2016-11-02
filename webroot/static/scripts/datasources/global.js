/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global DataSource that stores Bugzilla instances and user accounts.
 * @extends BzDeck.BaseDataSource
 * @todo Move this to the worker thread.
 */
BzDeck.GlobalDataSource = class GlobalDataSource extends BzDeck.BaseDataSource {
  /**
   * Get an GlobalDataSource instance. This is necessary to call the constructor of the base Event class.
   * @constructor
   * @param {undefined}
   * @returns {Object} accounts - New GlobalDataSource instance.
   */
  constructor () {
    super(); // Assign this.id
  }

  /**
   * Preload the app-wide database.
   * @param {undefined}
   * @returns {Promise.<IDBDatabase>} database - Target IndexedDB database.
   */
  async load () {
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
