/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Tooltip View. This constructor is intended to be inherited by each specific tooptip view.
 * @extends BzDeck.BaseView
 * @todo Add more controls, like position, delay, duration, etc.
 */
BzDeck.TooltipView = class TooltipView extends BzDeck.BaseView {
  /**
   * Initialize the Tooltip View.
   * @argument {HTMLElement} $owner - Element that owns/triggers the tooltip.
   * @argument {Array.<String>} [showing_events] - Events to show the tooptip. Default: mouseenter/focus
   * @argument {Array.<String>} [hiding_events] - Events to hide the tooltip. Default: mouseleave/blur
   * @argument {String} [type] - Type of the target data ID: string or number.
   * @return {undefined}
   */
  constructor ($owner, showing_events, hiding_events, type) {
    super(); // This does nothing but is required before using `this`

    this.$owner = $owner;
    this.showing_events = showing_events || ['mouseenter', 'focus'];
    this.hiding_events = hiding_events || ['mouseleave', 'blur'];
    this.regex = type === 'number' ? /^\d+$/ : /^.+$/;

    this.set_showing_events();
    this.set_hiding_events();
  }

  /**
   * Set event handlers on the owner element to show the tooltip.
   * @argument {undefined}
   * @return {undefined}
   */
  set_showing_events () {
    for (let type of this.showing_events) {
      this.$owner.addEventListener(type, event => {
        let value = event.target.value || event.target.dataset.id;

        this.hide_any();
        window.clearTimeout(this.timer);

        if (value && value.match(this.regex)) {
          this.timer = window.setTimeout(() => {
            this.id = isNaN(value) ? value : Number(value);
            this.show();
          }, 1000);
        }
      });
    }
  }

  /**
   * Set event handlers on the owner element to hide the tooltip.
   * @argument {undefined}
   * @return {undefined}
   */
  set_hiding_events () {
    for (let type of this.hiding_events) {
      this.$owner.addEventListener(type, event => this.hide());
    }
  }

  /**
   * Remove any existing tooptips from the page.
   * @argument {undefined}
   * @return {undefined}
   */
  hide_any () {
    let $tooltip = document.querySelector('body > [role="tooltip"]'),
        $owner;

    if ($tooltip) {
      $owner = document.querySelector(`[aria-describedby="${$tooltip.id}"]`);

      if ($owner) {
        $owner.removeAttribute('aria-describedby');
      }

      $tooltip.remove();
    }
  }

  /**
   * Remove the current tooptip from the page.
   * @argument {undefined}
   * @return {undefined}
   */
  hide () {
    if (this.$tooltip) {
      this.$owner.removeAttribute('aria-describedby');
      this.$tooltip.remove();
      delete this.$tooltip;
    }
  }
}

/**
 * Define the Bug Tooltip View.
 * @extends BzDeck.TooltipView
 */
BzDeck.BugTooltipView = class BugTooltipView extends BzDeck.TooltipView {
  /**
   * Initialize the Bug Tooltip View.
   * @constructor
   * @argument {...arguments} args - See BzDeck.TooltipView.prototype.constructor.
   * @return {Object} view - New BugTooltipView instance.
   */
  constructor (...args) {
    super(...args);
  }

  /**
   * Show the bug tooptip on the page.
   * @argument {undefined}
   * @return {undefined}
   */
  show () {
    let bug;

    new Promise(resolve => {
      BzDeck.collections.bugs.get(this.id, { id: this.id }).then(bug => {
        bug.summary ? resolve(bug) : bug.fetch().then(bug => resolve(bug));
      });
    }).then(_bug => {
      bug = _bug;
    }).then(() => {
      let contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;
      return BzDeck.collections.users.get(contributor, { name: contributor });
    }).then(_contributor => {
      this.$tooltip = this.fill(this.get_template('bug-tooltip'), {
        id: bug.id,
        summary: bug.summary,
        last_change_time: bug.last_change_time,
        contributor: _contributor.properties,
      }, {
        'data-id': bug.id,
      });
    }).then(() => {
      let rect = this.$owner.getBoundingClientRect();

      this.$tooltip.id = `bug-${bug.id}-tooltip`;
      this.$tooltip.style.top = `calc(${Number.parseInt(rect.top)}px - 6rem)`;
      this.$tooltip.style.left = `${Number.parseInt(rect.left)}px`;
      this.$tooltip.addEventListener('mousedown', event => this.trigger('GlobalView:OpenBug', { id: bug.id }));
      document.body.appendChild(this.$tooltip);
      this.$owner.setAttribute('aria-describedby', this.$tooltip.id);
    });
  }
}
