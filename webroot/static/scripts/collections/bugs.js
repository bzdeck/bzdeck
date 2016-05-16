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
   * @param {undefined}
   * @returns {Object} bugs - New BugCollection instance.
   * @listens BugzfeedController:BugUpdated
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
   * @param {(Array|Set)} _ids - List of bug IDs to retrieve.
   * @param {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @param {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @returns {Promise.<Array.<Proxy>>} bugs - Promise to be resolved in proxified BugModel instances.
   */
  fetch (_ids, include_metadata = true, include_details = true) {
    // Sort the IDs to make sure the subsequent index access always works
    let ids = [..._ids].sort();

    // Due to Bug 1169040, the Bugzilla API returns an error even if one of the bugs is not accessible. To work around
    // the issue, divide the array into chunks to retrieve 10 bugs per request, then divide each chunk again if failed.
    let ids_chunks = FlareTail.helpers.array.chunk(ids, 10);

    let _fetch = (ids, method, param_str = '') => new Promise((resolve, reject) => {
      let path = `bug/${ids[0]}`;
      let params = new URLSearchParams(param_str);

      if (method === 'last_visit') {
        path = `bug_user_last_visit/${ids[0]}`;
      } else if (method) {
        path += `/${method}`;
      }

      ids.forEach(id => params.append('ids', id));
      BzDeck.host.request(path, params)
          .then(result => result.error ? reject(new Error(result.code)) : resolve(result))
          .catch(event => reject(new Error(0)));
    });

    let get_fetchers = ids => {
      let fetchers = [];

      fetchers.push(include_metadata ? _fetch(ids) : Promise.resolve());
      fetchers.push(include_metadata ? _fetch(ids, 'last_visit') : Promise.resolve());

      if (include_details) {
        fetchers.push(_fetch(ids, 'comment'),
                      _fetch(ids, 'history'),
                      _fetch(ids, 'attachment', 'exclude_fields=data'));
      }

      return fetchers;
    };

    let get_bug = (values, id, index = 0) => {
      let _bug = { id };

      if (include_metadata) {
        _bug = values[0].bugs[index];
        _bug._last_visit = values[1][index].last_visit_ts;
      }

      if (include_details) {
        _bug.comments = values[2].bugs[id].comments;
        _bug.history = values[3].bugs[index].history || [];
        _bug.attachments = values[4].bugs[id] || [];

        for (let att of _bug.attachments) {
          BzDeck.collections.attachments.set(att.id, att);
        }
      }

      return _bug;
    };

    return Promise.all(ids_chunks.map(ids => {
      return Promise.all(get_fetchers(ids)).then(values => {
        return ids.map((id, index) => get_bug(values, id, index));
      }, error => {
        // Immediately return a bug object with an error when a single bug is returned
        if (ids.length === 1) {
          return [{ id: ids[0], error: { code: Number(error.message) } }];
        }

        // Retrieve the bugs one by one if failed
        return Promise.all(ids.map(id => {
          return Promise.all(get_fetchers([id])).then(values => {
            return get_bug(values, id);
          }, error => {
            return { id, error: { code: Number(error.message) } };
          });
        }));
      });
    })).then(bugs_chunks => {
      // Flatten an array of arrays
      return bugs_chunks.reduce((a, b) => a.concat(b), []);
    }).then(_bugs => {
      // _bugs is an Array of raw bug objects. Convert them to BugModel instances
      return Promise.all(_bugs.map(_bug => {
        return this.get(_bug.id).then(bug => {
          if (bug) {
            bug.merge(_bug);

            return bug;
          }

          return this.get(_bug.id, _bug);
        });
      }));
    });
  }

  /**
   * Retrieve the user's last visit timestamp for bugs, then update each bug's read status.
   * @param {(Array|Set|Iterator).<Number>} _ids - List of bug IDs to retrieve.
   * @returns {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in a map of bug IDs and BugModel instances.
   * @see {@link https://bugzilla.readthedocs.io/en/latest/api/core/v1/bug-user-last-visit.html}
   */
  retrieve_last_visit (_ids) {
    return this.get_some([..._ids].sort()).then(bugs => {
      let ids = [...bugs.keys()];

      if (!ids.length) {
        return Promise.resolve(bugs);
      }

      // The URLSearchParams can be too long if there are too many bugs. Split requests to avoid errors.
      let ids_chunks = FlareTail.helpers.array.chunk(ids, 100);

      return Promise.all(ids_chunks.map(ids => new Promise(resolve => {
        let params = new URLSearchParams();

        ids.forEach(id => params.append('ids', id));
        BzDeck.host.request(`bug_user_last_visit/${ids[0]}`, params)
            .then(results => resolve(Array.isArray(results) ? results : []))
            .catch(event => resolve([]));
      }))).then(results_chunks => {
        // Flatten an array of arrays
        return results_chunks.reduce((a, b) => a.concat(b), []);
      }).then(results => {
        for (let { id, last_visit_ts } of results) {
          bugs.get(Number(id))._last_visit = last_visit_ts; // Bug 1270227: id is a String
        }

        return Promise.resolve(bugs);
      });
    });
  }

  /**
   * Search bugs from the local database and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Object>} Promise to be resolved in the search results.
   * @todo Add support for Bugzilla quick search queries (#327).
   */
  search_local (params) {
    let words = params.get('short_desc').trim().split(/\s+/).map(word => word.toLowerCase());
    let match = (str, word) => !!str.match(new RegExp(`\\b${this.helpers.regexp.escape(word)}`, 'i'));

    return this.get_all().then(bugs => [...bugs.values()].filter(bug => {
      return words.every(word => bug.summary && match(bug.summary, word)) ||
             words.every(word => bug.alias.some(alias => match(alias, word))) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).startsWith(words[0]);
    })).then(bugs => this.get_search_results(bugs));
  }

  /**
   * Search bugs from the remote Bugzilla instnace and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   */
  search_remote (params) {
    let _bugs;

    return BzDeck.host.request('bug', params).then(result => {
      _bugs = new Map(result.bugs ? result.bugs.map(bug => [bug.id, bug]) : []);
    }).then(() => {
      return this.retrieve_last_visit(_bugs.keys());
    }).then(__bugs => {
      return Promise.all([...__bugs].map(entry => new Promise(resolve => {
        let [id, bug] = entry;
        let retrieved = _bugs.get(id); // Raw data object

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
   * @param {Array.<Proxy>} bugs - List of found bugs.
   * @returns {Promise.<Array.<Proxy>>} results - Promise to be resolved in the search results.
   * @todo Improve the sorting algorithm.
   */
  get_search_results (bugs) {
    // Sort by the last updated time
    bugs.sort((a, b) => new Date(a.last_change_time) < new Date(b.last_change_time));
    // Sort by the last visited time
    bugs.sort((a, b) => new Date(a._last_visit || 0) < new Date(b._last_visit || 0));
    // Another possible factors: How often the user visited the bug? How active the bug is?

    return Promise.resolve(bugs);
  }

  /**
   * Called by BugzfeedController whenever a bug is updated. Retrieve the latest data from Bugzilla.
   * @param {Object} data - Passed data.
   * @returns {undefined}
   */
  on_bug_updated (data) {
    let { id } = data;

    this.get(id, { id }).then(bug => bug.fetch());
  }
}
