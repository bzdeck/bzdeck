/**
 * BzDeck Tooltip Helper
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.helpers.Tooltip = function TooltipHelper () {};

BzDeck.helpers.Tooltip.prototype = Object.create(BzDeck.helpers.Base.prototype);
BzDeck.helpers.Tooltip.prototype.constructor = BzDeck.helpers.Tooltip;

BzDeck.helpers.Tooltip.prototype.init = function ($owner, showing_events, hiding_events, type) {
  this.$owner = $owner;
  this.showing_events = showing_events || ['mouseenter', 'focus'];
  this.hiding_events = hiding_events || ['mouseleave', 'blur'];
  this.regex = type === 'number' ? /^\d+$/ : /^.+$/;

  // TODO: add more controls, like position, delay, duration, etc.

  this.set_showing_events();
  this.set_hiding_events();
};

BzDeck.helpers.Tooltip.prototype.set_showing_events = function () {
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
};

BzDeck.helpers.Tooltip.prototype.set_hiding_events = function () {
  for (let type of this.hiding_events) {
    this.$owner.addEventListener(type, event => this.hide());
  }
};

BzDeck.helpers.Tooltip.prototype.hide_any = function () {
  let $tooltip = document.querySelector('body > [role="tooltip"]'),
      $owner;

  // Remove any existing tooltips
  if ($tooltip) {
    $owner = document.querySelector(`[aria-describedby="${$tooltip.id}"]`);

    if ($owner) {
      $owner.removeAttribute('aria-describedby');
    }

    $tooltip.remove();
  }
};

BzDeck.helpers.Tooltip.prototype.hide = function () {
  if (this.$tooltip) {
    this.$owner.removeAttribute('aria-describedby');
    this.$tooltip.remove();
    delete this.$tooltip;
  }
};

/* ------------------------------------------------------------------------------------------------------------------
 * Bug Tooltip
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.helpers.BugTooltip = function BugTooltipHelper (...args) {
  this.init(...args);
};

BzDeck.helpers.BugTooltip.prototype = Object.create(BzDeck.helpers.Tooltip.prototype);
BzDeck.helpers.BugTooltip.prototype.constructor = BzDeck.helpers.BugTooltip;

BzDeck.helpers.BugTooltip.prototype.show = function () {
  new Promise(resolve => {
    let bug = BzDeck.collections.bugs.get(this.id, { 'id': this.id, '_unread': true });

    if (bug.summary) {
      resolve(bug);
    } else {
      bug.fetch().then(bug => resolve(bug));
    }
  }).then(bug => {
    let contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator,
        rect = this.$owner.getBoundingClientRect();

    this.$tooltip = this.fill(this.get_fragment('bug-tooltip').firstElementChild, {
      'id': bug.id,
      'name': bug.summary,
      'dateModified': bug.last_change_time,
      'contributor': BzDeck.collections.users.get(contributor, { 'name': contributor }).properties,
    }, {
      'data-id': bug.id,
    });

    this.$tooltip.id = `bug-${bug.id}-tooltip`;
    this.$tooltip.style.top = `calc(${Number.parseInt(rect.top)}px - 6rem)`;
    this.$tooltip.style.left = `${Number.parseInt(rect.left)}px`;
    this.$tooltip.addEventListener('mousedown', event => BzDeck.router.navigate(`/bug/${bug.id}`));
    document.body.appendChild(this.$tooltip);
    this.$owner.setAttribute('aria-describedby', this.$tooltip.id);
  });
};
