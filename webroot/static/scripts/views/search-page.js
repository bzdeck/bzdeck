/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page View that represents the Advanced Search tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.SearchPageView = class SearchPageView extends BzDeck.BaseView {
  /**
   * Get a SearchPageView instance.
   * @constructor
   * @param {Number} id - 13-digit identifier for a new instance, generated with Date.now().
   * @param {URLSearchParams} params - Search query.
   * @param {Object} config - Bugzilla server configuration that contains products, components and more.
   * @returns {Object} view - New SearchPageView instance.
   */
  constructor (id, params, config) {
    super(); // This does nothing but is required before using `this`

    this.id = id;
    this.$tabpanel = document.querySelector(`#tabpanel-search-${id}`);
    this.$grid = this.$tabpanel.querySelector('[id$="-result-pane"] [role="grid"]');
    this.$status = this.$tabpanel.querySelector('[role="status"]');
    this.panes = {};

    this.setup_basic_search_pane(config);
    this.setup_result_pane();

    Object.defineProperties(this, {
      preview_is_hidden: {
        enumerable: true,
        get: () => this.helpers.env.device.mobile
      },
    });

    if (params) {
      // TODO: support other params
      this.panes['basic-search'].querySelector('.text-box [role="searchbox"]').value = params.get('short_desc') || '';
    }

    this.subscribe('C:Offline');
    this.subscribe('C:SearchStarted');
    this.subscribe_safe('C:SearchResultsAvailable');
    this.subscribe('C:SearchError');
    this.subscribe('C:SearchComplete');
    this.on('C:BugDataUnavailable', data => this.show_preview(undefined));
    this.on_safe('C:BugDataAvailable', data => this.show_preview(data));
  }

  /**
   * Set up the Basic Seach Pane that contains options for classification, product, component, status and resolution, as
   * well as search term textbox.
   * @param {Object} config - Bugzilla server configuration that contains products, components and more.
   * @returns {undefined}
   * @fires SearchPageView:SearchRequested
   */
  setup_basic_search_pane (config) {
    let $pane = this.panes['basic-search'] = this.$tabpanel.querySelector('[id$="-basic-search-pane"]');

    // Custom scrollbar
    for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
      new this.widgets.ScrollBar($outer, { adjusted: true });
    }

    let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]');
    let $product_list = $pane.querySelector('[id$="-browse-product-list"]');
    let $component_list = $pane.querySelector('[id$="-browse-component-list"]');
    let $status_list = $pane.querySelector('[id$="-browse-status-list"]');
    let $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

    let classifications = Object.keys(config.classification).sort().map((value, index) => ({
      id: `${$classification_list.id}item-${index}`,
      label: value
    }));

    let products = Object.keys(config.product).sort().map((value, index) => ({
      id: `${$product_list.id}item-${index}`,
      label: value
    }));

    let components = new Set();

    for (let [key, product] of Object.entries(config.product)) for (let component of Object.keys(product.component)) {
      components.add(component); // Duplicates will be automatically removed
    }

    components = [...components].sort().map((value, index) => ({
      id: `${$component_list.id}item-${index}`,
      label: value
    }));

    let statuses = config.field.status.values.map((value, index) => ({
      id: `${$status_list.id}item-${index}`,
      label: value
    }));

    let resolutions = config.field.resolution.values.map((value, index) => ({
      id: `${$resolution_list.id}item-${index}`,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    }));

    let ListBox = this.widgets.ListBox;
    let $$classification_list = new ListBox($classification_list, classifications);
    let $$product_list = new ListBox($product_list, products);
    let $$component_list = new ListBox($component_list, components);
    let $$status_list = new ListBox($status_list, statuses);
    let $$resolution_list = new ListBox($resolution_list, resolutions);

    $$classification_list.bind('Selected', event => {
      let products = [];
      let components = [];

      for (let classification of event.detail.labels) {
        products.push(...config.classification[classification].products);
      }

      for (let product of products) {
        components.push(...Object.keys(config.product[product].component));
      }

      $$product_list.filter(products);
      $$component_list.filter(components);
    });

    $$product_list.bind('Selected', event => {
      let components = [];

      for (let product of event.detail.labels) {
        components.push(...Object.keys(config.product[product].component));
      }

      $$component_list.filter(components);
    });

    let $textbox = $pane.querySelector('.text-box [role="searchbox"]');
    let $$button = new this.widgets.Button($pane.querySelector('.text-box [role="button"]'));

    $$button.bind('Pressed', event => {
      let params = new URLSearchParams();

      let map = {
        classification: $classification_list,
        product: $product_list,
        component: $component_list,
        status: $status_list,
        resolution: $resolution_list
      };

      for (let [name, $element] of Object.entries(map)) {
        for (let $opt of $element.querySelectorAll('[aria-selected="true"]')) {
          params.append(name, $opt.textContent);
        }
      }

      if ($textbox.value) {
        params.append('short_desc', $textbox.value);
        params.append('short_desc_type', 'allwordssubstr');
      }

      this.trigger(':SearchRequested', { params_str: params.toString() });
    });
  }

  /**
   * Set up the Result Pane that shows search results in a classic thread.
   * @param {undefined}
   * @returns {undefined}
   */
  setup_result_pane () {
    let $pane = this.panes['result'] = this.$tabpanel.querySelector('[id$="-result-pane"]');
    let $$grid;
    let mobile = this.helpers.env.device.mobile;

    Promise.all([
      BzDeck.prefs.get('home.list.sort_conditions'),
      BzDeck.prefs.get('search.list.columns'),
    ]).then(prefs => {
      let [sort_cond, columns] = prefs;

      this.thread = new BzDeck.ClassicThreadView(this, 'search', this.$grid, columns, {
        sortable: true,
        reorderable: true,
        sort_conditions: mobile ? { key: 'last_change_time', order: 'descending' }
                                  : sort_cond || { key: 'id', order: 'ascending' }
      });

      $$grid = this.thread.$$grid;

      // Force to change the sort condition when switched to the mobile layout
      if (mobile) {
        let cond = $$grid.options.sort_conditions;

        cond.key = 'last_change_time';
        cond.order = 'descending';
      }
    });

    $pane.addEventListener('transitionend', event => {
      let selected = $$grid.view.selected;

      if (event.propertyName === 'bottom' && selected.length) {
        $$grid.ensure_row_visibility(selected[selected.length - 1]);
      }
    });
  }

  /**
   * Get a list of bugs currently showing on the result thread. FIXME: This should be smartly done in the controller.
   * @param {Map.<Number, Proxy>} bugs - All bugs prepared for the thread.
   * @returns {Array.<Number>} ids - IDs of bugs currently showing.
   */
  get_shown_bugs (bugs) {
    return [...this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])')]
                                  .map($row => bugs.get(Number($row.dataset.id)));
  }

  /**
   * Show the preview of a selected bug on the Preview Pane.
   * @listens SearchPageController:BugDataUnavailable
   * @listens SearchPageController:BugDataAvailable
   * @param {Object} data - Preview data.
   * @param {Proxy}  data.bug - Bug to show.
   * @param {Object} data.controller - New BugController instance for that bug.
   * @returns {undefined}
   * @fires SearchPageView:OpeningTabRequested
   */
  show_preview (data) {
    let $pane = this.panes['preview'] = this.$tabpanel.querySelector('[id$="-preview-pane"]');

    $pane.innerHTML = '';

    let $bug = $pane.appendChild(this.get_template('search-preview-bug-template', this.id));
    let $info = $bug.appendChild(this.get_template('preview-bug-info'));

    // Activate the toolbar buttons
    new this.widgets.Button($bug.querySelector('[data-command="show-details"]'))
        .bind('Pressed', event => this.trigger(':OpeningTabRequested'));
    new this.widgets.Button($bug.querySelector('[data-command="show-basic-search-pane"]'))
        .bind('Pressed', event => this.show_basic_search_pane());

    // Assign keyboard shortcuts
    this.helpers.kbd.assign($bug, {
      // [B] previous bug or [F] next bug: handle on the search thread
      'B|F': event => this.helpers.kbd.dispatch(this.$grid, event.key),
      // Open the bug in a new tab
      O: event => this.trigger(':OpeningTabRequested'),
    });

    // Fill the content
    this.$$bug = new BzDeck.BugView(data.controller.id, data.bug, $bug);
    $info.id = `search-${this.id}-preview-bug-info`;
    $bug.removeAttribute('aria-hidden');

    // Show the preview pane
    if ($pane.matches('[aria-hidden="true"]')) {
      this.hide_status();
      this.panes['basic-search'].setAttribute('aria-hidden', 'true');
      $pane.setAttribute('aria-hidden', 'false');
    }
  }

  /**
   * Hide the Preview Pane and show the Basic Seach Pane instead.
   * @param {undefined}
   * @returns {undefined}
   */
  show_basic_search_pane () {
    this.panes['basic-search'].setAttribute('aria-hidden', 'false');
    this.panes['preview'].setAttribute('aria-hidden', 'true');
  }

  /**
   * Display a message on the statusbar.
   * @param {String} str - Message to show.
   * @returns {undefined}
   */
  show_status (str) {
    this.$status.firstElementChild.textContent = str;
    this.$status.setAttribute('aria-hidden', str === '');
    this.$grid.setAttribute('aria-hidden', str !== '');
  }

  /**
   * Remove any message from the statusbar.
   * @param {undefined}
   * @returns {undefined}
   */
  hide_status () {
    this.show_status('');
  }

  /**
   * Called when the search results cannot be retrieved because the device or browser is offline. Show a message to ask
   * the user to go online.
   * @listens SearchPageController:Offline
   * @param {undefined}
   * @returns {undefined}
   * @todo Reload when going online.
   */
  on_offline () {
    this.show_status('You have to go online to search bugs.'); // l10n
  }

  /**
   * Called when fetching the search results started. Empty the results and show a throbber.
   * @listens SearchPageController:SearchStarted
   * @param {undefined}
   * @returns {undefined}
   */
  on_search_started () {
    this.$grid.removeAttribute('aria-hidden');
    this.$grid.setAttribute('aria-busy', 'true');
    this.hide_status();
    this.thread.update(new Map()); // Clear grid body
  }

  /**
   * Called when the search results is retrieved. Show the results on the thread.
   * @listens SearchPageController:SearchResultsAvailable
   * @param {Object} data - Passed data.
   * @param {Map.<Number, Proxy>} data.bugs - Bugs matching the criteria.
   * @returns {undefined}
   */
  on_search_results_available (data) {
    if (data.bugs.size > 0) {
      this.thread.update(data.bugs);
      this.hide_status();
    } else {
      this.show_status('Zarro Boogs found.'); // l10n
    }
  }

  /**
   * Called when fetching the search results failed. Show an error message accordingly.
   * @listens SearchPageController:SearchError
   * @param {Object} data - Passed data.
   * @param {String} data.message - Error message.
   * @returns {undefined}
   */
  on_search_error (data) {
    this.show_status(data.message);
  }

  /**
   * Called when fetching the search results completed. Remove the throbber.
   * @listens SearchPageController:SearchComplete
   * @param {undefined}
   * @returns {undefined}
   */
  on_search_complete () {
    this.$grid.removeAttribute('aria-busy');
  }
}
