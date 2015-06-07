/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Bug Controller. The following methods mainly aim to update a bug. See the Bugzilla API documentation
 * for details of the spec: http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#update-bug
 *
 * [argument] id_prefix (String) prefix for the instance ID, such as home, search or details
 * [argument] bug (Object) BugModel instance
 * [return] controller (Object) BugController instance, when called with `new`
 */
BzDeck.controllers.Bug = function BugController (id_prefix, bug) {
  this.id = `${id_prefix}-bug-${bug.id}`;
  this.bug = bug;
  this.reset_changes();

  this.uploads = Object.create(Array.prototype, {
    parallel: { writable: true, value: true },
    total:    { writable: true, value: 0 },
  });

  Object.defineProperties(this, {
    has_changes:      { get: () => !!Object.keys(this.changes).length },
    has_comment:      { get: () => !!this.changes.comment },
    has_attachments:  { get: () => !!this.uploads.length },
    has_errors:       { get: () => !!this.find_errors().length },
    can_submit:       { get: () => !this.has_errors && (this.has_changes || this.has_attachments) },
  });

  // Attachments
  this.on('V:AttachFiles', data => this.attach_files(data.files));
  this.on('V:AttachText', data => this.attach_text(data.text));
  this.on('V:AddAttachment', data => this.add_attachment(data.attachment));
  this.on('V:RemoveAttachment', data => this.remove_attachment(data.hash));
  this.on('V:MoveUpAttachment', data => this.move_up_attachment(data.hash));
  this.on('V:MoveDownAttachment', data => this.move_down_attachment(data.hash));
  this.on('V:ChangeUploadOption', data => this.change_upload_option(data));

  // Other changes
  this.on('V:EditComment', data => this.edit_comment(data.text));
  this.on('V:EditField', data => this.edit_field(data.name, data.value));
  this.on('V:EditFlag', data => this.edit_flag(data.flag, data.added));

  // Form submission
  this.on('V:Submit', () => this.submit());

  // Add the people involved in the bug to the local user database
  BzDeck.collections.users.add_from_bug(this.bug);
};

BzDeck.controllers.Bug.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Bug.prototype.constructor = BzDeck.controllers.Bug;

/*
 * Create a Proxy for the changes object that fires the FieldEdited event when any field value is modified.
 *
 * [argument] none
 * [return] changes (Proxy) changes object
 */
BzDeck.controllers.Bug.prototype.reset_changes = function (comment) {
  this.changes = new Proxy({}, {
    set: (obj, name, value) => {
      if (obj[name] !== value) {
        obj[name] = value;
        this.trigger(':FieldEdited', { name, value });
      }

      return true;
    },
    deleteProperty: (obj, name) => {
      if (name in obj) {
        delete obj[name];
        this.trigger(':FieldEdited', { name, value: this.bug[name] || '' });
      }

      return true;
    }
  });

  return this.changes;
};

/*
 * Called by BugView whenever the new comment is edited by the user. Cache the comment and notify changes accordingly.
 *
 * [argument] comment (String) comment text
 * [return] none
 */
BzDeck.controllers.Bug.prototype.edit_comment = function (comment) {
  if (comment.match(/\S/)) {
    let added = !this.has_comment;

    this.changes.comment = { body: comment };

    if (added) {
      this.trigger(':CommentAdded', { has_comment: true, can_submit: this.can_submit });
      this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });
    }
  } else {
    let removed = this.has_comment;

    delete this.changes.comment;

    if (removed) {
      this.trigger(':CommentRemoved', { has_comment: false, can_submit: this.can_submit });
      this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });
    }
  }
};

/*
 * Called by BugView whenever any of the fields are edited by the user. Cache the value and notify changes accordingly.
 * Only the following fields are supported at this moment: status, resolution, dupe_of.
 *
 * [argument] name (String) field name
 * [argument] value (Any) field value
 * [return] none
 */
