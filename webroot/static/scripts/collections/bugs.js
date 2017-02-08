/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Collection that represents all downloaded bugs.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug Bugzilla API}
 */
BzDeck.BugCollection = class BugCollection extends BzDeck.BaseCollection {
  /**
   * Get a BugCollection instance.
   * @constructor
   * @returns {BugCollection} New BugCollection instance.
   */
  constructor () {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.account;
    this.store_name = 'bugs';
    this.model = BzDeck.BugModel;

    this.subscribe('BugzfeedModel#BugUpdated', true);
  }

  /**
   * Retrieve multiple bugs from Bugzilla with specific bug IDs, and return bug objects.
   * @param {(Array|Set)} _ids - List of bug IDs to retrieve.
   * @param {Boolean} [include_metadata=true] - Whether to retrieve the metadata of the bug.
   * @param {Boolean} [include_details=true] - Whether to retrieve the comments, history and attachment metadata.
   * @returns {Promise.<Array.<Proxy>>} Proxified BugModel instances.
   */
  async fetch (_ids, include_metadata = true, include_details = true) {
    // Sort the IDs to make sure the subsequent index access always works
    const ids = [..._ids].sort();

    // Due to Bug 1169040, the Bugzilla API returns an error even if one of the bugs is not accessible. To work around
    // the issue, divide the array into chunks to retrieve 20 bugs per request, then divide each chunk again if failed.
    const ids_chunks = FlareTail.util.Array.chunk(ids, 20);

    const _fetch = async (ids, method, param_str = '') => {
      const params = new URLSearchParams(param_str);
      let path = `bug/${ids[0]}`;
      let result;

      if (method === 'last_visit') {
        path = `bug_user_last_visit/${ids[0]}`;
      } else if (method) {
        path += `/${method}`;
      }

      ids.forEach(id => params.append('ids', id));

      try {
        result = await BzDeck.host.request(path, params);
      } catch (error) {
        throw new Error(0);
      }

      if (result.error) {
        throw new Error(result.code);
      }

      return result;
    };

    const get_fetchers = ids => {
      const fetchers = [];

      fetchers.push(include_metadata ? _fetch(ids) : Promise.resolve());
      fetchers.push(include_metadata ? _fetch(ids, 'last_visit') : Promise.resolve());

      if (include_details) {
        fetchers.push(_fetch(ids, 'comment'),
                      _fetch(ids, 'history'),
                      _fetch(ids, 'attachment', 'exclude_fields=data'));
      }

      return fetchers;
    };

    const get_bug = ([_meta, _visit, _comments, _history, _attachments], id, index = 0) => {
      let _bug = { id };

      if (include_metadata) {
        _bug = _meta.bugs[index];
        // Check the bug_user_last_visit results carefully. Bugzilla 5.0 has solved the issue. (Bug 1169181)
        _bug._last_visit = _visit && _visit[index] ? _visit[index].last_visit_ts : null;
      }

      if (include_details) {
        _bug.comments = _comments.bugs[id].comments;
        _bug.history = _history.bugs[index].history || [];
        _bug.attachments = _attachments.bugs[id] || [];

        for (const att of _bug.attachments) {
          BzDeck.collections.attachments.set(att.id, att);
        }
      }

      return _bug;
    };

    const bugs_chunks = await Promise.all(ids_chunks.map(async ids => {
      try {
        const values = await Promise.all(get_fetchers(ids));

        return ids.map((id, index) => get_bug(values, id, index));
      } catch (error) {
        // Immediately return a bug object with an error when a single bug is returned
        if (ids.length === 1) {
          return [{ id: ids[0], error: { code: Number(error.message) } }];
        }

        // Retrieve the bugs one by one if failed
        return Promise.all(ids.map(async id => {
          try {
            return get_bug(await Promise.all(get_fetchers([id])), id);
          } catch (error) {
            return { id, error: { code: Number(error.message) } };
          }
        }));
      }
    }));

    // Flatten an array of arrays
    const _bugs = bugs_chunks.reduce((a, b) => a.concat(b), []);

    // _bugs is an Array of raw bug objects. Convert them to BugModel instances
    return Promise.all(_bugs.map(async _bug => {
      const bug = await this.get(_bug.id);

      if (bug) {
        bug.merge(_bug);

        return bug;
      }

      return this.get(_bug.id, _bug);
    }));
  }

  /**
   * Retrieve the user's last visit timestamp for bugs, then update each bug's read status.
   * @param {(Array|Set|Iterator).<Number>} _ids - List of bug IDs to retrieve.
   * @returns {Promise.<Map.<Number, Proxy>>} A map of bug IDs and BugModel instances.
   * @see {@link https://bugzilla.readthedocs.io/en/latest/api/core/v1/bug-user-last-visit.html Bugzilla API}
   */
  async retrieve_last_visit (_ids) {
    const bugs = await this.get_some([..._ids].sort());
    const ids = [...bugs.keys()];

    if (!ids.length) {
      return bugs;
    }

    // The URLSearchParams can be too long if there are too many bugs. Split requests to avoid errors.
    const ids_chunks = FlareTail.util.Array.chunk(ids, 200);

    const results_chunks = await Promise.all(ids_chunks.map(async ids => {
      const params = new URLSearchParams(ids.map(id => ['ids', id]));
      let results;

      try {
        results = await BzDeck.host.request(`bug_user_last_visit/${ids[0]}`, params);
      } catch (error) {
        results = [];
      }

      return Array.isArray(results) ? results : [];
    }));

    // Flatten an array of arrays
    const results = results_chunks.reduce((a, b) => a.concat(b), []);

    for (const { id, last_visit_ts } of results) {
      bugs.get(id)._last_visit = last_visit_ts;
    }

    return bugs;
  }

  /**
   * Mark bugs as read by updating the user's last visit timestamp for each bug.
   * @param {(Array|Set|Iterator).<Number>} _ids - List of bug IDs to update.
   * @see {@link https://bugzilla.readthedocs.io/en/latest/api/core/v1/bug-user-last-visit.html Bugzilla API}
   */
  async mark_as_read (_ids) {
    const bugs = await this.get_some([..._ids].sort());
    // Check if the user is involved in each bug to prevent an exception being returned by the API
    const _bugs = [...bugs.values()].filter(bug => bug.is_involved);
    const ids = _bugs.map(bug => bug.id);
    const result = await BzDeck.host.request(`bug_user_last_visit/${ids[0]}`, null, { method: 'POST', data: { ids }});

    if (Array.isArray(result)) {
      for (const [index, bug] of _bugs.entries()) if (result[index]) {
        bug.update_last_visit(result[index].last_visit_ts);
      }
    }
  }

  /**
   * Search bugs from the local database and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Object>} Search results.
   * @todo Add support for Bugzilla quick search queries (#327).
   */
  async search_local (params) {
    const all_statuses = BzDeck.host.data.config.bzapi.field.status;
    const products = params.getAll('product').filter(String);
    const statuses = params.getAll('status').filter(String);
    const words = params.get('content').trim().split(/\s+/).map(word => word.toLowerCase());
    const match = (str, word) => !!str.match(new RegExp(`\\b${FlareTail.util.RegExp.escape(word)}\\b`, 'i'));
    const all_bugs = await this.get_all();
    let bugs = [...all_bugs.values()];

    // Filter by summary, aliases and IDs
    bugs = bugs.filter(bug => {
      return words.every(word => bug.summary && match(bug.summary, word)) ||
             words.every(word => bug.alias.some(alias => match(alias, word))) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).startsWith(words[0]);
    });

    // Filter by products
    if (products.length) {
      bugs = bugs.filter(bug => products.includes(bug.product));
    }

    // Filter by statuses
    if (statuses.length) {
      // Replace shorthand status with actual statuses. Remove __all__ since it's not necessary
      for (const short_status of ['__open__', '__closed__', '__all__']) {
        const index = statuses.findIndex(status => status === short_status);

        if (index > -1) {
          if (short_status === '__all__') {
            statuses.splice(index, 1);
          } else {
            statuses.splice(index, 1, ...all_statuses[short_status.replace(/_/g, '')]);
          }
        }
      }

      bugs = bugs.filter(bug => statuses.includes(bug.status));
    }

    return this.get_search_results(bugs);
  }

  /**
   * Search bugs from the remote Bugzilla instance and return the results.
   * @param {URLSearchParams} params - Search query.
   * @returns {Promise.<Array.<Proxy>>} Search results.
   */
  async search_remote (params) {
    const result = await BzDeck.host.request('bug', params);
    const _bugs = new Map(result.bugs ? result.bugs.map(bug => [bug.id, bug]) : []);
    const __bugs = await this.retrieve_last_visit(_bugs.keys());
    const bugs = await Promise.all([...__bugs].map(async ([id, bug]) => {
      const retrieved = _bugs.get(id); // Raw data object

      if (!bug) {
        bug = await this.set(id, retrieved);
      } else if (bug.last_change_time < retrieved.last_change_time) {
        bug.merge(retrieved);
      }

      return bug;
    }));

    return this.get_search_results(bugs);
  }

  /**
   * Sort descending (new to old) and return search results.
   * @param {Array.<Proxy>} bugs - List of found bugs.
   * @returns {Promise.<Array.<Proxy>>} Search results.
   * @todo Improve the sorting algorithm. Another possible factors: How often the user visited the bug? How active the
   *  bug is?
   */
  async get_search_results (bugs) {
    // Sort by the last updated time
    bugs.sort((a, b) => new Date(a.last_change_time) < new Date(b.last_change_time));
    // Sort by the last visited time
    bugs.sort((a, b) => new Date(a._last_visit || 0) < new Date(b._last_visit || 0));

    return bugs;
  }

  /**
   * Called whenever a bug is updated. Retrieve the latest data from Bugzilla.
   * @listens BugzfeedModel#BugUpdated
   * @param {Number} id - Bug ID.
   */
  async on_bug_updated ({ id } = {}) {
    const bug = await this.get(id, { id });

    bug.fetch();
  }
}
