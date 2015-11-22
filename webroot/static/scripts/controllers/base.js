/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers = BzDeck.controllers || {};

/**
 * Define the app's Base Controller. This constructor is intended to be inherited by each app controller.
 *
 * @constructor
 * @extends Controller
 * @argument {undefined}
 * @return {Object} controller - New BaseController instance.
 */
BzDeck.controllers.Base = function BaseController () {};

BzDeck.controllers.Base.prototype = Object.create(FlareTail.app.Controller.prototype);
BzDeck.controllers.Base.prototype.constructor = BzDeck.controllers.Base;

/**
 * Send an API request to the remote Bugzilla instance. Use a Worker on a different thread.
 *
 * @argument {String} path - Location including an API method.
 * @argument {URLSearchParams} [params] - Search query.
 * @argument {Object} [options] - Extra options.
 * @argument {String} [options.method='GET'] - Request method.
 * @argument {Object} [options.data] - Post data.
 * @argument {String} [options.api_key] - API key used to authenticate against the Bugzilla API.
 * @argument {Object.<String, Function>} [options.listeners] - Event listeners. The key is an event type like 'load',
 *  the value is the handler. If the type is 'progress' and the post data is set, it will called during the upload.
 * @return {Promise.<Object>} response - Promise to be resolved in the raw bug object retrieved from Bugzilla.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/}
 */
BzDeck.controllers.Base.prototype.request = function (path, params, options = {}) {
  if (!navigator.onLine) {
    return Promise.reject(new Error('You have to go online to load data.')); // l10n
  }

  let worker = new SharedWorker('/static/scripts/workers/shared.js'),
      server = BzDeck.models.server,
      url = new URL(server.url + server.endpoints.rest + path),
      method = options.method || (options.data ? 'POST' : 'GET'),
      headers = new Map(),
      listeners = options.listeners || {};

  if (params) {
    url.search = params.toString();
  }

  headers.set('Accept', 'application/json');
  headers.set('X-Bugzilla-API-Key', options.api_key || BzDeck.models.account.data.api_key);

  return new Promise((resolve, reject) => {
    worker.port.addEventListener('message', event => {
      let type = event.data.type;

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
    worker.port.postMessage(['xhr', { url: url.toString(), method, headers, data: options.data }]);
  });
};