BzDeck.controllers.Bug.prototype.edit_field = function (name, value) {
  let { field, product } = BzDeck.models.server.data.config,
      is_closed = value => field.status.closed.includes(value);

  if (['blocks', 'depends_on', 'see_also', 'dupe_of'].includes(name) &&
      typeof value === 'string' && value.match(/^\d+$/)) {
    value = Number.parseInt(value);
  }

  if (value === this.bug[name]) {
    delete this.changes[name];

    if (name === 'product') {
      delete this.changes.version;
      delete this.changes.component;
      delete this.changes.target_milestone;
    }

    if (name === 'status') {
      delete this.changes.resolution;
      delete this.changes.dupe_of;
    }
  } else if (value !== this.changes[name]) {
    this.changes[name] = value;

    // When the Product is updated, the Version, Component, Target Milestone have to be updated as well
    if (name === 'product') {
      let { version: versions, component, target_milestone_detail } = product[value],
          components = Object.keys(component),
          milestones = [for (milestone of target_milestone_detail) if (milestone.is_active) milestone.name];

      this.changes.version = versions.find(v => ['unspecified'].includes(v)) || versions[0];
      this.changes.component = components.find(c => ['General'].includes(c)) || components[0];
      this.changes.target_milestone = milestones.find(m => ['---'].includes(m)) || milestones[0];
    }

    if (name === 'status') {
      if (is_closed(value)) {
        if (this.bug.resolution !== 'FIXED') {
          this.changes.resolution = 'FIXED';
        } else {
          delete this.changes.resolution;
        }

        delete this.changes.dupe_of;
      } else {
        this.changes.resolution = '';
      }
    }
  }

  if (name === 'resolution' && value !== 'DUPLICATE') {
    delete this.changes.dupe_of;
  }

  this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });
};

/*
 * Called by BugView whenever any of the flags are edited by the user. Cache the value and notify changes accordingly.
 *
 * [argument] flag (Object) flag change object
 * [argument] added (Boolean) whether the flag is newly added
 * [return] none
 */
BzDeck.controllers.Bug.prototype.edit_flag = function (flag, added) {
  let flags = this.changes.flags = this.changes.flags || [];

  if (added) {
    flags.push(flag);
  } else {
    let { id, name, requestee } = flag,
        index = flags.findIndex(f => f.id === id || (f.name === name && f.requestee === requestee));

    if (index > -1) {
      flags.splice(index, 1);
    }

    if (!flags.length) {
      delete this.changes.flags;
    }
  }

  this.trigger(':FlagEdited', { flags: this.changes.flags, flag, added });
  this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });
};

/*
 * Called by BugView whenever new attachment files are selected by the user through a file input form control or a
 * drag-and-drop action. Read and cache the files. If the file size exceeds Bugzilla's limitation, notify the error.
 *
 * [argument] files (FileList) selected files
 * [return] none
 */
BzDeck.controllers.Bug.prototype.attach_files = function (files) {
  let oversized_files = new Set(),
      max_size = BzDeck.models.server.data.config.max_attachment_size;

  for (let _file of files) {
    let reader = new FileReader(),
        file = _file, // Redeclare the variable so it can be used in the following load event
        is_patch = /\.(patch|diff)$/.test(file.name) || /^text\/x-(patch|diff)$/.test(file.type);

    // Check if the file is not exceeding the limit
    if (file.size > max_size) {
      oversized_files.add(file);

      continue;
    }

    reader.addEventListener('load', event => {
      let attachment = {
        data: reader.result.split(',')[1], // Drop data:<type>;base64,
        summary: is_patch ? 'Patch' : file.name,
        file_name: file.name,
        is_patch,
        content_type: is_patch ? 'text/x-patch' : file.type || 'application/x-download'
      };

      // Add a custom property to make it easier to find the cached attachment. It's enumerable:false so later dropped
      // by Object.assign() before the data is sent through the API
      Object.defineProperty(attachment, 'hash', { value: md5([file.name, file.type, String(file.size)].join()) });

      this.add_attachment(attachment);
    });

    reader.readAsDataURL(file);
  }

  if (!oversized_files.size) {
    return;
  }

  // TODO: Integrate online storage APIs to upload large attachments (#111)

  let message,
      num_format = num => num.toLocaleString('en-US'),
      max = num_format(max_size);

  if (oversized_files.size > 1) {
    message = `These files cannot be attached because they may exceed the maximum attachment size (${max} bytes) \
               specified by the current Bugzilla instance. You can upload the files to an online storage and post the \
               links instead.`; // l10n
  } else {
    message = `This file cannot be attached because it may exceed the maximum attachment size (${max} bytes) \
               specified by the current Bugzilla instance. You can upload the file to an online storage and post the \
               link instead.`; // l10n
  }

  message += '\n\n' + [for (file of oversized_files) `* ${file.name} (${num_format(file.size)} bytes)`].join('\n');

  this.trigger(':AttachmentError', { message });
};

/*
 * Called whenever a new attachment text is added by the user through a text input form control or a drag-and-drop
 * action. Read and cache the text.
 *
 * [argument] text (String) added plain text or URL string
 * [return] none
 */
