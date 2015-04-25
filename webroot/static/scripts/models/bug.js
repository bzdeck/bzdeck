/**
 * BzDeck Bug Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Bug Model.
 *
 * [argument] data (Object) Bugzilla's raw bug data object
 * [argument] save (Boolean, optional) whether to save the data immediately
 * [return] bug (Proxy) proxified instance of the BugModel object, so consumers can access bug data seamlessly using
 *                      bug.prop instead of bug.data.prop
 */
BzDeck.models.Bug = function BugModel (data, save = false) {
  this.id = data.id;
  this.cache(data);

  Object.defineProperties(this, {
    'store': {
      'enumerable': true,
      'get': () => this.get_store('account', 'bugs'),
    },
    'transaction': {
      'enumerable': true,
      'get': () => this.get_transaction('account', 'bugs')
    },
    'starred': {
      'enumerable': true,
      'get': () => !!this.data._starred_comments && !!this.data._starred_comments.size,
      'set': value => this.update_star(value),
    },
    'unread': {
      'enumerable': true,
      'get': () => this.data._unread,
      'set': value => this.update_unread(value),
    },
    'aliases': {
      'enumerable': true,
      // Support for multiple aliases on Bugzilla 5.0+
      'get': () => this.data.alias ? (Array.isArray(this.data.alias) ? this.data.alias : [this.data.alias]) : [],
    },
    'is_new': {
      'enumerable': true,
      'get': () => this.detect_if_new(),
    },
    'participants': {
      'enumerable': true,
      'get': () => this.get_participants(),
    },
    'proxy': {
      'get': () => new Proxy(this, { 'get': (obj, prop) => this.data[prop] || this[prop] }),
    },
  });

  if (save) {
    this.save();
  }

  return this.proxy;
};

BzDeck.models.Bug.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Bug.prototype.constructor = BzDeck.models.Bug;

/*
 * Cache bug data as a new Proxy, so the object is automatically saved when a property is modifled.
 *
 * [argument] data (Object) Bugzilla's raw bug data object
 * [return] data (Proxy) proxified bug data object
 */
BzDeck.models.Bug.prototype.cache = function (data) {
  // Deproxify the object just in case
  data = Object.assign({}, data);

  return this.data = new Proxy(data, {
    'get': (obj, prop) => obj[prop], // Always require the get trap (Bug 895223)
    'set': (obj, prop, value) => {
      obj[prop] = value;
      this.store.save(obj);

      return true; // The set trap must return true (Bug 1132522)
    },
  });
};

/*
 * Save bug data in the IndexedDB storage.
 *
 * [argument] data (Object, optional) Bugzilla's raw bug data object
 * [return] bug (Promise -> Proxy) proxified instance of the BugModel object
 */
BzDeck.models.Bug.prototype.save = function (data = undefined) {
  if (data) {
    this.cache(data);
  }

  return this.store.save(this.data).then(() => Promise.resolve(this.proxy));
};

/*
 * Retrieve bug data from Bugzilla.
 *
 * [argument] include_metadata (Boolean, optional) whether to retrieve the metadata of the bug
 * [argument] include_details (Boolean, optional) whether to retrieve the comments, history and attachment metadata
 * [return] bug (Promise -> Proxy or Error) proxified instance of the BugModel object
 */
BzDeck.models.Bug.prototype.fetch = function (include_metadata = true, include_details = true) {
  return BzDeck.models.bugs.fetch([this.id], include_metadata, include_details).then(bugs => {
    this.merge(bugs[0]);

    return Promise.resolve(this.proxy);
  }, error => Promise.reject(error));
};

/*
 * Merge the provided bug data with the cache, parse the changes to update the unread status, then notify any changes.
 *
 * [argument] data (Object, optional) Bugzilla's raw bug data object
 * [return] cached (Boolean) whether the cache is found
 */
