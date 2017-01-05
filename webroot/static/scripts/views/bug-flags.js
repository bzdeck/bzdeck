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
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - Relevant bug with the flags.
   * @param {Proxy} [att] - Relevant attachment.
   * @returns {BugFlagsView} New BugFlagsView instance.
   */
  constructor (id, bug, att = undefined) {
    super(id); // Assign this.id

    this.bug = bug;
    this.att = att;
  }

  /**
   * Render the Flags section on the bug Details pane or attachment view. This feature is still a work in progress.
   * @param {HTMLElement} $outer - Container element to render.
   * @param {Number} [level=4] - aria-level for the label.
   */
  render ($outer, level = 4) {
    const config = BzDeck.host.data.config.bzapi;
    const get_person = name => BzDeck.collections.users.get(name, { name }); // Promise
    const _flags = (this.att ? this.att.flags : this.bug.flags) || [];
    const $flag = this.get_template('details-flag');
    const $fragment = new DocumentFragment();

    config.product[this.bug.product].component[this.bug.component].flag_type.forEach(async id => {
      const flag = config.flag_type[id];
      const _flag = _flags.find(f => f.name === flag.name);
      const $_flag = $flag.cloneNode(true);

      if (flag.is_for_bugs === !!this.att) {
        return; // continue the loop
      }

      const [setter, requestee] = await Promise.all([
        _flag && _flag.setter ? get_person(_flag.setter) : Promise.resolve({}),
        _flag && _flag.requestee ? get_person(_flag.requestee) : Promise.resolve({}),
      ]);

      $fragment.appendChild(this.fill($_flag, {
        name: flag.name,
        status: _flag ? _flag.status : '---',
        setter: setter.properties || {},
        requestee: requestee.properties || {},
      }, {
        'aria-label': flag.name,
        'aria-level': level,
        'data-field': flag.name,
        'data-has-value': _flag && !!_flag.status,
      }));

      for (const prop of ['setter', 'requestee']) {
        $_flag.querySelector(`[itemprop="${prop}"]`).setAttribute('aria-hidden', !_flag || !_flag[prop]);
      }

      // const $$combobox = new FlareTail.widgets.ComboBox($_flag.querySelector('[role="combobox"][aria-readonly="true"]'));

      // $$combobox.build_dropdown(['---', '?', '+', '-'].map(value => ({ value, selected: value === this.bug[name] })));
      // $$combobox.bind('Change', event => {});
    });

    $outer.appendChild($fragment);
  }
}
