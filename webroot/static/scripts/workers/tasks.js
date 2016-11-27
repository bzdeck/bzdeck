/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

'use strict';

/**
 * Define the module namespace.
 * @namespace
 */
const tasks = {};

/**
 * Send a XMLHttpRequest, and post the result events, not only load, but also abort, error and progress.
 * @param {MessagePort} port - Allow sending messages.
 * @param {String} url - URL to load.
 * @param {String} [method=GET] - Request method.
 * @param {Map} [headers] - HTTP headers to be set.
 * @param {*} [data] - Data to be POSTed.
 * @returns {undefined}
 */
tasks.xhr = (port, { url, method = 'GET', headers, data } = {}) => {
  const xhr = new XMLHttpRequest();

  const post = event => {
    const type = event.type;
    const message = { type };

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

  xhr.open(method, url);

  if (headers) {
    headers.forEach((value, key) => xhr.setRequestHeader(key, value));
  }

  xhr.addEventListener('abort', event => post(event), { once: true });
  xhr.addEventListener('error', event => post(event), { once: true });
  xhr.addEventListener('load', event => post(event), { once: true });
  xhr.addEventListener('loadend', event => { post(event); port.close(); }, { once: true });
  (data ? xhr.upload : xhr).addEventListener('progress', event => post(event));
  xhr.send(data ? JSON.stringify(data) : null);
};

/**
 * Decode a Base-64 encoded string as a binary, and post it and its Blob.
 * @param {MessagePort} port - Allow sending messages.
 * @param {String} str - Base-64 data.
 * @param {String} type - File type.
 * @returns {undefined}
 */
tasks.decode = (port, { str, type } = {}) => {
  const binary = type.startsWith('text/') ? decodeURIComponent(escape(atob(str))) : atob(str);
  const blob = new Blob([new Uint8Array([...binary].map((x, i) => binary.charCodeAt(i)))], { type });

  port.postMessage({ binary, blob });
  port.close();
};

/**
 * Read the content of a Blob or File, and post the data URL. Use FileReader instead of btoa() to avoid overflow.
 * @param {MessagePort} port - Allow sending messages.
 * @param {(Blob|File)} file - File to be read.
 * @returns {undefined}
 */
tasks.readfile = (port, { file } = {}) => {
  const reader = new FileReader();

  reader.addEventListener('load', event => {
    port.postMessage(event.target.result);
    port.close();
  }, { once: true });
  reader.readAsDataURL(file);
};

/**
 * Parse a patch file as an HTML string that can be displayed in the Patch Viewer.
 * @param {MessagePort} port - Allow sending messages.
 * @param {String} str - Raw patch content.
 * @returns {undefined}
 */
tasks.parse_patch = (port, { str } = {}) => {
  const entities = { '<': '&lt;', '>': '&gt;', '&': '&amp;' };
  const sanitize = str => str.replace(/[<>&]/g, match => entities[match]);
  let content = [];

  for (const file of str.replace(/\r\n?/g, '\n').match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/mg)) {
    const lines = file.split(/\n/);
    const [filename_a, filename_b] = lines.splice(0, 2).map(line => line.split(/\s+/)[1].replace(/^[ab]\//, ''));
    const filename = filename_a === '/dev/null' ? filename_b : filename_a;
    let rows = [];
    let removed_ln = 0;
    let added_ln = 0;

    for (const line of lines) {
      let row_class = '';
      let removed = '';
      let added = '';
      let sign = '';
      let code = '';

      if (line.startsWith('@@')) {
        const match = line.match(/^@@\ \-(\d+)(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/);

        removed_ln = Number(match[1]);
        added_ln = Number(match[2]);
        row_class = 'head';
        removed = '...';
        added = '...';
        code = line;
      } else if (line.startsWith('-')) {
        row_class = 'removed';
        removed = removed_ln;
        sign = line.substr(0, 1);
        code = line.substr(1);
        removed_ln++;
      } else if (line.startsWith('+')) {
        row_class = 'added';
        added = added_ln;
        sign = line.substr(0, 1);
        code = line.substr(1);
        added_ln++;
      } else {
        removed = removed_ln;
        added = added_ln;
        code = line.substr(1);
        removed_ln++;
        added_ln++;
      }

      rows.push(`<tr class="${row_class}"><td class="ln removed">${removed}</td><td class="ln added">${added}</td>` +
                `<td class="sign">${sign}</td><td class="code">${sanitize(code)}</td></tr>`);
    }

    content.push(`<details open><summary>${sanitize(filename)}</summary><table>${rows.join('')}</table></details>`);
  }

  port.postMessage(content.join(''));
  port.close();
};

self.addEventListener('connect', event => {
  const port = event.ports[0];

  port.addEventListener('message', event => tasks[event.data[0]](port, event.data[1]));
  port.start();
});
