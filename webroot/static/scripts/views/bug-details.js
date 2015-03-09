/**
 * BzDeck Bug Details View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.BugDetails = function BugDetailsView ($bug, bug) {
  let mql = window.matchMedia('(max-width: 1023px)');

  this.bug = bug;
  this.$bug = $bug;
  this.$tablist = this.$bug.querySelector('[role="tablist"]');
  this.$$tablist = new this.widget.TabList(this.$tablist);

  // Scroll a tabpanel to top when the tab is selected
  this.$$tablist.bind('Selected', event => {
    let $tabpanel = this.$bug.querySelector(`#${event.detail.items[0].getAttribute('aria-controls')}`);

    $tabpanel.querySelector('[role="region"]').scrollTop = 0; // Mobile
    $tabpanel.querySelector('.scrollable-area-content').scrollTop = 0; // Desktop
  });

  // Call BzDeck.views.Bug.prototype.init
  this.init();

  mql.addListener(mql => this.change_layout(mql));
  this.change_layout(mql);

  if (FlareTail.util.ua.device.mobile) {
    this.add_mobile_tweaks();
  }
};

BzDeck.views.BugDetails.prototype = Object.create(BzDeck.views.Bug.prototype);
BzDeck.views.BugDetails.prototype.constructor = BzDeck.views.BugDetails;

BzDeck.views.BugDetails.prototype.change_layout = function (mql) {
  let $info_tab = this.$bug.querySelector('[id$="-tab-info"]'),
      $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]'),
      $bug_info = this.$bug.querySelector('.bug-info');

  if (mql.matches) {  // Mobile layout
    $info_tab.setAttribute('aria-hidden', 'false');
    this.$bug.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
  } else {
    if (this.$$tablist.view.selected[0] === $info_tab) {
      this.$$tablist.view.selected = this.$$tablist.view.$focused = $timeline_tab;
    }

    $info_tab.setAttribute('aria-hidden', 'true');
    this.$bug.querySelector('article > div').appendChild($bug_info);
    this.$tablist.removeAttribute('aria-hidden');
  }
};

BzDeck.views.BugDetails.prototype.add_mobile_tweaks = function () {
  let mql = window.matchMedia('(max-width: 1023px)'),
      $timeline_content = this.$bug.querySelector('.bug-timeline .scrollable-area-content');

  $timeline_content.insertBefore(this.$bug.querySelector('h2').cloneNode(true),
                                 $timeline_content.firstElementChild);

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
  let $placeholder = this.$bug.querySelector('[data-field="attachments"]');

  if (!$placeholder) {
    return;
  }

  if (!attachments) {
    attachments = this.bug.attachments;

    for (let $attachment of $placeholder.querySelectorAll('[itemprop="attachment"]')) {
      $attachment.remove();
    }
  }

  if (!attachments.length) {
    return;
  }

  for (let att of attachments) {
    let $attachment = $placeholder.appendChild(
      FlareTail.util.content.get_fragment('details-attachment').firstElementChild);

    this.fill($attachment, {
      'url': `/attachment/${att.id}`,
      'description': att.summary,
      'name': att.file_name,
      'contentSize': `${(att.size / 1024).toFixed(2)} KB`, // l10n
      'encodingFormat': att.is_patch ? 'Patch' : att.content_type, // l10n
      'uploadDate': att.creation_time,
      'creator': BzDeck.controllers.users.get(att.creator).properties,
      'flag': [for (flag of att.flags) {
        'creator': BzDeck.controllers.users.get(flag.setter).properties,
        'name': flag.name,
        'status': flag.status
      }],
    }, {
      'data-attachment-id': att.id
    });
  }

  this.$bug.querySelector('[id$="-tab-attachments"]').setAttribute('aria-disabled', 'false');
};

BzDeck.views.BugDetails.prototype.render_history = function (history) {
  let $placeholder = this.$bug.querySelector('[data-field="history"]');

  if (!$placeholder) {
    return;
  }

  let datetime = FlareTail.util.datetime,
      conf_field = BzDeck.models.server.data.config.field,
      $tbody = $placeholder.querySelector('tbody'),
      $template = document.querySelector('#details-change');

  let cell_content = (field, content) =>
        ['blocks', 'depends_on'].includes(field)
                ? content.replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>')
                : content.replace('@', '&#8203;@'); // ZERO WIDTH SPACE

  if (!history) {
    history = this.bug.history;
    $tbody.innerHTML = ''; // Remove the table rows
  }

  if (!history.length) {
    return;
  }

  for (let hist of history) {
    for (let [i, change] of hist.changes.entries()) {
      let $row = $tbody.appendChild($template.content.cloneNode(true).firstElementChild),
          $cell = field => $row.querySelector(`[data-field="${field}"]`);

      if (i === 0) {
        $cell('who').innerHTML = hist.who.replace('@', '&#8203;@');
        $cell('who').rowSpan = $cell('when').rowSpan = hist.changes.length;
        datetime.fill_element($cell('when').appendChild(document.createElement('time')),
                              hist.when, { 'relative': false });
      } else {
        $cell('when').remove();
        $cell('who').remove();
      }

      let _field = conf_field[change.field_name] ||
                   // Bug 909055 - Field name mismatch in history: group vs groups
                   conf_field[change.field_name.replace(/s$/, '')] ||
                   // Bug 1078009 - Changes/history now include some wrong field names
                   conf_field[{
                     'flagtypes.name': 'flag',
                     'attachments.description': 'attachment.description',
                     'attachments.ispatch': 'attachment.is_patch',
                     'attachments.isobsolete': 'attachment.is_obsolete',
                     'attachments.isprivate': 'attachment.is_private',
                     'attachments.mimetype': 'attachment.content_type',
                   }[change.field_name]] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change;

      $cell('what').textContent = _field.description || _field.field_name;
      $cell('removed').innerHTML = cell_content(change.field_name, change.removed);
      $cell('added').innerHTML = cell_content(change.field_name, change.added);
    }
  }

  this.$bug.querySelector('[id$="-tab-history"]').setAttribute('aria-disabled', 'false');
};
