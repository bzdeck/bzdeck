/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Model that represents a downloaded bug. Available through the BugCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html Bugzilla API}
 */
BzDeck.BugModel = class BugModel extends BzDeck.BaseModel {
  /**
   * Get an BugModel instance.
   * @constructor
   * @param {Object} data - Bugzilla's raw bug object.
   * @returns {Proxy} Proxified BugModel instance, so consumers can seamlessly access bug properties via bug.prop
   *  instead of bug.data.prop.
   */
  constructor (data) {
    super(data.id); // Assign this.id

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'bugs';

    // [2015-08-10] Remove unnecessary attachment data introduced by a bug on AttachmentModel
    for (const key of Object.keys(data)) if (!isNaN(key)) {
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
      is_involved: {
        enumerable: true,
        get: () => this.detect_if_involved(),
      },
      participants: {
        enumerable: true,
        get: () => this.get_participants(),
      },
      extract: {
        enumerable: true,
        get: () => this.get_extract(),
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

    return this.proxy();
  }

  /**
   * Save data only if the user is involved in the bug or the bug is starred. This aims to prevent the database from
   * becoming bloated with irrelevant, outdated bugs.
   * @override
   * @param {Object} [data] - Raw data object.
   * @returns {Promise.<Proxy>} Proxified BugModel instance.
   */
  async save (data = undefined) {
    if (this.is_involved || this.data.starred) {
      super.save(data);
    }

    return this.proxy();
  }

  /**
   * Retrieve bug data from Bugzilla.
   * @param {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @param {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @returns {Promise.<Proxy>} Proxified BugModel instance.
   */
  async fetch (include_metadata = true, include_details = true) {
    const _fetch = async (method, param_str = '') => {
      const params = new URLSearchParams(param_str);
      let path = `bug/${this.id}`;

      if (method === 'last_visit') {
        path = `bug_user_last_visit/${this.id}`;
      } else if (method) {
        path += `/${method}`;
      }

      return BzDeck.host.request(path, params);
    };

    const fetchers = [];
    let result;

    fetchers.push(include_metadata ? _fetch() : Promise.resolve());
    fetchers.push(include_metadata ? _fetch('last_visit') : Promise.resolve());

    if (include_details) {
      fetchers.push(_fetch('comment'), _fetch('history'), _fetch('attachment', 'exclude_fields=data'));
    }

    try {
      result = await Promise.all(fetchers);
    } catch (error) {
      throw new Error('Failed to fetch bugs from Bugzilla.');
    }

    const [_meta, _visit, _comments, _history, _attachments] = result;
    let _bug;

    if (include_metadata ? _meta.error : _comments.error) { // _meta is an empty resolve when include_metadata = false
      _bug = { id: this.id, error: { code: _meta.code, message: _meta.message }};
    } else {
      if (include_metadata) {
        _bug = _meta.bugs[0];
        // Check the bug_user_last_visit results carefully. Bugzilla 5.0 has solved the issue. (Bug 1169181)
        _bug._last_visit = _visit && _visit[0] ? _visit[0].last_visit_ts : null;
      } else {
        _bug = { id: this.id };
      }

      if (include_details) {
        _bug.comments = _comments.bugs[this.id].comments;
        _bug.history = _history.bugs[0].history || [];
        _bug.attachments = _attachments.bugs[this.id] || [];

        for (const att of _bug.attachments) {
          BzDeck.collections.attachments.set(att.id, att);
        }
      }
    }

    this.merge(_bug);

    return this.proxy();
  }

  /**
   * Merge the provided bug data with the locally cached data, parse the changes to update the unread status if needed,
   * then notify any changes detected.
   * @param {Object} [data] - Bugzilla's raw bug object.
   * @fires BugModel#Updated
   * @fires BugModel#CacheUpdated
   * @fires BugModel#AnnotationUpdated
   * @returns {Boolean} Whether the cache is found.
   */
  merge (data) {
    const cache = this.data;

    if (!cache) {
      this.save(data);

      return false;
    }

    // Deproxify cache and merge data
    data = Object.assign({}, cache, data);

    const cached_time = new Date(cache.last_change_time);
    const cmp_time = obj => new Date(obj.creation_time || obj.when) > cached_time;
    const get_time = str => (new Date(str)).getTime(); // integer
    const new_comments = new Map((data.comments || []).filter(c => cmp_time(c))
                                                      .map(c => [get_time(c.creation_time), c]));
    const new_attachments = new Map((data.attachments || []).filter(a => cmp_time(a))
                                                            .map(a => [get_time(a.creation_time), a]));
    const new_history = new Map((data.history || []).filter(h => cmp_time(h)).map(h => [get_time(h.when), h]));
    const timestamps = new Set([...new_comments.keys(), ...new_attachments.keys(), ...new_history.keys()].sort());

    (async () => {
      const ignore_cc = (await BzDeck.prefs.get('notifications.ignore_cc_changes')) !== false;

      data._update_needed = false;

      // Combine all changes into one Map, then notify
      for (const time of timestamps) {
        const changes = new Map();
        const comment = new_comments.get(time);
        const attachment = new_attachments.get(time);
        const history = new_history.get(time);

        if (comment) {
          changes.set('comment', comment);
        }

        if (attachment) {
          changes.set('attachment', attachment);
        }

        if (history) {
          changes.set('history', history);
        }

        this.trigger('#Updated', { bug_id: this.id, changes });
      }

      this.save(data);
      this.trigger('#CacheUpdated', { bug_id: this.id });

      // If the cache was read but the updated data is unread, fire an event to update the UI
      if (cache._last_visit && new Date(cache._last_visit) >= cached_time && this.unread) {
        this.trigger('BugModel#AnnotationUpdated', { bug_id: this.id, type: 'unread', value: true });
      }
    })();

    return true;
  }

  /**
   * Update the bug's annotation and notify the change.
   * @param {String} type - Annotation type: star.
   * @param {Boolean} value - Whether to add star or not.
   * @fires BugModel#AnnotationUpdated
   * @returns {Boolean} Whether the annotation is updated.
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
    this.trigger('#AnnotationUpdated', { bug_id: this.id, type, value });

    return true;
  }

  /**
   * Update the last-visited timestamp on Bugzilla through the API.
   * @todo For a better offline experience, synchronize the timestamp once going online.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug-user-last-visit.html Bugzilla API}
   */
  async mark_as_read () {
    const result = await BzDeck.host.request(`bug_user_last_visit/${this.id}`, null, { method: 'POST', data: {}});

    if (Array.isArray(result) && result[0]) {
      this.update_last_visit(result[0].last_visit_ts);
    }
  }

  /**
   * Update the last-visited timestamp in cache.
   * @param {String} ts - Last visited timestamp.
   * @fires BugModel#AnnotationUpdated
   */
  update_last_visit (ts) {
    this.data._last_visit = ts;
    this.save();
    this.trigger('#AnnotationUpdated', { bug_id: this.id, type: 'unread', value: false });
  }

  /**
   * Get the duplicated bug list for this bug. The duplicates are currently not part of the API, so parse the comments
   * to generate the list. This list could be empty if the comments are not fetched yet. The list may also contain false
   * info if a duplicated bug has been reopened. This unreliable method won't be necessary once the API offers the
   * duplicates field (Bug 880163, BzDeck #317).
   * @returns {Array.<Number>} Duplicate bug IDs.
   */
  get_duplicates () {
    const duplicates = new Set(); // Use a Set to avoid potential duplicated IDs

    for (const comment of this.data.comments || []) {
      const match = comment.text.match(/Bug (\d+) has been marked as a duplicate of this bug/);

      if (match) {
        duplicates.add(Number(match[1]));
      }
    }

    return [...duplicates].sort();
  }

  /**
   * Check if the bug is unread or has been changed within the last 14 days.
   * @returns {Promise.<Boolean>} Whether the bug is new.
   */
  async detect_if_new () {
    const visited = (new Date(this.data._last_visit)).getTime();
    const changed = (new Date(this.data.last_change_time)).getTime();
    const time10d = Date.now() - 1000 * 60 * 60 * 24 * 14;
    const is_new = changed > time10d;

    const has_new = entry => {
      const time = new Date(entry.creation_time);

      return (visited && time > visited) || time > time10d;
    };

    // Check for new comments
    if (this.data.comments && this.data.comments.some(has_new)) {
      return true;
    }

    // Check for new attachments
    if (this.data.attachments && this.data.attachments.some(has_new)) {
      return true;
    }

    const ignore_cc = await BzDeck.prefs.get('notifications.ignore_cc_changes');

    // Ignore CC Changes option
    if (visited && ignore_cc !== false) {
      for (const h of this.data.history || []) {
        const time = (new Date(h.when)).getTime(); // Should be an integer for the following === comparison
        const non_cc_changes = h.changes.some(c => c.field_name !== 'cc');

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
  }

  /**
   * Check if the current BzDeck user is involved in this bug in any way.
   * @returns {Boolean} Whether the user is involved.
   */
  detect_if_involved () {
    const email = BzDeck.account.data.name;

    return this.data.creator === email || this.data.assigned_to === email || this.data.qa_contact === email ||
           (this.data.cc || []).includes(email) || (this.data.mentors || []).includes(email) ||
           (this.data.flags || []).some(flag => flag.requestee === email);
  }

  /**
   * Get a list of people involved in the bug.
   * @returns {Map.<String, Object>} List of all participants. The map's key is an account name and the value is the
   *  person's "detail" object in the raw bug object.
   */
  get_participants () {
    const participants = new Map([[this.data.creator, this.data.creator_detail]]);

    const add = person => {
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

    for (const cc_detail of this.data.cc_detail || []) {
      add(cc_detail);
    }

    for (const mentors_detail of this.data.mentors_detail || []) {
      add(mentors_detail);
    }

    for (const { creator: name } of this.data.comments || []) {
      add({ name });
    }

    for (const { creator: name } of this.data.attachments || []) {
      add({ name });
    }

    for (const { who: name } of this.data.history || []) {
      add({ name });
    }

    return participants;
  }

  /**
   * Get the last commenter on the bug. If the comments are not retrieved yet, the reporter will be returned instead.
   * @returns {Promise.<Object>} The contributor's basic info.
   */
  async get_contributor () {
    const comments = this.data.comments;
    const name = comments ? comments[comments.length - 1].creator : this.data.creator;
    const contributor = await BzDeck.collections.users.get(name, { name });

    return contributor.properties;
  }

  /**
   * Get an extract of a comment.
   * @param {Number} [comment_id] - If not specified, the last comment will be used.
   * @returns {String} Comment extract.
   */
  get_extract (comment_id) {
    const comments = this.data.comments;

    // The bug's comments could not be retrieved yet
    if (!comments || !comments.length) {
      return '';
    }

    const comment = comment_id ? comments.find(comment => comment.id === comment_id) : comments[comments.length - 1];

    if (!comment) {
      return '';
    }

    let extract = comment.text;

    if (comment.count === 0 && extract === '') {
      return `(No description)`; // l10n
    }

    // Remove quote headers and quotes (TODO: This requires l10n)
    extract = extract.replace(/^(\(In\ reply\ to|>).*/gm, '');
    // Remove attachment/review comment headers (TODO: This requires l10n)
    extract = extract.replace(/^(Comment\ on\ attachment\ \d+\n|Review\ of\ attachment\ \d+:\n\-+\n).*/gm, '');
    // Remove like breaks, leading and trailing spaces
    extract = extract.replace(/\s+/gm, ' ').trim();
    // Boil down to 140 characters
    extract = extract.length <= 140 ? extract : extract.substr(0, 136) + ' ...';

    return extract;
  }

  /**
   * Create and return a Proxy for the bug changes object that fires an event whenever any field value is modified.
   * @fires BugModel#FieldEdited
   * @returns {Proxy} Changes object.
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
   * @fires BugModel#BugEdited
   */
  onedit () {
    const { changes, att_changes, uploads, can_submit } = this;
    const _changes = Object.assign({}, changes); // Deproxify for data transfer

    this.trigger('#BugEdited', { bug_id: this.id, changes: _changes, att_changes, uploads, can_submit });
  }

  /**
   * Called whenever a new comment is edited by the user. Cache the comment and notify changes accordingly.
   * @param {String} comment - Comment text.
   * @fires BugModel#CommentEdited
   */
  edit_comment (comment) {
    const bug_id = this.id;

    if (comment.match(/\S/)) {
      const added = !this.has_comment;

      this.changes.comment = { body: comment, is_markdown: BzDeck.host.markdown_supported };

      if (added) {
        this.trigger('#CommentEdited', { bug_id, added: true, has_comment: true, can_submit: this.can_submit });
        this.onedit();
      }
    } else {
      const removed = this.has_comment;

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
   */
  edit_field (name, value) {
    const { field, product } = BzDeck.host.data.config.bzapi;
    const is_closed = value => field.status.closed.includes(value);

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
        const { version: versions, component, target_milestone_detail } = product[value];
        const components = Object.keys(component);
        const milestones = target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name);

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
   * @fires BugModel#FlagEdited
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html Bugzilla API}
   */
  edit_flag (flag, added) {
    const flags = this.changes.flags = this.changes.flags || [];

    if (added) {
      flags.push(flag);
    } else {
      const { id, name, requestee } = flag;
      const index = flags.findIndex(f => f.id === id || (f.name === name && f.requestee === requestee));

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
   * Called whenever the user attempted to add a new value to any multiple-value field. Cache and notify the changes.
   * @param {String} field - keywords, cc, etc.
   * @param {*} value - Any value to be added.
   * @fires BugModel#FieldValueAdded
   * @returns {Boolean} Whether the value is successfully added to the cache.
   */
  add_field_value (field, value) {
    const change = Object.assign({}, this.changes[field] || {});

    if ((change.remove || []).includes(value)) {
      change.remove.splice(change.remove.indexOf(value), 1);
    } else {
      change.add = change.add || [];

      if ((this.data[field] || []).includes(value) || change.add.includes(value)) {
        return false;
      }

      change.add.push(value);
    }

    this.changes[field] = change;
    this.cleanup_multiple_item_change(field);
    this.trigger('#FieldValueAdded', { bug_id: this.id, field, value });
    this.onedit();

    return true;
  }

  /**
   * Called whenever the user attempted to remove a value from any multiple-value field. Cache and notify the changes.
   * @param {String} field - keywords, cc, etc.
   * @param {*} value - Any value to be removed.
   * @fires BugModel#FieldValueRemoved
   * @returns {Boolean} Whether the value is successfully removed to the cache.
   */
  remove_field_value (field, value) {
    const change = Object.assign({}, this.changes[field] || {});

    if ((change.add || []).includes(value)) {
      change.add.splice(change.add.indexOf(value), 1);
    } else {
      change.remove = change.remove || [];

      if (!(this.data[field] || []).includes(value) || change.remove.includes(value)) {
        return false;
      }

      change.remove.push(value);
    }

    this.changes[field] = change;
    this.cleanup_multiple_item_change(field);
    this.trigger('#FieldValueRemoved', { bug_id: this.id, field, value });
    this.onedit();

    return true;
  }

  /**
   * Called whenever a participant is added by the user. Cache the value and notify changes accordingly.
   * @param {String} field - assigned_to, qa_contact, mentor or cc.
   * @param {String} email - Account name of the participant to be added.
   * @fires BugModel#ParticipantAdded
   * @returns {Boolean} Whether the participant is successfully added to the cache.
   */
  add_participant (field, email) {
    if (['mentor', 'cc'].includes(field)) {
      if (!this.add_field_value(field, email)) {
        return false;
      }
    } else {
      if (this.changes[field] === email) {
        return false;
      }

      if (this.data[field] === email) {
        delete this.changes[field];
      } else {
        this.changes[field] = email;
      }

      this.onedit();
    }

    this.trigger('#ParticipantAdded', { bug_id: this.id, field, email });

    return true;
  }

  /**
   * Called whenever a participant is removed by the user. Cache the value and notify changes accordingly.
   * @param {String} field - assigned_to, qa_contact, mentor or cc.
   * @param {String} email - Account name of the participant to be removed.
   * @fires BugModel#ParticipantRemoved
   * @returns {Boolean} Whether the participant is successfully removed from the cache.
   */
  remove_participant (field, email) {
    if (['mentor', 'cc'].includes(field)) {
      if (!this.remove_field_value(field, email)) {
        return false;
      }
    } else {
      if (field === 'assigned_to' && this.data.assigned_to !== BzDeck.host.default_assignee) {
        // Fall back to the default assignee
        this.changes[field] = BzDeck.host.default_assignee;
      } else {
        delete this.changes[field];
      }

      this.onedit();
    }

    this.trigger('#ParticipantRemoved', { bug_id: this.id, field, email });

    return true;
  }

  /**
   * Subscribe to the bug by adding the user's email to the Cc list, or unsubscribe from the bug by removing the user's
   * email from the Cc list. Notify the result accordingly.
   * @param {String} how - add or remove.
   * @fires BugModel#ParticipantAdded
   * @fires BugModel#ParticipantRemoved
   * @fires BugModel#FailedToSubscribe
   * @fires BugModel#FailedToUnsubscribe
   * @fires BugModel#Subscribed
   * @fires BugModel#Unsubscribed
   */
  async update_subscription (how) {
    const subscribe = how === 'add';
    const email = BzDeck.account.data.name;

    // Update the view first
    this.trigger(subscribe ? '#ParticipantAdded' : '#ParticipantRemoved', { bug_id: this.id, field: 'cc', email });

    const result = await this.post_changes({ cc: { [how]: [email] }});

    if (result.error) {
      this.trigger(subscribe ? '#FailedToSubscribe' : '#FailedToUnsubscribe', { bug_id: this.id });
    } else {
      this.trigger(subscribe ? '#Subscribed' : '#Unsubscribed', { bug_id: this.id });
      this._fetch();
    }
  }

  /**
   * Clean up a change with both additions and removals, such as mentor or cc. If there are no changes, removed the
   * object from the cache.
   * @param {String} field - mentor or cc.
   * @returns {Boolean} Whether the change object is updated.
   */
  cleanup_multiple_item_change (field) {
    const change = this.changes[field];

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
   * @param {Array.<File>} files - Selected files.
   * @fires BugModel#AttachmentError
   * @todo Integrate online storage APIs to upload large attachments (#111)
   */
  attach_files (files) {
    const oversized_files = new Set();
    const max_size = BzDeck.host.data.config.bzapi.max_attachment_size;

    for (const _file of files) {
      const worker = new SharedWorker('/static/scripts/workers/tasks.js');
      const file = _file; // Redeclare the variable so it can be used in the following load event
      const is_patch = /\.(patch|diff)$/.test(file.name) || /^text\/x-(patch|diff)$/.test(file.type);

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
          bug_id: this.id,
        }, file.size);
        worker.port.close();
      }, { once: true });

      worker.port.start();
      worker.port.postMessage(['readfile', { file }]);
    }

    if (!oversized_files.size) {
      return;
    }

    const num_format = num => num.toLocaleString('en-US');
    const max = num_format(max_size);
    let message;

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
   */
  attach_text (text) {
    const worker = new SharedWorker('/static/scripts/workers/tasks.js');
    const blob = new Blob([text], { type: 'text/plain' });
    const file_name = FlareTail.util.Misc.hash(32) + '.txt';
    const is_patch = !!text.match(/\-\-\-\ .*\n\+\+\+\ .*(?:\n[@\+\-\ ].*)+/m);
    const is_ghpr = text.match(/^https:\/\/github\.com\/(.*)\/pull\/(\d+)$/);
    const is_mrbr = text.match(/^https:\/\/reviewboard\.mozilla\.org\/r\/(\d+)\/$/);
    let summary = text.substr(0, 25) + (text.length > 25 ? '...' : '');
    let content_type = 'text/plain';

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
      const data = event.data.split(',')[1]; // Drop 'data:text/plain;base64,'

      this.add_attachment({ data, summary, file_name, content_type, is_patch }, blob.size);
      worker.port.close();
    }, { once: true });

    worker.port.start();
    worker.port.postMessage(['readfile', { file: blob }]);
  }

  /**
   * Find an attachment index from the cached new attachment list by comparing the hash values.
   * @param {String} hash - Hash value of the attachment object to find.
   * @returns {Number} 0 or a positive integer if the attachment is found, -1 if not found.
   */
  find_att_index (hash) {
    return this.uploads.findIndex(a => a.hash === hash);
  }

  /**
   * Find an attachment object from the cached new attachment list by comparing the hash values.
   * @param {String} hash - Hash value of the attachment object to find.
   * @returns {Proxy} AttachmentModel instance if the attachment is found, undefined if not found.
   */
  find_attachment (hash) {
    return this.uploads.find(a => a.hash === hash);
  }

  /**
   * Add an attachment to the cached new attachment list.
   * @param {Object} att - Raw attachment upload object for Bugzilla.
   * @param {Number} size - Actual file size.
   * @fires BugModel#AttachmentAdded
   * @fires BugModel#UploadListUpdated
   */
  async add_attachment (att, size) {
    // Cache as an AttachmentModel instance
    const attachment = await BzDeck.collections.attachments.cache(att, size);

    // Check if the file has already been attached
    if (this.find_attachment(attachment.hash)) {
      return;
    }

    this.uploads.push(attachment);

    this.trigger('#AttachmentAdded', { bug_id: this.id, id: attachment.id });
    this.trigger('#UploadListUpdated', { bug_id: this.id, uploads: this.uploads.map(att => Object.assign({}, att)) });
    this.onedit();
  }

  /**
   * Remove an attachment from the cached new attachment list.
   * @param {String} hash - Hash value of the attachment object to remove.
   * @fires BugModel#AttachmentRemoved
   * @fires BugModel#UploadListUpdated
   * @returns {Boolean} Whether the attachment is found and removed.
   */
  remove_attachment (hash) {
    const index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index, 1);

    this.trigger('#AttachmentRemoved', { bug_id: this.id, index, hash });
    this.trigger('#UploadListUpdated', { bug_id: this.id, uploads: this.uploads.map(att => Object.assign({}, att)) });
    this.onedit();

    return true;
  }

  /**
   * Edit a property of an unuploaded or existing attachment.
   * @param {Number} id - Numeric ID for an existing attachment or undefined for an unuploaded one.
   * @param {String} hash - Hash value for an unuploaded attachment or undefined for an existing one.
   * @param {String} prop - Edited property name.
   * @param {*} value - New value.
   * @fires BugModel#AttachmentEdited
   */
  async edit_attachment ({ id, hash, prop, value } = {}) {
    if (hash) {
      // Edit a new attachment
      const attachment = this.find_attachment(hash);

      if (attachment && attachment[prop] !== value) {
        attachment[prop] = value;

        this.trigger('#AttachmentEdited', { bug_id: this.id, id, hash, prop, value });
        this.onedit();
      }

      return;
    }

    // Edit an existing attachment
    const attachment = await BzDeck.collections.attachments.get(id);

    if (!attachment || attachment.bug_id !== this.data.id) {
      return;
    }

    const changes = this.att_changes.get(id) || {};
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

    this.trigger('#AttachmentEdited', { bug_id: this.id, id, hash, prop, value });
    this.onedit();
  }

  /**
   * Move up an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
   * @param {String} hash - Hash value of the attachment object to move.
   * @returns {Boolean} Whether the attachment is found and reordered.
   */
  move_up_attachment (hash) {
    const index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index - 1, 2, this.uploads[index], this.uploads[index - 1]);

    return true;
  }

  /**
   * Move down an attachment within the cached new attachment list when the order of the unuploaded attachments matters.
   * @param {String} hash - Hash value of the attachment object to move.
   * @returns {Boolean} Whether the attachment is found and reordered.
   */
  move_down_attachment (hash) {
    const index = this.find_att_index(hash);

    if (index === -1) {
      return false;
    }

    this.uploads.splice(index, 2, this.uploads[index + 1], this.uploads[index]);

    return true;
  }

  /**
   * Find any errors in the user-modified fields. Only the dupe_of field is supported at this moment.
   * @returns {Array.<String>} List of the detected errors.
   */
  find_errors () {
    const errors = [];

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
   * @fires BugModel#Submit
   * @fires BugModel#SubmitSuccess
   * @fires BugModel#SubmitError
   * @fires BugModel#SubmitComplete
   * @returns {Promise} Can be a rejected Promise if any error is found.
   */
  async submit () {
    if (this.has_errors) {
      this.trigger('#SubmitError', { bug_id: this.id, button_disabled: true, error: this.find_errors()[0] });

      throw new Error('The changes cannot be submitted because of errors.');
    }

    if (!this.can_submit) {
      throw new Error('No changes have been made on the bug.');
    }

    this.trigger('#Submit', { bug_id: this.id });

    this.uploads.total = 0;

    try {
      if (!this.has_changes) {
        // Jump into the attachment(s)
      } else if (Object.keys(this.changes).length === 1 && this.has_comment && this.uploads.length === 1) {
        // If the comment is the only change and there's a single attachment, send the comment with the attachment
        this.uploads[0].comment = this.changes.comment.body;
        this.uploads[0].is_markdown = BzDeck.host.markdown_supported;
      } else {
        // Post the changes first
        const result = await this.post_changes(this.changes);

        if (result.error) {
          throw new Error(result.message);
        }
      }

      // Update existing attachment(s)
      await Promise.all([...this.att_changes].map((...args) => this.post_att_changes(...args)));

      // Upload files in series
      if (this.has_attachments) {
        await this.uploads.reduce(async (sequence, att) => {
          await sequence;
          return this.post_attachment(att);
        }, Promise.resolve());
      }

      // All done! Clear the cached changes and uploads data
      this.reset_changes();
      this.att_changes.clear();
      this.uploads.length = 0;
      this.uploads.total = 0;

      // The timeline will soon be updated via Bugzfeed. Fetch the bug only if Bugzfeed is not working for some reason
      this._fetch();

      this.trigger('#SubmitSuccess', { bug_id: this.id });
    } catch (error) {
      // Failed to post at least one attachment
      this.trigger('#SubmitError', {
        bug_id: this.id,
        button_disabled: false,
        error: error.message || 'Failed to post your comment or attachment(s). Try again later.',
      });
    }

    this.trigger('#SubmitComplete', { bug_id: this.id });
  }

  /**
   * Post the meta data changes made on the bug to Bugzilla.
   * @param {Object} data - Bug change object.
   * @returns {Promise} Can be a rejected Promise if any error is found.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#update-bug Bugzilla API}
   */
  async post_changes (data) {
    return BzDeck.host.request(`bug/${this.data.id}`, null, { method: 'PUT', data });
  }

  /**
   * Post attachment changes to Bugzilla.
   * @param {Number} att_id - Attachment ID.
   * @param {Object} data - Attachment change object.
   * @returns {Promise} Can be a rejected Promise if any error is found.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#update-attachment Bugzilla API}
   */
  async post_att_changes (att_id, data) {
    return BzDeck.host.request(`bug/attachment/${att_id}`, null, { method: 'PUT', data });
  }

  /**
   * Post the new attachments added to the bug to Bugzilla.
   * @param {Proxy} attachment - AttachmentModel instance.
   * @fires BugModel#AttachmentUploaded
   * @fires BugModel#AttachmentUploadError
   * @returns {Promise} Can be a rejected Promise if any error is found.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#create-attachment Bugzilla API}
   */
  async post_attachment (attachment) {
    let size_computable;
    let size = 0;

    try {
      const result = await BzDeck.host.request(`bug/${this.data.id}/attachment`, null, {
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
      });

      if (!result.error) {
        throw new Error(result.message);
      }

      if (!size_computable) {
        attachment.uploaded = size;
        this.notify_upload_progress();
      }

      this.trigger('#AttachmentUploaded', { bug_id: this.id, id: attachment.id });

      this.uploads.total -= attachment.uploaded;
      this.remove_attachment(attachment.hash);
    } catch (error) {
      // Failed to post at least one attachment
      this.trigger('#AttachmentUploadError', {
        bug_id: this.id,
        button_disabled: false,
        error: error.message || 'Failed to upload your attachment. Try again later.',
      });
    }
  }

  /**
   * Notify the upload progress while the new attachment is being uploaded to Bugzilla.
   * @fires BugModel#SubmitProgress
   */
  notify_upload_progress () {
    const uploaded = this.uploads.map(att => att.uploaded).reduce((p, c) => p + c);
    const total = this.uploads.total;
    const percentage = Math.round(uploaded / total * 100);

    this.trigger('#SubmitProgress', { bug_id: this.id, uploaded, total, percentage });
  }

  /**
   * Retrieve the bug to update the timeline, when Bugzfeed is not working.
   */
  _fetch () {
    const bugzfeed = BzDeck.models.bugzfeed;

    if (!bugzfeed.connected || !bugzfeed.subscriptions.has(this.data.id)) {
      this.fetch();
    }
  }
}
