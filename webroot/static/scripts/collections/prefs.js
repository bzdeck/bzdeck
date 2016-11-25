/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Pref Collection that represents the user's application settings.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 */
BzDeck.PrefCollection = class PrefCollection extends BzDeck.BaseCollection {
  /**
   * Get a PrefCollection instance.
   * @returns {PrefCollection} New PrefCollection instance.
   */
  constructor () {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'prefs';
    this.store_type = 'simple';
  }

  /**
   * Save a preference key/value pair in the database, then fire an event.
   * @override
   * @param {(Number|String)} name - Key of the item.
   * @param {*} value - Raw data object or any value.
   * @fires PrefCollection#PrefChanged
   */
  set (name, value) {
    super.set(name, value);
    this.trigger('#PrefChanged', { name, value });
  }
}
