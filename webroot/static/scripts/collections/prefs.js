/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Pref Collection that represents the user's application settings.
 * @extends BzDeck.BaseCollection
 */
BzDeck.PrefCollection = class PrefCollection extends BzDeck.BaseCollection {
  /**
   * Get a PrefCollection instance.
   * @param {undefined}
   * @returns {Object} prefs - New PrefCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'prefs';
    this.store_type = 'simple';
  }
}
