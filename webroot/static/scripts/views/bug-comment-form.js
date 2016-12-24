/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Comment Form View that represents a comment form and quick edit UI under/above the bug timeline.
 * @extends BzDeck.BaseView
 */
BzDeck.BugCommentFormView = class BugCommentFormView extends BzDeck.BaseView {
  /**
   * Get a BugCommentFormView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Object} bug - BugModel instance.
   * @param {HTMLElement} $bug - Bug container element.
   * @fires BugView#Submit
   * @returns {BugCommentFormView} New BugCommentFormView instance.
   */
  constructor (id, bug, $bug) {
    super(id); // Assign this.id

    this.bug = bug;
    this.$bug = $bug;

    this.$form = this.get_template('bug-comment-form', `${this.bug.id}-${this.id}`);
    this.$tabpanel = this.$form.querySelector('[role="tabpanel"]');
    this.$formatting_toolbar = this.$form.querySelector('.text-formatting-toolbar');
    this.$textbox = this.$form.querySelector('[id$="tabpanel-comment"] [role="textbox"]');
    this.$tablist = this.$form.querySelector('[role="tablist"]');
    this.$$tablist = new FlareTail.widgets.TabList(this.$tablist);
    this.$comment_tab = this.$form.querySelector('[id$="tab-comment"]');
    this.$preview_tab = this.$form.querySelector('[id$="tab-preview"]');
    this.$attachments_tab = this.$form.querySelector('[id$="tab-attachments"]');
    this.$preview = this.$form.querySelector('[id$="tabpanel-preview"] [itemprop="text"]');
    this.$status = this.$form.querySelector('[role="status"]');
    this.$attach_button = this.$form.querySelector('[data-command="attach"]');
    this.$file_picker = this.$form.querySelector('input[type="file"]');
    this.$attachments_table = this.$form.querySelector('[id$="tabpanel-attachments"] table');
    this.$attachments_tbody = this.$attachments_table.querySelector('tbody');
    this.$submit = this.$form.querySelector('[data-command="submit"]');

    const click_event_type = FlareTail.env.device.mobile ? 'touchstart' : 'mousedown';

    for (const $tabpanel of this.$form.querySelectorAll('[role="tabpanel"]')) {
      new FlareTail.widgets.ScrollBar($tabpanel);
    }

    // Activate Markdown Editor for Bugzilla 5.0+
    if (BzDeck.host.markdown_supported) {
      new BzDeck.MarkdownEditor(this.id, this.$form);
    } else {
      this.$formatting_toolbar.setAttribute('aria-hidden', 'true');
    }

    this.$form.addEventListener('wheel', event => event.stopPropagation());
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail.items[0]));
    this.$tablist.setAttribute('aria-level', this.id.startsWith('details-bug-') ? 3 : 2);

    new FlareTail.widgets.Button(this.$submit);
    this.$submit.addEventListener(click_event_type, event => this.trigger('BugView#Submit'));

    this.init_comment_tabpanel();
    this.init_attachment_tabpanel();

    // Prepare the content available only to the users who have the "editbugs" permission on Bugzilla
    if (!this.editor_tabpanels_enabled && BzDeck.account.permissions.includes('editbugs')) {
      this.init_needinfo_tabpanel();
      this.editor_tabpanels_enabled = true;
    }

    // Render
    this.$bug.querySelector('.bug-timeline-wrapper').appendChild(this.$form);

    // Attachments
    this.subscribe('BugModel#AttachmentAdded', true);
    this.subscribe('BugModel#AttachmentRemoved', true);
    this.subscribe('BugModel#AttachmentEdited', true);
    this.subscribe('BugModel#AttachmentError', true);
    this.subscribe('BugModel#UploadListUpdated', true);

    // Other changes
    this.subscribe('BugModel#BugEdited', true);
    this.subscribe('BugModel#CommentEdited', true);

    // Form submission
    this.subscribe('BugModel#Submit', true);
    this.subscribe('BugModel#SubmitProgress', true);
    this.subscribe('BugModel#SubmitSuccess', true);
    this.subscribe('BugModel#SubmitError', true);
    this.subscribe('BugModel#SubmitComplete', true);
  }

  /**
   * Called by the tablist-role element whenever one of the tabs on the form is selected. Perform an action depending on
   * the newly selected tab.
   * @param {HTMLElement} $tab - Selected tab node.
   */
  on_tab_selected ($tab) {
    if (BzDeck.host.markdown_supported) {
      this.$formatting_toolbar.setAttribute('aria-hidden', !$tab.id.endsWith('comment'));
    }

    if ($tab.id.endsWith('preview')) {
      // Render the new comment for preview
      this.$preview.innerHTML = BzDeck.presenters.global.parse_comment(this.$textbox.value, BzDeck.host.markdown_supported);
    }
  }

  /**
   * Prepare the content on the Comment tabpanel.
   * @fires BugView#Submit
   */
  init_comment_tabpanel () {
    // Fill in an auto-saved draft comment if any, or workaround a Firefox bug where the placeholder is not displayed in
    // some cases
    this.$textbox.value = sessionStorage.getItem(`bug-${this.bug.id}-comment`) || '';

    // Show the browser's native context menu to allow using the spellchecker
    this.$textbox.addEventListener('contextmenu', event => event.stopPropagation());

    // Prevent the keyboard shortcuts on the timeline from being fired
    this.$textbox.addEventListener('keydown', event => event.stopPropagation(), true);

    this.$textbox.addEventListener('input', event => this.oninput());
    FlareTail.util.Keybind.assign(this.$textbox, { 'Accel+Enter': event => this.trigger('BugView#Submit') });
  }

  /**
   * Prepare the content on the Attachment tabpanel.
   */
  init_attachment_tabpanel () {
    const can_choose_dir = this.$file_picker.isFilesAndDirectoriesSupported === false;

    new FlareTail.widgets.Button(this.$attach_button);

    if (can_choose_dir) {
      this.$attach_button.title = 'Add attachments... (Shift+Click to choose directory)'; // l10n
    }

    // Attach files using a file picker
    // The event here should be click; others including touchstart and mousedown don't work
    this.$attach_button.addEventListener('click', event => {
      can_choose_dir && event.shiftKey ? this.$file_picker.chooseDirectory() : this.$file_picker.click();
    });

    // Notify BugView once files are selected
    this.$file_picker.addEventListener('change', event => {
      this.$bug.dispatchEvent(new CustomEvent('FilesSelected', { detail: { input: event.target }}));
    });
  }

  /**
   * Prepare the content on the NeedInfo tabpanel.
   * @fires BugView#EditFlag
   */
  init_needinfo_tabpanel () {
    const flags = this.bug.flags ? this.bug.flags.filter(flag => flag.name === 'needinfo') : [];
    const names = flags.map(flag => flag.requestee);
    const self_assigned = this.bug.creator === this.bug.assigned_to;
    const $tab = this.$form.querySelector('[id$="tab-needinfo"]');
    const $tabpanel = this.$form.querySelector('[id$="tabpanel-needinfo"]');
    const $finder_outer = $tabpanel.querySelector('.requestee-finder-outer');
    const $$finder = new BzDeck.PersonFinderView(this.id, `bug-${this.bug.id}-${this.id}-person-finder`, this.bug,
                                                 new Set([this.bug.creator, this.bug.assigned_to]));
    const $finder = $$finder.$combobox;

    const add_row = (requestee, checked, { id, label } = {}) => {
      const type = id ? 'clear' : 'request';
      const flag = id ? { id, status: 'X' } : { new: true, name: 'needinfo', status: '?', requestee };
      const $row = this.get_template(`bug-comment-form-${type}-needinfo-row`);
      const $checkbox = $row.querySelector('[role="checkbox"]');
      const $$checkbox = new FlareTail.widgets.CheckBox($checkbox);
      const $label = $checkbox.querySelector('label span');

      (async () => {
        const _requestee = await BzDeck.collections.users.get(requestee, { name: requestee });
        const $person = this.fill(this.get_template('person-with-image'), _requestee.properties);

        $row.querySelector('label').replaceChild($person, $row.querySelector('label strong'));
      })();

      $$checkbox.bind('Toggled', event => this.trigger('BugView#EditFlag', { flag, added: event.detail.checked }));
      $$checkbox.checked = checked;

      if ($label && label) {
        $label.textContent = label;
      }

      $finder_outer.insertAdjacentElement('beforebegin', $row);
    };

    // Remove the rows first if any
    for (const $element of $tabpanel.querySelectorAll('[class$="row"]')) {
      $element.remove();
    }

    for (const { id, requestee } of flags) {
      add_row(requestee, requestee === BzDeck.account.data.name, { id });
    }

    if (!names.includes(this.bug.creator)) {
      add_row(this.bug.creator, false, { label: self_assigned ? '(reporter/assignee)' : '(reporter)' });
    }

    if (!names.includes(this.bug.assigned_to) && !self_assigned &&
        !this.bug.assigned_to.startsWith('nobody@')) { // Is this BMO-specific?
      add_row(this.bug.assigned_to, false, { label: '(assignee)' });
    }

    $finder_outer.appendChild($finder);
    $finder.addEventListener('Change', event => {
      const requestee = event.detail.$target.dataset.value;

      add_row(requestee, true);
      $$finder.exclude.add(requestee);
      $$finder.clear();
    });

    $tab.setAttribute('aria-hidden', 'false');
  }

  /**
   * Called by the textbox element whenever the new comment is edited by the user.
   * @fires BugView#EditComment
   */
  oninput () {
    const text = this.$textbox.value;
    const storage_key = `bug-${this.bug.id}-comment`;

    this.$textbox.style.removeProperty('height');
    this.$textbox.style.setProperty('height', `${this.$textbox.scrollHeight}px`);

    if (this.$status.textContent) {
      this.$status.textContent = '';
    }

    this.trigger('BugView#EditComment', { text });

    // Auto-save the comment in the session storage
    if (text.match(/\S/)) {
      sessionStorage.setItem(storage_key, text);
    } else {
      sessionStorage.removeItem(storage_key);
    }
  }

  /**
   * Called whenever a new attachment is added by the user. Update the attachment list UI accordingly.
   * @listens BugModel#AttachmentAdded
   * @param {Number} bug_id - Corresponding bug ID.
   * @param {Number} id - Added attachment's ID.
   * @fires AnyView#OpeningAttachmentRequested
   * @fires AnyView#OpeningBugRequested
   * @fires BugView#RemoveAttachment
   * @fires BugView#MoveUpAttachment
   * @fires BugView#MoveDownAttachment
   */
  async on_attachment_added ({ bug_id, id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    const attachment = await BzDeck.collections.attachments.get(id);
    const hash = attachment.hash;
    const mobile = FlareTail.env.device.mobile;
    const click_event_type = mobile ? 'touchstart' : 'mousedown';
    const mql = window.matchMedia('(max-width: 1023px)');
    const $tbody = this.$attachments_tbody;
    const $row = this.get_template('bug-comment-form-attachments-row');

    $row.dataset.hash = hash;
    $row.querySelector('[itemprop="summary"]').textContent = attachment.summary;
    $row.querySelectorAll('[role="button"]').forEach($button => new FlareTail.widgets.Button($button));

    $row.querySelector('[data-command="edit"]').addEventListener(click_event_type, event => {
      if (!this.id.startsWith('details-bug-') || mobile && mql.matches) {
        this.trigger('AnyView#OpeningAttachmentRequested', { id: hash });
      } else {
        this.trigger('AnyView#OpeningBugRequested', { id: this.bug.id, att_id: hash.substr(0, 7) });
      }
    });

    $row.querySelector('[data-command="remove"]').addEventListener(click_event_type, event => {
      this.trigger('BugView#RemoveAttachment', { hash });
    });

    $row.querySelector('[data-command="move-up"]').addEventListener(click_event_type, event => {
      $tbody.insertBefore($row.previousElementSibling, $row.nextElementSibling);
      this.trigger('BugView#MoveUpAttachment', { hash });
    });

    $row.querySelector('[data-command="move-down"]').addEventListener(click_event_type, event => {
      $tbody.insertBefore($row.nextElementSibling, $row);
      this.trigger('BugView#MoveDownAttachment', { hash });
    });

    $tbody.appendChild($row);
  }

  /**
   * Called whenever a new attachment is removed by the user. Update the attachment list UI accordingly.
   * @listens BugModel#AttachmentRemoved
   * @param {Number} bug_id - Changed bug ID.
   * @param {Number} index - Removed attachment's index in the cached list.
   */
  on_attachment_removed ({ bug_id, index } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$attachments_tbody.rows[index].remove();
  }

  /**
   * Called whenever a new attachment is edited by the user. Update the attachment list UI accordingly.
   * @listens BugModel#AttachmentEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} hash - Attachment hash for unuploaded attachment.
   * @param {String} prop - Changed property name.
   * @param {*} value - New property value.
   */
  on_attachment_edited ({ bug_id, hash, prop, value } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    if (hash && prop === 'summary') {
      this.$attachments_tbody.querySelector(`[data-hash="${hash}"] [itemprop="summary"]`).textContent = value;
    }
  }

  /**
   * Called whenever a new attachment is added or removed by the user. If there is any unuploaded attachment, select the
   * Attachments tab. Otherwise, select the Comment tab and disable the Attachments tab.
   * @listens BugModel#UploadListUpdated
   * @param {Number} bug_id - Changed bug ID.
   * @param {Array.<Proxy>} uploads - List of the new attachments in Array-like Object.
   */
  on_upload_list_updated ({ bug_id, uploads } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    const len = uploads.length;

    this.$attachments_tab.setAttribute('aria-disabled', !len);
    this.$$tablist.view.selected = len ? this.$attachments_tab : this.$comment_tab;
  }

  /**
   * Called whenever a new attachment added by the user has an error, such as an oversized file. Show an alert dialog to
   * notify the user of the error.
   * @listens BugModel#AttachmentError
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} message - Explanation of the detected error.
   */
  on_attachment_error ({ bug_id, message } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    new FlareTail.widgets.Dialog({
      type: 'alert',
      title: 'Error on attaching files', // l10n
      message: message.replace('\n', '<br>'),
    }).show();
  }

  /**
   * Called whenever the a comment text is added or removed by the user. If the comment form is empty, disable the
   * Preview tab.
   * @listens BugModel#CommentEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Boolean} has_comment - Whether the comment is empty.
   */
  on_comment_edited ({ bug_id, has_comment } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$preview_tab.setAttribute('aria-disabled', !has_comment);
  }

  /**
   * Called whenever any of the fields, comments or attachments are edited by the user. If there is any change, enable
   * the Submit button. Otherwise, disable it.
   * @listens BugModel#BugEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Boolean} can_submit - Whether the changes can be submitted immediately.
   */
  on_bug_edited ({ bug_id, can_submit } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$submit.setAttribute('aria-disabled', !can_submit);
  }

  /**
   * Called whenever the changes are about to be submitted to Bugzilla. Disable the comment form and Submit button and
   * update the statusbar message.
   * @listens BugModel#Submit
   * @param {Number} bug_id - Changed bug ID.
   */
  on_submit ({ bug_id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$textbox.setAttribute('aria-readonly', 'true');
    this.$submit.setAttribute('aria-disabled', 'true');
    this.$status.textContent = 'Submitting...';
  }

  /**
   * Called whenever the upload of a new attachment is in progress. Show the current status on the statusbar.
   * @listens BugModel#SubmitProgress
   * @param {Number} bug_id - Changed bug ID.
   * @param {Number} total - Total size of attachments.
   * @param {Number} uploaded - Uploaded size of attachments.
   * @param {Number} percentage - Uploaded percentage.
   * @todo Use a progressbar (#159)
   */
  on_submit_progress ({ bug_id, total, uploaded, percentage } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$status.textContent = `${percentage}% uploaded`;
  }

  /**
   * Called whenever all the changes are submitted successfully. Reset the form content.
   * @listens BugModel#SubmitSuccess
   * @param {Number} bug_id - Changed bug ID.
   */
  on_submit_success ({ bug_id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$textbox.value = '';
    this.oninput();
  }

  /**
   * Called whenever any error is detected while submitting the changes. Show the error message on the statusbar.
   * @listens BugModel#SubmitError
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} error - Error message.
   * @param {Boolean} button_disabled - Whether the submit button should be disabled.
   */
  on_submit_error ({ bug_id, error, button_disabled } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$submit.setAttribute('aria-disabled', button_disabled);
    this.$status.textContent = error || 'There was an error while submitting your changes. Please try again.';
  }

  /**
   * Called once a submission is complete, regardless of errors. Enable and focus on the comment form.
   * @listens BugModel#SubmitComplete
   * @param {Number} bug_id - Changed bug ID.
   */
  on_submit_complete ({ bug_id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    // The textbox should be focused anyway
    this.$textbox.setAttribute('aria-readonly', 'false');
    this.$textbox.focus();
  }
}
