/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Subscription Collection, which is a labelled bug list. The visual presentation of each subscription is
 * a Sidebar folder, like Inbox, Starred or Reported.
 *
 * @constructor
 * @extends BaseCollection
 * @argument {undefined}
 * @return {Object} subscriptions - New SubscriptionCollection instance.
 */
BzDeck.collections.Subscriptions = function SubscriptionCollection () {};

BzDeck.collections.Subscriptions.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Subscriptions.prototype.constructor = BzDeck.collections.Subscriptions;

/**
 * Get bugs the user is participating from the local database with a specific key, like inbox, starred or reported.
 *
 * @argument {String} id - Key of the subscription.
 * @return {Map.<Number, Proxy>} bugs - Map of bug IDs and BugModel instances.
 */
BzDeck.collections.Subscriptions.prototype.get = function (id) {
  let severities = ['blocker', 'critical', 'major'],
      email = BzDeck.models.account.data.name,
      bugs = ['all', 'inbox', 'important'].includes(id) ? this.get_all() : BzDeck.collections.bugs.get_all();

  return new Map([...bugs.values()].filter(bug => {
    switch (id) {
      case 'inbox':     return bug.is_new;
      case 'important': return severities.includes(bug.severity);
      case 'watching':  return bug.cc && bug.cc.includes(email);
      case 'reported':  return bug.creator === email;
      case 'assigned':  return bug.assigned_to === email;
      case 'mentor':    return bug.mentors && bug.mentors.includes(email);
      case 'qa':        return bug.qa_contact === email;
      case 'requests':  return bug.flags && bug.flags.some(flag => flag.requestee === email);
      case 'starred':   return bug.starred;
      default:          return bug;
    }
  }).map(bug => [bug.id, bug]));
};

/**
 * Get all bugs the user is participating from the local database.
 *
 * @argument {undefined}
 * @return {Map.<Number, Proxy>} bugs - Map of Bug IDs and BugModel instances.
 */
BzDeck.collections.Subscriptions.prototype.get_all = function () {
  let email = BzDeck.models.account.data.name,
      bugs = [...BzDeck.collections.bugs.get_all().values()];

  bugs = bugs.filter(bug => (bug.cc && bug.cc.includes(email)) || bug.creator === email || bug.assigned_to === email ||
                                bug.qa_contact === email || (bug.mentors && bug.mentors.includes(email)) ||
                                (bug.flags && bug.flags.some(flag => flag.requestee === email)));

  return new Map(bugs.map(bug => [bug.id, bug]));
};

/**
 * Retrieve data of bugs the user is participating from the remote Bugzilla instance, and return those as models.
 *
 * @argument {undefined}
 * @return {Promise.<Array.<Object>>} bugs - Promise to be resolved in an array of BugModel instances.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug}
 */
BzDeck.collections.Subscriptions.prototype.fetch = function () {
  let last_loaded = BzDeck.prefs.get('subscriptions.last_loaded'),
      firstrun = !last_loaded,
      params = new URLSearchParams(),
      cached_bugs = BzDeck.collections.bugs.get_all(),
      fields = ['cc', 'reporter', 'assigned_to', 'qa_contact', 'bug_mentor', 'requestees.login_name'];

  // Fire an event to show the throbber
  this.trigger(':FetchingSubscriptionsStarted');

  params.append('j_top', 'OR');

  if (last_loaded) {
    let date = this.helpers.datetime.get_shifted_date(new Date(last_loaded), BzDeck.models.server.timezone);

    params.append('include_fields', 'id');
    params.append('chfieldfrom', date.toLocaleFormat('%Y-%m-%d %T'));
  } else {
    // Fetch only open bugs at initial startup
    params.append('resolution', '---');
  }

  for (let [i, name] of fields.entries()) {
    params.append(`f${i}`, name);
    params.append(`o${i}`, 'equals');
    params.append(`v${i}`, BzDeck.models.account.data.name);
  }

  // Append starred bugs to the query, that may include bugs the user is currently not involved in
  params.append('f9', 'bug_id');
  params.append('o9', 'anywords');
  params.append('v9', [...cached_bugs.values()].filter(bug => bug.starred).map(bug => bug.id).join());

  return BzDeck.controllers.global.request('bug', params).then(result => {
    last_loaded = Date.now();
    BzDeck.prefs.set('subscriptions.last_loaded', last_loaded);

    if (firstrun) {
      return Promise.all(result.bugs.map(_bug => {
        // Mark all bugs read if the session is firstrun
        _bug.unread = false;

        return BzDeck.collections.bugs.set(_bug.id, _bug);
      }));
    }

    if (result.bugs.length) {
      return BzDeck.collections.bugs.fetch(result.bugs.map(_bug => _bug.id))
          .then(_bugs => Promise.all(_bugs.map(_bug => {
            _bug._unread = true;

            let bug = BzDeck.collections.bugs.get(_bug.id);

            if (bug) {
              bug.merge(_bug);
            } else {
              bug = BzDeck.collections.bugs.get(_bug.id, _bug);
            }

            return bug;
          }))).then(bugs => { this.trigger(':Updated', { bugs }); return bugs; });
    }

    return Promise.all([]);
  }).then(bugs => Promise.resolve(bugs), error => {
    console.error(error);

    return Promise.reject(new Error('Failed to load data.')); // l10n
  }).then(() => this.trigger(':FetchingSubscriptionsComplete'));
};
