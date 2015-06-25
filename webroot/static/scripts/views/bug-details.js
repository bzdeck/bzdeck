/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.BugDetails = function BugDetailsView (view_id, bug, $bug) {
  let mql = window.matchMedia('(max-width: 1023px)');

  this.id = view_id;
  this.bug = bug;
  this.$bug = $bug;
  this.$tablist = this.$bug.querySelector('[role="tablist"]');
  this.$att_tab = this.$tablist.querySelector('[id$="-tab-attachments"]');
  this.$$tablist = new this.widgets.TabList(this.$tablist);

  this.$tablist.querySelector('[id$="history"]').setAttribute('aria-disabled', !(this.bug.history || []).length);

  this.$$tablist.bind('Selected', event => {
    let $selected = event.detail.items[0],
        $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

    // Scroll a tabpanel to top when the tab is selected
    $tabpanel.querySelector('[role="region"]').scrollTop = 0; // Mobile
    $tabpanel.querySelector('.scrollable-area-content').scrollTop = 0; // Desktop

    // Desktop: Show the info pane only when the timeline tab is selected
    if (!mql.matches && this.helpers.env.device.desktop) {
      this.$bug.querySelector('.bug-info').setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
    }
  });

  this.on('BugView:EditingAttachmentRequested', data => {
    // Switch the tabs when an attachment is selected on the comment form
    this.$$tablist.view.selected = this.$$tablist.view.$focused = this.$att_tab;
  });

  // Call BzDeck.views.Bug.prototype.init
  this.init();

  mql.addListener(mql => this.change_layout(mql));
  this.change_layout(mql);

  if (this.helpers.env.device.mobile) {
    this.add_mobile_tweaks();
  }
};

BzDeck.views.BugDetails.prototype = Object.create(BzDeck.views.Bug.prototype);
BzDeck.views.BugDetails.prototype.constructor = BzDeck.views.BugDetails;

BzDeck.views.BugDetails.prototype.change_layout = function (mql) {
  let $info_tab = this.$bug.querySelector('[id$="-tab-info"]'),
      $participants_tab = this.$bug.querySelector('[id$="-tab-participants"]'),
      $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]'),
      $bug_info = this.$bug.querySelector('.bug-info'),
      $bug_participants = this.$bug.querySelector('.bug-participants');

  if (mql.matches || this.helpers.env.device.mobile) {  // Mobile layout
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
    this.$bug.querySelector('article > div').appendChild($bug_info);
    this.$bug.querySelector('article > div').appendChild($bug_participants);
    this.$tablist.removeAttribute('aria-hidden');
  }
};

BzDeck.views.BugDetails.prototype.add_mobile_tweaks = function () {
  let mql = window.matchMedia('(max-width: 1023px)');

  // Hide tabs when scrolled down on mobile
  for (let $content of this.$bug.querySelectorAll('.scrollable-area-content')) {
    let info = $content.parentElement.matches('.bug-info'),
        top = 0,
        hidden = false;

    $content.addEventListener('scroll', event => {
      if (!mql.matches && info) {
        return;
      }

      let _top = event.target.scrollTop,
          _hidden = top < _top;

      if (hidden !== _hidden) {
        hidden = _hidden;
        this.$tablist.setAttribute('aria-hidden', hidden);
      }

      top = _top;
    });
  }
};

BzDeck.views.BugDetails.prototype.render_attachments = function (attachments) {
  let mobile = this.helpers.env.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)'),
      $field = this.$bug.querySelector('[data-field="attachments"]');

  this.$$attachments = new BzDeck.views.BugAttachments(this.id, this.bug.id, $field);

  if ((this.bug.attachments || []).length) {
    this.$$attachments.render([for (att of this.bug.attachments) BzDeck.collections.attachments.get(att.id)]);
  }

  // Select the first non-obsolete attachment when the Attachment tab is selected for the first time
  this.$$tablist.bind('Selected', event => {
    if (mobile || mql.matches || event.detail.items[0] !== this.$att_tab ||
        this.$$attachments.$listbox.querySelector('[role="option"][aria-selected="true"]')) { // Already selected
      return;
    }

    let $first = this.$$attachments.$listbox.querySelector('[role="option"][aria-disabled="false"]');

    if ($first) {
      this.$$attachments.$$listbox.view.selected = $first;
    }
  });
};

BzDeck.views.BugDetails.prototype.render_history = function (history) {
  let $tab = this.$tablist.querySelector('[id$="-tab-history"]');

  this.$$history = new BzDeck.views.BugHistory(this.id, this.$bug.querySelector('[data-field="history"]'));

  if ((this.bug.history || []).length) {
    this.$$history.render(this.bug.history);
    $tab.setAttribute('aria-disabled', 'false');
  }
};
