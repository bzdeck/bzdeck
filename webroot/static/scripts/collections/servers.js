/**
 * BzDeck Servers Collection
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Servers Collection.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the ServersCollection object, when called with `new`
 */
BzDeck.collections.Servers = function ServersCollection () {
  this.model = BzDeck.models.Server;
};

BzDeck.collections.Servers.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Servers.prototype.constructor = BzDeck.collections.Servers;

/*
 * Load the all server data from local IndexedDB, create a new ServerModel instance for each item, then cache them in a
 * new Map for faster access.
 *
 * [argument] none
 * [return] items (Promise -> Map(String or Number, Proxy)) new instances of the ServerModel object
 */
BzDeck.collections.Servers.prototype.load = function () {
  this.map = new Map([for (server of BzDeck.config.servers) [server.name, new this.model(server)]]);

  return Promise.resolve(this.map);
};