BzDeck.controllers.Bug.prototype.attach_text = function (text) {
  let reader = new FileReader(),
      blob = new Blob([text], { type: 'text/plain' }),
      summary = text.substr(0, 25) + (text.length > 25 ? '...' : ''),
      file_name = URL.createObjectURL(blob).match(/\w+$/)[0] + '.txt',
      content_type = 'text/plain',
      is_patch = !!text.match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/m),
      is_ghpr = text.match(/^https:\/\/github\.com\/(.*)\/pull\/(\d+)$/),
      is_mrbr = text.match(/^https:\/\/reviewboard\.mozilla\.org\/r\/(\d+)\/$/);

  if (is_patch) {
    // TODO: Append a revision to the summary, based on the currently-attached patches if any
    summary = 'Patch';
    content_type = 'text/x-patch';
  }

  if (is_ghpr) {
    summary = `GitHub Pull Request: ${is_ghpr[1]}#${is_ghpr[2]}`;
    content_type = 'text/x-github-pull-request';
  }

  if (is_mrbr) {
    summary = `MozReview Request: ${is_mrbr[1]}`;
    content_type = 'text/x-review-board-request';
  }

  // Use FileReader instead of btoa() to avoid overflow
  reader.addEventListener('load', event => {
    let data = reader.result.split(',')[1], // Drop data:text/plain;base64,
        attachment = { data, summary, file_name, content_type, is_patch };

    // Add a custom property to make it easier to find the cached attachment
    Object.defineProperty(attachment, 'hash', { value: md5([file_name, content_type, String(blob.size)].join()) });

    this.add_attachment(attachment);
  });

  reader.readAsDataURL(blob);
};

/*
 * Find an attachment from the cached new attachment list by comparing the hash values.
 *
 * [argument] hash (String) hash value of the attachment object to find
 * [return] index (Number) 0 or a positive integer if the attachment is found, -1 if not found
 */
BzDeck.controllers.Bug.prototype.find_attachment = function (hash) {
  return this.uploads.findIndex(a => a.hash === hash);
};

/*
 * Add an attachment to the cached new attachment list.
 *
 * [argument] attachment (Object) attachment object to add
 * [return] result (Boolean) whether the attachment is cached
 */
BzDeck.controllers.Bug.prototype.add_attachment = function (attachment) {
  // Check if the file has already been attached
  if (this.find_attachment(attachment.hash) > -1) {
    return false;
  }

  // Add a custom property to make it easier to track the upload status
  Object.defineProperty(attachment, 'uploaded', { writable: true, value: 0 });

  this.uploads.push(attachment);

  this.trigger(':AttachmentAdded', { attachment });
  this.trigger(':AttachmentsEdited', { uploads: this.uploads });
  this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });

  return true;
};

/*
 * Remove an attachment from the cached new attachment list.
 *
 * [argument] hash (String) hash value of the attachment object to remove
 * [return] result (Boolean) whether the attachment is found and removed
 */
BzDeck.controllers.Bug.prototype.remove_attachment = function (hash) {
  let index = this.find_attachment(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index, 1);

  this.trigger(':AttachmentRemoved', { index, hash });
  this.trigger(':AttachmentsEdited', { uploads: this.uploads });
  this.trigger(':BugEdited', { changes: this.changes, uploads: this.uploads, can_submit: this.can_submit });

  return true;
};

/*
 * Move up an attachment within the cached new attachment list, when the parallel upload option is disabled and the
 * order of the to-be-uploaded attachments matters.
 *
 * [argument] hash (String) hash value of the attachment object to move
 * [return] result (Boolean) whether the attachment is found and reordered
 */
BzDeck.controllers.Bug.prototype.move_up_attachment = function (hash) {
  let index = this.find_attachment(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index - 1, 2, attachment, this.uploads[index - 1]);

  return true;
};

/*
 * Move down an attachment within the cached new attachment list, when the parallel upload option is disabled and the
 * order of the to-be-uploaded attachments matters.
 *
 * [argument] hash (String) hash value of the attachment object to move
 * [return] result (Boolean) whether the attachment is found and reordered
 */
BzDeck.controllers.Bug.prototype.move_down_attachment = function (hash) {
  let index = this.find_attachment(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index, 2, this.uploads[index + 1], attachment);

  return true;
};

/*
 * Change the attachment upload option.
 *
 * [argument] option (Object) parallel upload is the only supported option at this moment
 * [return] none
 */
BzDeck.controllers.Bug.prototype.change_upload_option = function (options) {
  this.uploads.parallel = options.parallel;

  this.trigger(':UploadOptionChanged', { uploads: this.uploads });
};

/*
 * Find any errors in the user-modified fields. Only the dupe_of field is supported at this moment.
 *
 * [argument] none
 * [return] errors (Array(String)) list of the detected errors
 */
