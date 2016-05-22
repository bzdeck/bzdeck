/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Attachments View that represents the Attachment tabpanel content within a Bug Details tabpanel.
 * @extends BzDeck.BaseView
 */
BzDeck.BugAttachmentsView = class BugAttachmentsView extends BzDeck.BaseView {
  /**
   * Get a BugAttachmentsView instance.
   * @constructor
   * @param {String} view_id - Instance identifier. It should be the same as the BugPresenter instance, otherwise the
   *  relevant notification events won't work.
   * @param {Number} bug_id - Corresponding bug ID.
   * @param {HTMLElement} $container - Container node to render the attachments.
   * @returns {Object} view - New BugAttachmentsView instance.
   * @fires BugView#AttachmentSelected
   */
  constructor (view_id, bug_id, $container) {
    super(); // This does nothing but is required before using `this`

    let mobile = this.helpers.env.device.mobile;
    let mql = window.matchMedia('(max-width: 1023px)');

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
    this.$$listbox.bind('click', event => this.listbox_onclick(event));
    this.$$listbox.bind('dblclick', event => this.listbox_onclick(event));

    this.$$listbox.bind('Selected', event => {
      let $target = event.detail.items[0];

      if (!$target || mobile && mql.matches) {
        return;
      }

      let attachment = this.attachments.get($target.dataset.hash || Number($target.dataset.id));
      let $attachment = this.$container.querySelector('.content');

      new this.widgets.ScrollBar($attachment);
      new BzDeck.AttachmentView(attachment, $attachment);

      this.trigger_safe('BugView#AttachmentSelected', { attachment });
    });

    this.$$obsolete_checkbox = new this.widgets.CheckBox(this.$obsolete_checkbox);

    this.$$obsolete_checkbox.bind('Toggled', event => {
      let checked = event.detail.checked;

      for (let $att of this.$listbox.querySelectorAll('[role="option"]')) {
        $att.setAttribute('aria-hidden', checked ? 'false' : $att.querySelector('[itemprop="is_obsolete"]').content);
      }

      this.$$listbox.update_members();
    });

    this.init_uploader();

    this.subscribe_safe('BugModel#AttachmentAdded', true);
    this.subscribe('BugModel#AttachmentRemoved', true);
    this.subscribe('BugModel#AttachmentEdited', true);
    this.subscribe_safe('BugModel#UploadListUpdated', true);
    this.subscribe('BugPresenter#HistoryUpdated');
  }

  /**
   * Render the provided attachments.
   * @param {Array.<Proxy>} attachments - Attachment list of the bug.
   * @returns {undefined}
   */
  render (attachments) {
    let $fragment = new DocumentFragment();
    let $listitem = this.get_template('details-attachment-listitem');

    attachments.reverse(); // The newest attachment should be on the top of the list

    Promise.all(attachments.map(att => {
      return BzDeck.collections.users.get(att.creator, { name: att.creator });
    })).then(creators => attachments.forEach((att, index) => {
      this.attachments.set(att.id || att.hash, att);

      this.fill($fragment.appendChild($listitem.cloneNode(true)), {
        id: att.hash ? att.hash.substr(0, 7) : att.id,
        summary: att.summary,
        last_change_time: att.last_change_time,
        creator: creators[index].properties,
        content_type: att.content_type,
        is_patch: !!att.is_patch,
        is_obsolete: !!att.is_obsolete,
        is_unuploaded: !!att.is_unuploaded,
      }, {
        id: `bug-${this.bug_id}-attachment-${att.hash ? att.hash.substr(0, 7) : att.id}`,
        'aria-hidden': !!att.is_obsolete,
        'data-id': att.id,
        'data-hash': att.hash,
      });
    })).then(() => {
      let has_obsolete = [...this.attachments.values()].some(a => !!a.is_obsolete);

      this.update_list_title();
      this.$obsolete_checkbox.setAttribute('aria-hidden', !has_obsolete);
      this.$listbox.insertBefore($fragment, this.$listbox.firstElementChild);
      this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
      this.$$listbox.update_members();
    });
  }

  /**
   * Called whenever the attachment list is clicked.
   * @param {MouseEvent} event - click or dblclick.
   * @returns {undefined}
   * @fires GlobalView#OpenAttachment
   */
  listbox_onclick (event) {
    let $selected = this.$$listbox.view.selected[0];
    let id = $selected ? $selected.dataset.hash || Number($selected.dataset.id) : undefined;
    let mobile = this.helpers.env.device.mobile;
    let narrow = window.matchMedia('(max-width: 1023px)').matches;

    if (id && ((event.type === 'click' && mobile && narrow) || event.type === 'dblclick')) {
      this.trigger('GlobalView#OpenAttachment', { id });
    }
  }

  /**
   * Initialize the attachment uploading interface. This offers Add/Remove buttons as well as the drag-and-drop support.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugView#FilesSelected
   * @fires BugView#AttachText
   * @fires BugView#RemoveAttachment
   */
  init_uploader () {
    this.$drop_target = this.$container.querySelector('[aria-dropeffect]');
    this.$add_button = this.$container.querySelector('[data-command="add-attachment"]');
    this.$remove_button = this.$container.querySelector('[data-command="remove-attachment"]');
    this.$file_picker = this.$container.querySelector('input[type="file"]');

    this.$drop_target.addEventListener('dragover', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'copy');
      event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed = 'copy';
      event.preventDefault();
    });

    this.$drop_target.addEventListener('dragleave', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });

    this.$drop_target.addEventListener('drop', event => {
      let dt = event.dataTransfer;

      if (dt.types.contains('Files')) {
        this.trigger_safe('BugView#FilesSelected', { input: dt });
      } else if (dt.types.contains('text/plain')) {
        this.trigger('BugView#AttachText', { text: dt.getData('text/plain') });
      }

      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });

    this.$$listbox.bind('Selected', event => {
      let $selected = this.$$listbox.view.selected[0];
      let hash = $selected ? $selected.dataset.hash : undefined;

      this.$remove_button.setAttribute('aria-disabled', !hash);
    });

    this.$$listbox.assign_key_bindings({
      'Backspace': event => {
        let $selected = this.$$listbox.view.selected[0];
        let hash = $selected ? $selected.dataset.hash : undefined;

        if (hash) {
          this.trigger('BugView#RemoveAttachment', { hash });
          this.$remove_button.setAttribute('aria-disabled', 'true');
        }
      },
    });

    let can_choose_dir = this.$file_picker.isFilesAndDirectoriesSupported === false;

    if (can_choose_dir) {
      this.$add_button.title = 'Add attachments... (Shift+Click to choose directory)'; // l10n
    }

    this.$add_button.addEventListener('click', event => {
      can_choose_dir && event.shiftKey ? this.$file_picker.chooseDirectory() : this.$file_picker.click();
    });

    this.$remove_button.addEventListener('mousedown', event => {
      this.trigger('BugView#RemoveAttachment', { hash: this.$$listbox.view.selected[0].dataset.hash });
      this.$remove_button.setAttribute('aria-disabled', 'true');
    });

    this.$file_picker.addEventListener('change', event => {
      this.trigger_safe('BugView#FilesSelected', { input: event.target });
    });
  }

  /**
   * Called whenever a new attachment is added by the user. Add the item to the listbox.
   * @listens BugModel#AttachmentAdded
   * @param {Number} bug_id - Changed bug ID.
   * @param {Proxy} attachment - Added attachment data as AttachmentModel instance.
   * @returns {undefined}
   */
  on_attachment_added ({ bug_id, attachment } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    this.attachments.set(attachment.hash, attachment);
    this.render([attachment]);
  }

  /**
   * Called whenever a new attachment is removed by the user. Remove the item from the listbox.
   * @listens BugModel#AttachmentRemoved
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} hash - Removed attachment's hash value in the cached list.
   * @returns {undefined}
   */
  on_attachment_removed ({ bug_id, hash } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    this.attachments.delete(hash);
    this.$listbox.querySelector(`[data-hash='${hash}']`).remove();
    this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
    this.$$listbox.update_members();
  }

  /**
   * Called whenever a new attachment is edited by the user. Update the item on the listbox.
   * @listens BugModel#AttachmentEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Number} id - Numeric ID for an existing attachment or undefined for an unuploaded one.
   * @param {String} hash - Hash value for an unuploaded attachment or undefined for an existing one.
   * @param {String} prop - Edited property name.
   * @param {*} value - New value.
   * @returns {undefined}
   */
  on_attachment_edited ({ bug_id, id, hash, prop, value } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    let $item = this.$listbox.querySelector(`[data-${hash ? 'hash' : 'id'}='${hash || id}']`);

    if (['summary', 'content_type'].includes(prop)) {
      $item.querySelector(`[itemprop="${prop}"]`).textContent = value;
    }

    if (['is_patch', 'is_obsolete'].includes(prop)) {
      $item.querySelector(`[itemprop="${prop}"]`).content = value;
    }
  }

  /**
   * Called whenever a new attachment is added or removed by the user. Update the list header title.
   * @listens BugModel#UploadListUpdated
   * @param {Number} bug_id - Changed bug ID.
   * @param {Array.<Proxy>} uploads - List of the new attachments in Array-like object.
   * @returns {undefined}
   */
  on_upload_list_updated ({ bug_id, uploads } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    this.update_list_title();
  }

  /**
   * Update the list header title, showing the number of the attachments including unuploaded ones.
   * @param {undefined}
   * @returns {undefined}
   */
  update_list_title () {
    let total = this.attachments.size;
    let uploads = [...this.attachments.values()].filter(att => att.is_unuploaded).length;
    let text = total === 1 ? '1 attachment' : `${total} attachments`; // l10n

    if (uploads > 0) {
      text += ' ' + `(${uploads} unuploaded)`; // l10n
    }

    this.$title.textContent = text;
  }

  /**
   * Called whenever the navigation history state is updated. If a valid attachment ID is specified, select that item on
   * the listbox.
   * @listens BugPresenter#HistoryUpdated
   * @param {Object} [state] - Current history state.
   * @param {String} [state.att_id] - Attachment ID or hash.
   * @returns {undefined}
   */
  on_history_updated ({ state } = {}) {
    let target_id = state ? state.att_id : undefined;
    let $target = target_id ? this.$listbox.querySelector(`[id$='attachment-${target_id}']`) : undefined;

    if ($target && !this.helpers.env.device.mobile && !window.matchMedia('(max-width: 1023px)').matches) {
      if ($target.matches('[data-obsolete="true"]') && !this.$$obsolete_checkbox.checked) {
        this.$obsolete_checkbox.click();
      }

      this.$$listbox.view.selected = this.$$listbox.view.focused = $target;
    }
  }
}
