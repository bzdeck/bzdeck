/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Details View that represents the content displayed on the Bug Details page.
 * @extends BzDeck.BugView
 */
BzDeck.BugDetailsView = class BugDetailsView extends BzDeck.BugView {
  /**
   * Get a BugDetailsView instance.
   * @constructor
   * @param {String} container_id - Unique instance identifier of the parent container view.
   * @param {Number} bug_id - Bug ID to show.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {BugDetailsView} New BugDetailsView instance.
   */
  constructor (container_id, bug_id, siblings = [], $bug) {
    super(container_id, bug_id, siblings); // Assign this.id

    const mql = window.matchMedia('(max-width: 1023px)');

    this.$tablist = this.$bug.querySelector('[role="tablist"]');
    this.$att_tab = this.$tablist.querySelector('[id$="-tab-attachments"]');
    this.$$tablist = new FlareTail.widgets.TabList(this.$tablist);
    this.$outline = this.$bug.querySelector('.bug-outline');

    this.$$tablist.bind('Selected', event => {
      const $selected = event.detail.items[0];
      const $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

      // Scroll a tabpanel to top when the tab is selected
      $tabpanel.querySelector('.scrollable').scrollTop = 0;

      // Desktop: Show the outline pane only when the timeline tab is selected
      if (!mql.matches && FlareTail.helpers.env.device.desktop) {
        this.$outline.setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
      }
    });

    mql.addListener(mql => this.change_layout(mql));
    this.change_layout(mql);

    if (FlareTail.helpers.env.device.mobile) {
      this.add_mobile_tweaks();
    }

    // Subscribe to events
    this.subscribe('BugPresenter#HistoryUpdated');
  }

  /**
   * Change the page layout by moving some elements, depending on the viewport.
   * @param {MediaQueryList} mql - Detecting the current viewport.
   */
  change_layout (mql) {
    const $info_tab = this.$bug.querySelector('[id$="-tab-info"]');
    const $participants_tab = this.$bug.querySelector('[id$="-tab-participants"]');
    const $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]');
    const $bug_info = this.$bug.querySelector('.bug-info');
    const $bug_participants = this.$bug.querySelector('.bug-participants');

    if (mql.matches || FlareTail.helpers.env.device.mobile) {  // Mobile layout
      $info_tab.setAttribute('aria-hidden', 'false');
      $participants_tab.setAttribute('aria-hidden', 'false');
      this.$bug.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
      this.$bug.querySelector('[id$="-tabpanel-participants"]').appendChild($bug_participants);
    } else {
      if ([$info_tab, $participants_tab].includes(this.$$tablist.view.selected[0])) {
        this.$$tablist.view.selected = this.$$tablist.view.$focused = $timeline_tab;
      }

      $info_tab.setAttribute('aria-hidden', 'true');
      $participants_tab.setAttribute('aria-hidden', 'true');
      this.$outline.appendChild($bug_info);
      this.$outline.appendChild($bug_participants);
      this.$tablist.removeAttribute('aria-hidden');
    }
  }

  /**
   * Add a UI gimmick for mobile that hides the tabs when scrolled down.
   */
  add_mobile_tweaks () {
    const mql = window.matchMedia('(max-width: 1023px)');

    for (const $content of this.$bug.querySelectorAll('.scrollable')) {
      const info = $content.matches('.bug-info');
      let top = 0;
      let hidden = false;

      $content.addEventListener('scroll', event => {
        if (!mql.matches && info) {
          return;
        }

        const _top = event.target.scrollTop;
        const _hidden = top < _top;

        if (hidden !== _hidden) {
          hidden = _hidden;
          this.$tablist.setAttribute('aria-hidden', hidden);
        }

        top = _top;
      });
    }
  }

  /**
   * Add the number of the comments, attachments and history entries to the each relevant tab as a small badge.
   */
  add_tab_badges () {
    for (const prop of ['comments', 'attachments', 'history']) {
      const tab_name = prop === 'comments' ? 'timeline' : prop;
      const number = (this.bug[prop] || []).length;

      this.$tablist.querySelector(`[id$="tab-${tab_name}"] label`).dataset.badge = number;
    }
  }

  /**
   * Render the Tracking Flags section on the bug info pane.
   */
  render_tracking_flags () {
    const config = BzDeck.host.data.config;
    const $outer = this.$bug.querySelector('[data-category="tracking-flags"]');
    const $flag = this.get_template('details-tracking-flag');
    const $fragment = new DocumentFragment();

    for (const name of Object.keys(this.bug.data).sort()) {
      const field = config.field[name];
      const value = this.bug.data[name];

      // Check the flag type, 99 is for project flags or tracking flags on bugzilla.mozilla.org
      if (!name.startsWith('cf_') || !field || !field.is_active || field.type !== 99) {
        continue;
      }

      $fragment.appendChild(this.fill($flag.cloneNode(true), {
        name: field.description,
        value,
      }, {
        'aria-label': field.description,
        'data-field': name,
        'data-has-value': value !== '---',
      }));
    }

    $outer.appendChild($fragment);
  }

  /**
   * Render the Attachments tabpanel content with BugAttachmentsView.
   */
  render_attachments () {
    const mobile = FlareTail.helpers.env.device.mobile;
    const mql = window.matchMedia('(max-width: 1023px)');
    const $field = this.$bug.querySelector('[data-field="attachments"]');

    this.$$attachments = new BzDeck.BugAttachmentsView(this.id, this.bug.id, $field);

    if ((this.bug.attachments || []).length) {
      (async () => {
        this.$$attachments.render(await Promise.all(this.bug.attachments.map(att => {
          return BzDeck.collections.attachments.get(att.id);
        })));
      })();
    }

    // Select the first non-obsolete attachment when the Attachment tab is selected for the first time
    this.$$tablist.bind('Selected', event => {
      if (mobile || mql.matches || event.detail.items[0] !== this.$att_tab ||
          this.$$attachments.$listbox.querySelector('[role="option"][aria-selected="true"]')) { // Already selected
        return;
      }

      const $first = this.$$attachments.$listbox.querySelector('[role="option"][aria-disabled="false"]');

      if ($first) {
        this.$$attachments.$$listbox.view.selected = $first;
      }
    });
  }

  /**
   * Render the History tabpanel content with BugHistoryView.
   */
  render_history () {
    const $tab = this.$tablist.querySelector('[id$="-tab-history"]');

    this.$$history = new BzDeck.BugHistoryView(this.id, this.$bug.querySelector('[data-field="history"]'));

    if ((this.bug.history || []).length) {
      this.$$history.render(this.bug.history);
      $tab.setAttribute('aria-disabled', 'false');
    }
  }

  /**
   * Called whenever the location fragment or history state is updated. Switch the tabs when an attachment is selected
   * on the timeline or comment form.
   * @listens BugPresenter#HistoryUpdated
   * @param {Object} [state] - Current history state.
   * @param {String} [state.att_id] - Attachment ID or hash.
   */
  on_history_updated ({ state } = {}) {
    if (state && state.att_id) {
      this.$$tablist.view.selected = this.$$tablist.view.$focused = this.$att_tab;
    }
  }
}
