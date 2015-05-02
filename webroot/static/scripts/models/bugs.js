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
  });
};

BzDeck.models.Bugs.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Bugs.prototype.constructor = BzDeck.models.Bugs;

/*
 * Load the all bug data from local IndexedDB, create a new Bug Model instance for each bug, then cache them in a new
 * Map for faster access.
 *
 * [argument] none
 * [return] bugs (Promise -> Map(Integer, Proxy)) new instances of the BugModel object, same as get_all
 */
BzDeck.models.Bugs.prototype.load = function () {
  this.store.get_all().then(_bugs => {
    this.map = new Map([for (_bug of _bugs) [_bug.id, new BzDeck.models.Bug(_bug)]]);

    return Promise.resolve(this.map);
  });
};

/*
 * Add a bug to the database.
 *
 * [argument] data (Object) Bugzilla's raw bug data object
 * [return] bug (Proxy) new instance of the BugModel object
 */
BzDeck.models.Bugs.prototype.add = function (data) {
  let bug = new BzDeck.models.Bug(data);

  bug.save();
  this.map.set(bug.id, bug);

  return bug;
};

/*
 * Get a bug with a specific ID.
 *
 * [argument] id (Number or String) bug ID
 * [argument] record_time (Boolean, optional) whether to record the fetched time in the bug
 * [return] bug (Proxy) new instance of the BugModel object
 */
BzDeck.models.Bugs.prototype.get = function (id, record_time = true) {
  let bug = this.map.get(id);

  if (!bug) {
    bug = new BzDeck.models.Bug({ id, '_unread': true });
    bug.save();
    this.map.set(id, bug);
  } else if (record_time) {
    bug.data._last_viewed = Date.now();
  } 

  return bug;
};

/*
 * Get bugs with specific IDs.
 *
 * [argument] ids (Array(Number) or Set(Number)) list of bug ID
 * [argument] record_time (Boolean, optional) whether to record the fetched time in the bug
 * [return] bugs (Map(Integer, Proxy)) new instances of the BugModel object
 */
BzDeck.models.Bugs.prototype.get_some = function (ids, record_time = true) {
  return new Map([for (id of ids) [id, this.get(id, record_time)]]);
};

/*
 * Get all bugs locally-stored in IndexedDB.
 *
 * [argument] none
 * [return] bugs (Map(Integer, Proxy)) new instances of the BugModel object
 */
BzDeck.models.Bugs.prototype.get_all = function () {
  return this.map;
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
