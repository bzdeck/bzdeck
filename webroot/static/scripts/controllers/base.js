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
 * Send an API request to the remote Bugzilla instance.
 *
 * @argument {String} path - Location including an API method.
 * @argument {URLSearchParams} params - Search query.
 * @argument {Object} [options] - Extra options.
 * @argument {String} [options.method='GET'] - Request method.
 * @argument {Object} [options.data] - Post data.
 * @argument {String} [options.api_key] - API key used to authenticate against the Bugzilla API.
 * @argument {Boolean} [options.auth] - Whether the request requires an authentication.
 * @argument {Object} [options.listeners] - Download event listeners. The object key is an event type like 'progress',
 *  the value is an event handler function.
 * @argument {Object} [options.upload_listeners] - Upload event listeners.
 * @return {Promise.<Object>} response - Promise to be resolved in the raw bug object retrieved from Bugzilla.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/}
 */
BzDeck.controllers.Base.prototype.request = function (path, params, options = {}) {
  // We can't use the Fetch API here since it lacks progress events for now
  let server = BzDeck.models.server,
      xhr = new XMLHttpRequest(),
      url = new URL(server.url + server.endpoints.rest),
      listeners = options.listeners || {},
      upload_listeners = options.upload_listeners || {};

  params = params || new URLSearchParams();

  url.pathname += path;
  url.search = '?' + params.toString();
  xhr.open(options.method || (options.data ? 'POST' : 'GET'), url.toString(), true);
  xhr.setRequestHeader('Accept', 'application/json');

  if (!navigator.onLine) {
    return Promise.reject(new Error('You have to go online to load data.')); // l10n
  }

  if (options.api_key || options.auth) {
    let key = options.api_key || BzDeck.models.account.data.api_key;

    if (!key) {
      return Promise.reject(new Error('Your API key is required to authenticate against Bugzilla but not found.'));
    }

    xhr.setRequestHeader('X-Bugzilla-API-Key', key);
  }

  for (let type in listeners) {
    xhr.addEventListener(type, event => listeners[type](event));
  }

  for (let type in upload_listeners) {
    xhr.upload.addEventListener(type, event => upload_listeners[type](event));
  }

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', event => {
      let text = event.target.responseText;

      text ? resolve(JSON.parse(text)) : reject(new Error('Data not found or not valid in the response.'));
    });

    xhr.addEventListener('error', event => reject(new Error('Connection error.')));
    xhr.addEventListener('abort', event => reject(new Error('Connection aborted.')));
    xhr.send(options.data ? JSON.stringify(options.data) : null);
  });
};
