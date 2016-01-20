/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Server Collection that represents remote Bugzilla instances. Each server is a ServerModel.
 * @extends BzDeck.BaseCollection
 */
BzDeck.ServerCollection = class ServerCollection extends BzDeck.BaseCollection {
  /**
   * Get a ServerCollection instance.
   * @argument {undefined}
   * @return {Object} servers - New ServerCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'bugzilla';
    this.model = BzDeck.models.Server;
  }
}
