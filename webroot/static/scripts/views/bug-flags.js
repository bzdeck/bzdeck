/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Flags View that represents a bug flag widget on each Bug Details page.
 * @extends BzDeck.BaseView
 */
BzDeck.BugFlagsView = class BugFlagsView extends BzDeck.BaseView {
  /**
   * Get a BugFlagsView instance.
   * @constructor
   * @argument {Proxy} bug - Relevant bug with the flags.
   * @argument {Proxy} [att] - Relevant attachment.
   * @return {undefined}
   */
  constructor (bug, att = undefined) {
    super(); // This does nothing but is required before using `this`

    this.bug = bug;
    this.att = att;
  }

  /**
   * Render the Flags section on the bug info pane or attachment view. This feature is still a work in progress.
   * @argument {HTMLElement} $outer - Container element to render.
   * @argument {Number} level - aria-level for the label.
   * @return {undefined}
   */
  render ($outer, level = 4) {
    let config = BzDeck.server.data.config,
        get_person = name => BzDeck.collections.users.get(name, { name }), // Promise
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

      Promise.all([
        _flag && _flag.setter ? get_person(_flag.setter) : Promise.resolve({}),
        _flag && _flag.requestee ? get_person(_flag.requestee) : Promise.resolve({}),
      ]).then(people => {
        $fragment.appendChild(this.fill($_flag, {
          name: flag.name,
          status: _flag ? _flag.status : '---',
          setter: people[0].properties || {},
          requestee: people[1].properties || {},
        }, {
          'aria-label': flag.name,
          'aria-level': level,
          'data-field': flag.name,
          'data-has-value': _flag && !!_flag.status,
        }));
      });

      for (let prop of ['setter', 'requestee']) {
        $_flag.querySelector(`[itemprop="${prop}"]`).setAttribute('aria-hidden', !_flag || !_flag[prop]);
      }

      // let $$combobox = new FlareTail.widgets.ComboBox($_flag.querySelector('[role="combobox"][aria-readonly="true"]'));

      // $$combobox.build_dropdown(['---', '?', '+', '-'].map(value => ({ value, selected: value === this.bug[name] })));
      // $$combobox.bind('Change', event => {});
    }

    $outer.appendChild($fragment);
  }
}
