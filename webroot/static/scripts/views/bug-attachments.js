/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Bug Attachments View.
 *
 * [argument] view_id (String) instance ID. It should be the same as the BugController instance, otherwise the related
 *                            notification events won't work
 * [argument] bug_id (Integer) corresponding bug ID
 * [argument] $container (Element) container node to render the attachments
 * [return] view (Object) BugAttachmentsView instance, when called with `new`
 */
BzDeck.views.BugAttachments = function BugAttachmentsView (view_id, bug_id, $container) {
  let mobile = this.helpers.env.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)');

  this.id = view_id;
  this.bug_id = bug_id;
  this.attachments = new Map();

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
        att_id = $selected ? $selected.dataset.hash || Number($selected.dataset.id) : undefined;

    if (att_id && mobile && mql.matches) {
      BzDeck.router.navigate(`/attachment/${att_id}`);
    }
  });

  this.$$listbox.bind('dblclick', event => {
    let $selected = this.$$listbox.view.selected[0],
        att_id = $selected ? $selected.dataset.hash || Number($selected.dataset.id) : undefined;

    if (att_id) {
      BzDeck.router.navigate(`/attachment/${att_id}`);
    }
  });

  this.$$listbox.bind('Selected', event => {
    let $target = event.detail.items[0];

    if (!$target || mobile && mql.matches) {
      return;
    }

    let attachment = this.attachments.get($target.dataset.hash || Number($target.dataset.id));

    new this.widgets.ScrollBar(this.$container.querySelector('.content'));
    new BzDeck.views.Attachment(attachment, this.$container.querySelector('.content .scrollable-area-content'));

    this.trigger('BugView:AttachmentSelected', { attachment });
  });

  this.$$obsolete_checkbox = new this.widgets.Checkbox(this.$obsolete_checkbox);

  this.$$obsolete_checkbox.bind('Toggled', event => {
    let checked = event.detail.checked;

    for (let $att of this.$listbox.querySelectorAll('[role="option"]')) {
      $att.setAttribute('aria-hidden', checked ? 'false' : $att.properties.is_obsolete[0].itemValue);
    }

    this.$$listbox.update_members();
  });

  this.check_state();
  window.addEventListener('popstate', event => this.check_state());

  this.on('BugController:AttachmentAdded', data => this.on_attachment_added(data.attachment));
  this.on('BugController:AttachmentRemoved', data => this.on_attachment_removed(data.hash));
  this.on('BugController:UploadListUpdated', data => this.on_upload_list_updated(data.uploads));
};

BzDeck.views.BugAttachments.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugAttachments.prototype.constructor = BzDeck.views.BugAttachments;

/*
 * Render the provided attachments.
 *
 * [argument] attachments (Array(Proxy)) attachment list
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.render = function (attachments) {
  let $fragment = new DocumentFragment(),
      $listitem = this.get_template('details-attachment-listitem');

  for (let att of attachments.reverse()) { // The newest attachment should be on the top of the list
    this.attachments.set(att.id || att.hash, att);

    this.fill($fragment.appendChild($listitem.cloneNode(true)), {
      id: att.hash ? att.hash.substr(0, 7) : att.id,
      description: att.summary,
      dateModified: att.last_change_time,
      creator: BzDeck.collections.users.get(att.creator, { name: att.creator }).properties,
      encodingFormat: att.is_patch ? 'text/x-patch' : att.content_type, // l10n
      is_obsolete: !!att.is_obsolete,
      is_unuploaded: !!att.is_unuploaded,
    }, {
      id: `bug-${this.bug_id}-attachment-${att.hash ? att.hash.substr(0, 7) : att.id}`,
      'aria-hidden': !!att.is_obsolete,
      'data-id': att.id,
      'data-hash': att.hash,
    });
  }

  let has_obsolete = !![for (a of this.attachments.values()) if (!!a.is_obsolete) a].length;

  this.update_list_title();
  this.$obsolete_checkbox.setAttribute('aria-hidden', !has_obsolete);
  this.$listbox.insertBefore($fragment, this.$listbox.firstElementChild);
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
};

/*
 * Check for the history state and show an attachment if the attachment ID is specified.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.check_state = function () {
  let target_id = history.state ? history.state.att_id : undefined,
      $target = target_id ? this.$listbox.querySelector(`[id$='attachment-${target_id}']`) : undefined;

  if ($target && !this.helpers.env.device.mobile && !window.matchMedia('(max-width: 1023px)').matches &&
      location.pathname === `/bug/${this.bug_id}`) {
    if ($target.matches('[data-obsolete="true"]') && !this.$$obsolete_checkbox.checked) {
      this.$obsolete_checkbox.click();
    }

    this.$$listbox.view.selected = this.$$listbox.view.focused = $target;
  }
};

/*
 * Called by BugController whenever a new attachment is added by the user.
 *
 * [argument] attachment (Proxy) added attachment data as AttachmentModel instance
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.on_attachment_added = function (attachment) {
  this.attachments.set(attachment.hash, attachment);
  this.render([attachment]);
};

/*
 * Called by BugController whenever a new attachment is removed by the user.
 *
 * [argument] hash (String) removed attachment's hash value in the cached list
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.on_attachment_removed = function (hash) {
  this.attachments.delete(hash);
  this.$listbox.querySelector(`[data-hash='${hash}']`).remove();
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
};

/*
 * Called by BugController whenever a new attachment is added or removed by the user.
 *
 * [argument] uploads (extended Array(Proxy)) list of the new attachments
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.on_upload_list_updated = function (uploads) {
  this.update_list_title();
};

/*
 * Update the list header title, showing the number of the attachments.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugAttachments.prototype.update_list_title = function () {
  let total = this.attachments.size,
      uploads = [for (att of this.attachments.values()) if (att.is_unuploaded) att].length,
      text = total === 1 ? '1 attachment' : `${total} attachments`; // l10n

  if (uploads > 0) {
    text += ' ' + `(${uploads} unuploaded)`; // l10n
  }

  this.$title.textContent = text;
};
