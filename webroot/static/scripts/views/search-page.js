/**
 * BzDeck Search Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.SearchPage = function SearchPageView (id, params, config) {
  this.id = id;
  this.$tabpanel = document.querySelector(`#tabpanel-search-${id}`);
  this.$grid = this.$tabpanel.querySelector('[id$="-result-pane"] [role="grid"]');
  this.$status = this.$tabpanel.querySelector('[role="status"]');
  this.panes = {};

  this.setup_basic_search_pane(config);
  this.setup_result_pane();

  Object.defineProperties(this, {
    'preview_is_hidden': {
      'enumerable': true,
      'get': () => FlareTail.util.ua.device.mobile
    },
  });

  if (params) {
    // TODO: support other params
    this.panes['basic-search'].querySelector('.text-box [role="searchbox"]').value = params.get('short_desc') || '';
  }

  this.on('C:Offline', data => {
    this.show_status('You have to go online to search bugs.'); // l10n
  });

  this.on('C:SearchStarted', data => {
    this.$grid.removeAttribute('aria-hidden');
    this.$grid.setAttribute('aria-busy', 'true');
    this.hide_status();
    this.thread.update(new Map()); // Clear grid body
  });

  this.on('C:SearchResultsAvailable', data => {
    if (data.bugs.size > 0) {
      this.thread.update(data.bugs);
      this.hide_status();
    } else {
      this.show_status('Zarro Boogs found.'); // l10n
    }
  });

  this.on('C:SearchError', data => {
    this.show_status(data.error.message);
  });

  this.on('C:SearchComplete', data => {
    this.$grid.removeAttribute('aria-busy');
  });

  this.on('C:BugDataUnavailable', data => this.show_preview(undefined));
  this.on('C:BugDataAvailable', data => this.show_preview(data.bug));
};

BzDeck.views.SearchPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.SearchPage.prototype.constructor = BzDeck.views.SearchPage;

BzDeck.views.SearchPage.prototype.setup_basic_search_pane = function (config) {
  let $pane = this.panes['basic-search'] = this.$tabpanel.querySelector('[id$="-basic-search-pane"]');

  // Custom scrollbar
  for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
    new this.widget.ScrollBar($outer, true);
  }

  let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]'),
      $product_list = $pane.querySelector('[id$="-browse-product-list"]'),
      $component_list = $pane.querySelector('[id$="-browse-component-list"]'),
      $status_list = $pane.querySelector('[id$="-browse-status-list"]'),
      $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

  let classifications = Object.keys(config.classification).sort().map((value, index) => ({
    'id': `${$classification_list.id}item-${index}`,
    'label': value
  }));

  let products = Object.keys(config.product).sort().map((value, index) => ({
    'id': `${$product_list.id}item-${index}`,
    'label': value
  }));

  let components = [];

  for (let [key, { 'component': cs }] of Iterator(config.product)) {
    components.push(...[for (c of Object.keys(cs)) if (!components.includes(c)) c]);
  }

  components = components.sort().map((value, index) => ({
    'id': `${$component_list.id}item-${index}`,
    'label': value
  }));

  let statuses = config.field.status.values.map((value, index) => ({
    'id': `${$status_list.id}item-${index}`,
    'label': value
  }));

  let resolutions = config.field.resolution.values.map((value, index) => ({
    'id': `${$resolution_list.id}item-${index}`,
    'label': value || '---',
    'selected': !value // Select '---' to search open bugs
  }));

  let ListBox = this.widget.ListBox,
      $$classification_list = new ListBox($classification_list, classifications),
      $$product_list = new ListBox($product_list, products),
      $$component_list = new ListBox($component_list, components),
      $$status_list = new ListBox($status_list, statuses),
      $$resolution_list = new ListBox($resolution_list, resolutions);

  $$classification_list.bind('Selected', event => {
    let products = [],
        components = [];

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

  let $textbox = $pane.querySelector('.text-box [role="searchbox"]'),
      $$button = new this.widget.Button($pane.querySelector('.text-box [role="button"]'));

  $$button.bind('Pressed', event => {
    let params = new URLSearchParams(),
        map = {
          'classification': $classification_list,
          'product': $product_list,
          'component': $component_list,
          'status': $status_list,
          'resolution': $resolution_list
        };

    for (let [name, list] of Iterator(map)) {
      for (let $opt of list.querySelectorAll('[aria-selected="true"]')) {
        params.append(name, $opt.textContent);
      }
    }

    if ($textbox.value) {
      params.append('short_desc', $textbox.value);
      params.append('short_desc_type', 'allwordssubstr');
    }

    this.trigger(':SearchRequested', { params });
  });
};

BzDeck.views.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.panes['result'] = this.$tabpanel.querySelector('[id$="-result-pane"]'),
      mobile = FlareTail.util.ua.device.mobile;

  this.thread = new BzDeck.views.ClassicThread(this, 'search', this.$grid, {
    'sortable': true,
    'reorderable': true,
    'sort_conditions': mobile ? { 'key': 'last_change_time', 'order': 'descending' }
                              : BzDeck.collections.prefs.get('home.list.sort_conditions') ||
                                { 'key': 'id', 'order': 'ascending' }
  });

  let $$grid = this.thread.$$grid;

  // Force to change the sort condition when switched to the mobile layout
  if (mobile) {
    let cond = $$grid.options.sort_conditions;

    cond.key = 'last_change_time';
    cond.order = 'descending';
  }

  $pane.addEventListener('transitionend', event => {
    let selected = $$grid.view.selected;

    if (event.propertyName === 'bottom' && selected.length) {
      $$grid.ensure_row_visibility(selected[selected.length - 1]);
    }
  });
};

BzDeck.views.SearchPage.prototype.get_shown_bugs = function (bugs) {
  let rows = this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

  return [for ($row of rows) bugs.get(Number($row.dataset.id))];
};

BzDeck.views.SearchPage.prototype.show_preview = function (bug) {
  let $pane = this.panes['preview'] = this.$tabpanel.querySelector('[id$="-preview-pane"]');

  $pane.innerHTML = '';

  if (!bug) {
    return;
  }

  let $bug = $pane.appendChild(this.get_fragment('search-preview-bug-template', this.id).firstElementChild),
      $info = $bug.appendChild(this.get_fragment('preview-bug-info').firstElementChild);

  // Activate the toolbar buttons
  new this.widget.Button($bug.querySelector('[data-command="show-details"]'))
      .bind('Pressed', event => this.trigger(':OpeningTabRequested'));
  new this.widget.Button($bug.querySelector('[data-command="show-basic-search-pane"]'))
      .bind('Pressed', event => this.show_basic_search_pane());

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign($bug, {
    // [B] previous bug or [F] next bug: handle on the search thread
    'B|F': event => FlareTail.util.kbd.dispatch(this.$grid, event.key),
    // Open the bug in a new tab
    'O': event => this.trigger(':OpeningTabRequested'),
  });

  // Fill the content
  this.$$bug = new BzDeck.views.Bug($bug, bug);
  $info.id = `search-${this.id}-preview-bug-info`;
  $bug.removeAttribute('aria-hidden');

  // Show the preview pane
  if ($pane.matches('[aria-hidden="true"]')) {
    this.hide_status();
    this.panes['basic-search'].setAttribute('aria-hidden', 'true');
    $pane.setAttribute('aria-hidden', 'false');
  }
};

BzDeck.views.SearchPage.prototype.show_basic_search_pane = function () {
  this.panes['basic-search'].setAttribute('aria-hidden', 'false');
  this.panes['preview'].setAttribute('aria-hidden', 'true');
};

BzDeck.views.SearchPage.prototype.show_status = function (str) {
  this.$status.firstElementChild.textContent = str;
  this.$status.setAttribute('aria-hidden', str === '');
  this.$grid.setAttribute('aria-hidden', str !== '');
};

BzDeck.views.SearchPage.prototype.hide_status = function () {
  this.show_status('');
};
