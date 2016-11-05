/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Subscription Collection, which is a labelled bug list. The visual presentation of each subscription is a
 * Sidebar folder, like Inbox, Starred or Reported.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 */
BzDeck.SubscriptionCollection = class SubscriptionCollection extends BzDeck.BaseCollection {
  /**
   * Get a SubscriptionCollection instance. This constructor is required to fire events in the member functions.
   * Otherwise `constructor.name` will be blank and `this.trigger` doesn't work.
   * @constructor
   * @param {undefined}
   * @returns {Object} collection - New SubscriptionCollection instance.
   */
  constructor () {
    super(); // Assign this.id
  }

  /**
   * Get bugs the user is participating from the local database with a specific key, like inbox, starred or reported.
   * @override
   * @param {String} id - Key of the subscription.
   * @returns {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in map of bug IDs and BugModel instances.
   */
  async get (id) {
    const email = BzDeck.account.data.name;
    const all_bugs = await (['all', 'inbox'].includes(id) ? this.get_all() : BzDeck.collections.bugs.get_all());
    const _bugs = [...all_bugs.values()];
    const is_new_results = _bugs.map(bug => bug.is_new);
    const bugs = _bugs.filter((bug, index) => {
      switch (id) {
        case 'inbox':     return is_new_results[index];
        case 'watching':  return bug.cc && bug.cc.includes(email);
        case 'reported':  return bug.creator === email;
        case 'assigned':  return bug.assigned_to === email;
        case 'mentor':    return bug.mentors && bug.mentors.includes(email);
        case 'qa':        return bug.qa_contact === email;
        case 'requests':  return bug.flags && bug.flags.some(flag => flag.requestee === email);
        case 'starred':   return bug.starred;
        default:          return !!bug;
      };
    });

    return new Map(bugs.map(bug => [bug.id, bug]));
  }

  /**
   * Get all bugs the user is participating from the local database.
   * @override
   * @param {undefined}
   * @returns {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in map of Bug IDs and BugModel instances.
   */
  async get_all () {
    const email = BzDeck.account.data.name;
    const all_bugs = await BzDeck.collections.bugs.get_all();

    return new Map([...all_bugs.values()].filter(bug => {
      return (bug.cc && bug.cc.includes(email)) || bug.creator === email || bug.assigned_to === email ||
             bug.qa_contact === email || (bug.mentors && bug.mentors.includes(email)) ||
             (bug.flags && bug.flags.some(flag => flag.requestee === email));
    }).map(bug => [bug.id, bug]));
  }

  /**
   * Retrieve data of bugs the user is participating from the remote Bugzilla instance, and return those as models.
   * @param {Boolean} [firstrun=false] - True for the initial session.
   * @param {URLSearchParams} [params] - Search query.
   * @fires SubscriptionCollection#FetchingSubscriptionsStarted
   * @fires SubscriptionCollection#FetchingSubscriptionsComplete
   * @fires SubscriptionCollection#Updated
   * @returns {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in map of bug IDs and BugModel instances.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug}
   */
  async fetch (firstrun = false, params = new URLSearchParams()) {
    const fields = ['cc', 'reporter', 'assigned_to', 'qa_contact', 'bug_mentor', 'requestees.login_name'];

    // Fire an event to show the throbber
    this.trigger('#FetchingSubscriptionsStarted');

    params.append('j_top', 'OR');

    for (const [i, name] of fields.entries()) {
      params.append(`f${i}`, name);
      params.append(`o${i}`, 'equals');
      params.append(`v${i}`, BzDeck.account.data.name);
    }

    const [last_loaded, cached_bugs] = await Promise.all([
      BzDeck.prefs.get('subscriptions.last_loaded'),
      BzDeck.collections.bugs.get_all(),
    ]);

    if (!firstrun) {
      // Retrieve bugs changed since the cached date for returning sessions
      params.append('chfieldfrom', (new Date(last_loaded)).toISOString());
      params.append('include_fields', 'id');
    }

    // Append starred bugs to the query, that may include bugs the user is currently not involved in
    params.append('f9', 'bug_id');
    params.append('o9', 'anywords');
    params.append('v9', [...cached_bugs.values()].filter(bug => bug.starred).map(bug => bug.id).join());

    try {
      const result = await BzDeck.host.request('bug', params);
      let _bugs;

      if (firstrun) {
        _bugs = await Promise.all(result.bugs.map(_bug => BzDeck.collections.bugs.set(_bug.id, _bug)));
      } else if (result.bugs.length) {
        _bugs = await BzDeck.collections.bugs.fetch(result.bugs.map(_bug => _bug.id), true, false);
        this.trigger_safe('#Updated', { bugs: _bugs });
      } else {
        _bugs = [];
      }

      const all_bugs = await BzDeck.collections.bugs.get_all();

      // Retrieve the last visit timestamp for all bugs
      await BzDeck.collections.bugs.retrieve_last_visit(all_bugs.keys());

      const bugs = await BzDeck.collections.bugs.get_some(_bugs.map(bug => bug.id)); // Map

      BzDeck.prefs.set('subscriptions.last_loaded', Date.now());
      this.trigger('#FetchingSubscriptionsComplete');

      return bugs;
    } catch (error) {
      this.trigger('#FetchingSubscriptionsComplete');

      throw new Error('Failed to load data.'); // l10n
    }
  }
}
