/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Host Collection that represents remote Bugzilla instances. Each host is a HostModel.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 */
BzDeck.HostCollection = class HostCollection extends BzDeck.BaseCollection {
  /**
   * Get a HostCollection instance.
   * @returns {HostCollection} New HostCollection instance.
   */
  constructor () {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'bugzilla';
    this.model = BzDeck.HostModel;
  }
}
