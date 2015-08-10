/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Bug Flags View.
 *
 * [argument] bug (Proxy) relevant bug with the flags
 * [argument] att (Proxy, optional) relevant attachment
 * [return] none
 */
BzDeck.views.BugFlags = function BugFlagsView (bug, att = undefined) {
  this.bug = bug;
  this.att = att;
};

BzDeck.views.BugFlags.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugFlags.prototype.constructor = BzDeck.views.BugFlags;

/*
 * Render the Flags section on the bug info pane or attachment view.
 *
 * [argument] $outer (Element) container element to render
 * [argument] level (Integer, optional) aria-level for the label
 * [return] none
 */
BzDeck.views.BugFlags.prototype.render = function ($outer, level = 4) {
  let config = BzDeck.models.server.data.config,
      get_person = name => BzDeck.collections.users.get(name, { name }).properties,
      _flags = (this.att ? this.att.flags : this.bug.flags) || [],
      $flag = this.get_template('details-flag'),
      $fragment = new DocumentFragment();

  for (let id of config.product[this.bug.product].component[this.bug.component].flag_type) {
    let flag = config.flag_type[id],
        _flag = _flags.find(f => f.name === flag.name),
        $_flag = $flag.cloneNode(true);

    if (flag.is_for_bugs === !!this.att) {
      continue;
    }

    $fragment.appendChild(this.fill($_flag, {
      name: flag.name,
      status: _flag ? _flag.status : '---',
      setter: _flag && _flag.setter ? get_person(_flag.setter) : {},
      requestee: _flag && _flag.requestee ? get_person(_flag.requestee) : {},
    }, {
      'aria-label': flag.name,
      'aria-level': level,
      'data-field': flag.name,
      'data-has-value': _flag && !!_flag.status,
    }));

    for (let prop of ['setter', 'requestee']) {
      $_flag.querySelector(`[itemprop="${prop}"]`).setAttribute('aria-hidden', !_flag || !_flag[prop]);
    }

    // let $$combobox = new this.widgets.ComboBox($_flag.querySelector('[role="combobox"][aria-readonly="true"]'));

    // $$combobox.build([for (value of ['---', '?', '+', '-']) { value, selected: value === this.bug[name] }]);
    // $$combobox.bind('Change', event => {});
  }

  $outer.appendChild($fragment);
};
