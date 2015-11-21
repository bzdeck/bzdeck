/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the QuickSearchView that represents the Quick Search bar on the app banner.
 *
 * @constructor
 * @extends BaseView
 * @argument {undefined}
 * @return {Object} view - New QuickSearchView instance.
 */
BzDeck.views.QuickSearch = function QuickSearchView () {
  this.$input = document.querySelector('#quicksearch [role="searchbox"]');
  this.$button = document.querySelector('#quicksearch [role="button"]');
  this.$results = document.querySelector('#quicksearch-results');
  this.$$results = new this.widgets.Menu(this.$results);

  this.$input.addEventListener('input', event => this.oninput());
  this.$input.addEventListener('focus', event => this.oninput());
  this.$input.addEventListener('onblur', event => this.cleanup());
  this.$input.addEventListener('mousedown', event => event.stopPropagation());
  this.$input.addEventListener('contextmenu', event => this.helpers.event.ignore(event), true); // Suppress context menu
  this.$button.addEventListener('mousedown', event => { event.stopPropagation(); this.onsubmit() });
  this.$$results.bind('MenuItemSelected', event => this.on_result_selected(event.detail.target));
  window.addEventListener('mousedown', event => this.cleanup());
  window.addEventListener('popstate', event => this.cleanup());
  this.on('C:ResultsAvailable', data => this.render_results(data), true);

  this.assign_keyboard_bindings();
  this.activate_results();
};

BzDeck.views.QuickSearch.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.QuickSearch.prototype.constructor = BzDeck.views.QuickSearch;

/**
 * Enable some keyboard shortcuts on the elements.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.assign_keyboard_bindings = function () {
  this.helpers.kbd.assign(window, {
    'Accel+K': event => {
      this.$input.focus();
      event.preventDefault();
    },
  });

  this.helpers.kbd.assign(this.$input, {
    'ArrowUp|ArrowDown': event => {
      if (this.$input.value.trim() && this.$results.matches('[aria-expanded="false"]')) {
        this.exec_quick_search();
      }
    },
    Enter: event => {
      this.$results.setAttribute('aria-expanded', 'false');
      this.exec_advanced_search();
    },
  });

  this.helpers.kbd.assign(this.$button, {
    'Enter|Space': event => {
      this.exec_advanced_search();
    },
  });
};

/**
 * Activate each result sections and cache them in a Map for later access.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.activate_results = function () {
  this.sections = new Map();

  for (let $section of this.$results.querySelectorAll('[role="group"]')) {
    let category = $section.id.match(/^quicksearch-results-(.+)$/)[1];

    this.sections.set(category, new BzDeck.views.QuickSearchResults(category, $section));
  }
};

/**
 * Called whenever the user is typing or focusing on the search box. If the box is has some characters, show the search
 * results. Otherwise, show the Recent Searches if any.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.oninput = function () {
  if (this.$input.value.trim()) {
    this.exec_quick_search();
  } else {
    this.trigger(':RecentSearchesRequested');
  }
};

/**
 * Called whenever the search button is pressed. On desktop, execute a new Advanced Search. On mobile, focus on the
 * search box or execute a new Advanced Search.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.onsubmit = function () {
  let $root = document.documentElement; // <html>

  if (this.helpers.env.device.mobile) {
    if (!$root.hasAttribute('data-quicksearch')) {
      $root.setAttribute('data-quicksearch', 'activated');
      // Somehow moving focus doesn't work, so use the async function here
      this.helpers.event.async(() => this.$input.focus());
    } else if (this.$input.value.trim()) {
      this.exec_advanced_search();
    }
  } else {
    this.exec_advanced_search();
  }
};

/**
 * Request quick search results.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.exec_quick_search = function () {
  this.trigger(':QuickSearchRequested', { input: this.$input.value });
};

/**
 * Request advanced search results, leading to a new search page.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.exec_advanced_search = function () {
  this.trigger(':AdvancedSearchRequested', { input: this.$input.value });
  this.cleanup();
};

/**
 * Show search results on the drop down list.
 *
 * @argument {Object} data - Passed data.
 * @argument {String} data.category - Search category, such as 'recent', 'bugs' or 'users'.
 * @argument {String} data.input - Original search terms.
 * @argument {Array}  data.results - Search results.
 * @return {Boolean} displayed - Whether the results are displayed.
 */
