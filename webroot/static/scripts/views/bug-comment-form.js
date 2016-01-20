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
   * @argument {String} view_id - Instance identifier. It should be the same as the BugController instance, otherwise
   *  the relevant notification events won't work.
   * @argument {Object} bug - BugModel instance.
   * @argument {HTMLElement} $bug - Bug container element.
   * @return {Object} view - New BugCommentFormView instance.
   */
  constructor (view_id, bug, $bug) {
    super(); // This does nothing but is required before using `this`

    this.id = view_id;
    this.bug = bug;
    this.$bug = $bug;

    this.$form = this.get_template('bug-comment-form', `${this.id}-comment-form`);
    this.$tabpanel = this.$form.querySelector('[role="tabpanel"]');
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
    this.$drop_target = this.$form.querySelector('[aria-dropeffect]');
    this.$submit = this.$form.querySelector('[data-command="submit"]');

    let click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown';

    for (let $tabpanel of this.$form.querySelectorAll('[role="tabpanel"]')) {
      new this.widgets.ScrollBar($tabpanel);
    }

    this.$form.addEventListener('wheel', event => event.stopPropagation());
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail.items[0]));
    this.$tablist.setAttribute('aria-level', this.id.startsWith('details-bug-') ? 3 : 2);
    this.$submit.addEventListener(click_event_type, event => this.trigger('BugView:Submit'));

    this.init_comment_tabpanel();
    this.init_attachment_tabpanel();

    // Prepare the content available only to the users who have the "editbugs" permission on Bugzilla
    if (!this.editor_tabpanels_enabled && BzDeck.account.permissions.includes('editbugs')) {
      this.init_status_tab();
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
   * @argument {HTMLElement} $tab - Selected tab node.
   * @return {undefined}
   */
  on_tab_selected ($tab) {
    if ($tab.id.endsWith('write')) {
      this.$textbox.focus();
    }

    if ($tab.id.endsWith('preview')) {
      // Render the new comment for preview
      this.$preview.innerHTML = BzDeck.controllers.global.parse_comment(this.$textbox.value);
    }
  }

  /**
   * Prepare the content on the Comment tabpanel.
   * @argument {undefined}
   * @return {undefined}
   */
  init_comment_tabpanel () {
    // Workaround a Firefox bug: the placeholder is not displayed in some cases
    this.$textbox.value = '';

    // Prevent the keyboard shortcuts on the timeline from being fired
    this.$textbox.addEventListener('keydown', event => event.stopPropagation(), true);

    this.$textbox.addEventListener('input', event => this.oninput());
    this.helpers.kbd.assign(this.$textbox, { 'Accel+Enter': event => this.trigger('BugView:Submit') });
  }

  /**
   * Prepare the content on the Attachment tabpanel.
   * @argument {undefined}
   * @return {undefined}
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

    // Attach files by drag & drop
    this.$form.addEventListener('dragover', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'copy');
      event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed = 'copy';
      event.preventDefault();
    });

    this.$form.addEventListener('dragleave', event => {
      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });

    this.$form.addEventListener('drop', event => {
      let dt = event.dataTransfer;

      if (dt.types.contains('Files')) {
        this.trigger('BugView:FilesSelected', { input: dt });
      } else if (dt.types.contains('text/plain')) {
        this.trigger('BugView:AttachText', { text: dt.getData('text/plain') });
      }

      this.$drop_target.setAttribute('aria-dropeffect', 'none');
      event.preventDefault();
    });
  }

  /**
   * Show the Status tab when needed.
   * @argument {undefined}
   * @return {undefined}
   */
  init_status_tab () {
    let $tab = this.$form.querySelector('[id$="tab-status"]'),
        $tabpanel = this.$form.querySelector('[id$="tabpanel-status"]');

    // Show the tab only on the previews; the details page has the info pane
    if (this.id.startsWith('details')) {
      $tabpanel.remove();
    } else {
      $tab.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Prepare the content on the NeedInfo tabpanel.
   * @argument {undefined}
   * @return {undefined}
   */
  init_needinfo_tabpanel () {
    let flags = this.bug.flags ? this.bug.flags.filter(flag => flag.name === 'needinfo') : [],
        names = flags.map(flag => flag.requestee),
        self_assigned = this.bug.creator === this.bug.assigned_to,
        $tab = this.$form.querySelector('[id$="tab-needinfo"]'),
        $tabpanel = this.$form.querySelector('[id$="tabpanel-needinfo"]'),
        $finder_outer = $tabpanel.querySelector('.requestee-finder-outer'),
        $$finder = new BzDeck.PersonFinderView(`${this.id}-person-finder`, this.bug,
                                               new Set([this.bug.creator, this.bug.assigned_to])),
        $finder = $$finder.$combobox;

    let add_row = (requestee, checked, options = {}) => {
      let { id, label } = options,
          type = id ? 'clear' : 'request',
          flag = id ? { id, status: 'X' } : { new: true, name: 'needinfo', status: '?', requestee },
          $row = this.get_template(`bug-comment-form-${type}-needinfo-row`),
          $checkbox = $row.querySelector('[role="checkbox"]'),
          $$checkbox = new this.widgets.CheckBox($checkbox),
          $label = $checkbox.querySelector('span');

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
   * @argument {undefined}
   * @return {undefined}
   */
  oninput () {
    this.$textbox.style.removeProperty('height');
    this.$textbox.style.setProperty('height', `${this.$textbox.scrollHeight}px`);

    if (this.$status.textContent) {
      this.$status.textContent = '';
    }

    this.trigger('BugView:EditComment', { text: this.$textbox.value });
  }

  /**
   * Called by BugController whenever a new attachment is added by the user. Update the attachment list UI accordingly.
   * @argument {Object} data - Passed data.
   * @argument {Proxy}  data.attachment - Added attachment data as an AttachmentModel instance.
   * @return {undefined}
   */
  on_attachment_added (data) {
    let attachment = data.attachment,
        hash = attachment.hash,
        click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown',
        mobile = this.helpers.env.device.mobile,
        mql = window.matchMedia('(max-width: 1023px)'),
        $tbody = this.$attachments_tbody,
        $row = this.get_template('bug-comment-form-attachments-row');

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
   * @argument {Object} data - Passed data.
   * @argument {Number} data.index - Removed attachment's index in the cached list.
   * @return {undefined}
   */
  on_attachment_removed (data) {
    this.$attachments_tbody.rows[data.index].remove();
  }

  /**
   * Called by BugController whenever a new attachment is edited by the user. Update the attachment list UI accordingly.
   * @argument {Object} data - Passed data.
   * @argument {Object} data.change - Change details.
   * @argument {String} data.change.hash - Attachment hash for unuploaded attachment.
   * @argument {String} data.change.prop - Changed property name.
   * @argument {*}      data.change.value - New property value.
   * @return {undefined}
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
   * @argument {Object} data - Passed data.
   * @argument {Array.<Proxy>} data.uploads - List of the new attachments in Array-like Object.
   * @return {undefined}
   */
  on_upload_list_updated (data) {
    let len = data.uploads.length;

    this.$attachments_tab.setAttribute('aria-disabled', !len);
    this.$$tablist.view.selected = len ? this.$attachments_tab : this.$comment_tab;
  }

  /**
   * Called by BugController whenever a new attachment added by the user has an error, such as an oversized file. Show
   * an alert dialog to notify the user of the error.
   * @argument {Object} data - Passed data.
   * @argument {String} data.message - Explanation of the detected error.
   * @return {undefined}
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
   * @argument {Object} data - Passed data.
   * @argument {Boolean} data.has_comment - Whether the comment is empty.
   * @return {undefined}
   */
  on_comment_edited (data) {
    this.$preview_tab.setAttribute('aria-disabled', !data.has_comment);
  }

  /**
   * Called by BugController whenever any of the fields, comments or attachments are edited by the user. If there is
   * any change, enable the Submit button. Otherwise, disable it.
   * @argument {Object} data - Passed data.
   * @argument {Boolean} data.can_submit - Whether the changes can be submitted immediately.
   * @return {undefined}
   */
  on_bug_edited (data) {
    this.$submit.setAttribute('aria-disabled', !data.can_submit);
  }

  /**
   * Called by BugController whenever the changes are about to be submitted to Bugzilla. Disable the comment form and
   * Submit button and update the statusbar message.
   * @argument {undefined}
   * @return {undefined}
   */
  on_submit () {
    this.$textbox.setAttribute('aria-readonly', 'true');
    this.$submit.setAttribute('aria-disabled', 'true');
    this.$status.textContent = 'Submitting...';
  }

  /**
   * Called by BugController whenever the upload of a new attachment is in progress. Show the current status on the
   * statusbar. TODO: Use a progressbar (#159)
   * @argument {object} data - Current uploading status.
   * @argument {Number} data.total - Total size of attachments.
   * @argument {Number} data.uploaded - Uploaded size of attachments.
   * @argument {Number} data.percentage - Uploaded percentage.
   * @return {undefined}
   */
  on_submit_progress (data) {
    this.$status.textContent = `${data.percentage}% uploaded`;
  }

  /**
   * Called by BugController whenever all the changes are submitted successfully. Reset the form content.
   * @argument {undefined}
   * @return {undefined}
   */
  on_submit_success () {
    this.$textbox.value = '';
    this.oninput();
  }

  /**
   * Called by BugController whenever any error is detected while submitting the changes. Show the error message on the
   * statusbar.
   * @argument {object} data - Error details.
   * @argument {String} data.error - Error message.
   * @argument {Boolean} data.button_disabled - Whether the submit button should be disabled.
   * @return {undefined}
   */
  on_submit_error (data) {
    this.$submit.setAttribute('aria-disabled', data.button_disabled);
    this.$status.textContent = data.error || 'There was an error while submitting your changes. Please try again.';
  }

  /**
   * Called by BugController once a submission is complete, regardless of errors. Enable and focus on the comment form.
   * @argument {undefined}
   * @return {undefined}
   */
  on_submit_complete () {
    // The textbox should be focused anyway
    this.$textbox.setAttribute('aria-readonly', 'false');
    this.$textbox.focus();
  }
}
