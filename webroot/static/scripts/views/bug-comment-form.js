/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Bug Comment Form View. This view has a comment form and quick edit UI.
 *
 * [argument] view_id (String) instance ID. It should be the same as the BugController instance, otherwise the related
 *                            notification events won't work
 * [argument] bug (Object) BugModel instance
 * [return] view (Object) BugCommentFormView instance, when called with `new`
 */
BzDeck.views.BugCommentForm = function BugCommentFormView (view_id, bug, $bug) {
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
  this.$attachments_tbody = this.$form.querySelector('[id$="tabpanel-attachments"] tbody');
  this.$parallel_checkbox = this.$form.querySelector('[role="checkbox"]');
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
  if (!this.editor_tabpanels_enabled && BzDeck.models.account.permissions.includes('editbugs')) {
    this.init_status_tab();
    this.init_needinfo_tabpanel();
    this.editor_tabpanels_enabled = true;
  }

  // Render
  this.$bug.querySelector('.bug-timeline-wrapper').appendChild(this.$form);

  // Attachments
  this.on('BugController:AttachmentAdded', data => this.on_attachment_added(data.attachment));
  this.on('BugController:AttachmentRemoved', data => this.on_attachment_removed(data.index));
  this.on('BugController:AttachmentsEdited', data => this.on_attachments_edited(data.uploads));
  this.on('BugController:AttachmentError', data => this.on_attachment_error(data.message));
  this.on('BugController:UploadOptionChanged', data => this.update_parallel_ui(data.uploads));

  // Other changes
  this.on('BugController:BugEdited', data => this.on_bug_edited(data.can_submit));
  this.on('BugController:CommentAdded', data => this.on_comment_edited(data.has_comment));
  this.on('BugController:CommentRemoved', data => this.on_comment_edited(data.has_comment));

  // Form submission
  this.on('BugController:Submit', () => this.on_submit());
  this.on('BugController:SubmitProgress', data => this.on_submit_progress(data));
  this.on('BugController:SubmitSuccess', () => this.on_submit_success());
  this.on('BugController:SubmitError', data => this.on_submit_error(data));
  this.on('BugController:SubmitComplete', () => this.on_submit_complete());
};

BzDeck.views.BugCommentForm.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.BugCommentForm.prototype.constructor = BzDeck.views.BugCommentForm;

