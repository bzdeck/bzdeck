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
  this.att_changes = new Map();

  this.uploads = Object.create(Array.prototype, {
    total:    { writable: true, value: 0 },
  });

  Object.defineProperties(this, {
    has_changes:      { get: () => !!Object.keys(this.changes).length },
    has_att_changes:  { get: () => !!this.att_changes.size },
    has_comment:      { get: () => !!this.changes.comment },
    has_attachments:  { get: () => !!this.uploads.length },
    has_errors:       { get: () => !!this.find_errors().length },
    can_submit:       { get: () => !this.has_errors &&
                                    (this.has_changes || this.has_att_changes || this.has_attachments) },
  });

  // Attachments
  this.on('V:AttachFiles', data => this.attach_files(data.files));
  this.on('V:AttachText', data => this.attach_text(data.text));
  this.on('V:RemoveAttachment', data => this.remove_attachment(data.hash));
  this.on('V:MoveUpAttachment', data => this.move_up_attachment(data.hash));
  this.on('V:MoveDownAttachment', data => this.move_down_attachment(data.hash));
  this.on('AttachmentView:EditAttachment', data => this.edit_attachment(data));

  // Subscription
  this.on('V:Subscribe', data => this.update_subscription('add'));
  this.on('V:Unsubscribe', data => this.update_subscription('remove'));

  // Other changes
  this.on('V:EditComment', data => this.edit_comment(data.text));
  this.on('V:EditField', data => this.edit_field(data.name, data.value));
  this.on('V:EditFlag', data => this.edit_flag(data.flag, data.added));
  this.on('V:AddParticipant', data => this.add_participant(data.field, data.email));
  this.on('V:RemoveParticipant', data => this.remove_participant(data.field, data.email));

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
 * Called internally whenever a bug field or an attachment property is edited by the user. Fire an event to notify the
 * views of the change.
 *
 * [argument] none
 * [return] none
 */
BzDeck.controllers.Bug.prototype.onedit = function () {
  let { changes, att_changes, uploads, can_submit } = this;

  this.trigger(':BugEdited', { changes, att_changes, uploads, can_submit });
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
      this.onedit();
    }
  } else {
    let removed = this.has_comment;

    delete this.changes.comment;

    if (removed) {
      this.trigger(':CommentRemoved', { has_comment: false, can_submit: this.can_submit });
      this.onedit();
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
          milestones = target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name);

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

  this.onedit();
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
  this.onedit();
};

/*
 * Called by BugView whenever a participant is added by the user. Cache the value and notify changes accordingly.
 *
 * [argument] field (String) assigned_to, qa_contact, mentor or cc
 * [argument] email (String) participant to be added
 * [return] result (Boolean) whether the participant is added to the cache successfully
 */
BzDeck.controllers.Bug.prototype.add_participant = function (field, email) {
  if (['mentor', 'cc'].includes(field)) {
    let change = this.changes[field] || {};

    if ((change.remove || []).includes(email)) {
      change.remove.splice(change.remove.indexOf(email), 1);
    } else {
      change.add = change.add || [];

      if ((this.bug[field] || []).includes(email) || change.add.includes(email)) {
        return false;
      }

      change.add.push(email);
    }

    this.changes[field] = change;
  } else {
    if (this.changes[field] === email) {
      return false;
    }

    if (this.bug[field] === email) {
      delete this.changes[field];
    } else {
      this.changes[field] = email;
    }
  }

  this.trigger(':ParticipantAdded', { field, email });
  this.onedit();
  this.cleanup_multiple_item_change(field);

  return true;
};

/*
 * Called by BugView whenever a participant is removed by the user. Cache the value and notify changes accordingly.
 *
 * [argument] field (String) assigned_to, qa_contact, mentor or cc
 * [argument] email (String) participant to be removed
 * [return] result (Boolean) whether the participant is removed from the cache successfully
 */
BzDeck.controllers.Bug.prototype.remove_participant = function (field, email) {
  if (['mentor', 'cc'].includes(field)) {
    let change = this.changes[field] || {};

    if ((change.add || []).includes(email)) {
      change.add.splice(change.add.indexOf(email), 1);
    } else {
      change.remove = change.remove || [];

      if (!(this.bug[field] || []).includes(email) || change.remove.includes(email)) {
        return false;
      }

      change.remove.push(email);
    }

    this.changes[field] = change;
  } else {
    this.changes[field] = field === 'assigned_to' ? BzDeck.models.server.default_assignee : '';
  }

  this.trigger(':ParticipantRemoved', { field, email });
  this.onedit();
  this.cleanup_multiple_item_change(field);

  return true;
};

