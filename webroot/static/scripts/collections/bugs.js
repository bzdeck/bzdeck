/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Bug Collection.
 *
 * @constructor
 * @extends BaseCollection
 * @argument {undefined}
 * @return {Object} bugs - New BugCollection instance.
 */
BzDeck.collections.Bugs = function BugCollection () {
  this.datasource = BzDeck.datasources.account;
  this.store_name = 'bugs';
  this.model = BzDeck.models.Bug;
};

BzDeck.collections.Bugs.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Bugs.prototype.constructor = BzDeck.collections.Bugs;

/**
 * Retrieve bug data from Bugzilla with specific IDs.
 *
 * @argument {(Array|Set)} ids - List of bug ID.
 * @argument {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
 * @argument {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
 * @return {Promise.<(Array.<Object>|Error)>} bugs - List of retrieved Bugzilla data object.
 */
BzDeck.collections.Bugs.prototype.fetch = function (ids, include_metadata = true, include_details = true) {
  // Sort the IDs to make sure the subsequent index access always works
  ids = [...ids].sort();

  let fetch = (method, param_str = '') => new Promise((resolve, reject) => {
    let params = new URLSearchParams(param_str);

    ids.forEach(id => params.append('ids', id));
    BzDeck.controllers.global.request(`bug/${ids[0]}` + (method ? `/${method}` : ''), params)
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

      for (let att of _bug.attachments) {
        BzDeck.collections.attachments.set(att.id, att);
      }
    }

    return _bug;
  })).catch(error => new Error('Failed to fetch bugs from Bugzilla.'));
};