BzDeck.views.QuickSearch.prototype.render_results = function (data) {
  let { category, input, results } = data,
      section = this.sections.get(category);

  // Check if the search terms have not changed since the search is triggered
  if (input !== this.$input.value) {
    return false;
  }

  this.$results.setAttribute('aria-busy', 'true');

  if (category === 'recent') {
    // Hide all sections first other than Recent Searches
    for (let [category, _section] of this.sections) if (category !== 'recent') {
      _section.render([]);
    }
  } else {
    // Hide the Recent Searches section first when other category of results are provided
    this.sections.get('recent').render([]);
  }

  section.render(results);
  this.$$results.update_members();

  if (results.length) {
    this.show_results();
  } else if (![...this.sections.values()].some(_section => !!_section.results.length)) {
    // Hide the drop down list as well when no other results found
    this.hide_results();
  }

  this.$results.removeAttribute('aria-busy');

  return true;
};

/**
 * Show the drop down list for the search results.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.show_results = function () {
  if (!this.$results.matches('[aria-expanded="true"]')) {
    this.$results.setAttribute('aria-expanded', 'true');
  }
};

/**
 * Hide the drop down list for the search results.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.hide_results = function () {
  if (!this.$results.matches('[aria-expanded="false"]')) {
    this.$results.setAttribute('aria-expanded', 'false');
  }
};

/**
 * End a quick search session.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.cleanup = function () {
  let $root = document.documentElement; // <html>

  if ($root.hasAttribute('data-quicksearch')) {
    $root.removeAttribute('data-quicksearch');
  }

  this.hide_results();
};

/**
 * Called whenever a search result is selected. Open the object or Advanced Search page in a new tab, and close the drop
 * down list.
 *
 * @argument {HTMLElement} $target - Selected element.
 * @return {undefined}
 */
BzDeck.views.QuickSearch.prototype.on_result_selected = function ($target) {
  if ($target.matches('[data-command="search-all-bugs"]')) {
    this.onsubmit();
  } else {
    let id = $target.dataset.id,
        type = $target.getAttribute('itemtype').match(/\w+$/)[0].toLowerCase();

    this.trigger(':ResultSelected', { id: isNaN(id) ? id : Number(id), type });
  }

  // Add a small delay to make sure the drop down list is closed shortly
  window.setTimeout(() => {
    this.$button.focus();
    this.cleanup();
  }, 50);
};

/**
 * Initialize the QuickSearchResultsView that represents each section on Quick Search results.
 *
 * @constructor
 * @extends BaseView
 * @argument {String} category - Search category, such as 'recent', 'bugs' or 'users'.
 * @argument {HTMLElement} $outer - Section node.
 * @return {Object} view - New QuickSearchResultsView instance.
 */
BzDeck.views.QuickSearchResults = function QuickSearchResultsView (category, $outer) {
  this.category = category;
  this.results = [];

  this.$outer = $outer;
  this.$list = this.$outer.querySelector('ul');
  this.templates = {
    bug: this.get_template('quicksearch-results-bugs-item'),
    user: this.get_template('quicksearch-results-users-item'),
  };
};

BzDeck.views.QuickSearchResults.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.QuickSearchResults.prototype.constructor = BzDeck.views.QuickSearchResults;

/**
 * Show the section.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearchResults.prototype.show = function () {
  if (!this.$outer.matches('[aria-hidden="false"]')) {
    this.$outer.setAttribute('aria-hidden', 'false');
  }
};

/**
 * Hide the section.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.QuickSearchResults.prototype.hide = function () {
  if (!this.$outer.matches('[aria-hidden="true"]')) {
    this.$outer.setAttribute('aria-hidden', 'true');
  }
};

/**
 * Render the search results on the section using a template.
 *
 * @argument {Array.<Object>} results - Search results.
 * @return {undefined}
 */
BzDeck.views.QuickSearchResults.prototype.render = function (results) {
  let $fragment = new DocumentFragment();

  this.results = results;

  // Show 5 results for people
  for (let result of results.slice(0, this.category === 'users' ? 4 : 6)) {
    $fragment.appendChild(this.fill(this.templates[result.type].cloneNode(true), result, {
      id: `quicksearch-results-${this.category}-item-${result.id}`,
      'data-id': result.id,
    }));
  }

  this.$list.innerHTML = '';
  this.$list.appendChild($fragment);

  if (results.length) {
    this.show();
  } else {
    this.hide();
  }
};
