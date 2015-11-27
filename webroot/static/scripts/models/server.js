/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Server Model that represents a remote Bugzilla instance. Available through the ServerCollection.
 *
 * @constructor
 * @extends BaseModel
 * @argument {Object} data - Server data.
 * @return {Proxy} bug - New ServerModel instance.
 */
BzDeck.models.Server = function ServerModel (data) {
  this.datasource = BzDeck.datasources.global;
  this.store_name = 'bugzilla';
  this.data = data;
  this.name = data.host;

  let config = BzDeck.config.servers[this.name];

  // Extract the local config for easier access
  for (let [key, value] of Object.entries(config)) {
    this[key] = value;
  }
};

BzDeck.models.Server.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Server.prototype.constructor = BzDeck.models.Server;

/**
 * Get the Bugzilla configuration from cache. If it's not cached yet or older than 24 hours, retrieve the current config
 * from the remote Bugzilla instance. The config is not yet available from the REST endpoint so use the BzAPI compat
 * layer instead.
 *
 * @argument {undefined}
 * @return {Promise.<Object>} config - Promise to be resolved in the Bugzilla configuration data.
 * @see {@link https://wiki.mozilla.org/Bugzilla:BzAPI:Methods#Other}
 * @see {@link https://bugzilla.mozilla.org/show_bug.cgi?id=504937}
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

  // Fetch the config via BzAPI
  return this.helpers.network.json(`${this.url}${this.endpoints.bzapi}configuration?cached_ok=1`).then(config => {
    if (config && config.version) {
      let config_retrieved = this.data.config_retrieved = Date.now();

      this.data.config = config;
      this.datasource.get_store(this.store_name).save({ host: this.name, config, config_retrieved });

      return Promise.resolve(config);
    }

    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.'));
  }).catch(error => {
    return Promise.reject(new Error('Bugzilla configuration could not be loaded. The instance might be offline.'));
  });
};