BzDeck.controllers.Bug.prototype.find_errors = function () {
  let errors = [];

  if (this.changes.resolution === 'DUPLICATE' && !this.changes.dupe_of ||
      this.changes.dupe_of !== undefined && typeof this.changes.dupe_of !== 'number' ||
      this.changes.dupe_of === this.bug.id) {
    errors.push('Please specify a valid duplicate bug ID.'); // l10n
  }

  if (this.changes.summary === '') {
    errors.push('The summary should not be empty.'); // l10n
  }

  return errors;
};

/*
 * Submit the changes made on the bug to Bugzilla.
 *
 * [argument] none
 * [return] submission (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.submit = function () {
  if (this.has_errors) {
    this.trigger(':SubmitError', { button_disabled: true, error: this.find_errors()[0] });

    return Promise.reject('The changes cannot be submitted because of errors.');
  }

  if (!this.can_submit) {
    return Promise.reject('No changes have been made on the bug.');
  }

  this.trigger(':Submit');

  this.uploads.total = 0;

  return new Promise((resolve, reject) => {
    if (!this.has_changes) {
      // Jump into the attachment(s)
      resolve();
    } else if (Object.keys(this.changes).length === 1 && this.has_comment && this.uploads.length === 1) {
      // If the comment is the only change and there's a single attachment, send the comment with the attachment
      this.uploads[0].comment = this.changes.comment.body;
      resolve();
    } else {
      // Post the changes first
      this.post_changes(this.changes).then(result => {
        if (result.error) {
          reject(new Error(result.message));
        } else {
          resolve();
        }
      }).catch(error => reject(new Error(error.message)));
    }
  }).then(() => {
    if (!this.uploads.length) {
      // There is nothing more to do if no file is attached
      return Promise.resolve();
    }

    if (this.uploads.parallel) {
      // Upload files in parallel
      return Promise.all([for (att of this.uploads) this.post_attachment(att)]);
    }

    // Upload files in series
    return this.uploads.reduce((sequence, att) => sequence.then(() => this.post_attachment(att)), Promise.resolve());
  }).then(() => {
    // All done! Clear the cached changes and uploads data
    this.reset_changes();
    this.uploads.length = 0;
    this.uploads.total = 0;

    // The timeline will soon be updated via Bugzfeed. Fetch the bug only if Bugzfeed is not working for some reason
    if (!BzDeck.controllers.bugzfeed.websocket || !BzDeck.controllers.bugzfeed.subscription.has(this.bug.id)) {
      BzDeck.collections.bugs.get(this.bug.id, { id: this.bug.id, _unread: true }).fetch();
    }

    this.trigger(':SubmitSuccess');
  }).catch(error => {
    // Failed to post at least one attachment
    this.trigger(':SubmitError', {
      button_disabled: false,
      error: error.message || 'Failed to post your comment or attachment(s). Try again later.',
    });
  }).then(() => {
    this.trigger(':SubmitComplete');
  });
};

/*
 * Post the meta data changes made on the bug to Bugzilla.
 *
 * [argument] none
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.post_changes = function (data) {
  return this.request(`bug/${this.bug.id}`, null, { method: 'PUT', auth: true, data });
};

/*
 * Post the new attachments added to the bug to Bugzilla.
 *
 * [argument] none
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.post_attachment = function (attachment) {
  let size_computable,
      size = 0;

  return this.request(`bug/${this.bug.id}/attachment`, null, {
    method: 'POST',
    auth: true,
    data: Object.assign({}, attachment), // Clone the object to drop the custom properties (hash, uploaded)
    upload_listeners: {
      progress: event => {
        if (!size) {
          size_computable = event.lengthComputable;
          size = event.total;
          this.uploads.total += size;
        }

        if (size_computable) {
          attachment.uploaded = event.loaded;
          this.notify_upload_progress();
        }
      }
    }
  }).then(result => {
    return result.error ? Promise.reject(new Error(result.message)) : Promise.resolve(result);
  }).then(result => {
    if (!size_computable) {
      attachment.uploaded = size;
      this.notify_upload_progress();
    }

    this.trigger(':AttachmentUploaded', { attachment });

    this.uploads.total -= attachment.uploaded;
    this.remove_attachment(attachment.hash);
  }).catch(error => {
    // Failed to post at least one attachment
    this.trigger(':AttachmentUploadError', {
      button_disabled: false,
      error: error.message || 'Failed to upload your attachment. Try again later.',
    });
  });
};

/*
 * Notify the upload progress while the new attachent is being uploaded to Bugzilla.
 *
 * [argument] none
 * [return] none
 */
BzDeck.controllers.Bug.prototype.notify_upload_progress = function () {
  let uploaded = [for (attachment of this.uploads) attachment.uploaded].reduce((p, c) => p + c),
      total = this.uploads.total;

  this.trigger(':SubmitProgress', { uploaded, total, percentage: Math.round(uploaded / total * 100) });
};
