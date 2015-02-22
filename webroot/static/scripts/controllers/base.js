/**
 * BzDeck Base Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers = BzDeck.controllers || {};

BzDeck.controllers.Base = function BaseController () {};

BzDeck.controllers.Base.prototype = Object.create(FlareTail.app.Controller.prototype);
BzDeck.controllers.Base.prototype.constructor = BzDeck.controllers.Base;

BzDeck.controllers.Base.prototype.request = function (method, path, params, data = null,
                                                                listeners = {}, options = {}) {
  let server = BzDeck.models.server.data,
      account = BzDeck.models.account.data,
      xhr = new XMLHttpRequest(),
      url = new URL(server.url + server.endpoints.rest);

  params = params || new URLSearchParams();

  if (options.auth) {
    params.append('api_key', account.api_key);
  }

  url.pathname += path;
  url.searchParams = params;
  xhr.open(method, url.toString(), true);
  xhr.setRequestHeader('Accept', 'application/json');

  for (let [type, listener] of Iterator(listeners)) if (type !== 'upload') {
    xhr.addEventListener(type, event => listener(event));
  }

  for (let [type, listener] of Iterator(listeners.upload || {})) {
    xhr.upload.addEventListener(type, event => listener(event));
  }

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', event => {
      let text = event.target.responseText;

      text ? resolve(JSON.parse(text)) : reject(new Error('Data not found or not valid in the response.'));
    });

    xhr.addEventListener('error', event => reject(new Error('Connection error.')));
    xhr.addEventListener('abort', event => reject(new Error('Connection aborted.')));

    if (navigator.onLine) {
      xhr.send(data);
    } else {
      reject(new Error('You have to go online to load data.')); // l10n
    }
  });
};

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

  str = FlareTail.util.string.sanitize(str);

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
    '<a href="/attachment/$1" data-attachment-id="$1">Attachment $1</a>' // l10n
  );

  return str;
};
