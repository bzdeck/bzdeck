/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.BugDetails = function BugDetailsView ($bug, bug) {
  let mql = window.matchMedia('(max-width: 1023px)');

  this.bug = bug;
  this.$bug = $bug;
  this.$tablist = this.$bug.querySelector('[role="tablist"]');
  this.$$tablist = new this.widget.TabList(this.$tablist);

  this.$tablist.querySelector('[id$="attachments"]').setAttribute('aria-disabled', !(this.bug.attachments || []).length);
  this.$tablist.querySelector('[id$="history"]').setAttribute('aria-disabled', !(this.bug.history || []).length);

  this.$$tablist.bind('Selected', event => {
    let $selected = event.detail.items[0],
        $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

    // Scroll a tabpanel to top when the tab is selected
    $tabpanel.querySelector('[role="region"]').scrollTop = 0; // Mobile
    $tabpanel.querySelector('.scrollable-area-content').scrollTop = 0; // Desktop

    // Desktop: Show the info pane only when the timeline tab is selected
    if (!mql.matches && FlareTail.util.ua.device.desktop) {
      this.$bug.querySelector('.bug-info').setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
    }
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
      $participants_tab = this.$bug.querySelector('[id$="-tab-participants"]'),
      $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]'),
      $bug_info = this.$bug.querySelector('.bug-info'),
      $bug_participants = this.$bug.querySelector('.bug-participants');

  if (mql.matches || FlareTail.util.ua.device.mobile) {  // Mobile layout
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
  let $attachments = this.$bug.querySelector('[data-field="attachments"]');

  if (!$attachments) {
    return;
  }

  if (!attachments) {
    attachments = this.bug.attachments;

    for (let $attachment of $attachments.querySelectorAll('[itemprop="attachment"]')) {
      $attachment.remove();
    }
  }

  let len = attachments.length;

  if (!len) {
    return;
  }

  let mobile = FlareTail.util.ua.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)'),
      $attachment_tab = this.$tablist.querySelector('[id$="-tab-attachments"]'),
      $show_obsolete_checkbox = $attachments.querySelector('.list [role="checkbox"]'),
      $$show_obsolete_checkbox = new this.widget.Checkbox($show_obsolete_checkbox),
      $listbox = $attachments.querySelector('[role="listbox"]'),
      $fragment = new DocumentFragment(),
      $title = $attachments.querySelector('h4'),
      $listitem = FlareTail.util.content.get_fragment('details-attachment-listitem').firstElementChild;

  if (!this.$$attachment_list) {
    this.$$attachment_list = new this.widget.ListBox($listbox, []);

    this.$$attachment_list.bind('click', event => {
      let $selected = this.$$attachment_list.view.selected[0],
          attachment_id = $selected ? Number($selected.dataset.id) : undefined;

      if (attachment_id && mobile && mql.matches) {
        BzDeck.router.navigate(`/attachment/${attachment_id}`);
      }
    });

    this.$$attachment_list.bind('dblclick', event => {
      let $selected = this.$$attachment_list.view.selected[0],
          attachment_id = $selected ? Number($selected.dataset.id) : undefined;

      BzDeck.router.navigate(`/attachment/${attachment_id}`);
    });

    this.$$attachment_list.bind('Selected', event => {
      if (!event.detail.items[0] || (mobile && mql.matches)) {
        return;
      }

      let attachment = attachments.find(att => att.id === Number(event.detail.items[0].dataset.id));

      new this.widget.ScrollBar($attachments.querySelector('.content'));
      new BzDeck.views.Attachment(attachment, $attachments.querySelector('.content .scrollable-area-content'));
    });
  }

  for (let att of attachments) {
    this.fill($fragment.appendChild($listitem.cloneNode(true)), {
      'id': att.id,
      'description': att.summary,
      'dateModified': att.last_change_time,
      'creator': BzDeck.collections.users.get(att.creator, { 'name': att.creator }).properties,
      'encodingFormat': att.is_patch ? 'text/x-patch' : att.content_type, // l10n
      'is_obsolete': att.is_obsolete ? 'true' : 'false',
    }, {
      'id': `bug-${att.bug_id}-attachment-${att.id}`,
      'aria-disabled': !!att.is_obsolete,
      'data-id': att.id,
      'data-obsolete': att.is_obsolete ? 'true' : 'false',
    });
  }

  $title.textContent = len === 1 ? `${len} attachment` : `${len} attachments`; // l10n

  $show_obsolete_checkbox.setAttribute('aria-hidden', ![for (att of attachments) if (att.is_obsolete) att].length);
  $$show_obsolete_checkbox.bind('Toggled', event => {
    let checked = event.detail.checked;

    for (let $att of $listbox.querySelectorAll('[role="option"]')) {
      $att.setAttribute('aria-disabled', checked ? 'false' : $att.properties.is_obsolete[0].itemValue);
    }

    this.$$attachment_list.update_members();
    FlareTail.util.event.async(() => this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height()));
  });

  $listbox.appendChild($fragment);
  $listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$attachment_list.update_members();

  $attachment_tab.setAttribute('aria-disabled', 'false');

  // Select the first non-obsolete attachment
  {
    let $first = $listbox.querySelector('[role="option"][aria-disabled="false"]');

    if ($first && !mobile && !mql.matches) {
      this.$$attachment_list.view.selected = $first;
    }
  }

  let check_state = () => {
    let target_id = history.state ? history.state.attachment_id : undefined,
        $target = target_id ? $listbox.querySelector(`[id$='attachment-${target_id}']`) : undefined;

    if ($target && !mobile && !mql.matches && location.pathname === `/bug/${this.bug.id}`) {
      // If an attachment ID is specified in the history state, show the attachment
      if ($target.matches('[data-obsolete="true"]')) {
        $show_obsolete_checkbox.click();
      }

      this.$$tablist.view.selected = this.$$tablist.view.$focused = $attachment_tab;
      this.$$attachment_list.view.selected = this.$$attachment_list.view.focused = $target;
    }
  };

  check_state();
  window.addEventListener('popstate', event => check_state());

  // Force updating the scrollbars because sometimes those are not automatically updated
  FlareTail.util.event.async(() => this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height()));
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

  this.$tablist.querySelector('[id$="-tab-history"]').setAttribute('aria-disabled', 'false');
};
