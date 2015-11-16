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
 * @argument {Object} [options] - Request method (default: GET), post data, API key, whether authenticating, download
 *  and upload event listeners.
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

/**
 * Parse a bug comment and format as HTML. URLs are automatically converted to links. Bug IDs and attachment IDs are
 * converted to internal links. Quotes are nested in <blockquote> elements. TODO: Add more autolinkification support
 * (#68) and improve the performance probably using a worker.
 *
 * @argument {String} str - Bug comment in plain text, as provided by Bugzilla.
 * @return {String} str - HTML-formatted comment.
 */
BzDeck.controllers.Base.prototype.parse_comment = function (str) {
  let blockquote = p => {
    let regex = /^&gt;\s?/gm;

    if (!p.match(regex)) {
      return p;
    }

    let lines = p.split(/\n/),
        quote = [];

    for (let [i, line] of lines.entries()) {
      if (line.match(regex)) {
        // A quote start
        quote.push(line);
      }

      if ((!line.match(regex) || !lines[i + 1]) && quote.length) {
        // A quote end, the next line is not a part of the quote, or no more lines
        let quote_str = quote.join('\n'),
            quote_repl = quote_str.replace(regex, '');

        if (quote_repl.match(regex)) {
          // Nested quote(s) found, do recursive processing
          quote_repl = blockquote(quote_repl);
        }

        for (let p of quote_repl.split(/\n{2,}/)) {
          quote_repl = quote_repl.replace(p, `<p>${p}</p>`);
        }

        p = p.replace(quote_str, `<blockquote>${quote_repl}</blockquote>`);
        quote = [];
      }
    }

    return p;
  };

  str = this.helpers.string.sanitize(str);

  // Quotes
  for (let p of str.split(/\n{2,}/)) {
    str = str.replace(p, `<p>${blockquote(p)}</p>`);
  }

  str = str.replace(/\n{2,}/gm, '').replace(/\n/gm, '<br>');

  // General links
  str = str.replace(
    /((https?|feed|ftps?|ircs?|mailto|news):(?:\/\/)?[\w-]+(\.[\w-]+)+((&amp;|[\w.,@?^=%$:\/~+#-])*(&amp;|[\w@?^=%$\/~+#-]))?)/gm,
    '<a href="$1">$1</a>'
  );

  // Email links
  // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address
  str = str.replace(
    /^([a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
    '<a href="mailto:$1">$1</a>'
  );

  // Bugs
  str = str.replace(
    /Bug\s*#?(\d+)/igm,
    '<a href="/bug/$1" data-bug-id="$1">Bug $1</a>' // l10n
  );

  // Attachments
  str = str.replace(
    /Attachment\s*#?(\d+)/igm,
    '<a href="/attachment/$1" data-att-id="$1">Attachment $1</a>' // l10n
  );

  return str;
};