BzDeck.models.Bug.prototype.merge = function (data) {
  let cache = this.data;

  if (!cache) {
    data._unread = true;
    this.save(data);

    return false;
  }

  // Deproxify cache and merge data
  data = Object.assign({}, cache, data);

  let ignore_cc = BzDeck.models.prefs.data['notifications.ignore_cc_changes'] !== false,
      cached_time = new Date(cache.last_change_time),
      cmp_time = obj => new Date(obj.creation_time || obj.when) > cached_time,
      new_comments = new Map([for (c of data.comments) if (cmp_time(c)) [new Date(c.creation_time), c]]),
      new_attachments = new Map([for (a of data.attachments || []) if (cmp_time(a)) [new Date(a.creation_time), a]]),
      new_history = new Map([for (h of data.history || []) if (cmp_time(h)) [new Date(h.when), h]]),
      timestamps = new Set([...new_comments.keys(), ...new_attachments.keys(), ...new_history.keys()].sort());

  // Mark the bug unread if the user subscribes CC changes or the bug is already unread
  if (!ignore_cc || cache._unread || !cache._last_viewed ||
      // or there are unread comments or attachments
      new_comments.size || new_attachments.size ||
      // or there are unread non-CC changes
      [for (h of new_history.values()) if ([for (c of h.changes) if (c.field_name !== 'cc') c].length) h].length) {
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

    FlareTail.util.event.trigger(window, 'Bug:Updated', { 'detail': { 'bug': data, changes }});
  }

  this.save(data);

  return true;
};

/*
 * Update the bug's star annotation and notify the change.
 *
 * [argument] starred (Boolean) whether to add star
 * [return] result (Boolean) whether the annotation is updated
 */
BzDeck.models.Bug.prototype.update_star = function (starred) {
  if (!this.data.comments) {
    return false;
  }

  if (!this.data._starred_comments) {
    this.data._starred_comments = new Set();
  }

  if (starred) {
    this.data._starred_comments.add(this.data.comments[0].id);
  } else {
    this.data._starred_comments.clear();
  }

  this.save(); // Force to save the data
  this.trigger('Bug:StarToggled', { 'bug': this.proxy });

  return true;
};

/*
 * Update the bug's unread annotation and notify the change.
 *
 * [argument] unread (Boolean) whether to mark as unread
 * [return] result (Boolean) whether the annotation is updated
 */
BzDeck.models.Bug.prototype.update_unread = function (unread) {
  if (this.data._unread === unread) {
    return false;
  }

  this.data._unread = unread;
  this.trigger('Bug:UnreadToggled', { 'bug': this.proxy });

  return true;
};

/*
 * Check if the bug is unread or has been changed in 10 days.
 *
 * [argument] none
 * [return] new (Boolean) whether the bug is new
 */
BzDeck.models.Bug.prototype.detect_if_new = function () {
  if (this.unread || new Date(this.data.last_change_time) > Date.now() - 1000 * 60 * 60 * 24 * 11) {
    return true;
  }

  // Ignore CC Changes option
  // At first startup, bug details are not loaded yet, so check if the comments exist
  if (BzDeck.models.prefs.data['notifications.ignore_cc_changes'] !== false && this.data._last_viewed) {
    // Check if there is a comment, attachment or non-CC change(s) on the last modified time
    return [for (c of this.data.comments || []) if (new Date(c.creation_time) > this.data._last_viewed) c].length ||
           [for (a of this.data.attachments || []) if (new Date(a.creation_time) > this.data._last_viewed) a].length ||
           [for (h of this.data.history || []) if (new Date(h.when) > this.data._last_viewed &&
               [for (c of h.changes) if (c.field_name !== 'cc') c].length) h].length;
  }

  return false;
};

/*
 * Get a list of people involved in the bug.
 *
 * [argument] none
 * [return] participants (Map) list of all participants
 */
BzDeck.models.Bug.prototype.get_participants = function () {
  let participants = new Map([[this.data.creator, this.data.creator_detail]]);

  if (this.data.assigned_to && !participants.has(this.data.assigned_to)) {
    participants.set(this.data.assigned_to, this.data.assigned_to_detail);
  }

  if (this.data.qa_contact && !participants.has(this.data.qa_contact)) {
    participants.set(this.data.qa_contact, this.data.qa_contact_detail);
  }

  for (let cc of this.data.cc_detail || []) if (!participants.has(cc.name)) {
    participants.set(cc.name, cc);
  }

  for (let mentor of this.data.mentors_detail || []) if (!participants.has(mentor.name)) {
    participants.set(mentor.name, mentor);
  }

  for (let c of this.data.comments || []) if (!participants.has(c.creator)) {
    participants.set(c.creator, { 'name': c.creator });
  }

  for (let a of this.data.attachments || []) if (!participants.has(a.creator)) {
    participants.set(a.creator, { 'name': a.creator });
  }

  for (let h of this.data.history || []) if (!participants.has(h.who)) {
    participants.set(h.who, { 'name': h.who });
  }

  return participants;
};
