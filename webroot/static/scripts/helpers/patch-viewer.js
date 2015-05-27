/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

// TODO: support non-unified formats
// TODO: implement syntax highlight

BzDeck.helpers.PatchViewer = function PatchViewerHelper (str) {
  let $fragment = new DocumentFragment();

  for (let file of str.match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/mg)) {
    let lines = file.split(/\n/),
        [filename_a, filename_b] = lines.splice(0, 2).map(line => line.split(/\s+/)[1].replace(/^[ab]\//, '')),
        removed_ln = 0,
        added_ln = 0,
        $details = $fragment.appendChild(document.createElement('details')),
        $summary = $details.appendChild(document.createElement('summary')),
        $table = $details.appendChild(document.createElement('table'));

    $summary.textContent = filename_a === '/dev/null' ? filename_b : filename_a;

    for (let line of lines) {
      let $row = $table.insertRow(),
          $removed_ln = $row.insertCell(),
          $added_ln = $row.insertCell(),
          $sign = $row.insertCell(),
          $line = $row.insertCell();

      $removed_ln.classList.add('ln', 'removed');
      $added_ln.classList.add('ln', 'removed');
      $sign.classList.add('sign');
      $line.classList.add('code');

      if (line.startsWith('@@')) {
        let match = line.match(/^@@\ \-(\d+),\d+\s\+(\d+),\d+\s@@/);

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
};

BzDeck.helpers.PatchViewer.prototype = Object.create(BzDeck.helpers.Base.prototype);
BzDeck.helpers.PatchViewer.prototype.constructor = BzDeck.helpers.PatchViewer;
