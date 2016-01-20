/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Collection that represents all downloaded bugs.
 * @extends BzDeck.BaseCollection
 */
BzDeck.BugCollection = class BugCollection extends BzDeck.BaseCollection {
  /**
   * Get a BugCollection instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} bugs - New BugCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'bugs';
    this.model = BzDeck.models.Bug;

    this.subscribe('BugzfeedClientController:BugUpdated', true);
  }

  /**
   * Retrieve multiple bugs from Bugzilla with specific bug IDs, and return raw bug objects.
   * @argument {(Array|Set)} ids - List of bug ID to retrieve.
   * @argument {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @argument {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @return {Promise.<Array.<Object>>} bugs - List of retrieved bug data objects.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug}
   */
  fetch (ids, include_metadata = true, include_details = true) {
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
  }

  /**
   * Search bugs from the local database and return the results. TODO: Add support for Bugzilla quick search queries
   * (#327).
   * @argument {URLSearchParams} params - Search query.
   * @return {Promise.<Object>} Promise to be resolved in the search results.
   */
  search_local (params) {
    let words = params.get('short_desc').trim().split(/\s+/).map(word => word.toLowerCase()),
        match = (str, word) => !!str.match(new RegExp(`\\b${this.helpers.regexp.escape(word)}`, 'i'));

    return this.get_all().then(bugs => [...bugs.values()].filter(bug => {
      return words.every(word => bug.summary && match(bug.summary, word)) ||
             words.every(word => bug.aliases.some(alias => match(alias, word))) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).startsWith(words[0]);
    })).then(bugs => this.get_search_results(bugs));
  }

  /**
   * Search bugs from the remote Bugzilla instnace and return the results.
   * @argument {URLSearchParams} params - Search query.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   */
  search_remote (params) {
    let _bugs;

    return BzDeck.controllers.global.request('bug', params).then(result => {
      if (!result.bugs || !result.bugs.length) {
        return Promise.resolve([]);
      }

      _bugs = new Map(result.bugs.map(bug => [bug.id, bug]));
    }).then(() => {
      return this.get_some(_bugs.keys());
    }).then(__bugs => {
      return Promise.all([...__bugs].map(entry => new Promise(resolve => {
        let [id, bug] = entry,
            retrieved = _bugs.get(id); // Raw data object

        // Mark as unread
        retrieved._unread = true;

        if (bug) {
          if (bug.last_change_time < retrieved.last_change_time) {
            bug.merge(retrieved);
          }

          resolve(bug);
        } else {
          this.set(id, retrieved).then(bug => resolve(bug));
        }
      })));
    }).then(bugs => {
      return this.get_search_results(bugs);
    });
  }

  /**
   * Sort descending (new to old) and return search results. TODO: Improve the sorting algorithm.
   * @argument {Array.<Proxy>} bugs - List of found bugs.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   */
  get_search_results (bugs) {
    // Sort by the last updated time
    bugs.sort((a, b) => new Date(a.last_change_time) < new Date(b.last_change_time));
    // Sort by the last visited time
    bugs.sort((a, b) => new Date(a._last_viewed || 0) < new Date(b._last_viewed || 0));
    // Another possible factors: How often the user visited the bug? How active the bug is?

    return Promise.resolve(bugs);
  }

  /**
   * Called by BugzfeedClientController whenever a bug is updated. Retrieve the latest data from Bugzilla.
   * @argument {Object} data - Passed data.
   * @return {undefined}
   */
  on_bug_updated (data) {
    let { id } = data;

    this.get(id, { id, _unread: true }).then(bug => bug.fetch());
  }
}
