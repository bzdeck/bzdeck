/**
 * BzDeck Server Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Server = function ServerModel () {};

BzDeck.models.Server.prototype = Object.create(BzDeck.models.BaseModel.prototype);
BzDeck.models.Server.prototype.constructor = BzDeck.models.Server;

BzDeck.models.Server.prototype.get = function (name) {
  let server = [for (server of BzDeck.config.servers) if (server.name === name) server][0];

  return new Promise((resolve, reject) => {
    if (server) {
      this.data = server;
      resolve(server);
    } else {
      reject(new Error('Server Not Found'));
    }
  });
};

BzDeck.models.Server.prototype.get_config = function () {
  return new Promise((resolve, reject) => {
    this.get_store('bugzilla').get(this.data.name).then(server => {
      if (server) {
        this.data.config = server.config;
        resolve(server.config);
      } else {
        reject(new Error('Config cache could not be found.'));
      }
    });
  });
};

BzDeck.models.Server.prototype.save_config = function (config) {
  this.data.config = config;
  this.get_store('bugzilla').save({ 'host': this.data.name, config });
};
