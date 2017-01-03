/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the SidebarSearch View that contains the quick search panel.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarSearchView = class SidebarSearchView extends BzDeck.BaseView {
  /**
   * Get a SidebarSearchView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @returns {SidebarSearchView} New SidebarSearchView instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.$container = document.querySelector('#sidebar-search-panel');
    this.$searchbar = this.$container.querySelector('#sidebar-search-container');
    this.$searchbox = this.$searchbar.querySelector('[role="searchbox"]');
    this.$clear_button = this.$searchbar.querySelector('[data-command="clear"]');
    this.$products_cbox = this.$searchbar.querySelector('[data-field="product"] [role="combobox"]');
    this.$status_cbox = this.$searchbar.querySelector('[data-field="status"] [role="combobox"]');
    this.$results = this.$container.querySelector('#sidebar-search-results');
    this.$results_listbox = this.$results.querySelector('[role="listbox"]');
    this.$statusbar = this.$container.querySelector('#sidebar-search-statusbar');
    this.$status = this.$statusbar.querySelector('[role="status"]');

    this.$$clear_button = new FlareTail.widgets.Button(this.$clear_button);
    this.$$products_cbox = new FlareTail.widgets.ComboBox(this.$products_cbox);
    this.$$status_cbox = new FlareTail.widgets.ComboBox(this.$status_cbox);

    this.query = { input: '', status: '__open__', product: '' };

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.sidebar_search = this.presenter = new BzDeck.SidebarSearchPresenter(this.id);
    BzDeck.presenters.quick_search = new BzDeck.QuickSearchPresenter(this.id);

    this.init_searchbar();
    this.init_results();
  }

  /**
   * Initialize the searchbar available in the vertical layout.
   */
  init_searchbar () {
    const _products = BzDeck.host.data.config.product;
    const products = Object.keys(_products).filter(name => _products[name].is_active).sort().map(value => ({ value }));
    const statuses = [
      { label: 'Open', value: '__open__', selected: true },
      { label: 'Closed', value: '__closed__', selected: false },
      { label: 'All', value: '__all__', selected: false }
    ];

    products.unshift({ label: 'All', value: '', selected: true });

    this.$$products_cbox.build_dropdown(products);
    this.$$status_cbox.build_dropdown(statuses);

    // Add event listeners
    document.querySelector('#navigator-folder-search').addEventListener('click', event => this.on_folder_click());
    this.$searchbox.addEventListener('input', event => this.on_condition_change('input', this.$searchbox.value.trim()));
    this.$$clear_button.bind('Pressed', event => this.clear());
    this.$$products_cbox.bind('Change', event => this.on_condition_change('product', event.detail.value));
    this.$$status_cbox.bind('Change', event => this.on_condition_change('status', event.detail.value));
  }

  /**
   * Initialize the search results thread.
   */
  init_results () {
    this.thread = new BzDeck.VerticalThreadView(this, 'search', this.$results, {
      filter_condition: 'all',
      sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
    });

    // Star button
    this.$results_listbox.addEventListener('mousedown', async event => {
      if (event.target.matches('[itemprop="starred"]')) {
        const bug = await BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id));

        bug.starred = event.target.matches('[aria-checked="false"]');
        event.stopPropagation();
      }
    });

    this.subscribe('QuickSearchPresenter#ResultsAvailable', true);
  }

  /**
   * Clear the searchbox and thread.
   */
  clear () {
    this.$searchbox.value = this.query.input = '';
    this.$searchbox.focus();
    this.$clear_button.setAttribute('aria-hidden', 'true');
    this.thread.update([]);
  }

  /**
   * Called whenever the navigator's Search folder is clicked. Move focus to the searchbar. For a better accessibility,
   * only consider click events; keyboard interaction is excluded.
   */
  on_folder_click () {
    window.setTimeout(() => {
      this.$searchbox.focus();
      this.$searchbox.select();
    }, 100);
  }

  /**
   * Called whenever a search condition has been changed by the user. Start searching if any search term is given.
   * @param {String} key - One of query keys, e.g. `input`, `status` or `product`.
   * @param {String} value - Query value.
   * @fires AnyView#QuickSearchRequested
   */
  on_condition_change (key, value) {
    this.query[key] = value;

    if (this.query.input) {
      this.$clear_button.setAttribute('aria-hidden', 'false');
      this.$results_listbox.setAttribute('aria-busy', 'true');
      this.$statusbar.setAttribute('aria-hidden', 'false');
      this.$status.textContent = 'Loading Search Results...'; // l10n

      this.trigger('AnyView#QuickSearchRequested', this.query);
    } else {
      this.$clear_button.setAttribute('aria-hidden', 'true');
      this.thread.update([]);
    }
  }

  /**
   * Called whenever search results are provided. Update the thread and statusbar.
   * @listens QuickSearchPresenter#ResultsAvailable
   * @param {String} category - One of search categories, e.g. `bugs` or `users`.
   * @param {Boolean} remote - Whether the results are from the remote Bugzilla instance rather than the local database.
   * @param {Object} query - Original search query.
   * @param {String} query.input - Search term.
   * @param {String} [query.product] - Any product name for the search.
   * @param {String} [query.status] - Any bug status for the search.
   * @param {Array.<Object>} results - Search results.
   */
  async on_results_available ({ category, remote, query, results } = {}) {
    // Check if the search terms have not changed since the search is triggered
    if (category !== 'bugs' || query.input !== this.query.input ||
        query.product !== this.query.product || query.status !== this.query.status) {
      return;
    }

    if (remote) {
      this.$results_listbox.removeAttribute('aria-busy');
      this.$statusbar.setAttribute('aria-hidden', 'true');
      this.$status.textContent = '';
    }

    // Render the results
    this.thread.update(await BzDeck.collections.bugs.get_some(results.map(result => result.id)));
  }
}
