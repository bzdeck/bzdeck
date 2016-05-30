/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Patch Viewer View. Render a patch file in HTML format so added and removed lines can be highlighted with
 * CSS.
 * @extends BzDeck.BaseView
 * @todo Support non-unified formats.
 * @todo Implement syntax highlight (#279).
 */
BzDeck.PatchViewerView = class PatchViewerView extends BzDeck.BaseView {
  /**
   * Get a PatchViewerView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {String} str - Raw patch content.
   * @returns {DocumentFragment} $fragment - formatted HTML fragment
   */
  constructor (id, str) {
    super(id); // Assign this.id

    let $fragment = new DocumentFragment();

    str = str.replace(/\r\n?/g, '\n');

    for (let file of str.match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/mg)) {
      let lines = file.split(/\n/);
      let [filename_a, filename_b] = lines.splice(0, 2).map(line => line.split(/\s+/)[1].replace(/^[ab]\//, ''));
      let removed_ln = 0;
      let added_ln = 0;
      let $details = $fragment.appendChild(document.createElement('details'));
      let $summary = $details.appendChild(document.createElement('summary'));
      let $table = $details.appendChild(document.createElement('table'));

      $summary.textContent = filename_a === '/dev/null' ? filename_b : filename_a;

      for (let line of lines) {
        let $row = $table.insertRow();
        let $removed_ln = $row.insertCell();
        let $added_ln = $row.insertCell();
        let $sign = $row.insertCell();
        let $line = $row.insertCell();

        $removed_ln.classList.add('ln', 'removed');
        $added_ln.classList.add('ln', 'removed');
        $sign.classList.add('sign');
        $line.classList.add('code');

        if (line.startsWith('@@')) {
          let match = line.match(/^@@\ \-(\d+)(?:,\d+)?\s\+(\d+)(?:,\d+)?\s@@/);

          removed_ln = Number(match[1]);
          added_ln = Number(match[2]);
          $row.classList.add('head');
          $removed_ln.textContent = '...';
          $added_ln.textContent = '...';
          $line.textContent = line;
        } else if (line.startsWith('-')) {
          $row.classList.add('removed');
          $removed_ln.textContent = removed_ln;
          $sign.textContent = line.substr(0, 1);
          $line.textContent = line.substr(1);
          removed_ln++;
        } else if (line.startsWith('+')) {
          $row.classList.add('added');
          $added_ln.textContent = added_ln;
          $sign.textContent = line.substr(0, 1);
          $line.textContent = line.substr(1);
          added_ln++;
        } else {
          $removed_ln.textContent = removed_ln;
          $added_ln.textContent = added_ln;
          $line.textContent = line.substr(1);
          removed_ln++;
          added_ln++;
        }
      }
    }

    return $fragment;
  }
}
