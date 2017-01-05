/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page View that represents the Advanced Search tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.SearchPageView = class SearchPageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Search Page View. Unlike other pages, this presenter doesn't check
   * existing tabs, because the user can open multiple search tabs at the same time.
   * @constructor
   * @param {Number} id - 7-digit random identifier for the new instance.
   * @fires SearchPageView#SearchRequested
   * @returns {SearchPageView} New SearchPageView instance.
   */
  constructor (id) {
    super(id);

    // Open a tab first
    this.connect();

    this.$tabpanel = document.querySelector(`#tabpanel-search-${id}`);
    this.$grid = this.$tabpanel.querySelector('[id$="-result-pane"] [role="grid"]');
    this.$status = this.$tabpanel.querySelector('[role="status"]');
    this.$preview_pane = this.$tabpanel.querySelector('[id$="-preview-pane"]');

    this.setup_basic_search_pane();
    this.setup_result_pane();

    // Subscribe to events
    this.subscribe('P#Offline');
    this.subscribe('P#SearchStarted');
    this.subscribe('P#SearchResultsAvailable');
    this.subscribe('P#SearchError');
    this.subscribe('P#SearchComplete');
    window.addEventListener('popstate', event => this.onpopstate());

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.SearchPagePresenter(this.id);
    this.container_view = new BzDeck.BugContainerView(this.id, this.$preview_pane);

    const params = new URLSearchParams(location.search.substr(1) || (history.state ? history.state.params : undefined));

    if (params.toString()) {
      // TODO: support other params
      this.$basic_search_pane.querySelector('.text-box [role="searchbox"]').value = params.get('short_desc') || '';
      this.trigger('#SearchRequested', { params_str: params.toString() });
    }
  }

  /**
   * Called by the app router to reuse the view.
   * @param {Number} id - 13-digit identifier for a new instance, generated with Date.now().
   */
  reconnect (id) {
    this.connect();
  }

  /**
   * Connect to the view.
   */
  connect () {
    BzDeck.views.main.open_tab({
      label: 'Search', // l10n
      description: 'Search & Browse Bugs', // l10n
      category: 'search',
    }, this);
  }

  /**
   * Set up the Basic Search Pane that contains options for classification, product, component, status and resolution,
   * as well as search term textbox.
   * @fires SearchPageView#SearchRequested
   */
  setup_basic_search_pane () {
    const config = BzDeck.host.data.config.bzapi;
    const $pane = this.$basic_search_pane = this.$tabpanel.querySelector('[id$="-basic-search-pane"]');

    // Custom scrollbar
    for (const $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
      new FlareTail.widgets.ScrollBar($outer, { adjusted: true });
    }

    const $classification_list = $pane.querySelector('[id$="-browse-classification-list"]');
    const $product_list = $pane.querySelector('[id$="-browse-product-list"]');
    const $component_list = $pane.querySelector('[id$="-browse-component-list"]');
    const $status_list = $pane.querySelector('[id$="-browse-status-list"]');
    const $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

    const classifications = Object.keys(config.classification).sort().map((value, index) => ({
      id: `${$classification_list.id}item-${index}`,
      label: value
    }));

    const products = Object.keys(config.product).sort().map((value, index) => ({
      id: `${$product_list.id}item-${index}`,
      label: value
    }));

    const components = new Set();

    for (const [key, product] of Object.entries(config.product)) {
      for (const component of Object.keys(product.component)) {
        components.add(component); // Duplicates will be automatically removed
      }
    }

    components = [...components].sort().map((value, index) => ({
      id: `${$component_list.id}item-${index}`,
      label: value
    }));

    const statuses = config.field.status.values.map((value, index) => ({
      id: `${$status_list.id}item-${index}`,
      label: value
    }));

    const resolutions = config.field.resolution.values.map((value, index) => ({
      id: `${$resolution_list.id}item-${index}`,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    }));

    const ListBox = FlareTail.widgets.ListBox;
    const $$classification_list = new ListBox($classification_list, classifications);
    const $$product_list = new ListBox($product_list, products);
    const $$component_list = new ListBox($component_list, components);
    const $$status_list = new ListBox($status_list, statuses);
    const $$resolution_list = new ListBox($resolution_list, resolutions);

    $$classification_list.bind('Selected', event => {
      const products = [];
      const components = [];

      for (const classification of event.detail.labels) {
        products.push(...config.classification[classification].products);
      }

      for (const product of products) {
        components.push(...Object.keys(config.product[product].component));
      }

      $$product_list.filter(products);
      $$component_list.filter(components);
    });

    $$product_list.bind('Selected', event => {
      const components = [];

      for (const product of event.detail.labels) {
        components.push(...Object.keys(config.product[product].component));
      }

      $$component_list.filter(components);
    });

    const $textbox = $pane.querySelector('.text-box [role="searchbox"]');
    const $$button = new FlareTail.widgets.Button($pane.querySelector('.text-box [role="button"]'));

    $$button.bind('Pressed', event => {
      const params = new URLSearchParams();

      const map = {
        classification: $classification_list,
        product: $product_list,
        component: $component_list,
        status: $status_list,
        resolution: $resolution_list
      };

      for (const [name, $element] of Object.entries(map)) {
        for (const $opt of $element.querySelectorAll('[aria-selected="true"]')) {
          params.append(name, $opt.textContent);
        }
      }

      if ($textbox.value) {
        params.append('short_desc', $textbox.value);
        params.append('short_desc_type', 'allwordssubstr');
      }

      this.trigger('#SearchRequested', { params_str: params.toString() });
    });
  }

  /**
   * Set up the Result Pane that shows search results in a classic thread.
   */
  async setup_result_pane () {
    const $pane = this.$result_pane = this.$tabpanel.querySelector('[id$="-result-pane"]');
    const mobile = FlareTail.env.device.mobile;

    const [sort_cond, columns] = await Promise.all([
      BzDeck.prefs.get('sidebar.list.sort_conditions'),
      BzDeck.prefs.get('search.list.columns'),
    ]);

    this.thread = new BzDeck.ClassicThreadView(this, 'search', this.$grid, columns, {
      sortable: true,
      reorderable: true,
      sort_conditions: mobile ? { key: 'last_change_time', order: 'descending' }
                                : sort_cond || { key: 'id', order: 'ascending' }
    });

    const $$grid = this.thread.$$grid;

    // Force to change the sort condition when switched to the mobile layout
    if (mobile) {
      const cond = $$grid.options.sort_conditions;

      cond.key = 'last_change_time';
      cond.order = 'descending';
    }

    $pane.addEventListener('transitionend', event => {
      const selected = $$grid.view.selected;

      if (event.propertyName === 'bottom' && selected.length) {
        $$grid.ensure_row_visibility(selected[selected.length - 1]);
      }
    });
  }

  /**
   * Get a list of bugs currently showing on the result thread. FIXME: This should be smartly done in the presenter.
   * @returns {Array.<Number>} IDs of bugs currently showing.
   */
  get_shown_bugs () {
    return [...this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])')]
                                  .map($row => Number($row.dataset.id));
  }

  /**
   * Hide the Preview Pane and show the Basic Search Pane instead.
   */
  show_basic_search_pane () {
    this.$basic_search_pane.setAttribute('aria-hidden', 'false');
    this.$preview_pane.setAttribute('aria-hidden', 'true');
  }

  /**
   * Display a message on the statusbar.
   * @param {String} str - Message to show.
   */
  show_status (str) {
    this.$status.firstElementChild.textContent = str;
    this.$status.setAttribute('aria-hidden', str === '');
    this.$grid.setAttribute('aria-hidden', str !== '');
  }

  /**
   * Remove any message from the statusbar.
   */
  hide_status () {
    this.show_status('');
  }

  /**
   * Called when the search results cannot be retrieved because the device or browser is offline. Show a message to ask
   * the user to go online.
   * @listens SearchPagePresenter#Offline
   * @todo Reload when going online.
   */
  on_offline () {
    this.show_status('You have to go online to search bugs.'); // l10n
  }

  /**
   * Called when fetching the search results started. Empty the results and show a throbber.
   * @listens SearchPagePresenter#SearchStarted
   */
  on_search_started () {
    this.$grid.removeAttribute('aria-hidden');
    this.$grid.setAttribute('aria-busy', 'true');
    this.hide_status();
    this.thread.update(new Map()); // Clear grid body
  }

  /**
   * Called when the search results is retrieved. Show the results on the thread.
   * @listens SearchPagePresenter#SearchResultsAvailable
   * @param {Array.<Number>} ids - Bug IDs matching the criteria.
   */
  async on_search_results_available ({ ids } = {}) {
    const bugs = await BzDeck.collections.bugs.get_some(ids); // Map

    if (bugs.size > 0) {
      this.thread.update(bugs);
      this.hide_status();
    } else {
      this.show_status('Zarro Boogs found.'); // l10n
    }
  }

  /**
   * Called when fetching the search results failed. Show an error message accordingly.
   * @listens SearchPagePresenter#SearchError
   * @param {String} message - Error message.
   */
  on_search_error ({ message } = {}) {
    this.show_status(message);
  }

  /**
   * Called when fetching the search results completed. Remove the throbber.
   * @listens SearchPagePresenter#SearchComplete
   */
  on_search_complete () {
    this.$grid.removeAttribute('aria-busy');
  }

  /**
   * Called whenever the history state is updated.
   */
  onpopstate () {
    if (location.pathname !== `/search/${this.id}` || !history.state) {
      return;
    }

    const { preview_id } = history.state;
    const siblings = this.get_shown_bugs();

    // Show the bug preview only when the preview pane is visible (on desktop and tablet)
    if (FlareTail.env.device.mobile) {
      BzDeck.router.navigate('/bug/' + preview_id, { siblings });
    } else if (preview_id !== this.preview_id) {
      this.preview_id = preview_id;
      this.container_view.on_adding_bug_requested({ bug_id: preview_id, siblings });

      if (this.$preview_pane.matches('[aria-hidden="true"]')) {
        this.$basic_search_pane.setAttribute('aria-hidden', 'true');
        this.$preview_pane.setAttribute('aria-hidden', 'false');
      }
    }
  }
}
