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
   * @param {String} view_id - Instance identifier. It should be the same as the BugController instance, otherwise the
   *  relevant notification events won't work.
   * @param {Object} bug - BugModel instance.
   * @param {HTMLElement} $bug - Bug container element.
   * @returns {Object} view - New BugCommentFormView instance.
   * @fires BugView:Submit
   * @listens BugController:AttachmentAdded
   * @listens BugController:AttachmentRemoved
   * @listens BugController:AttachmentEdited
   * @listens BugController:AttachmentError
   * @listens BugController:UploadListUpdated
   * @listens BugController:BugEdited
   * @listens BugController:CommentEdited
   * @listens BugController:Submit
   * @listens BugController:SubmitProgress
   * @listens BugController:SubmitSuccess
   * @listens BugController:SubmitError
   * @listens BugController:SubmitComplete
   */
  constructor (view_id, bug, $bug) {
    super(); // This does nothing but is required before using `this`

    this.id = view_id;
    this.bug = bug;
    this.$bug = $bug;

    this.$form = this.get_template('bug-comment-form', `${this.id}-comment-form`);
    this.$tabpanel = this.$form.querySelector('[role="tabpanel"]');
    this.$formatting_toolbar = this.$form.querySelector('.text-formatting-toolbar');
    this.$textbox = this.$form.querySelector('[id$="tabpanel-comment"] [role="textbox"]');
    this.$tablist = this.$form.querySelector('[role="tablist"]');
    this.$$tablist = new this.widgets.TabList(this.$tablist);
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

    let click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown';

    for (let $tabpanel of this.$form.querySelectorAll('[role="tabpanel"]')) {
      new this.widgets.ScrollBar($tabpanel);
    }

    // Activate Markdown Editor
    new BzDeck.MarkdownEditor(this.$form);

    this.$form.addEventListener('wheel', event => event.stopPropagation());
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail.items[0]));
    this.$tablist.setAttribute('aria-level', this.id.startsWith('details-bug-') ? 3 : 2);
    this.$submit.addEventListener(click_event_type, event => this.trigger('BugView:Submit'));

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
    this.subscribe('BugController:AttachmentAdded');
    this.subscribe('BugController:AttachmentRemoved');
    this.subscribe('BugController:AttachmentEdited');
    this.subscribe('BugController:AttachmentError');
    this.subscribe('BugController:UploadListUpdated');

    // Other changes
    this.subscribe('BugController:BugEdited');
    this.subscribe('BugController:CommentEdited');

    // Form submission
    this.subscribe('BugController:Submit');
    this.subscribe('BugController:SubmitProgress');
    this.subscribe('BugController:SubmitSuccess');
    this.subscribe('BugController:SubmitError');
    this.subscribe('BugController:SubmitComplete');
  }

  /**
   * Called by the tablist-role element whenever one of the tabs on the form is selected. Perform an action depending on
   * the newly selected tab.
   * @param {HTMLElement} $tab - Selected tab node.
   * @returns {undefined}
   */
  on_tab_selected ($tab) {
    this.$formatting_toolbar.setAttribute('aria-hidden', !$tab.id.endsWith('comment'));

    if ($tab.id.endsWith('preview')) {
      // Render the new comment for preview
      this.$preview.innerHTML = BzDeck.controllers.global.parse_comment(this.$textbox.value);
    }
  }

  /**
   * Prepare the content on the Comment tabpanel.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugView:Submit
   */
  init_comment_tabpanel () {
    // Fill in an auto-saved draft comment if any, or workaround a Firefox bug where the placeholder is not displayed in
    // some cases
    this.$textbox.value = sessionStorage.getItem(`bug-${this.bug.id}-comment`) || '';

    // Prevent the keyboard shortcuts on the timeline from being fired
    this.$textbox.addEventListener('keydown', event => event.stopPropagation(), true);

    this.$textbox.addEventListener('input', event => this.oninput());
    this.helpers.kbd.assign(this.$textbox, { 'Accel+Enter': event => this.trigger('BugView:Submit') });
  }

  /**
   * Prepare the content on the Attachment tabpanel.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugView:FilesSelected
   */
  init_attachment_tabpanel () {
    let can_choose_dir = this.$file_picker.isFilesAndDirectoriesSupported === false;

    if (can_choose_dir) {
      this.$attach_button.title = 'Add attachments... (Shift+Click to choose directory)'; // l10n
    }

    // Attach files using a file picker
    // The event here should be click; others including touchstart and mousedown don't work
    this.$attach_button.addEventListener('click', event => {
      can_choose_dir && event.shiftKey ? this.$file_picker.chooseDirectory() : this.$file_picker.click();
    });

    this.$file_picker.addEventListener('change', event => {
      this.trigger('BugView:FilesSelected', { input: event.target });
    });
  }

  /**
   * Prepare the content on the NeedInfo tabpanel.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugView:EditFlag
   */
  init_needinfo_tabpanel () {
    let flags = this.bug.flags ? this.bug.flags.filter(flag => flag.name === 'needinfo') : [];
    let names = flags.map(flag => flag.requestee);
    let self_assigned = this.bug.creator === this.bug.assigned_to;
    let $tab = this.$form.querySelector('[id$="tab-needinfo"]');
    let $tabpanel = this.$form.querySelector('[id$="tabpanel-needinfo"]');
    let $finder_outer = $tabpanel.querySelector('.requestee-finder-outer');
    let $$finder = new BzDeck.PersonFinderView(`${this.id}-person-finder`, this.bug,
                                               new Set([this.bug.creator, this.bug.assigned_to]));
    let $finder = $$finder.$combobox;

    let add_row = (requestee, checked, options = {}) => {
      let { id, label } = options;
      let type = id ? 'clear' : 'request';
      let flag = id ? { id, status: 'X' } : { new: true, name: 'needinfo', status: '?', requestee };
      let $row = this.get_template(`bug-comment-form-${type}-needinfo-row`);
      let $checkbox = $row.querySelector('[role="checkbox"]');
      let $$checkbox = new this.widgets.CheckBox($checkbox);
      let $label = $checkbox.querySelector('span');

      BzDeck.collections.users.get(requestee, { name: requestee }).then(_requestee => {
        return this.fill(this.get_template('person-with-image'), _requestee.properties);
      }).then($person => {
        $row.replaceChild($person, $row.querySelector('strong'));
      });

      $$checkbox.bind('Toggled', event => this.trigger('BugView:EditFlag', { flag, added: event.detail.checked }));
      $$checkbox.checked = checked;

      if ($label && label) {
        $label.textContent = label;
      }

      $finder_outer.parentElement.insertBefore($row, $finder_outer);
    };

    // Remove the rows first if any
    for (let $element of $tabpanel.querySelectorAll('[class$="row"]')) {
      $element.remove();
    }

    for (let { id, requestee } of flags) {
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
      let requestee = event.detail.$target.dataset.value;

      add_row(requestee, true);
      $$finder.exclude.add(requestee);
      $$finder.clear();
    });

    $tab.setAttribute('aria-hidden', 'false');
  }

  /**
   * Called by the textbox element whenever the new comment is edited by the user.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugView:EditComment
   */
  oninput () {
    let text = this.$textbox.value;
    let storage_key = `bug-${this.bug.id}-comment`;

    this.$textbox.style.removeProperty('height');
    this.$textbox.style.setProperty('height', `${this.$textbox.scrollHeight}px`);

    if (this.$status.textContent) {
      this.$status.textContent = '';
    }

    this.trigger('BugView:EditComment', { text });

    // Auto-save the comment in the session storage
    if (text.match(/\S/)) {
      sessionStorage.setItem(storage_key, text);
    } else {
      sessionStorage.removeItem(storage_key);
    }
  }

  /**
   * Called by BugController whenever a new attachment is added by the user. Update the attachment list UI accordingly.
   * @param {Object} data - Passed data.
   * @param {Proxy}  data.attachment - Added attachment data as an AttachmentModel instance.
   * @returns {undefined}
   * @fires GlobalView:OpenAttachment
   * @fires GlobalView:OpenBug
   * @fires BugView:RemoveAttachment
   * @fires BugView:MoveUpAttachment
   * @fires BugView:MoveDownAttachment
   */
  on_attachment_added (data) {
    let attachment = data.attachment;
    let hash = attachment.hash;
    let click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown';
    let mobile = this.helpers.env.device.mobile;
    let mql = window.matchMedia('(max-width: 1023px)');
    let $tbody = this.$attachments_tbody;
    let $row = this.get_template('bug-comment-form-attachments-row');

    $row.dataset.hash = hash;
    $row.querySelector('[itemprop="summary"]').textContent = attachment.summary;

    $row.querySelector('[data-command="edit"]').addEventListener(click_event_type, event => {
      if (!this.id.startsWith('details-bug-') || mobile && mql.matches) {
        this.trigger('GlobalView:OpenAttachment', { id: hash });
      } else {
        this.trigger('GlobalView:OpenBug', { id: this.bug.id, att_id: hash.substr(0, 7) });
      }
    });

    $row.querySelector('[data-command="remove"]').addEventListener(click_event_type, event => {
      this.trigger('BugView:RemoveAttachment', { hash });
    });

    $row.querySelector('[data-command="move-up"]').addEventListener(click_event_type, event => {
      $tbody.insertBefore($row.previousElementSibling, $row.nextElementSibling);
      this.trigger('BugView:MoveUpAttachment', { hash });
    });

    $row.querySelector('[data-command="move-down"]').addEventListener(click_event_type, event => {
      $tbody.insertBefore($row.nextElementSibling, $row);
      this.trigger('BugView:MoveDownAttachment', { hash });
    });

    $tbody.appendChild($row);
  }

  /**
   * Called by BugController whenever a new attachment is removed by the user. Update the attachment list UI
   * accordingly.
   * @param {Object} data - Passed data.
   * @param {Number} data.index - Removed attachment's index in the cached list.
   * @returns {undefined}
   */
  on_attachment_removed (data) {
    this.$attachments_tbody.rows[data.index].remove();
  }

  /**
   * Called by BugController whenever a new attachment is edited by the user. Update the attachment list UI accordingly.
   * @param {Object} data - Passed data.
   * @param {Object} data.change - Change details.
   * @param {String} data.change.hash - Attachment hash for unuploaded attachment.
   * @param {String} data.change.prop - Changed property name.
   * @param {*}      data.change.value - New property value.
   * @returns {undefined}
   */
  on_attachment_edited (data) {
    let { hash, prop, value } = data.change;

    if (hash && prop === 'summary') {
      this.$attachments_tbody.querySelector(`[data-hash="${hash}"] [itemprop="summary"]`).textContent = value;
    }
  }

  /**
   * Called by BugController whenever a new attachment is added or removed by the user. If there is any unuploaded
   * attachment, select the Attachments tab. Otherwise, select the Comment tab and disable the Attachments tab.
   * @param {Object} data - Passed data.
   * @param {Array.<Proxy>} data.uploads - List of the new attachments in Array-like Object.
   * @returns {undefined}
   */
  on_upload_list_updated (data) {
    let len = data.uploads.length;

    this.$attachments_tab.setAttribute('aria-disabled', !len);
    this.$$tablist.view.selected = len ? this.$attachments_tab : this.$comment_tab;
  }

  /**
   * Called by BugController whenever a new attachment added by the user has an error, such as an oversized file. Show
   * an alert dialog to notify the user of the error.
   * @param {Object} data - Passed data.
   * @param {String} data.message - Explanation of the detected error.
   * @returns {undefined}
   */
  on_attachment_error (data) {
    new this.widgets.Dialog({
      type: 'alert',
      title: 'Error on attaching files', // l10n
      message: data.message.replace('\n', '<br>'),
    }).show();
  }

  /**
   * Called by BugController whenever the a comment text is added or removed by the user. If the comment form is empty,
   * disable the Preview tab.
   * @param {Object} data - Passed data.
   * @param {Boolean} data.has_comment - Whether the comment is empty.
   * @returns {undefined}
   */
  on_comment_edited (data) {
    this.$preview_tab.setAttribute('aria-disabled', !data.has_comment);
  }

  /**
   * Called by BugController whenever any of the fields, comments or attachments are edited by the user. If there is
   * any change, enable the Submit button. Otherwise, disable it.
   * @param {Object} data - Passed data.
   * @param {Boolean} data.can_submit - Whether the changes can be submitted immediately.
   * @returns {undefined}
   */
  on_bug_edited (data) {
    this.$submit.setAttribute('aria-disabled', !data.can_submit);
  }

  /**
   * Called by BugController whenever the changes are about to be submitted to Bugzilla. Disable the comment form and
   * Submit button and update the statusbar message.
   * @param {undefined}
   * @returns {undefined}
   */
  on_submit () {
    this.$textbox.setAttribute('aria-readonly', 'true');
    this.$submit.setAttribute('aria-disabled', 'true');
    this.$status.textContent = 'Submitting...';
  }

  /**
   * Called by BugController whenever the upload of a new attachment is in progress. Show the current status on the
   * statusbar.
   * @param {object} data - Current uploading status.
   * @param {Number} data.total - Total size of attachments.
   * @param {Number} data.uploaded - Uploaded size of attachments.
   * @param {Number} data.percentage - Uploaded percentage.
   * @returns {undefined}
   * @todo Use a progressbar (#159)
   */
  on_submit_progress (data) {
    this.$status.textContent = `${data.percentage}% uploaded`;
  }

  /**
   * Called by BugController whenever all the changes are submitted successfully. Reset the form content.
   * @param {undefined}
   * @returns {undefined}
   */
  on_submit_success () {
    this.$textbox.value = '';
    this.oninput();
  }

  /**
   * Called by BugController whenever any error is detected while submitting the changes. Show the error message on the
   * statusbar.
   * @param {object} data - Error details.
   * @param {String} data.error - Error message.
   * @param {Boolean} data.button_disabled - Whether the submit button should be disabled.
   * @returns {undefined}
   */
  on_submit_error (data) {
    this.$submit.setAttribute('aria-disabled', data.button_disabled);
    this.$status.textContent = data.error || 'There was an error while submitting your changes. Please try again.';
  }

  /**
   * Called by BugController once a submission is complete, regardless of errors. Enable and focus on the comment form.
   * @param {undefined}
   * @returns {undefined}
   */
  on_submit_complete () {
    // The textbox should be focused anyway
    this.$textbox.setAttribute('aria-readonly', 'false');
    this.$textbox.focus();
  }
}
