/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Person Finder View that represents the finder UI to search a Bugzilla user.
 * @extends BzDeck.BaseView
 */
BzDeck.PersonFinderView = class PersonFinderView extends BzDeck.BaseView {
  /**
   * Get a PersonFinderView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {String} combobox_id - ID of an element with the combobox role.
   * @param {Proxy} [bug] - Specific bug to search against.
   * @param {Set.<String>} [exclude] - List of Bugzilla user accounts that should be excluded from search results. For
   *  example, if the Person Finder is for Cc, the current Cc members should not be displayed on the results.
   * @returns {PersonFinderView} New PersonFinderView instance.
   */
  constructor (id, combobox_id, bug = undefined, exclude = new Set()) {
    super(id); // Assign this.id

    this.bug = bug;
    this.participants = bug ? bug.participants : new Map();
    this.exclude = exclude;
    this.results = new Map();

    this.$combobox = this.get_template('person-finder');
    this.$input = this.$combobox.querySelector('[role="searchbox"]');
    this.$option = this.get_template('person-finder-item');

    this.$$combobox = new FlareTail.widgets.ComboBox(this.$combobox);
    this.$$combobox.$container.id = this.combobox_id = combobox_id;
    this.$$combobox.on('Input', event => this.oninput(event));
  }

  /**
   * Called whenever the user is typing on the searchbox. Execute searches based on the terms.
   * @param {InputEvent} event - The input event fired on the searchbox.
   */
  oninput (event) {
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
  }

  /**
   * Start searching from the specified bug.
   */
  async search_bug () {
    this.search(this.participants);
  }

  /**
   * Start searching from the local database.
   */
  async search_local () {
    this.search(await BzDeck.collections.users.get_all());
  }

  /**
   * Start searching from the remote Bugzilla instance using the API.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user Bugzilla API}
   */
  search_remote () {
    const value = this.value; // Keep this as local a variable for later use
    const params = new URLSearchParams();

    params.append('match', value);
    params.append('limit', 10);

    this.timer = window.setTimeout(async () => {
      const users = await BzDeck.collections.users.search_remote(params);

      // Check if the search term is not updated
      if (this.value === value && users.length) {
        this.search(new Map(users.map(user => [user.name, user])));
      }
    }, 1000);
  }

  /**
   * Find matching people from the provided user list, and show the results on the drop down list.
   * @param {Map.<String, Proxy>} users - User list.
   */
  async search (users = new Map()) {
    const has_colon = this.value.startsWith(':');
    const re = new RegExp((has_colon ? '' : '\\b') + FlareTail.helpers.regexp.escape(this.value), 'i');
    const find = str => re.test(str);
    const _people = await Promise.all([...users.keys()].map(name => BzDeck.collections.users.get(name, { name })));
    const people = new Map(_people.map(person => [person.email, person]));
    const results = new Map();
    const $fragment = new DocumentFragment();

    for (const [name, user] of users) {
      if (this.exclude.has(name) || this.results.has(name)) {
        continue;
      }

      const person = people.get(name); // name = email

      if ((has_colon && person.nick_names.some(nick => find(nick) || find(`:${nick}`))) ||
          find(person.name) || find(person.email)) {
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

    for (const [name, user] of results) {
      const data = { name: user.name, nick: user.nick_names[0] || '', email: user.email, image: user.image };
      const attrs = { id: `${this.combobox_id}-${user.email}`, 'data-value': user.email };

      $fragment.appendChild(this.fill(this.$option.cloneNode(true), data, attrs));
    }

    this.$$combobox.fill_dropdown($fragment);
    this.$$combobox.show_dropdown();
  }

  /**
   * Clear any terms on the searchbox.
   */
  clear () {
    this.$$combobox.clear_input();
  }
}
