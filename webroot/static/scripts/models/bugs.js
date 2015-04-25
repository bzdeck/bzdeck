/**
 * BzDeck Bugs Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Bugs Model.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the BugsModel object, when an instance is created
 */
BzDeck.models.Bugs = function BugsModel () {
  Object.defineProperties(this, {
    'store': { 'enumerable': true, 'get': () => this.get_store('account', 'bugs') },
    'transaction': { 'enumerable': true, 'get': () => this.get_transaction('account', 'bugs') },
  });
};

BzDeck.models.Bugs.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Bugs.prototype.constructor = BzDeck.models.Bugs;

/*
 * Get a bug with a specific ID.
 *
 * [argument] id (Number or String) bug ID
 * [argument] record_time (Boolean, optional) whether to record the fetched time in the bug
 * [return] bug (Promise -> Object) new instance of the BugModel object
 */
BzDeck.models.Bugs.prototype.get = function (id, record_time = true) {
  return this.store.get(Number.parseInt(id)).then(_bug => {
    // _bug: Bugzilla's raw bug object
    if (!_bug) {
      _bug = { id, '_unread': true };
    } else if (record_time) {
      _bug._last_viewed = Date.now();
    }

    return Promise.resolve(new BzDeck.models.Bug(_bug, record_time || !_bug.summary));
  });
};

/*
 * Get bugs with specific IDs.
 *
 * [argument] ids (Array(Number) or Set(Number)) list of bug ID
 * [argument] record_time (Boolean, optional) whether to record the fetched time in the bug
 * [return] bugs (Promise -> Map) new instances of the BugModel object
 */
BzDeck.models.Bugs.prototype.get_some = function (ids, record_time = true) {
  return Promise.all([for (id of ids) this.get(id, record_time)])
      .then(bugs => Promise.resolve(new Map([for (bug of bugs) [bug.id, bug]])));
};

/*
 * Get all bugs locally-stored in IndexedDB.
 *
 * [argument] none
 * [return] bugs (Promise -> Map) new instances of the BugModel object
 */
BzDeck.models.Bugs.prototype.get_all = function () {
  return this.store.get_all()
      .then(_bugs => Promise.resolve(new Map([for (_bug of _bugs) [_bug.id, new BzDeck.models.Bug(_bug)]])));
};

/*
 * Retrieve bug data from Bugzilla with specific IDs.
 *
 * [argument] ids (Array or Set) list of bug ID
 * [argument] include_metadata (Boolean, optional) whether to retrieve the metadata of the bug
 * [argument] include_details (Boolean, optional) whether to retrieve the comments, history and attachment metadata
 * [return] bugs (Promise -> Array(Object) or Error) list of retrieved Bugzilla data object
 */
BzDeck.models.Bugs.prototype.fetch = function (ids, include_metadata = true, include_details = true) {
  // Sort the IDs to make sure the subsequent index access always works
  ids = [...ids].sort();

  let fetch = (method, param_str = '') => new Promise((resolve, reject) => {
    let params = new URLSearchParams(param_str);

    ids.forEach(id => params.append('ids', id));
    BzDeck.controllers.global.request('bug' + (method ? `/${ids[0]}/${method}` : ''), params)
        .then(result => resolve(result.bugs), event => reject(new Error()));
  });

  let fetchers = [include_metadata ? fetch() : Promise.resolve()];

  if (include_details) {
    fetchers.push(fetch('comment'), fetch('history'), fetch('attachment', 'exclude_fields=data'));
  }

  return Promise.all(fetchers).then(values => ids.map((id, index) => {
    let _bug = include_metadata ? values[0][index] : { id };

    if (include_details) {
      _bug.comments = values[1][id].comments;
      _bug.history = values[2][index].history || [];
      _bug.attachments = values[3][id] || [];
    }

    return _bug;
  })).catch(error => new Error('Failed to fetch bugs from Bugzilla.'));
};