/*
 * Subscribe to the bug by adding the user's email to the Cc list, or unsubscribe from the bug by removing the user's
 * email from the Cc list.
 *
 * [argument] how (String) add or remove
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.update_subscription = function (how) {
  let subscribe = how === 'add',
      email = BzDeck.models.account.data.name;

  // Update the view first
  this.trigger(subscribe ? ':ParticipantAdded' : ':ParticipantRemoved', { field: 'cc', email });

  return this.post_changes({ cc: { [how]: [email] }}).then(result => {
    if (result.error) {
      this.trigger(subscribe ? ':FailedToSubscribe' : ':FailedToUnsubscribe');
    } else {
      this.trigger(subscribe ? ':Subscribed' : ':Unsubscribed');
      this.fetch();
    }
  });
};

/*
 * Clean up a change with both additions and removals, such as mentor or cc. If there are no changes, removed the
 * object from the cache.
 *
 * [argument] field (String) mentor or cc
 * [return] result (Boolean) whether the change object is updated
 */
BzDeck.controllers.Bug.prototype.cleanup_multiple_item_change = function (field) {
  let change = this.changes[field];

  if (!change) {
    return false;
  }

  if (change.remove && !change.remove.length) {
    delete change.remove;
  }

  if (change.add && !change.add.length) {
    delete change.add;
  }

  if (Object.keys(change).length) {
    this.changes[field] = change;
  } else {
    delete this.changes[field];
  }

  return true;
};

/*
 * Called by BugView whenever new attachment files are selected by the user through a file input form control or a
 * drag-and-drop action. Read and cache the files. If the file size exceeds Bugzilla's limitation, notify the error.
 *
 * [argument] files (FileList or Array) selected files
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
      this.add_attachment({
        data: reader.result.split(',')[1], // Drop 'data:<type>;base64,'
        summary: is_patch ? 'Patch' : file.name,
        file_name: file.name,
        content_type: is_patch ? 'text/plain' : file.type || 'application/x-download',
        is_patch,
      }, file.size);
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

  message += '\n\n' + oversized_files.map(file => `* ${file.name} (${num_format(file.size)} bytes)`).join('\n');

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
    let data = reader.result.split(',')[1]; // Drop 'data:text/plain;base64,'

    this.add_attachment({ data, summary, file_name, content_type, is_patch }, blob.size);
  });

  reader.readAsDataURL(blob);
};

/*
 * Find an attachment index from the cached new attachment list by comparing the hash values.
 *
 * [argument] hash (String) hash value of the attachment object to find
 * [return] index (Number) 0 or a positive integer if the attachment is found, -1 if not found
 */
BzDeck.controllers.Bug.prototype.find_att_index = function (hash) {
  return this.uploads.findIndex(a => a.hash === hash);
};

/*
 * Find an attachment object from the cached new attachment list by comparing the hash values.
 *
 * [argument] hash (String) hash value of the attachment object to find
 * [return] attachment (Proxy) AttachmentModel instance if the attachment is found, undefined if not found
 */
BzDeck.controllers.Bug.prototype.find_attachment = function (hash) {
  return this.uploads.find(a => a.hash === hash);
};

/*
 * Add an attachment to the cached new attachment list.
 *
 * [argument] att (Object) raw attachment upload object for Bugzilla
 * [argument] size (Integer) actual file size
 * [return] result (Boolean) whether the attachment is cached
 */
BzDeck.controllers.Bug.prototype.add_attachment = function (att, size) {
  // Cache as an AttachmentModel instance
  let attachment = BzDeck.collections.attachments.cache(att, size);

  // Check if the file has already been attached
  if (this.find_attachment(attachment.hash)) {
    return false;
  }

  this.uploads.push(attachment);

  this.trigger(':AttachmentAdded', { attachment });
  this.trigger(':UploadListUpdated', { uploads: this.uploads });
  this.onedit();

  return true;
};

/*
 * Remove an attachment from the cached new attachment list.
 *
 * [argument] hash (String) hash value of the attachment object to remove
 * [return] result (Boolean) whether the attachment is found and removed
 */
BzDeck.controllers.Bug.prototype.remove_attachment = function (hash) {
  let index = this.find_att_index(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index, 1);

  this.trigger(':AttachmentRemoved', { index, hash });
  this.trigger(':UploadListUpdated', { uploads: this.uploads });
  this.onedit();

  return true;
};

/*
 * Edit a property of a new or existing attachment
 *
 * [argument] change (Object) change detail containing the attachment id (or hash for unuploaded attachments), changed
 *                  property name and value
 * [return] result (Boolean) whether the attachment is edited successfully
 */
