/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the QuickSearchView that represents the Quick Search bar on the app banner.
 * @extends BzDeck.BaseView
 */
BzDeck.QuickSearchView = class QuickSearchView extends BzDeck.BaseView {
  /**
   * Get a QuickSearchView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @returns {QuickSearchView} New QuickSearchView instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.$input = document.querySelector('#quicksearch [role="searchbox"]');
    this.$button = document.querySelector('#quicksearch [role="button"]');
    this.$results = document.querySelector('#quicksearch-results');
    this.$$results = new FlareTail.widgets.Menu(this.$results);

    this.$input.addEventListener('input', event => this.oninput());
    this.$input.addEventListener('focusin', event => this.oninput());
    this.$input.addEventListener('focusout', event => this.cleanup());
    this.$input.addEventListener('mousedown', event => event.stopPropagation());

    // Suppress context menu
    this.$input.addEventListener('contextmenu', event => FlareTail.util.Events.ignore(event), true);

    this.$button.addEventListener('mousedown', event => { event.stopPropagation(); this.onsubmit() });
    this.$$results.bind('MenuItemSelected', event => this.on_result_selected(event.detail.target));
    window.addEventListener('mousedown', event => this.cleanup());
    window.addEventListener('popstate', event => this.cleanup());
    this.on('P#ResultsAvailable', data => this.render_results(data), true);

    this.assign_keyboard_bindings();
    this.activate_results();

    // Initiate the corresponding presenter
    this.presenter = BzDeck.presenters.quick_search = new BzDeck.QuickSearchPresenter(this.id);
  }

  /**
   * Enable some keyboard shortcuts on the elements.
   */
  assign_keyboard_bindings () {
    FlareTail.util.Keybind.assign(window, {
      'Accel+K': event => {
        this.$input.focus();
        event.preventDefault();
      },
    });

    FlareTail.util.Keybind.assign(this.$input, {
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

    FlareTail.util.Keybind.assign(this.$button, {
      'Enter|Space': event => {
        this.exec_advanced_search();
      },
    });
  }

  /**
   * Activate each result sections and cache them in a Map for later access.
   */
  activate_results () {
    this.sections = new Map();

    for (const $section of this.$results.querySelectorAll('[role="group"]')) {
      const category = $section.id.match(/^quicksearch-results-(.+)$/)[1];

      this.sections.set(category, new BzDeck.QuickSearchResultsView(category, $section));
    }
  }

  /**
   * Called whenever the user is typing or focusing on the search box. If the box is has some characters, show the
   * search results. Otherwise, show the Recent Searches if any.
   * @fires QuickSearchView#RecentSearchesRequested
   */
  oninput () {
    if (this.$input.value.trim()) {
      this.exec_quick_search();
    } else {
      this.trigger('#RecentSearchesRequested');
    }
  }

  /**
   * Called whenever the search button is pressed. On desktop, execute a new Advanced Search. On mobile, focus on the
   * search box or execute a new Advanced Search.
   */
  onsubmit () {
    const $root = document.documentElement; // <html>

    if (FlareTail.env.device.mobile) {
      if (!$root.hasAttribute('data-quicksearch')) {
        $root.setAttribute('data-quicksearch', 'activated');
        // Somehow moving focus doesn't work, so use the async function here
        (async () => this.$input.focus())();
      } else if (this.$input.value.trim()) {
        this.exec_advanced_search();
      }
    } else {
      this.exec_advanced_search();
    }
  }

  /**
   * Request quick search results.
   * @fires QuickSearchView#QuickSearchRequested
   */
  exec_quick_search () {
    this.trigger('#QuickSearchRequested', { input: this.$input.value });
  }

  /**
   * Request advanced search results, leading to a new search page.
   * @fires QuickSearchView#AdvancedSearchRequested
   */
  exec_advanced_search () {
    this.trigger('#AdvancedSearchRequested', { input: this.$input.value });
    this.cleanup();
  }

  /**
   * Show search results on the drop down list.
   * @listens QuickSearchPresenter#ResultsAvailable
   * @param {String} category - Search category, such as 'recent', 'bugs' or 'users'.
   * @param {String} input - Original search terms.
   * @param {Array.<Object>} results - Search results.
   * @returns {Boolean} Whether the results are displayed.
   */
  render_results ({ category, input, results } = {}) {
    const section = this.sections.get(category);

    // Check if the search terms have not changed since the search is triggered
    if (input !== this.$input.value) {
      return false;
    }

    this.$results.setAttribute('aria-busy', 'true');

    if (category === 'recent') {
      // Hide all sections first other than Recent Searches
      for (const [category, _section] of this.sections) if (category !== 'recent') {
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
  }

  /**
   * Show the drop down list for the search results.
   */
  show_results () {
    if (!this.$results.matches('[aria-expanded="true"]')) {
      this.$results.setAttribute('aria-expanded', 'true');
    }
  }

  /**
   * Hide the drop down list for the search results.
   */
  hide_results () {
    if (!this.$results.matches('[aria-expanded="false"]')) {
      this.$results.setAttribute('aria-expanded', 'false');
    }
  }

  /**
   * End a quick search session.
   */
  cleanup () {
    const $root = document.documentElement; // <html>

    if ($root.hasAttribute('data-quicksearch')) {
      $root.removeAttribute('data-quicksearch');
    }

    this.hide_results();
  }

  /**
   * Called whenever a search result is selected. Open the object or Advanced Search page in a new tab, and close the
   * drop down list.
   * @param {HTMLElement} $target - Selected element.
   * @fires QuickSearchView#ResultSelected
   */
  on_result_selected ($target) {
    if ($target.matches('[data-command="search-all-bugs"]')) {
      this.onsubmit();
    } else {
      const id = $target.dataset.id;
      const type = $target.getAttribute('itemtype').match(/\w+$/)[0].toLowerCase();

      this.trigger('#ResultSelected', { id: isNaN(id) ? id : Number(id), type });
    }

    // Add a small delay to make sure the drop down list is closed shortly
    window.setTimeout(() => {
      this.$button.focus();
      this.cleanup();
    }, 50);
  }
}

/**
 * Define the QuickSearchResultsView that represents each section on Quick Search results.
 * @extends BzDeck.BaseView
 */
BzDeck.QuickSearchResultsView = class QuickSearchResultsView extends BzDeck.BaseView {
  /**
   * Get a QuickSearchView instance.
   * @constructor
   * @param {String} category - Search category, such as 'recent', 'bugs' or 'users'.
   * @param {HTMLElement} $outer - Section node.
   * @returns {QuickSearchResultsView} New QuickSearchResultsView instance.
   */
  constructor (category, $outer) {
    super(); // Assign this.id

    this.category = category;
    this.results = [];

    this.$outer = $outer;
    this.$list = this.$outer.querySelector('ul');
    this.templates = {
      bug: this.get_template('quicksearch-results-bugs-item'),
      user: this.get_template('quicksearch-results-users-item'),
    };
  }

  /**
   * Show the section.
   */
  show () {
    if (!this.$outer.matches('[aria-hidden="false"]')) {
      this.$outer.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide the section.
   */
  hide () {
    if (!this.$outer.matches('[aria-hidden="true"]')) {
      this.$outer.setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Render the search results on the section using a template.
   * @param {Array.<Object>} results - Search results.
   */
  render (results) {
    const $fragment = new DocumentFragment();

    this.results = results;

    // Show 5 results for people
    for (const result of results.slice(0, this.category === 'users' ? 4 : 6)) {
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
  }
}
