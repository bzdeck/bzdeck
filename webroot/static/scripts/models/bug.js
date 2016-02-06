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
   * @argument {Object} data - Bugzilla's raw bug object.
   * @return {Proxy} bug - Proxified BugModel instance, so consumers can seamlessly access bug properties via bug.prop
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

    Object.defineProperties(this, {
      starred: {
        enumerable: true,
        // For backward compatibility, check for the obsolete Set-typed property as well
        get: () => this.data._starred_comments ? !!this.data._starred_comments.size : this.data._starred || false,
        set: value => this.update_annotation('starred', value),
      },
      unread: {
        enumerable: true,
        get: () => this.data._unread || false,
        set: value => this.update_annotation('unread', value),
      },
      aliases: {
        enumerable: true,
        // Support for multiple aliases on Bugzilla 5.0+
        get: () => this.data.alias ? (Array.isArray(this.data.alias) ? this.data.alias : [this.data.alias]) : [],
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
    });

    return this.proxy();
  }

  /**
   * Retrieve bug data from Bugzilla.
   * @argument {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @argument {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @return {Promise.<Proxy>} bug - Promise to be resolved in the proxified BugModel instance.
   */
  fetch (include_metadata = true, include_details = true) {
    let fetch = (method, param_str = '') => new Promise((resolve, reject) => {
      BzDeck.host.request(`bug/${this.id}` + (method ? `/${method}` : ''), new URLSearchParams(param_str))
          .then(result => resolve(result), event => reject(new Error()));
    });

    let fetchers = [include_metadata ? fetch() : Promise.resolve()];

    if (include_details) {
      fetchers.push(fetch('comment'), fetch('history'), fetch('attachment', 'exclude_fields=data'));
    }

    return Promise.all(fetchers).then(values => {
      let _bug;

      if (values[include_metadata ? 0 : 1].error) { // values[0] is an empty resolve when include_metadata is false
        _bug = { id: this.id, error: { code: values[0].code, message: values[0].message }};
      } else {
        _bug = include_metadata ? values[0].bugs[0] : { id: this.id };

        if (include_details) {
          _bug.comments = values[1].bugs[this.id].comments;
          _bug.history = values[2].bugs[0].history || [];
          _bug.attachments = values[3].bugs[this.id] || [];

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
   * Merge the provided bug data with the locally cached data, parse the changes to update the unread status, then
   * notify any changes detected.
   * @argument {Object} [data] - Bugzilla's raw bug object.
   * @return {Boolean} cached - Whether the cache is found.
   */
  merge (data) {
    let cache = this.data;

    if (!cache) {
      data._unread = true;
      this.save(data);

      return false;
    }

    // Deproxify cache and merge data
    data = Object.assign({}, cache, data);

    let cached_time = new Date(cache.last_change_time),
        cmp_time = obj => new Date(obj.creation_time || obj.when) > cached_time,
        get_time = str => new Date(str).getTime(), // integer
        new_comments = new Map((data.comments || []).filter(c => cmp_time(c)).map(c => [get_time(c.creation_time), c])),
        new_attachments = new Map((data.attachments || []).filter(a => cmp_time(a))
                                                          .map(a => [get_time(a.creation_time), a])),
        new_history = new Map((data.history || []).filter(h => cmp_time(h)).map(h => [get_time(h.when), h])),
        timestamps = new Set([...new_comments.keys(), ...new_attachments.keys(), ...new_history.keys()].sort());

    BzDeck.prefs.get('notifications.ignore_cc_changes').then(ignore_cc => {
      ignore_cc = ignore_cc !== false;

      // Mark the bug unread if the user subscribes CC changes or the bug is already unread
      if (!ignore_cc || cache._unread || !cache._last_viewed ||
          // or there are unread comments or attachments
          new_comments.size || new_attachments.size ||
          // or there are unread non-CC changes
          [...new_history.values()].some(h => h.changes.some(c => c.field_name !== 'cc'))) {
        data._unread = true;
      } else {
        // Looks like there are only CC changes, so mark the bug read
        data._unread = false;
      }

      data._update_needed = false;

      // Combine all changes into one Map, then notify
      for (let time of timestamps) {
        let changes = new Map(),
            comment = new_comments.get(time),
            attachment = new_attachments.get(time),
            history = new_history.get(time);

        if (comment) {
          changes.set('comment', comment);
        }

        if (attachment) {
          changes.set('attachment', attachment);
        }

        if (history) {
          changes.set('history', history);
        }

        this.trigger(':Updated', { bug: data, changes });
      }

      this.save(data);
    });

    return true;
  }

  /**
   * Update the bug's annotation and notify the change. If the bug is being marked as read, update the last-visited
   * timestamp on Bugzilla through the API.
   * @argument {String} type - Annotation type: star or unread.
   * @argument {Boolean} value - Whether to add star or mark as unread.
   * @return {Boolean} result - Whether the annotation is updated.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug-user-last-visit.html}
   */
  update_annotation (type, value) {
    if (type === 'unread' && value === false) {
      BzDeck.host.request('bug_user_last_visit/' + this.id, null, {
        method: 'POST',
      }).then(result => {
        if (result[0] && result[0].id === this.id && result[0].last_visit_ts) {
          return Promise.resolve(result[0].last_visit_ts);
        } else {
          return Promise.reject(new Error('The last-visited timestamp could not be retrieved'));
        }
      }).then(timestamp => {
        return new Date(timestamp).getTime();
      }).catch(error => {
        // Fallback
        // TODO: for a better offline experience, synchronize the timestamp once going online
        return Date.now();
      }).then(timestamp => {
        this.data._last_viewed = timestamp;
        this.trigger(':AnnotationUpdated', { bug: this.proxy(), type: 'last_viewed', value: timestamp });
      });
    }

    if (this.data[`_${type}`] === value) {
      return false;
    }

    // Delete the obsolete Set-typed property
    if (type === 'starred') {
      delete this.data._starred_comments;
    }

    this.data[`_${type}`] = value;
    this.trigger(':AnnotationUpdated', { bug: this.proxy(), type, value });

    return true;
  }

  /**
   * Get the duplicated bug list for this bug. The duplicates are currently not part of the API, so parse the comments
   * to generate the list. This list could be empty if the comments are not fetched yet. The list may also contain false
   * info if a duplicated bug has been reopened. This unreliable method won't be necessary once the API offers the
   * duplicates field (Bug 880163, BzDeck #317).
   * @argument {undefined}
   * @return {Array.<Number>} duplicates - Duplicate bug IDs.
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
   * Check if the bug is unread or has been changed within the last 10 days.
   * @argument {undefined}
   * @return {Promise.<Boolean>} new - Promise to be resolved in whether the bug is new.
   */
  detect_if_new () {
    let viewed = this.data._last_viewed,
        changed = new Date(this.data.last_change_time).getTime(),
        time10d = Date.now() - 1000 * 60 * 60 * 24 * 10,
        is_new = changed > time10d;

    let has_new = entry => {
      let time = new Date(entry.creation_time);
      return (viewed && time > viewed) || time > time10d;
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
      if (viewed && ignore_cc !== false) {
        for (let h of this.data.history || []) {
          let time = new Date(h.when).getTime(), // Should be an integer for the following === comparison
              non_cc_changes = h.changes.some(c => c.field_name !== 'cc');

          if (time > viewed && non_cc_changes) {
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
   * @argument {undefined}
   * @return {Map.<String, Object>} participants - List of all participants. The map's key is an account name and the
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
   * @argument {undefined}
   * @return {Set.<String>} contributors - List of all contributor account names (email addresses).
   */
  get_contributors () {
    let contributors = new Map(), // key: name, value: number of contributions
        exclusions = new Set([this.data.creator, this.data.assigned_to, this.data.qa_contact,
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
}