BzDeck.controllers.Bug.prototype.edit_attachment = function (change) {
  let attachment,
      { id, hash, prop, value } = change;

  if (hash) {
    // Edit a new attachment
    attachment = this.find_attachment(hash);

    if (!attachment || attachment[prop] === value) {
      return false;
    }

    attachment[prop] = value;
  } else {
    // Edit an existing attachment
    attachment = BzDeck.collections.attachments.get(id);

    if (!attachment || attachment.bug_id !== this.bug.id) {
      return false;
    }

    let changes = this.att_changes.get(id) || {},
        edited = true;

    // The properties prefixed with 'is_' are supposed to be a boolean but actually 0 or 1, so use the non-strict
    // inequality operator for comparison. This includes 'is_patch' and 'is_obsolete'.
    if (attachment[prop] != value) {
      changes[prop] = value;
    } else if (prop in changes) {
      delete changes[prop];
    } else {
      edited = false;
    }

    if (Object.keys(changes).length) {
      this.att_changes.set(id, changes);
    } else {
      this.att_changes.delete(id);
    }

    if (!edited) {
      return false;
    }
  }

  this.trigger(':AttachmentEdited', { attachment, change });
  this.onedit();

  return true;
};

/*
 * Move up an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
 *
 * [argument] hash (String) hash value of the attachment object to move
 * [return] result (Boolean) whether the attachment is found and reordered
 */
BzDeck.controllers.Bug.prototype.move_up_attachment = function (hash) {
  let index = this.find_att_index(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index - 1, 2, this.uploads[index], this.uploads[index - 1]);

  return true;
};

/*
 * Move down an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
 *
 * [argument] hash (String) hash value of the attachment object to move
 * [return] result (Boolean) whether the attachment is found and reordered
 */
BzDeck.controllers.Bug.prototype.move_down_attachment = function (hash) {
  let index = this.find_att_index(hash);

  if (index === -1) {
    return false;
  }

  this.uploads.splice(index, 2, this.uploads[index + 1], this.uploads[index]);

  return true;
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
    // Update existing attachment(s)
    return Promise.all([...this.att_changes].map(c => this.post_att_changes(c[0], c[1])));
  }).then(() => {
    if (!this.has_attachments) {
      // There is nothing more to do if no file is attached
      return Promise.resolve();
    }

    // Upload files in series
    return this.uploads.reduce((sequence, att) => sequence.then(() => this.post_attachment(att)), Promise.resolve());
  }).then(() => {
    // All done! Clear the cached changes and uploads data
    this.reset_changes();
    this.att_changes.clear();
    this.uploads.length = 0;
    this.uploads.total = 0;

    // The timeline will soon be updated via Bugzfeed. Fetch the bug only if Bugzfeed is not working for some reason
    this.fetch();

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
 * [argument] data (Object) bug change object
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.post_changes = function (data) {
  return this.request(`bug/${this.bug.id}`, null, { method: 'PUT', auth: true, data });
};

/*
 * Post attachment changes to Bugzilla.
 *
 * [argument] att_id (Integer) attachment id
 * [argument] data (Object) attachment change object
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.post_att_changes = function (att_id, data) {
  return this.request(`bug/attachment/${att_id}`, null, { method: 'PUT', auth: true, data });
};

/*
 * Post the new attachments added to the bug to Bugzilla.
 *
 * [argument] attachment (Proxy) AttachmentModel instance
 * [return] request (Promise) can be a rejected Promise if any error is found
 */
BzDeck.controllers.Bug.prototype.post_attachment = function (attachment) {
  let size_computable,
      size = 0;

  return this.request(`bug/${this.bug.id}/attachment`, null, {
    method: 'POST',
    auth: true,
    data: Object.assign({}, attachment.data), // Clone the object to drop the custom properties (hash, uploaded)
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
  let uploaded = this.uploads.map(att => att.uploaded).reduce((p, c) => p + c),
      total = this.uploads.total;

  this.trigger(':SubmitProgress', { uploaded, total, percentage: Math.round(uploaded / total * 100) });
};

/*
 * Retrieve the bug to update the timeline, when Bugzfeed is not working.
 *
 * [argument] none
 * [return] result (Boolean) whether the fetcher is invoked
 */
BzDeck.controllers.Bug.prototype.fetch = function () {
  let bugzfeed = BzDeck.controllers.bugzfeed;

  if (bugzfeed.websocket && bugzfeed.subscription.has(this.bug.id)) {
    return false;
  }

  this.bug.fetch();

  return true;
};
