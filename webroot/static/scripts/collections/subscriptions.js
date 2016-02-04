/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Subscription Collection, which is a labelled bug list. The visual presentation of each subscription is a
 * Sidebar folder, like Inbox, Starred or Reported.
 * @extends BzDeck.BaseCollection
 */
BzDeck.SubscriptionCollection = class SubscriptionCollection extends BzDeck.BaseCollection {
  /**
   * Get bugs the user is participating from the local database with a specific key, like inbox, starred or reported.
   * @argument {String} id - Key of the subscription.
   * @return {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in map of bug IDs and BugModel instances.
   */
  get (id) {
    let email = BzDeck.account.data.name,
        get_all = ['all', 'inbox', 'important'].includes(id) ? this.get_all() : BzDeck.collections.bugs.get_all();

    return get_all.then(bugs => {
      let _bugs = [...bugs.values()];

      return Promise.all(_bugs.map(bug => bug.is_new)).then(is_new_results => {
        return _bugs.filter((bug, index) => {
          switch (id) {
            case 'inbox':     return is_new_results[index];
            case 'important': return ['blocker', 'critical', 'major'].includes(bug.severity);
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
      });
    }).then(bugs => new Map(bugs.map(bug => [bug.id, bug])));
  }

  /**
   * Get all bugs the user is participating from the local database.
   * @argument {undefined}
   * @return {Promise.<Map.<Number, Proxy>>} bugs - Promise to be resolved in map of Bug IDs and BugModel instances.
   */
  get_all () {
    let email = BzDeck.account.data.name;

    return BzDeck.collections.bugs.get_all().then(bugs => [...bugs.values()].filter(bug => {
      return (bug.cc && bug.cc.includes(email)) || bug.creator === email || bug.assigned_to === email ||
             bug.qa_contact === email || (bug.mentors && bug.mentors.includes(email)) ||
             (bug.flags && bug.flags.some(flag => flag.requestee === email));
    })).then(bugs => new Map(bugs.map(bug => [bug.id, bug])));
  }

  /**
   * Retrieve data of bugs the user is participating from the remote Bugzilla instance, and return those as models.
   * @argument {undefined}
   * @return {Promise.<Array.<Object>>} bugs - Promise to be resolved in an array of BugModel instances.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/bug.html#get-bug}
   */
  fetch () {
    let firstrun = false,
        params = new URLSearchParams(),
        fields = ['cc', 'reporter', 'assigned_to', 'qa_contact', 'bug_mentor', 'requestees.login_name'];

    // Fire an event to show the throbber
    this.trigger(':FetchingSubscriptionsStarted');

    params.append('j_top', 'OR');

    for (let [i, name] of fields.entries()) {
      params.append(`f${i}`, name);
      params.append(`o${i}`, 'equals');
      params.append(`v${i}`, BzDeck.account.data.name);
    }

    return BzDeck.prefs.get('subscriptions.last_loaded').then(last_loaded => {
      firstrun = !last_loaded;

      if (last_loaded) {
        let date = this.helpers.datetime.get_shifted_date(new Date(last_loaded), BzDeck.server.timezone);

        params.append('include_fields', 'id');
        params.append('chfieldfrom', date.toLocaleFormat('%Y-%m-%d %T'));
      } else {
        // Fetch only open bugs at initial startup
        params.append('resolution', '---');
      }
    }).then(() => {
      return BzDeck.collections.bugs.get_all();
    }).then(cached_bugs => {
      // Append starred bugs to the query, that may include bugs the user is currently not involved in
      params.append('f9', 'bug_id');
      params.append('o9', 'anywords');
      params.append('v9', [...cached_bugs.values()].filter(bug => bug.starred).map(bug => bug.id).join());
    }).then(() => {
      return BzDeck.server.request('bug', params);
    }).then(result => {
      if (firstrun) {
        return Promise.all(result.bugs.map(_bug => {
          // Mark all bugs read if the session is firstrun
          _bug.unread = false;

          return BzDeck.collections.bugs.set(_bug.id, _bug);
        }));
      }

      if (!result.bugs.length) {
        return Promise.resolve([]);
      }

      return BzDeck.collections.bugs.fetch(result.bugs.map(_bug => _bug.id)).then(_bugs => {
        return Promise.all(_bugs.map(_bug => new Promise(resolve => {
          _bug._unread = true;

          BzDeck.collections.bugs.get(_bug.id).then(bug => {
            if (bug) {
              bug.merge(_bug);
              resolve(bug);
            } else {
              BzDeck.collections.bugs.get(_bug.id, _bug).then(bug => resolve(bug));
            }
          });
        })));
      }).then(bugs => {
        this.trigger(':Updated', { bugs });

        return bugs;
      });
    }).then(bugs => {
      BzDeck.prefs.set('subscriptions.last_loaded', Date.now());

      return Promise.resolve(bugs);
    }).catch(error => {
      return Promise.reject(new Error('Failed to load data.')); // l10n
    }).then(() => this.trigger(':FetchingSubscriptionsComplete'));
  }
}
