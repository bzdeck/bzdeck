/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.PersonFinder = function PersonFinderView (combobox_id, bug = undefined, exclude = []) {
  this.bug = bug;
  this.participants = bug ? bug.participants : new Map();
  this.exclude = new Set(exclude);
  this.results = new Map();

  this.$combobox = this.get_template('person-finder');
  this.$input = this.$combobox.querySelector('[role="searchbox"]');
  this.$option = this.get_template('person-finder-item');

  this.$$combobox = new this.widgets.ComboBox(this.$combobox);
  this.$$combobox.$container.id = this.combobox_id = combobox_id;
  this.$$combobox.on('Input', event => this.oninput(event));
};

BzDeck.views.PersonFinder.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.PersonFinder.prototype.constructor = BzDeck.views.PersonFinder;

BzDeck.views.PersonFinder.prototype.oninput = function (event) {
  this.value = event.detail.value.toLowerCase();
  this.results.clear();
  window.clearTimeout(this.timer);
  this.$$combobox.hide_dropdown();

  if (this.value === ':') {
    return;
  }

  // Find in the bug
  if (this.bug) {
    this.search_bug();
  }

  if (this.value.length >= 3) {
    // Search the local database
    this.search_local();

    // Search Bugzilla if the user can be authenticated, otherwise we cannot get the result
    if (BzDeck.models.account.data.api_key) {
      this.search_remote();
    }
  }
};

BzDeck.views.PersonFinder.prototype.search_bug = function () {
  this.helpers.event.async(() => this.search(this.participants));
};

BzDeck.views.PersonFinder.prototype.search_local = function () {
  this.helpers.event.async(() => this.search(BzDeck.collections.users.data));
};

BzDeck.views.PersonFinder.prototype.search_remote = function () {
  let value = this.value, // Keep this as local a variable for later use
      params = new URLSearchParams();

  params.append('match', value);
  params.append('limit', 10);

  this.timer = window.setTimeout(() => {
    BzDeck.controllers.global.request('user', params, { auth: true }).then(result => {
      // Check if the search term is not updated
      if (this.value !== value || !result.users || !result.users.length) {
        return;
      }

      let users = [];

      for (let user of result.users) {
        if (!BzDeck.collections.users.has(user.name)) {
          BzDeck.collections.users.set(user.name, { bugzilla: user });
        }

        users.push(user);
      }

      users.sort((a, b) => new Date(a.last_activity) > new Date(b.last_activity));
      this.helpers.event.async(() => this.search(new Map([for (user of users) [user.name, user]])));
    });
  }, 1000);
};

BzDeck.views.PersonFinder.prototype.search = function (users) {
  let has_colon = this.value.startsWith(':'),
      re = new RegExp((has_colon ? '' : '\\b') + this.helpers.regexp.escape(this.value), 'i'),
      find = str => re.test(str),
      results = new Map(),
      $fragment = new DocumentFragment();

  for (let [name, user] of users) {
    if (this.exclude.has(name) || this.results.has(name)) {
      continue;
    }

    let person = BzDeck.collections.users.get(name, { name });

    if ((has_colon && [for (nick of person.nick_names) if (find(`:${nick}`)) nick].length) ||
        find(person.name) || find(person.email) || [for (nick of person.nick_names) if (find(nick)) nick].length) {
      results.set(name, person);
      this.results.set(name, person); // Save all results as well
    }

    if (results.size === 10) {
      break;
    }
  }

  if (!results.size) {
    return;
  }

  for (let [name, user] of results) {
    let data = { name: user.name, nick: user.nick_names[0] || '', email: user.email, image: user.image },
        attrs = { id: `${this.combobox_id}--${user.email}`, 'data-value': user.email };

    $fragment.appendChild(this.fill(this.$option.cloneNode(true), data, attrs));
  }

  this.$$combobox.fill_dropdown($fragment);
  this.$$combobox.show_dropdown();
};

BzDeck.views.PersonFinder.prototype.clear = function () {
  this.$$combobox.clear_input();
};
