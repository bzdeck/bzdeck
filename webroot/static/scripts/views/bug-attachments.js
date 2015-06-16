/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.BugAttachments = function BugAttachmentsView (view_id, $container) {
  let mobile = this.helpers.env.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)');

  this.id = view_id;
  this.attachments = [];

  this.$container = $container;
  this.$title = this.$container.querySelector('h4');
  this.$listbox = this.$container.querySelector('[role="listbox"]');
  this.$obsolete_checkbox = this.$container.querySelector('.list [role="checkbox"]');

  for (let $attachment of this.$container.querySelectorAll('[itemprop="attachment"]')) {
    $attachment.remove();
  }

  this.$$listbox = new this.widgets.ListBox(this.$listbox, []);

  this.$$listbox.bind('click', event => {
    let $selected = this.$$listbox.view.selected[0],
        att_id = $selected ? Number($selected.dataset.id) : undefined;

    if (att_id && mobile && mql.matches) {
      BzDeck.router.navigate(`/attachment/${att_id}`);
    }
  });

  this.$$listbox.bind('dblclick', event => {
    let $selected = this.$$listbox.view.selected[0],
        att_id = $selected ? Number($selected.dataset.id) : undefined;

    if (att_id) {
      BzDeck.router.navigate(`/attachment/${att_id}`);
    }
  });

  this.$$listbox.bind('Selected', event => {
    if (!event.detail.items[0] || (mobile && mql.matches)) {
      return;
    }

    let attachment = this.attachments.find(att => att.id === Number(event.detail.items[0].dataset.id));

    new this.widgets.ScrollBar(this.$container.querySelector('.content'));
    new BzDeck.views.Attachment(attachment, this.$container.querySelector('.content .scrollable-area-content'));

    this.trigger('BugView:AttachmentSelected', { attachment });
  });

  this.$obsolete_checkbox.setAttribute('aria-hidden', ![for (a of this.attachments) if (a.is_obsolete) a].length);
  this.$$obsolete_checkbox = new this.widgets.Checkbox(this.$obsolete_checkbox);

  this.$$obsolete_checkbox.bind('Toggled', event => {
    let checked = event.detail.checked;

    for (let $att of this.$listbox.querySelectorAll('[role="option"]')) {
      $att.setAttribute('aria-disabled', checked ? 'false' : $att.properties.is_obsolete[0].itemValue);
    }

    this.$$listbox.update_members();
  });

  this.check_state();
  window.addEventListener('popstate', event => this.check_state());
};

BzDeck.views.BugAttachments.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugAttachments.prototype.constructor = BzDeck.views.BugAttachments;

BzDeck.views.BugAttachments.prototype.render = function (attachments) {
  let $fragment = new DocumentFragment(),
      $listitem = this.get_template('details-attachment-listitem');

  for (let att of attachments) {
    this.attachments.push(att);

    this.fill($fragment.appendChild($listitem.cloneNode(true)), {
      id: att.id,
      description: att.summary,
      dateModified: att.last_change_time,
      creator: BzDeck.collections.users.get(att.creator, { name: att.creator }).properties,
      encodingFormat: att.is_patch ? 'text/x-patch' : att.content_type, // l10n
      is_obsolete: att.is_obsolete ? 'true' : 'false',
    }, {
      id: `bug-${att.bug_id}-attachment-${att.id}`,
      'aria-disabled': !!att.is_obsolete,
      'data-id': att.id,
      'data-obsolete': att.is_obsolete ? 'true' : 'false',
    });
  }

  let len = this.attachments.length;

  this.$title.textContent = len === 1 ? `${len} attachment` : `${len} attachments`; // l10n
  this.$listbox.appendChild($fragment);
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
};

BzDeck.views.BugAttachments.prototype.check_state = function () {
  let target_id = history.state ? history.state.attachment_id : undefined,
      $target = target_id ? this.$listbox.querySelector(`[id$='attachment-${target_id}']`) : undefined;

  if ($target && !this.helpers.env.device.mobile && !window.matchMedia('(max-width: 1023px)').matches &&
      location.pathname === `/bug/${this.bug.id}`) {
    // If an attachment ID is specified in the history state, show the attachment
    if ($target.matches('[data-obsolete="true"]')) {
      this.$obsolete_checkbox.click();
    }

    this.$$listbox.view.selected = this.$$listbox.view.focused = $target;
  }
};
