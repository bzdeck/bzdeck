/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Host Model that represents a remote Bugzilla instance. Available through the HostCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 */
BzDeck.HostModel = class HostModel extends BzDeck.BaseModel {
  /**
   * Get an BugModel instance.
   * @constructor
   * @param {Object} data - Host data.
   * @returns {Proxy} bug - New HostModel instance.
   */
  constructor (data) {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'bugzilla';
    this.data = data;
    this.name = data.host;

    const config = BzDeck.config.hosts[this.name];

    // Extract the local config for easier access
    for (const [key, value] of Object.entries(config)) {
      this[key] = value;
    }
  }

  /**
   * Send an API request to the remote Bugzilla instance. Use a Worker on a different thread.
   * @param {String} path - Location including an API method.
   * @param {URLSearchParams} [params] - Search query.
   * @param {String} [method='GET'] - Request method.
   * @param {Object} [data] - Post data.
   * @param {String} [api_key] - API key used to authenticate against the Bugzilla API.
   * @param {Object.<String, Function>} [listeners] - Event listeners. The key is an event type like 'load', the
   *  value is the handler. If the type is 'progress' and the post data is set, it will called during the upload.
   * @returns {Promise.<Object>} response - Promise to be resolved in the raw bug object retrieved from Bugzilla.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/}
   */
  async request (path, params, { method, data, api_key, listeners = {} } = {}) {
    if (!navigator.onLine) {
      throw new Error('You have to go online to load data.'); // l10n
    }

    const worker = new SharedWorker('/static/scripts/workers/tasks.js');
    const url = new URL(this.origin + '/rest/' + path);
    const headers = new Map();

    method = method || (data ? 'POST' : 'GET');
    data = data ? Object.assign({}, data) : undefined; // Avoid DataCloneError by postMessage

    if (params) {
      url.search = params.toString();
    }

    headers.set('Content-Type', 'application/json');
    headers.set('Accept', 'application/json');
    headers.set('X-Bugzilla-API-Key', api_key || BzDeck.account.data.api_key);

    if (this.user_agent_accepted) {
      headers.set('User-Agent', 'BzDeck/0.1 (https://www.bzdeck.com/)');
    }

    return new Promise((resolve, reject) => {
      worker.port.addEventListener('message', event => {
        const type = event.data.type;

        if (type === 'abort') {
          reject(new Error('Connection aborted.'));
        }

        if (type === 'error') {
          reject(new Error('Connection error.'));
        }

        if (type === 'load') {
          try {
            resolve(JSON.parse(event.data.response));
          } catch (ex) {
            reject(new Error('Data not found or not valid in the response.'));
          }
        }

        if (type in listeners) {
          listeners[type](event.data);
        }
      });

      worker.port.start();
      worker.port.postMessage(['xhr', { url: url.toString(), method, headers, data }]);
    });
  }

  /**
   * Get the Bugzilla configuration from cache. If it's not cached yet or older than 24 hours, retrieve the current
   * config from the remote Bugzilla instance. The config is not yet available from the REST endpoint so use the BzAPI
   * compat layer instead.
   * @param {undefined}
   * @returns {Promise.<Object>} config - Promise to be resolved in the Bugzilla configuration data.
   * @see {@link https://wiki.mozilla.org/Bugzilla:BzAPI:Methods#Other}
   * @see {@link https://bugzilla.mozilla.org/show_bug.cgi?id=504937}
   */
  async get_config () {
    if (!navigator.onLine) {
      // Offline; give up
      throw new Error('You have to go online to load data.'); // l10n
    }

    if (this.data.config && new Date(this.data.config_retrieved || 0) > Date.now() - 1000 * 60 * 60 * 24) {
      // The config data is still fresh, retrieved within 24 hours
      return this.data.config;
    }

    let config;

    // Fetch the config via BzAPI
    try {
      config = await FlareTail.helpers.network.json(this.origin + '/bzapi/configuration?cached_ok=1');
    } catch (error) {
      throw new Error('Bugzilla configuration could not be loaded. The instance might be offline.');
    }

    if (!config || !config.version) {
      throw new Error('Bugzilla configuration could not be loaded. The retrieved data is collapsed.');
    }

    const config_retrieved = this.data.config_retrieved = Date.now();

    this.data.config = config;
    this.datasource.get_store(this.store_name).save({ host: this.name, config, config_retrieved });

    return config;
  }

  /**
   * Verify the combination of the provided user name and API key.
   * @param {String} name - User name. Usually email address.
   * @param {String} api_key - API key to authenticate.
   * @returns {Promise.<Object>} user - Promise to be resolved in the verified user's info.
   * @see {@link https://bugzilla.readthedocs.io/en/latest/api/core/v1/user.html#get-user}
   */
  async verify_account (name, api_key) {
    const params = new URLSearchParams();
    let result;

    params.append('names', name);

    try {
      result = await this.request('user', params, { api_key });
    } catch (error) {
      throw new Error('Failed to find your account.'); // l10n
    }

    if (!result.users || !result.users[0]) {
      throw new Error(result.message || 'User Not Found'); // l10n
    }

    if (result.users[0].error) {
      throw new Error(result.users[0].error);
    }

    return result.users[0];
  }
}
