/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Host Collection that represents remote Bugzilla instances. Each host is a HostModel.
 * @extends BzDeck.BaseCollection
 */
BzDeck.HostCollection = class HostCollection extends BzDeck.BaseCollection {
  /**
   * Get a HostCollection instance.
   * @param {undefined}
   * @returns {Object} hosts - New HostCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'bugzilla';
    this.model = BzDeck.HostModel;
  }
}
