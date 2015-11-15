/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Server Collection that represents remote Bugzilla instances. Each server is a ServerModel.
 *
 * @constructor
 * @extends BaseCollection
 * @argument {undefined}
 * @return {Object} servers - New ServerCollection instance.
 */
BzDeck.collections.Servers = function ServerCollection () {
  this.datasource = BzDeck.datasources.global;
  this.store_name = 'bugzilla';
  this.model = BzDeck.models.Server;
};

BzDeck.collections.Servers.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Servers.prototype.constructor = BzDeck.collections.Servers;
