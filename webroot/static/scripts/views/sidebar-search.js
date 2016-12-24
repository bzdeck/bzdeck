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

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.sidebar_search = this.presenter = new BzDeck.SidebarSearchPresenter(this.id);
    BzDeck.presenters.quick_search = new BzDeck.QuickSearchPresenter(this.id);

    this.init_searchbar();
    this.init_results();
  }

  /**
   * Initialize the searchbar available in the vertical layout.
   * @listens QuickSearchPresenter#ResultsAvailable
   * @fires AnyView#QuickSearchRequested
   */
  init_searchbar () {
    const $searchbar = document.querySelector('#sidebar-search-container');
    const $searchbox = $searchbar.querySelector('[role="searchbox"]');
    const $clear_button = $searchbar.querySelector('[data-command="clear"]');
    const $$clear_button = new FlareTail.widgets.Button($clear_button);
    const $products_cbox = $searchbar.querySelector('[data-field="product"] [role="combobox"]');
    const $$products_cbox = new FlareTail.widgets.ComboBox($products_cbox);
    const $status_cbox = $searchbar.querySelector('[data-field="status"] [role="combobox"]');
    const $$status_cbox = new FlareTail.widgets.ComboBox($status_cbox);
    const _products = BzDeck.host.data.config.product;
    const products = Object.keys(_products).filter(name => _products[name].is_active).sort().map(value => ({ value }));
    const query = { input: '', status: '__open__', product: '' };

    const onchange = (key, value) => {
      query[key] = value;

      if (query.input) {
        this.trigger('AnyView#QuickSearchRequested', query);
        this.thread.$listbox.setAttribute('aria-busy', 'true');
      }
    };

    const onclear = () => {
      this.thread.update([]);
      $searchbox.value = query.input = '';
      $searchbox.focus();
    };

    products.unshift({ label: 'All', value: '', selected: true });
    $$products_cbox.build_dropdown(products);
    $$status_cbox.build_dropdown([
      { label: 'Open', value: '__open__', selected: true },
      { label: 'Closed', value: '__closed__', selected: false },
      { label: 'All', value: '__all__', selected: false }
    ]);

    // Add event listeners
    $searchbox.addEventListener('input', event => onchange('input', $searchbox.value.trim()));
    $$clear_button.bind('Pressed', event => onclear());
    $$products_cbox.bind('Change', event => onchange('product', event.detail.value));
    $$status_cbox.bind('Change', event => onchange('status', event.detail.value));

    this.on('QuickSearchPresenter#ResultsAvailable', async ({ category, remote, input, product, status, results } = {}) => {
      // Check if the search terms have not changed since the search is triggered
      if (category !== 'bugs' || input !== query.input || product !== query.product || status !== query.status) {
        return;
      }

      if (results.length || remote) {
        this.thread.$listbox.removeAttribute('aria-busy');
      }

      // Render the results
      this.thread.update(await BzDeck.collections.bugs.get_some(results.map(result => result.id)));
    }, true);
  }

  /**
   * Initialize the search results thread.
   */
  init_results () {
    const $listbox = document.querySelector('#sidebar-search-results [role="listbox"]');

    // Star button
    $listbox.addEventListener('mousedown', async event => {
      if (event.target.matches('[itemprop="starred"]')) {
        const bug = await BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id));

        bug.starred = event.target.matches('[aria-checked="false"]');
        event.stopPropagation();
      }
    });

    this.thread = new BzDeck.VerticalThreadView(this, 'search', document.querySelector('#sidebar-search-results'), {
      filter_condition: 'all',
      sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
    });
  }
}
