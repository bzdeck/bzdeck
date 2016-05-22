/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Model that represents a downloaded bug. Available through the BugCollection.
 * @extends BzDeck.BaseModel
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html}
 */
BzDeck.BugModel = class BugModel extends BzDeck.BaseModel {
  /**
   * Get an BugModel instance.
   * @constructor
   * @param {Object} data - Bugzilla's raw bug object.
   * @returns {Proxy} bug - Proxified BugModel instance, so consumers can seamlessly access bug properties via bug.prop
   *  instead of bug.data.prop.
   */
  constructor (data) {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'bugs';
    this.id = data.id;

    // [2015-08-10] Remove unnecessary attachment data introduced by a bug on AttachmentModel
    for (let key of Object.keys(data)) if (!isNaN(key)) {
      delete data[key];
    }

    this.cache(data);

    this.reset_changes();
    this.att_changes = new Map();
    this.uploads = Object.create(Array.prototype, { total: { writable: true, value: 0 }});

    Object.defineProperties(this, {
      starred: {
        enumerable: true,
        // For backward compatibility, check for the obsolete Set-typed property as well
        get: () => this.data._starred_comments ? !!this.data._starred_comments.size : this.data._starred || false,
        set: value => this.update_annotation('starred', value),
      },
      unread: {
        enumerable: true,
        get: () => this.data._last_visit && new Date(this.data._last_visit) < new Date(this.data.last_change_time),
      },
      alias: {
        enumerable: true,
        // For backward compatibility, check the type that has been changed from String to Array with Bugzilla 5.0
        get: () => !this.data.alias ? [] : Array.isArray(this.data.alias) ? this.data.alias : [this.data.alias],
      },
      duplicates: {
        enumerable: true,
        get: () => this.get_duplicates(),
      },
      is_new: {
        enumerable: true,
        get: () => this.detect_if_new(), // Promise
      },
      participants: {
        enumerable: true,
        get: () => this.get_participants(),
      },
      contributors: {
        enumerable: true,
        get: () => this.get_contributors(),
      },
      // Draft
      has_changes:      { get: () => !!Object.keys(this.changes).length },
      has_att_changes:  { get: () => !!this.att_changes.size },
      has_comment:      { get: () => !!this.changes.comment },
      has_attachments:  { get: () => !!this.uploads.length },
      has_errors:       { get: () => !!this.find_errors().length },
      can_submit:       { get: () => !this.has_errors &&
                                      (this.has_changes || this.has_att_changes || this.has_attachments) },
    });

    // Hardcode an empty array until Bug 1269212 is solved
    this.data.mentors = this.data.mentors_detail = [];

    return this.proxy();
  }

  /**
   * Retrieve bug data from Bugzilla.
   * @param {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @param {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @returns {Promise.<Proxy>} bug - Promise to be resolved in the proxified BugModel instance.
   */
  fetch (include_metadata = true, include_details = true) {
    let _fetch = (method, param_str = '') => new Promise((resolve, reject) => {
      let path = `bug/${this.id}`;
      let params = new URLSearchParams(param_str);

      if (method === 'last_visit') {
        path = `bug_user_last_visit/${this.id}`;
      } else if (method) {
        path += `/${method}`;
      }

      BzDeck.host.request(path, params).then(result => resolve(result), event => reject(new Error()));
    });

    let fetchers = [];

    fetchers.push(include_metadata ? _fetch() : Promise.resolve());
    fetchers.push(include_metadata ? _fetch('last_visit') : Promise.resolve());

    if (include_details) {
      fetchers.push(_fetch('comment'), _fetch('history'), _fetch('attachment', 'exclude_fields=data'));
    }

    return Promise.all(fetchers).then(values => {
      let _bug;

      if (values[include_metadata ? 0 : 2].error) { // values[0] is an empty resolve when include_metadata is false
        _bug = { id: this.id, error: { code: values[0].code, message: values[0].message }};
      } else {
        if (include_metadata) {
          _bug = values[0].bugs[0];
          // Check the bug_user_last_visit results carefully. Bugzilla 5.0 has solved the issue. (Bug 1169181)
          _bug._last_visit = values[1] && values[1][0] ? values[1][0].last_visit_ts : null;
        } else {
          _bug = { id: this.id };
        }

        if (include_details) {
          _bug.comments = values[2].bugs[this.id].comments;
          _bug.history = values[3].bugs[0].history || [];
          _bug.attachments = values[4].bugs[this.id] || [];

          for (let att of _bug.attachments) {
            BzDeck.collections.attachments.set(att.id, att);
          }
        }
      }

      this.merge(_bug);

      return Promise.resolve(this.proxy());
    }, error => Promise.reject(new Error('Failed to fetch bugs from Bugzilla.')));
  }

  /**
   * Merge the provided bug data with the locally cached data, parse the changes to update the unread status if needed,
   * then notify any changes detected.
   * @param {Object} [data] - Bugzilla's raw bug object.
   * @returns {Boolean} cached - Whether the cache is found.
   * @fires BugModel#Updated
   */
  merge (data) {
    let cache = this.data;

    if (!cache) {
      this.save(data);

      return false;
    }

    // Deproxify cache and merge data
    data = Object.assign({}, cache, data);

    let cached_time = new Date(cache.last_change_time);
    let cmp_time = obj => new Date(obj.creation_time || obj.when) > cached_time;
    let get_time = str => new Date(str).getTime(); // integer
    let new_comments = new Map((data.comments || []).filter(c => cmp_time(c)).map(c => [get_time(c.creation_time), c]));
    let new_attachments = new Map((data.attachments || []).filter(a => cmp_time(a))
                                                          .map(a => [get_time(a.creation_time), a]));
    let new_history = new Map((data.history || []).filter(h => cmp_time(h)).map(h => [get_time(h.when), h]));
    let timestamps = new Set([...new_comments.keys(), ...new_attachments.keys(), ...new_history.keys()].sort());

    BzDeck.prefs.get('notifications.ignore_cc_changes').then(ignore_cc => {
      ignore_cc = ignore_cc !== false;
      data._update_needed = false;

      // Mark the bug as read when the Ignore CC Changes option is enabled and there are only CC changes
      if (ignore_cc && !new_comments.size && !new_attachments.size &&
          ![...new_history.values()].some(h => h.changes.some(c => c.field_name !== 'cc'))) {
        this.mark_as_read();
      }

      // Combine all changes into one Map, then notify
      for (let time of timestamps) {
        let changes = new Map();
        let comment = new_comments.get(time);
        let attachment = new_attachments.get(time);
        let history = new_history.get(time);

        if (comment) {
          changes.set('comment', comment);
        }

        if (attachment) {
          changes.set('attachment', attachment);
        }

        if (history) {
          changes.set('history', history);
        }

        this.trigger_safe('#Updated', { bug_id: this.id, bug: data, changes });
      }

      this.save(data);
    });

    return true;
  }

  /**
   * Update the bug's annotation and notify the change.
   * @param {String} type - Annotation type: star.
   * @param {Boolean} value - Whether to add star or not.
   * @returns {Boolean} result - Whether the annotation is updated.
   * @fires BugModel#AnnotationUpdated
   */
  update_annotation (type, value) {
    if (this.data[`_${type}`] === value) {
      return false;
    }

    // Delete deprecated properties
    delete this.data._last_viewed;
    delete this.data._starred_comments;

    this.data[`_${type}`] = value;
    this.save();
    this.trigger_safe('#AnnotationUpdated', { bug_id: this.id, bug: this.proxy(), type, value });

    return true;
  }

  /**
   * Update the last-visited timestamp on Bugzilla through the API. Mark the bug as read and notify the change.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugModel#AnnotationUpdated
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug-user-last-visit.html}
   */
  mark_as_read () {
    BzDeck.host.request(`bug_user_last_visit/${this.id}`, null, { method: 'POST', data: {}}).then(result => {
      if (Array.isArray(result)) {
        return Promise.resolve(result[0].last_visit_ts);
      } else {
        return Promise.reject(new Error('The last-visited timestamp could not be retrieved'));
      }
    }).catch(error => {
      // Fallback
      // TODO: for a better offline experience, synchronize the timestamp once going online
      return (new Date()).toISOString();
    }).then(value => {
      this.data._last_visit = value;
      this.save();
      this.trigger_safe('#AnnotationUpdated', { bug_id: this.id, bug: this.proxy(), type: 'last_visit', value });
    });
  }

  /**
   * Get the duplicated bug list for this bug. The duplicates are currently not part of the API, so parse the comments
   * to generate the list. This list could be empty if the comments are not fetched yet. The list may also contain false
   * info if a duplicated bug has been reopened. This unreliable method won't be necessary once the API offers the
   * duplicates field (Bug 880163, BzDeck #317).
   * @param {undefined}
   * @returns {Array.<Number>} duplicates - Duplicate bug IDs.
   */
  get_duplicates () {
    let duplicates = new Set(); // Use a Set to avoid potential duplicated IDs

    for (let comment of this.data.comments || []) {
      let match = comment.text.match(/Bug (\d+) has been marked as a duplicate of this bug/);

      if (match) {
        duplicates.add(Number(match[1]));
      }
    }

    return [...duplicates].sort();
  }

  /**
   * Check if the bug is unread or has been changed within the last 14 days.
   * @param {undefined}
   * @returns {Promise.<Boolean>} new - Promise to be resolved in whether the bug is new.
   */
  detect_if_new () {
    let visited = new Date(this.data._last_visit).getTime();
    let changed = new Date(this.data.last_change_time).getTime();
    let time10d = Date.now() - 1000 * 60 * 60 * 24 * 14;
    let is_new = changed > time10d;

    let has_new = entry => {
      let time = new Date(entry.creation_time);
      return (visited && time > visited) || time > time10d;
    };

    // Check for new comments
    if (this.data.comments && this.data.comments.some(has_new)) {
      return Promise.resolve(true);
    }

    // Check for new attachments
    if (this.data.attachments && this.data.attachments.some(has_new)) {
      return Promise.resolve(true);
    }

    return BzDeck.prefs.get('notifications.ignore_cc_changes').then(ignore_cc => {
      // Ignore CC Changes option
      if (visited && ignore_cc !== false) {
        for (let h of this.data.history || []) {
          let time = new Date(h.when).getTime(); // Should be an integer for the following === comparison
          let non_cc_changes = h.changes.some(c => c.field_name !== 'cc');

          if (time > visited && non_cc_changes) {
            return true;
          }

          if (time === changed && !non_cc_changes) {
            return false;
          }
        }
      }

      // Check the unread status
      if (is_new && this.unread) {
        return true;
      }

      // Check the date
      if (is_new) {
        return true;
      }

      return false;
    });
  }

  /**
   * Get a list of people involved in the bug.
   * @param {undefined}
   * @returns {Map.<String, Object>} participants - List of all participants. The map's key is an account name and the
   *  value is the person's "detail" object in the raw bug object.
   */
  get_participants () {
    let participants = new Map([[this.data.creator, this.data.creator_detail]]);

    let add = person => {
      if (!participants.has(person.name)) {
        participants.set(person.name, person);
      }
    };

    if (this.data.assigned_to) {
      add(this.data.assigned_to_detail);
    }

    if (this.data.qa_contact) {
      add(this.data.qa_contact_detail);
    }

    for (let cc_detail of this.data.cc_detail || []) {
      add(cc_detail);
    }

    for (let mentors_detail of this.data.mentors_detail || []) {
      add(mentors_detail);
    }

    for (let { creator: name } of this.data.comments || []) {
      add({ name });
    }

    for (let { creator: name } of this.data.attachments || []) {
      add({ name });
    }

    for (let { who: name } of this.data.history || []) {
      add({ name });
    }

    return participants;
  }

  /**
   * Get a list of people contributing to the bug, excluding the reporter, assignee, QA and mentors. The list may
   * include commenters, attachment creators and flag setters.
   * @param {undefined}
   * @returns {Set.<String>} contributors - List of all contributor account names (email addresses).
   */
  get_contributors () {
    let contributors = new Map(); // key: name, value: number of contributions
    let exclusions = new Set([this.data.creator, this.data.assigned_to, this.data.qa_contact,
                              ...(this.data.mentors || [])]);

    let add = name => {
      if (!exclusions.has(name)) {
        contributors.set(name, contributors.has(name) ? contributors.get(name) + 1 : 1);
      }
    };

    for (let c of this.data.comments || []) {
      add(c.creator);
    }

    for (let a of this.data.attachments || []) {
      add(a.creator);

      for (let f of a.flags || []) if (f.setter !== a.creator) {
        add(f.setter);
      }
    }

    return new Set([...contributors.keys()].sort((a, b) => contributors.get(b) - contributors.get(a)));
  }

  /**
   * Create and return a Proxy for the bug changes object that fires an event whenever any field value is modified.
   * @param {undefined}
   * @returns {Proxy} changes - Changes object.
   * @fires BugModel#FieldEdited
   */
  reset_changes () {
    this.changes = new Proxy({}, {
      set: (obj, name, value) => {
        if (obj[name] !== value) {
          obj[name] = value;
          this.trigger('#FieldEdited', { bug_id: this.id, name, value });
        }

        return true;
      },
      deleteProperty: (obj, name) => {
        if (name in obj) {
          delete obj[name];
          this.trigger('#FieldEdited', { bug_id: this.id, name, value: this.data[name] || '' });
        }

        return true;
      }
    });

    return this.changes;
  }

  /**
   * Called internally whenever a bug field or an attachment property is edited by the user. Fire an event to notify the
   * views of the change.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugModel#BugEdited
   */
  onedit () {
    let { changes, att_changes, uploads, can_submit } = this;

    this.trigger_safe('#BugEdited', { bug_id: this.id, changes, att_changes, uploads, can_submit });
  }

  /**
   * Called whenever a new comment is edited by the user. Cache the comment and notify changes accordingly.
   * @param {String} comment - Comment text.
   * @returns {undefined}
   * @fires BugModel#CommentEdited
   */
  edit_comment (comment) {
    let bug_id = this.id;

    if (comment.match(/\S/)) {
      let added = !this.has_comment;

      this.changes.comment = { body: comment, is_markdown: true };

      if (added) {
        this.trigger('#CommentEdited', { bug_id, added: true, has_comment: true, can_submit: this.can_submit });
        this.onedit();
      }
    } else {
      let removed = this.has_comment;

      delete this.changes.comment;

      if (removed) {
        this.trigger('#CommentEdited', { bug_id, removed: true, has_comment: false, can_submit: this.can_submit });
        this.onedit();
      }
    }
  }

  /**
   * Called whenever any field is edited by the user. Cache the value and notify changes accordingly. Only the following
   * fields are supported at this moment: status, resolution, dupe_of.
   * @param {String} name - Field name.
   * @param {*} value - Field value.
   * @returns {undefined}
   */
  edit_field (name, value) {
    let { field, product } = BzDeck.host.data.config;
    let is_closed = value => field.status.closed.includes(value);

    if (['blocks', 'depends_on', 'see_also', 'dupe_of'].includes(name) &&
        typeof value === 'string' && value.match(/^\d+$/)) {
      value = Number.parseInt(value);
    }

    if (value === this.data[name]) {
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
        let { version: versions, component, target_milestone_detail } = product[value];
        let components = Object.keys(component);
        let milestones = target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name);

        this.changes.version = versions.find(v => ['unspecified'].includes(v)) || versions[0];
        this.changes.component = components.find(c => ['General'].includes(c)) || components[0];
        this.changes.target_milestone = milestones.find(m => ['---'].includes(m)) || milestones[0];
      }

      if (name === 'status') {
        if (is_closed(value)) {
          if (this.data.resolution !== 'FIXED') {
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
  }

  /**
   * Called whenever any flag is edited by the user. Cache the value and notify changes accordingly.
   * @param {Object} flag - Flag change object.
   * @param {Number} flag.id - Bugzilla-defined numeric ID of the flag.
   * @param {String} flag.name - Type of the flag, such as 'review' or 'needinfo'.
   * @param {String} flag.requestee - Person created the flag.
   * @param {Boolean} added - Whether the flag is newly added.
   * @returns {undefined}
   * @fires BugModel#FlagEdited
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html}
   */
  edit_flag (flag, added) {
    let flags = this.changes.flags = this.changes.flags || [];

    if (added) {
      flags.push(flag);
    } else {
      let { id, name, requestee } = flag;
      let index = flags.findIndex(f => f.id === id || (f.name === name && f.requestee === requestee));

      if (index > -1) {
        flags.splice(index, 1);
      }

      if (!flags.length) {
        delete this.changes.flags;
      }
    }

    this.trigger('#FlagEdited', { bug_id: this.id, flags: this.changes.flags, flag, added });
    this.onedit();
  }

  /**
   * Called whenever a participant is added by the user. Cache the value and notify changes accordingly.
   * @param {String} field - assigned_to, qa_contact, mentor or cc.
   * @param {String} email - Account name of the participant to be added.
   * @returns {Boolean} result - Whether the participant is successfully added to the cache.
   * @fires BugModel#ParticipantAdded
   */
  add_participant (field, email) {
    if (['mentor', 'cc'].includes(field)) {
      let change = this.changes[field] || {};

      if ((change.remove || []).includes(email)) {
        change.remove.splice(change.remove.indexOf(email), 1);
      } else {
        change.add = change.add || [];

        if ((this.data[field] || []).includes(email) || change.add.includes(email)) {
          return false;
        }

        change.add.push(email);
      }

      this.changes[field] = change;
    } else {
      if (this.changes[field] === email) {
        return false;
      }

      if (this.data[field] === email) {
        delete this.changes[field];
      } else {
        this.changes[field] = email;
      }
    }

    this.trigger('#ParticipantAdded', { bug_id: this.id, field, email });
    this.onedit();
    this.cleanup_multiple_item_change(field);

    return true;
  }

  /**
   * Called whenever a participant is removed by the user. Cache the value and notify changes accordingly.
   * @param {String} field - assigned_to, qa_contact, mentor or cc.
   * @param {String} email - Account name of the participant to be removed.
   * @returns {Boolean} result - Whether the participant is successfully removed from the cache.
   * @fires BugModel#ParticipantRemoved
   */
  remove_participant (field, email) {
    if (['mentor', 'cc'].includes(field)) {
      let change = this.changes[field] || {};

      if ((change.add || []).includes(email)) {
        change.add.splice(change.add.indexOf(email), 1);
      } else {
        change.remove = change.remove || [];

        if (!(this.data[field] || []).includes(email) || change.remove.includes(email)) {
          return false;
        }

        change.remove.push(email);
      }

      this.changes[field] = change;
    } else {
      this.changes[field] = field === 'assigned_to' ? BzDeck.host.default_assignee : '';
    }

    this.trigger('#ParticipantRemoved', { bug_id: this.id, field, email });
    this.onedit();
    this.cleanup_multiple_item_change(field);

    return true;
  }

  /**
   * Subscribe to the bug by adding the user's email to the Cc list, or unsubscribe from the bug by removing the user's
   * email from the Cc list. Notify the result accordingly.
   * @param {String} how - add or remove.
   * @returns {Promise} request - Can be a rejected Promise if any error is found.
   * @fires BugModel#ParticipantAdded
   * @fires BugModel#ParticipantRemoved
   * @fires BugModel#FailedToSubscribe
   * @fires BugModel#FailedToUnsubscribe
   * @fires BugModel#Subscribed
   * @fires BugModel#Unsubscribed
   */
  update_subscription (how) {
    let subscribe = how === 'add';
    let email = BzDeck.account.data.name;

    // Update the view first
    this.trigger(subscribe ? '#ParticipantAdded' : '#ParticipantRemoved', { bug_id: this.id, field: 'cc', email });

    return this.post_changes({ cc: { [how]: [email] }}).then(result => {
      if (result.error) {
        this.trigger(subscribe ? '#FailedToSubscribe' : '#FailedToUnsubscribe', { bug_id: this.id });
      } else {
        this.trigger(subscribe ? '#Subscribed' : '#Unsubscribed', { bug_id: this.id });
        this._fetch();
      }
    });
  }

  /**
   * Clean up a change with both additions and removals, such as mentor or cc. If there are no changes, removed the
   * object from the cache.
   * @param {String} field - mentor or cc.
   * @returns {Boolean} result - Whether the change object is updated.
   */
  cleanup_multiple_item_change (field) {
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
  }

  /**
   * Called whenever new attachment files are provided by the user through a file input form control or a drag-and-drop
   * action. Read and cache the files. If the file size exceeds Bugzilla's limitation, notify the error.
   * @param {(FileList|Array)} files - Selected files.
   * @returns {undefined}
   * @fires BugModel#AttachmentError
   * @todo Integrate online storage APIs to upload large attachments (#111)
   */
  attach_files (files) {
    let oversized_files = new Set();
    let max_size = BzDeck.host.data.config.max_attachment_size;

    for (let _file of files) {
      let worker = new SharedWorker('/static/scripts/workers/tasks.js');
      let file = _file; // Redeclare the variable so it can be used in the following load event
      let is_patch = /\.(patch|diff)$/.test(file.name) || /^text\/x-(patch|diff)$/.test(file.type);

      // Check if the file is not exceeding the limit
      if (file.size > max_size) {
        oversized_files.add(file);

        continue;
      }

      worker.port.addEventListener('message', event => {
        this.add_attachment({
          data: event.data.split(',')[1], // Drop 'data:<type>;base64,'
          summary: is_patch ? 'Patch' : file.name,
          file_name: file.name,
          content_type: is_patch ? 'text/plain' : file.type || 'application/x-download',
          is_patch,
        }, file.size);
      });

      worker.port.start();
      worker.port.postMessage(['readfile', { file }]);
    }

    if (!oversized_files.size) {
      return;
    }

    let message;
    let num_format = num => num.toLocaleString('en-US');
    let max = num_format(max_size);

    if (oversized_files.size > 1) {
      message = `These files cannot be attached because they may exceed the maximum attachment size (${max} bytes) \
                 specified by the current Bugzilla instance. You can upload the files to an online storage and post \
                 the links instead.`; // l10n
    } else {
      message = `This file cannot be attached because it may exceed the maximum attachment size (${max} bytes) \
                 specified by the current Bugzilla instance. You can upload the file to an online storage and post the \
                 link instead.`; // l10n
    }

    message += '\n\n' + oversized_files.map(file => `* ${file.name} (${num_format(file.size)} bytes)`).join('\n');

    this.trigger('#AttachmentError', { bug_id: this.id, message });
  }

  /**
   * Called whenever a new attachment text is provided by the user through a text input form control or a drag-and-drop
   * action. Read and cache the text.
   * @param {String} text - Added plain text or URL string.
   * @returns {undefined}
   */
  attach_text (text) {
    let worker = new SharedWorker('/static/scripts/workers/tasks.js');
    let blob = new Blob([text], { type: 'text/plain' });
    let summary = text.substr(0, 25) + (text.length > 25 ? '...' : '');
    let file_name = URL.createObjectURL(blob).match(/\w+$/)[0] + '.txt';
    let content_type = 'text/plain';
    let is_patch = !!text.match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/m);
    let is_ghpr = text.match(/^https:\/\/github\.com\/(.*)\/pull\/(\d+)$/);
    let is_mrbr = text.match(/^https:\/\/reviewboard\.mozilla\.org\/r\/(\d+)\/$/);

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

    worker.port.addEventListener('message', event => {
      let data = event.data.split(',')[1]; // Drop 'data:text/plain;base64,'

      this.add_attachment({ data, summary, file_name, content_type, is_patch }, blob.size);
    });

    worker.port.start();
    worker.port.postMessage(['readfile', { file: blob }]);
  }

  /**
   * Find an attachment index from the cached new attachment list by comparing the hash values.
   * @param {String} hash - Hash value of the attachment object to find.
   * @returns {Number} index - 0 or a positive integer if the attachment is found, -1 if not found.
   */
  find_att_index (hash) {
    return this.uploads.findIndex(a => a.hash === hash);
  }

  /**
   * Find an attachment object from the cached new attachment list by comparing the hash values.
   * @param {String} hash - Hash value of the attachment object to find.
   * @returns {Proxy} attachment - AttachmentModel instance if the attachment is found, undefined if not found
   */
  find_attachment (hash) {
    return this.uploads.find(a => a.hash === hash);
  }

  /**
   * Add an attachment to the cached new attachment list.
   * @param {Object} att - Raw attachment upload object for Bugzilla.
   * @param {Number} size - Actual file size.
   * @returns {undefined}
   * @fires BugModel#AttachmentAdded
   * @fires BugModel#UploadListUpdated
   */
  add_attachment (att, size) {
    // Cache as an AttachmentModel instance
    BzDeck.collections.attachments.cache(att, size).then(attachment => {
      // Check if the file has already been attached
      if (this.find_attachment(attachment.hash)) {
        return;
      }

      this.uploads.push(attachment);

      this.trigger_safe('#AttachmentAdded', { bug_id: this.id, attachment });
      this.trigger_safe('#UploadListUpdated', { bug_id: this.id, uploads: this.uploads });
      this.onedit();
    });
  }

  /**
   * Remove an attachment from the cached new attachment list.
   * @param {String} hash - Hash value of the attachment object to remove.
   * @returns {Boolean} result - Whether the attachment is found and removed.
   * @fires BugModel#AttachmentRemoved
   * @fires BugModel#UploadListUpdated
   */
  remove_attachment (hash) {
    let index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index, 1);

    this.trigger('#AttachmentRemoved', { bug_id: this.id, index, hash });
    this.trigger_safe('#UploadListUpdated', { bug_id: this.id, uploads: this.uploads });
    this.onedit();

    return true;
  }

  /**
   * Edit a property of an unuploaded or existing attachment.
   * @param {Number} id - Numeric ID for an existing attachment or undefined for an unuploaded one.
   * @param {String} hash - Hash value for an unuploaded attachment or undefined for an existing one.
   * @param {String} prop - Edited property name.
   * @param {*} value - New value.
   * @returns {undefined}
   * @fires BugModel#AttachmentEdited
   */
  edit_attachment ({ id, hash, prop, value } = {}) {
    if (hash) {
      // Edit a new attachment
      let attachment = this.find_attachment(hash);

      if (attachment && attachment[prop] !== value) {
        attachment[prop] = value;

        this.trigger_safe('#AttachmentEdited', { bug_id: this.id, attachment, id, hash, prop, value });
        this.onedit();
      }

      return;
    }

    // Edit an existing attachment
    BzDeck.collections.attachments.get(id).then(attachment => {
      if (!attachment || attachment.bug_id !== this.data.id) {
        return;
      }

      let changes = this.att_changes.get(id) || {};
      let edited = true;

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
        return;
      }

      this.trigger_safe('#AttachmentEdited', { bug_id: this.id, attachment, id, hash, prop, value });
      this.onedit();
    });
  }

  /**
   * Move up an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
   * @param {String} hash - Hash value of the attachment object to move.
   * @returns {Boolean} result - Whether the attachment is found and reordered.
   */
  move_up_attachment (hash) {
    let index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index - 1, 2, this.uploads[index], this.uploads[index - 1]);

    return true;
  }

  /**
   * Move down an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
   * @param {String} hash - Hash value of the attachment object to move.
   * @returns {Boolean} result - Whether the attachment is found and reordered.
   */
  move_down_attachment (hash) {
    let index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index, 2, this.uploads[index + 1], this.uploads[index]);

    return true;
  }

  /**
   * Find any errors in the user-modified fields. Only the dupe_of field is supported at this moment.
   * @param {undefined}
   * @returns {Array.<String>} errors - List of the detected errors.
   */
  find_errors () {
    let errors = [];

    if (this.changes.resolution === 'DUPLICATE' && !this.changes.dupe_of ||
        this.changes.dupe_of !== undefined && typeof this.changes.dupe_of !== 'number' ||
        this.changes.dupe_of === this.data.id) {
      errors.push('Please specify a valid duplicate bug ID.'); // l10n
    }

    if (this.changes.summary === '') {
      errors.push('The summary should not be empty.'); // l10n
    }

    return errors;
  }

  /**
   * Submit all the changes made on the bug to Bugzilla.
   * @param {undefined}
   * @returns {Promise} submission - Can be a rejected Promise if any error is found.
   * @fires BugModel#Submit
   * @fires BugModel#SubmitSuccess
   * @fires BugModel#SubmitError
   * @fires BugModel#SubmitComplete
   */
  submit () {
    if (this.has_errors) {
      this.trigger('#SubmitError', { bug_id: this.id, button_disabled: true, error: this.find_errors()[0] });

      return Promise.reject('The changes cannot be submitted because of errors.');
    }

    if (!this.can_submit) {
      return Promise.reject('No changes have been made on the bug.');
    }

    this.trigger('#Submit', { bug_id: this.id });

    this.uploads.total = 0;

    return new Promise((resolve, reject) => {
      if (!this.has_changes) {
        // Jump into the attachment(s)
        resolve();
      } else if (Object.keys(this.changes).length === 1 && this.has_comment && this.uploads.length === 1) {
        // If the comment is the only change and there's a single attachment, send the comment with the attachment
        this.uploads[0].comment = this.changes.comment.body;
        this.uploads[0].is_markdown = true;
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
      this._fetch();

      this.trigger('#SubmitSuccess', { bug_id: this.id });
    }).catch(error => {
      // Failed to post at least one attachment
      this.trigger('#SubmitError', {
        bug_id: this.id,
        button_disabled: false,
        error: error.message || 'Failed to post your comment or attachment(s). Try again later.',
      });
    }).then(() => {
      this.trigger('#SubmitComplete', { bug_id: this.id });
    });
  }

  /**
   * Post the meta data changes made on the bug to Bugzilla.
   * @param {Object} data - Bug change object.
   * @returns {Promise} request - Can be a rejected Promise if any error is found.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#update-bug}
   */
  post_changes (data) {
    return BzDeck.host.request(`bug/${this.data.id}`, null, { method: 'PUT', data });
  }

  /**
   * Post attachment changes to Bugzilla.
   * @param {Number} att_id - Attachment ID.
   * @param {Object} data - Attachment change object.
   * @returns {Promise} request - Can be a rejected Promise if any error is found.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#update-attachment}
   */
  post_att_changes (att_id, data) {
    return BzDeck.host.request(`bug/attachment/${att_id}`, null, { method: 'PUT', data });
  }

  /**
   * Post the new attachments added to the bug to Bugzilla.
   * @param {Proxy} attachment - AttachmentModel instance.
   * @returns {Promise} request - Can be a rejected Promise if any error is found.
   * @fires BugModel#AttachmentUploaded
   * @fires BugModel#AttachmentUploadError
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#create-attachment}
   */
  post_attachment (attachment) {
    let size_computable;
    let size = 0;

    return BzDeck.host.request(`bug/${this.data.id}/attachment`, null, {
      method: 'POST',
      data: Object.assign({}, attachment.data), // Clone the object to drop the custom properties (hash, uploaded)
      listeners: {
        progress: data => {
          if (!size) {
            size_computable = data.lengthComputable;
            size = data.total;
            this.uploads.total += size;
          }

          if (size_computable) {
            attachment.uploaded = data.loaded;
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

      this.trigger_safe('#AttachmentUploaded', { bug_id: this.id, attachment });

      this.uploads.total -= attachment.uploaded;
      this.remove_attachment(attachment.hash);
    }).catch(error => {
      // Failed to post at least one attachment
      this.trigger('#AttachmentUploadError', {
        bug_id: this.id,
        button_disabled: false,
        error: error.message || 'Failed to upload your attachment. Try again later.',
      });
    });
  }

  /**
   * Notify the upload progress while the new attachment is being uploaded to Bugzilla.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugModel#SubmitProgress
   */
  notify_upload_progress () {
    let uploaded = this.uploads.map(att => att.uploaded).reduce((p, c) => p + c);
    let total = this.uploads.total;
    let percentage = Math.round(uploaded / total * 100);

    this.trigger('#SubmitProgress', { bug_id: this.id, uploaded, total, percentage });
  }

  /**
   * Retrieve the bug to update the timeline, when Bugzfeed is not working.
   * @param {undefined}
   * @returns {undefined}
   */
  _fetch () {
    let bugzfeed = BzDeck.models.bugzfeed;

    if (!bugzfeed.connected || !bugzfeed.subscriptions.has(this.data.id)) {
      this.fetch();
    }
  }
}
