/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

const tasks = {};

/**
 * Send a XMLHttpRequest, and post the result events, not only load, but also abort, error and progress.
 * @argument {MessagePort} port - Allow sending messages.
 * @argument {Object}  args - Arguments.
 * @argument {String}  args.url - URL to load.
 * @argument {String} [args.method=GET] - Request method.
 * @argument {Map}    [args.headers] - HTTP headers to be set.
 * @argument {*}      [args.data] - Data to be POSTed.
 * @return {undefined}
 */
tasks.xhr = (port, args) => {
  let { url, method, headers, data } = args,
      xhr = new XMLHttpRequest();

  let post = event => {
    let type = event.type,
        message = { type };

    if (type === 'load') {
      message.response = event.target.response;
    }

    if (type === 'progress') {
      message.total = event.total;
      message.loaded = event.loaded;
      message.lengthComputable = event.lengthComputable;
    }

    port.postMessage(message);
  };

  xhr.open(method || 'GET', url, false); // async = false

  if (headers) {
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
  }

  xhr.addEventListener('abort', event => post(event));
  xhr.addEventListener('error', event => post(event));
  xhr.addEventListener('load', event => post(event));
  (data ? xhr.upload : xhr).addEventListener('progress', event => post(event));
  xhr.send(data ? JSON.stringify(data) : null);
};

/**
 * Decode a Base-64 encoded string as a binary, and post it and its Blob.
 * @argument {MessagePort} port - Allow sending messages.
 * @argument {Object} args - Arguments.
 * @argument {String} args.str - Base-64 data.
 * @argument {String} args.type - File type.
 * @return {undefined}
 */
tasks.decode = (port, args) => {
  let { str, type } = args,
      binary = atob(str),
      blob = new Blob([new Uint8Array([...binary].map((x, i) => binary.charCodeAt(i)))], { type });

  port.postMessage({ binary, blob });
};

/**
 * Read the content of a Blob or File, and post the data URL. Use FileReader instead of btoa() to avoid overflow.
 * @argument {MessagePort} port - Allow sending messages.
 * @argument {Object} args - Arguments.
 * @argument {(Blob|File)} args.file - File to be read.
 * @return {undefined}
 */
tasks.readfile = (port, args) => {
  let { file } = args,
      reader = new FileReader();

  reader.addEventListener('load', event => port.postMessage(event.target.result));
  reader.readAsDataURL(file);
};

self.addEventListener('connect', event => {
  let port = event.ports[0];

  port.addEventListener('message', event => tasks[event.data[0]](port, event.data[1]));
  port.start();
});
