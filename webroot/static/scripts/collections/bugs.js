/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Collection that represents all downloaded bugs.
 * @extends BzDeck.BaseCollection
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug}
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
    this.model = BzDeck.BugModel;

    this.subscribe('BugzfeedController:BugUpdated', true);
  }

  /**
   * Retrieve multiple bugs from Bugzilla with specific bug IDs, and return bug objects.
   * @argument {(Array|Set)} _ids - List of bug IDs to retrieve.
   * @argument {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @argument {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @return {Promise.<Array.<Proxy>>} bugs - Promise to be resolved in proxified BugModel instances.
   */
  fetch (_ids, include_metadata = true, include_details = true) {
    // Sort the IDs to make sure the subsequent index access always works
    let ids = [..._ids].sort(),
        ids_chunks = [];

    // Due to Bug 1169040, the Bugzilla API returns an error even if one of the bugs is not accessible. To work around
    // the issue, divide the array into chunks to retrieve 10 bugs per request, then divide each chunk again if failed.
    for (let i = 0; i < ids.length; i = i + 10) {
      ids_chunks.push(ids.slice(i, i + 10));
    }

    let _fetch = (ids, method, param_str = '') => new Promise((resolve, reject) => {
      let params = new URLSearchParams(param_str);

      ids.forEach(id => params.append('ids', id));
      BzDeck.host.request(`bug/${ids[0]}` + (method ? `/${method}` : ''), params)
          .then(result => resolve(result.bugs), event => reject(new Error()));
    });

    let get_fetchers = ids => {
      let fetchers = [include_metadata ? _fetch(ids) : Promise.resolve()];

      if (include_details) {
        fetchers.push(_fetch(ids, 'comment'),
                      _fetch(ids, 'history'),
                      _fetch(ids, 'attachment', 'exclude_fields=data'));
      }

      return fetchers;
    };

    let get_bug = (values, id, index = 0) => {
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
    };

    return new Promise(resolve => {
      Promise.all(ids_chunks.map(ids => {
        Promise.all(get_fetchers(ids)).then(values => {
          return ids.map((id, index) => get_bug(values, id, index));
        }, error => {
          // Retrieve the bugs one by one if failed
          return Promise.all(ids.map(id => {
            return Promise.all(get_fetchers([id])).then(values => {
              return get_bug(values, id);
            }, error => {
              // Return a bug with the error code 102 = unauthorized access
              return { id, error: { code: 102 }};
            });
          }));
        }).then(_bugs => {
          // _bugs is an Array of raw bug objects. Convert them to BugModel instances
          return Promise.all(_bugs.map(_bug => new Promise(resolve => {
            _bug._unread = true;

            this.get(_bug.id).then(bug => {
              if (bug) {
                bug.merge(_bug);
                resolve(bug);
              } else {
                this.get(_bug.id, _bug).then(bug => resolve(bug));
              }
            });
          })));
        });
      })).then(bugs_chunks => {
        // Flatten an array of arrays
        resolve(bugs_chunks.reduce((a, b) => a.concat(b), []));
      });
    });
  }

  /**
   * Search bugs from the local database and return the results.
   * @argument {URLSearchParams} params - Search query.
   * @return {Promise.<Object>} Promise to be resolved in the search results.
   * @todo Add support for Bugzilla quick search queries (#327).
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

    return BzDeck.host.request('bug', params).then(result => {
      _bugs = new Map(result.bugs ? result.bugs.map(bug => [bug.id, bug]) : []);
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
   * Sort descending (new to old) and return search results.
   * @argument {Array.<Proxy>} bugs - List of found bugs.
   * @return {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   * @todo Improve the sorting algorithm.
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
   * Called by BugzfeedController whenever a bug is updated. Retrieve the latest data from Bugzilla.
   * @argument {Object} data - Passed data.
   * @return {undefined}
   */
  on_bug_updated (data) {
    let { id } = data;

    this.get(id, { id, _unread: true }).then(bug => bug.fetch());
  }
}
