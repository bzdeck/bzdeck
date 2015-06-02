/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.SearchPage = function SearchPageController (id) {
  this.id = id;

  this.data = new Proxy({
    bugs: new Map(),
    preview_id: null
  },
  {
    get: (obj, prop) => {
      if (prop === 'bugs') {
        // Return a sorted bug list
        return this.view.get_shown_bugs(new Map([for (bug of obj.bugs) [bug.id, bug]]));
      }

      return obj[prop];
    },
    set: (obj, prop, newval) => {
      let oldval = obj[prop];

      if (oldval === newval && !this.view.preview_is_hidden) {
        return true;
      }

      if (prop === 'preview_id') {
        // Show the bug preview only when the preview pane is visible (on desktop and tablet)
        if (this.view.preview_is_hidden) {
          BzDeck.router.navigate('/bug/' + newval, { ids: [...this.data.bugs.keys()] });

          return true; // Do not save the value
        }

        if (oldval !== newval) {
          this.prep_preview(oldval, newval);
          BzDeck.controllers.bugzfeed.subscribe([newval]);
        }
      }

      obj[prop] = newval;

      return true;
    }
  });

  let params = new URLSearchParams(location.search.substr(1) || (history.state ? history.state.params : undefined));

  BzDeck.views.toolbar.open_tab({
    page_category: 'search',
    page_id: this.id,
    page_constructor: BzDeck.views.SearchPage,
    page_constructor_args: [this.id, params, BzDeck.models.server.data.config],
    tab_label: 'Search', // l10n
    tab_desc: 'Search & Browse Bugs', // l10n
  }, this);

  if (params.toString()) {
    this.exec_search(params);
  }

  this.on('V:SearchRequested', data => this.exec_search(data.params));

  this.on('V:OpeningTabRequested', data => {
    BzDeck.router.navigate('/bug/' + this.data.preview_id, { ids: [...this.data.bugs.keys()] });
  });
};

BzDeck.controllers.SearchPage.route = '/search/(\\d{13,})';

BzDeck.controllers.SearchPage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.SearchPage.prototype.constructor = BzDeck.controllers.SearchPage;

BzDeck.controllers.SearchPage.prototype.prep_preview = function (oldval, newval) {
  if (!newval) {
    this.trigger(':BugDataUnavailable');
  } else {
    let bug = BzDeck.collections.bugs.get(newval);

    if (bug) {
      bug.unread = false;
      this.trigger(':BugDataAvailable', { bug, controller: new BzDeck.controllers.Bug('search', bug) });
    } else {
      this.trigger(':BugDataUnavailable');
    }
  }
};

BzDeck.controllers.SearchPage.prototype.exec_search = function (params) {
  if (!navigator.onLine) {
    this.trigger(':Offline');

    return;
  }

  this.trigger(':SearchStarted');

  this.request('bug', params).then(result => {
    if (!result.bugs.length) {
      return;
    }

    let bugs = new Map(),
        _bugs = this.data.bugs = new Map([for (_bug of result.bugs) [_bug.id, _bug]]);

    BzDeck.collections.bugs.get_some(_bugs.keys()).forEach((bug, id) => {
      let retrieved = _bugs.get(id); // Raw data object

      // Mark as unread
      retrieved._unread = true;

      if (!bug) {
        bug = BzDeck.collections.bugs.set(id, retrieved);
      } else if (bug.last_change_time < retrieved.last_change_time) {
        bug.merge(retrieved);
      }

      bugs.set(id, bug);
    });

    this.trigger(':SearchResultsAvailable', { bugs });
  }).catch(error => {
    this.trigger(':SearchError', { error });
  }).then(() => {
    this.trigger(':SearchComplete');
  });
};
