/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Person Finder View that represents the finder UI to search a Bugzilla user.
 *
 * @constructor
 * @extends BaseView
 * @argument {String} combobox_id - ID of an element with the combobox role.
 * @argument {Proxy} [bug] - Specific bug to search against.
 * @argument {Set.<String>} [exclude] - List of Bugzilla user accounts that should be excluded from search results. For
 *  example, if the Person Finder is for Cc, the current Cc members should not be displayed on the results.
 * @return {Object} view - New PersonFinderView instance.
 */
BzDeck.views.PersonFinder = function PersonFinderView (combobox_id, bug = undefined, exclude = new Set()) {
  this.bug = bug;
  this.participants = bug ? bug.participants : new Map();
  this.exclude = exclude;
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

/**
 * Called whenever the user is typing on the searchbox. Execute searches based on the terms.
 *
 * @argument {InputEvent} event - The input event fired on the searchbox.
 * @return {undefined}
 */
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
    this.search_local();
    this.search_remote();
  }
};

/**
 * Start searching from the specified bug.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.PersonFinder.prototype.search_bug = function () {
  this.helpers.event.async(() => this.search(this.participants));
};

/**
 * Start searching from the local database.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.PersonFinder.prototype.search_local = function () {
  BzDeck.collections.users.get_all().then(users => this.search(users));
};

/**
 * Start searching from the remote Bugzilla instance using the API.
 *
 * @argument {undefined}
 * @return {undefined}
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.views.PersonFinder.prototype.search_remote = function () {
  let value = this.value, // Keep this as local a variable for later use
      params = new URLSearchParams();

  params.append('match', value);
  params.append('limit', 10);

  this.timer = window.setTimeout(() => {
    BzDeck.collections.users.search_remote(params).then(users => {
      // Check if the search term is not updated
      if (this.value === value && users.length) {
        this.search(new Map(users.map(user => [user.name, user])));
      }
    });
  }, 1000);
};

/**
 * Find matching people from the provided user list, and show the results on the drop down list.
 *
 * @argument {Map.<String, Proxy>} users - User list.
 * @return {undefined}
 */
BzDeck.views.PersonFinder.prototype.search = function (users = new Map()) {
  let has_colon = this.value.startsWith(':'),
      re = new RegExp((has_colon ? '' : '\\b') + this.helpers.regexp.escape(this.value), 'i'),
      find = str => re.test(str),
      results = new Map(),
      $fragment = new DocumentFragment();

  Promise.all([...users.keys()].map(name => {
    return BzDeck.collections.users.get(name, { name });
  })).then(people => {
    return new Map(people.map(person => [person.email, person]));
  }).then(people => {
    for (let [name, user] of users) {
      if (this.exclude.has(name) || this.results.has(name)) {
        continue;
      }

      let person = people.get(name); // name = email

      if ((has_colon && person.nick_names.some(nick => find(nick) || find(`:${nick}`))) ||
          find(person.name) || find(person.email)) {
        results.set(name, person);
        this.results.set(name, person); // Save all results as well
      }

      if (results.size === 10) {
        break;
      }
    }
  }).then(() => {
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
  });
};

/**
 * Clear any terms on the searchbox.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.PersonFinder.prototype.clear = function () {
  this.$$combobox.clear_input();
};
