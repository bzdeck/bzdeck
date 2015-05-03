/**
 * BzDeck Server Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Server = function ServerModel (server) {
  this.data = server;

  Object.defineProperties(this, {
    'store': { 'enumerable': true, 'get': () => this.get_store('global', 'bugzilla') },
  });
};

BzDeck.models.Server.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Server.prototype.constructor = BzDeck.models.Server;

BzDeck.models.Server.prototype.get_config = function () {
  return new Promise((resolve, reject) => {
    this.store.get(this.data.name).then(server => {
      if (server) {
        this.data.config = server.config;
        resolve(server.config);
      } else {
        reject(new Error('Config cache could not be found.'));
      }
    });
  });
};

BzDeck.models.Server.prototype.fetch_config = function () {
  // Load the Bugzilla config in background
  let server = BzDeck.models.server.data;

  return new Promise((resolve, reject) => {
    if (!navigator.onLine) {
      // Offline; give up
      return reject(new Error('You have to go online to load data.')); // l10n
    }

    // The config is not available from the REST endpoint so use the BzAPI compat layer instead
    FlareTail.util.network.json(server.url + server.endpoints.bzapi + 'configuration?cached_ok=1').then(data => {
      if (data && data.version) {
        resolve(data);
      } else {
        reject(new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.')); // l10n
      }
    }).catch(error => reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.')));
  });
};

BzDeck.models.Server.prototype.save_config = function (config) {
  this.data.config = config;
  this.store.save({ 'host': this.data.name, config });
};
