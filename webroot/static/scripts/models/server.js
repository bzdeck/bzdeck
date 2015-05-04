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
};

BzDeck.models.Server.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Server.prototype.constructor = BzDeck.models.Server;

/*
 * Load the Bugzilla configuration from the database.
 *
 * [argument] none
 * [return] config (Promise -> Object or Error) Bugzilla configuration data
 */
BzDeck.models.Server.prototype.load_config = function () {
  return this.datasource.get_store(this.store_name).get(this.data.name).then(server => {
    if (server) {
      this.data.config = server.config;

      return Promise.resolve(server.config);
    }

    return Promise.reject(new Error('Config cache could not be found.'));
  });
};

/*
 * Retrieve the Bugzilla configuration from the remote Bugzilla instance.
 *
 * [argument] none
 * [return] config (Promise -> Object or Error) Bugzilla configuration data
 */
BzDeck.models.Server.prototype.fetch_config = function () {
  if (!navigator.onLine) {
    // Offline; give up
    return Promise.reject(new Error('You have to go online to load data.')); // l10n
  }

  // The config is not available from the REST endpoint so use the BzAPI compat layer instead
  let endpoint = `${this.data.url}${this.data.endpoints.bzapi}configuration?cached_ok=1`;

  return FlareTail.util.network.json(endpoint).then(data => {
    if (data && data.version) {
      return Promise.resolve(data);
    }

    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.'));
  }).catch(error => {
    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.'));
  });
};

/*
 * Save the Bugzilla configuration to the database.
 *
 * [argument] config (Object) Bugzilla configuration data
 * [return] none
 */
BzDeck.models.Server.prototype.save_config = function (config) {
  this.data.config = config;
  this.datasource.get_store(this.store_name).save({ 'host': this.data.name, config });
};