/*
 * Called by the tablist-role element whenever one of the tabs on the form is selected. Perform an action depending on
 * the newly selected tab.
 *
 * [argument] $tab (Element) selected tab node
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_tab_selected = function ($tab) {
  if ($tab.id.endsWith('write')) {
    this.$textbox.focus();
  }

  if ($tab.id.endsWith('preview')) {
    // Render the new comment for preview
    this.$preview.innerHTML = BzDeck.controllers.global.parse_comment(this.$textbox.value);
  }
};

/*
 * Prepare the content on the Comment tabpanel.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.init_comment_tabpanel = function () {
  // Workaround a Firefox bug: the placeholder is not displayed in some cases
  this.$textbox.value = '';

  // Prevent the keyboard shortcuts on the timeline from being fired
  this.$textbox.addEventListener('keydown', event => event.stopPropagation(), true);

  this.$textbox.addEventListener('input', event => this.oninput());
  this.helpers.kbd.assign(this.$textbox, { 'Accel+Enter': event => this.trigger('BugView:Submit') });
};

/*
 * Prepare the content on the Attachment tabpanel.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.init_attachment_tabpanel = function () {
  // Attach files using a file picker
  // The event here should be click; others including touchstart and mousedown don't work
  this.$attach_button.addEventListener('click', event => this.$file_picker.click());
  this.$file_picker.addEventListener('change', event => {
    this.trigger('BugView:AttachFiles', { files: event.target.files });
  });

  // Attach files by drag & drop
  this.$form.addEventListener('dragover', event => {
    this.$drop_target.setAttribute('aria-dropeffect', 'copy');
    event.dataTransfer.dropEffect = event.dataTransfer.effectAllowed = 'copy';
    event.preventDefault();
  });

  this.$form.addEventListener('drop', event => {
    let dt = event.dataTransfer;

    if (dt.types.contains('Files')) {
      this.trigger('BugView:AttachFiles', { files: dt.files });
    } else if (dt.types.contains('text/plain')) {
      this.trigger('BugView:AttachText', { text: dt.getData('text/plain') });
    }

    this.$drop_target.setAttribute('aria-dropeffect', 'none');
    event.preventDefault();
  });

  new this.widgets.Checkbox(this.$parallel_checkbox).bind('Toggled', event => {
    this.trigger('BugView:ChangeUploadOption', { parallel: event.detail.checked });
  });
};

/*
 * Show the Status tab when needed.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.init_status_tab = function () {
  let $tab = this.$form.querySelector('[id$="tab-status"]'),
      $tabpanel = this.$form.querySelector('[id$="tabpanel-status"]');

  // Show the tab only on the previews; the details page has the info pane
  if (this.id.startsWith('details')) {
    $tabpanel.remove();
  } else {
    $tab.setAttribute('aria-hidden', 'false');
  }
};

/*
 * Prepare the content on the NeedInfo tabpanel.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.init_needinfo_tabpanel = function () {
  let flags = [for (flag of this.bug.flags || []) if (flag.name === 'needinfo') flag],
      names = [for (flag of flags) flag.requestee],
      self_assigned = this.bug.creator === this.bug.assigned_to,
      $tab = this.$form.querySelector('[id$="tab-needinfo"]'),
      $tabpanel = this.$form.querySelector('[id$="tabpanel-needinfo"]'),
      $finder_outer = $tabpanel.querySelector('.requestee-finder-outer'),
      $$finder = new BzDeck.views.PersonFinder(`${this.id}-person-finder`, this.bug,
                                               new Set([this.bug.creator, this.bug.assigned_to])),
      $finder = $$finder.$combobox;

  let add_row = (requestee, checked, options = {}) => {
    let { id, label } = options,
        type = id ? 'clear' : 'request',
        flag = id ? { id, status: 'X' } : { new: true, name: 'needinfo', status: '?', requestee },
        $row = this.get_template(`bug-comment-form-${type}-needinfo-row`),
        $person = this.fill(this.get_template('person-with-image'),
                            BzDeck.collections.users.get(requestee, { name: requestee }).properties),
        $checkbox = $row.querySelector('[role="checkbox"]'),
        $$checkbox = new this.widgets.Checkbox($checkbox),
        $label = $checkbox.querySelector('span');

    $checkbox.replaceChild($person, $checkbox.querySelector('strong'));
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
    add_row(requestee, requestee === BzDeck.models.account.data.name, { id });
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
};

/*
 * Called by the textbox element whenever the new comment is edited by the user.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.oninput = function () {
  this.$textbox.style.removeProperty('height');
  this.$textbox.style.setProperty('height', `${this.$textbox.scrollHeight}px`);

  if (this.$status.textContent) {
    this.$status.textContent = '';
  }

  this.trigger('BugView:EditComment', { text: this.$textbox.value });
};

/*
 * Called by BugController whenever a new attachment is added by the user.
 *
 * [argument] attachment (Object) added attachment data
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_attachment_added = function (attachment) {
  let hash = attachment.hash,
      click_event_type = this.helpers.env.touch.enabled ? 'touchstart' : 'mousedown',
      $tbody = this.$attachments_tbody,
      $row = this.get_template('bug-comment-form-attachments-row'),
      $desc = $row.querySelector('[data-field="description"]');

  $desc.value = $desc.placeholder = attachment.summary;
  $desc.addEventListener('keydown', event => event.stopPropagation());
  $desc.addEventListener('input', event => attachment.summary = $desc.value);

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
};

/*
 * Called by BugController whenever a new attachment is removed by the user.
 *
 * [argument] index (Integer) removed attachment's index in the cached list
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_attachment_removed = function (index) {
  this.$attachments_tbody.rows[index].remove();
};

/*
 * Called by BugController whenever a new attachment is added or removed by the user.
 *
 * [argument] uploads (Array+) list of the new attachments
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_attachments_edited = function (uploads) {
  this.$attachments_tab.setAttribute('aria-disabled', !uploads.length);
  this.$$tablist.view.selected = uploads.length ? this.$attachments_tab : this.$comment_tab;
  this.update_parallel_ui(uploads);
};

/*
 * Called by BugController whenever a new attachment added by the user has an error, such as an oversized file. Show an
 * alert dialog to notify the user of the error.
 *
 * [argument] message (String) explanation of the detected error
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_attachment_error = function (message) {
  new this.widgets.Dialog({
    type: 'alert',
    title: 'Error on attaching files', // l10n
    message: data.message.replace('\n', '<br>'),
  }).show();
};

/*
 * Called by BugController whenever a new attachment is added or removed by the user, or the upload option is changed.
 * Update the parallel upload UI based on the current option and the number of the new attachments.
 *
 * [argument] uploads (Array+) list of the new attachments
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.update_parallel_ui = function (uploads) {
  let disabled = uploads.length < 2 || uploads.parallel;

  for (let $button of this.$attachments_tbody.querySelectorAll('[data-command|="move"]')) {
    $button.setAttribute('aria-disabled', disabled);
  }

  this.$parallel_checkbox.setAttribute('aria-hidden', uploads.length < 2);
};

/*
 * Called by BugController whenever the new commend is added or removed by the user.
 *
 * [argument] has_comment (Boolean) whether the comment is empty
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_comment_edited = function (has_comment) {
  this.$preview_tab.setAttribute('aria-disabled', !has_comment);
};

/*
 * Called by BugController whenever any of the fields, comments or attachments are edited by the user.
 *
 * [argument] can_submit (Boolean) whether the changes can be submitted immediately
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_bug_edited = function (can_submit) {
  this.$submit.setAttribute('aria-disabled', !can_submit);
};

/*
 * Called by BugController whenever the changes are about to be submitted to Bugzilla.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_submit = function () {
  this.$textbox.setAttribute('aria-readonly', 'true');
  this.$submit.setAttribute('aria-disabled', 'true');
  this.$status.textContent = 'Submitting...';
};

/*
 * Called by BugController whenever the upload of a new attachment is in progress.
 *
 * [argument] data (object) includes the uploaded size, total size and percentage
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_submit_progress = function (data) {
  // TODO: Use a progressbar (#159)
  this.$status.textContent = `${data.percentage}% uploaded`;
};

/*
 * Called by BugController whenever all the changes are submitted successfully. Reset the form content.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_submit_success = function () {
  this.$textbox.value = '';
  this.oninput();
};

/*
 * Called by BugController whenever any error is detected while submitting the changes.
 *
 * [argument] data (object) includes the errors and whether the submit button should be disabled
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_submit_error = function (data) {
  this.$submit.setAttribute('aria-disabled', data.button_disabled);
  this.$status.textContent = data.error || 'There was an error while submitting your changes. Please try again.';
};

/*
 * Called by BugController once a submission is complete, regardless of errors.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.BugCommentForm.prototype.on_submit_complete = function () {
  // The textbox should be focused anyway
  this.$textbox.setAttribute('aria-readonly', 'false');
  this.$textbox.focus();
};
