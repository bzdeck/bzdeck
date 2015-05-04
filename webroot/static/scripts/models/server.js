/**
 * BzDeck Server Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Server Model.
 *
 * [argument] data (Object) server data
 * [return] bug (Proxy) instance of the ServerModel object, when called with `new`
 */
BzDeck.models.Server = function ServerModel (data) {
  this.datasource = BzDeck.datasources.global;
  this.store_name = 'bugzilla';
  this.data = data;

  // Extract the local config for easier access
  for (let [key, value] of Iterator(BzDeck.config.servers[this.data.host])) {
    this[key] = value;
  }
};

BzDeck.models.Server.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Server.prototype.constructor = BzDeck.models.Server;

/*
 * Retrieve the Bugzilla configuration from cache or the remote Bugzilla instance.
 *
 * [argument] none
 * [return] config (Promise -> Object or Error) Bugzilla configuration data
 */
BzDeck.models.Server.prototype.get_config = function () {
  if (!navigator.onLine) {
    // Offline; give up
    return Promise.reject(new Error('You have to go online to load data.')); // l10n
  }

  if (this.data.config && new Date(this.data.config_retrieved || 0) > Date.now() - 1000 * 60 * 60 * 24) {
    // The config data is still fresh, retrieved within 24 hours
    return Promise.resolve(this.data.config);
  }

  // The config is not available from the REST endpoint so use the BzAPI compat layer instead
  return FlareTail.util.network.json(`${this.url}${this.endpoints.bzapi}configuration?cached_ok=1`).then(config => {
    if (config && config.version) {
      let config_retrieved = this.data.config_retrieved = Date.now();

      this.data.config = config;
      this.datasource.get_store(this.store_name).save({ 'host': this.data.host, config, config_retrieved });

      return Promise.resolve(config);
    }

    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.'));
  }).catch(error => {
    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.'));
  });
};
