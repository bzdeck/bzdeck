/**
 * BzDeck Search Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.SearchPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      $content = document.querySelector('template#tabpanel-search').content.cloneNode(),
      id_suffix = this.id = (new Date()).getTime();

  // Assign unique IDs
  for (let $element of $content.querySelectorAll('[id]')) {
    $element.id = $element.id.replace(/TID/, id_suffix);
  }

  this.view = {
    tabpanel: $content.querySelector('[role="tabpanel"]'),
    buttons: {},
    panes: {}
  };

  this.data = new Proxy({
    preview_id: null
  },
  {
    set: (obj, prop, newval) => {
      let oldval = obj[prop];
      if (oldval === newval) {
        return;
      }
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }
  });

  let tab = tablist.add_tab(
    'search-' + id_suffix,
    'Search', // l10n
    'Search & Browse Bugs', // l10n
    this.view.tabpanel
  );

  this.setup_basic_search_pane();
  this.setup_result_pane();
  this.setup_preview_pane();
  this.setup_toolbar();

  tablist.view.selected = tablist.view.focused = tab;
};

BzDeck.SearchPage.prototype.setup_toolbar = function () {
  let buttons = this.view.buttons,
      panes = this.view.panes;

  let handler = event => {
    switch (event.target.dataset.command) {
      case 'show-details': {
        new BzDeck.DetailsPage(this.data.preview_id);
        break;
      }
      case 'show-basic-search-pane': {
        panes['basic-search'].setAttribute('aria-hidden', 'false');
        panes['preview'].setAttribute('aria-hidden', 'true');
        buttons['show-details'].data.disabled = true;
        buttons['show-basic-search-pane'].data.disabled = true;
        break;
      }
    }
  };

  for (let $button of this.view.tabpanel.querySelectorAll('footer [role="button"]')) {
    buttons[$button.dataset.command] = new BriteGrid.widget.Button($button);
    $button.addEventListener('Pressed', handler.bind(this));
  }
};

BzDeck.SearchPage.prototype.setup_basic_search_pane = function () {
  let $pane = this.view.panes['basic-search'] 
            = this.view.tabpanel.querySelector('[id$="-basic-search-pane"]'),
      ScrollBar = BriteGrid.widget.ScrollBar,
      config = BzDeck.data.bugzilla_config;

  for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
    new ScrollBar($outer, true);
  }

  let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]'),
      $product_list = $pane.querySelector('[id$="-browse-product-list"]'),
      $component_list = $pane.querySelector('[id$="-browse-component-list"]'),
      $status_list = $pane.querySelector('[id$="-browse-status-list"]'),
      $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

  $classification_list.addEventListener('Selected', event => {
    let products = [],
        components = [];
    for (let $option of $classification_list.querySelectorAll('[aria-selected="true"]')) {
      products = products.concat(config.classification[$option.textContent].products);
    }
    for (let product of products) {
      components = components.concat(Object.keys(config.product[product].component));
    }
    // Narrow down the product list
    for (let $option of $product_list.querySelectorAll('[role="option"]')) {
      let state = products.length && products.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      let state = components.length && components.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
  });

  $product_list.addEventListener('Selected', event => {
    let components = [];
    for (let $option of $product_list.querySelectorAll('[aria-selected="true"]')) {
      components = components.concat(Object.keys(config.product[$option.textContent].component));
    }
    // Narrow down the component list
    for (let $option of $component_list.querySelectorAll('[role="option"]')) {
      let state = components.length && components.indexOf($option.textContent) === -1;
      $option.setAttribute('aria-disabled', state);
      $option.setAttribute('aria-selected', 'false');
    }
  });

  let classifications = Object.keys(config.classification),
      classification_list_id_prefix = $classification_list.id + 'item-';
  classifications.sort();
  for (let [index, value] of Iterator(classifications)) {
    classifications[index] = {
      id: classification_list_id_prefix + index,
      label: value
    };
  }

  let products = [],
      product_list_id_prefix = $product_list.id + 'item-',
      components = [],
      component_list_id_prefix = $component_list.id + 'item-';
  for (let [key, value] of Iterator(config.product)) {
    products.push(key);
    for (let [key, value] of Iterator(value.component)) {
      if (components.indexOf(key) === -1) {
        components.push(key);
      }
    }
  }
  products.sort();
  for (let [index, value] of Iterator(products)) {
    products[index] = {
      id: product_list_id_prefix + index,
      label: value
    };
  }
  components.sort();
  for (let [index, value] of Iterator(components)) {
    components[index] = {
      id: component_list_id_prefix + index,
      label: value
    };
  }

  let statuses = [],
      status_list_id_prefix = $status_list.id + 'item-';
  for (let [index, value] of Iterator(config.field.status.values)) {
    statuses.push({
      id: status_list_id_prefix + index,
      label: value
    });
  };

  let resolutions = [],
      resolution_list_id_prefix = $resolution_list.id + 'item-';
  for (let [key, value] of Iterator(config.field.resolution.values)) {
    resolutions.push({
      id: resolution_list_id_prefix + key,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    });
  };

  let ListBox = BriteGrid.widget.ListBox;
  new ListBox($classification_list, classifications);
  new ListBox($product_list, products);
  new ListBox($component_list, components);
  new ListBox($status_list, statuses);
  new ListBox($resolution_list, resolutions);

  let $textbox = $pane.querySelector('.text-box [role="textbox"]'),
      $button = $pane.querySelector('.text-box [role="button"]');

  $button.addEventListener('Pressed', event => {
    let query = {};

    let map = {
      classification: $classification_list,
      product: $product_list,
      component: $component_list,
      status: $status_list,
      resolution: $resolution_list
    };

    for (let [name, list] of Iterator(map)) {
      let values = [];
      for (let $option of list.querySelectorAll('[aria-selected="true"]')) {
        values.push($option.textContent);
      }
      if (values.length) {
        query[name] = values;
      }
    }

    if ($textbox.value) {
      query['summary'] = $textbox.value;
      query['summary_type'] = 'contains_all';
    }

    this.exec_search(query);
  });

  new BriteGrid.widget.Button($button);
};

BzDeck.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.view.panes['result'] 
            = this.view.tabpanel.querySelector('[id$="-result-pane"]'),
      $grid = $pane.querySelector('[role="grid"]'),
      prefs = BzDeck.data.prefs,
      columns = prefs['search.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  this.view.grid = new BriteGrid.widget.Grid($grid, {
    rows: [],
    columns: columns.map(col => {
      // Add labels
      switch (col.id) {
        case '_starred': {
          col.label = 'Starred';
          break;
        }
        case '_unread': {
          col.label = 'Unread';
          break;
        }
        default: {
          col.label = field[col.id].description;
        }
      }
      return col;
    })
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: prefs['search.list.sort_conditions'] || { key:'id', order:'ascending' }
  });

  $grid.addEventListener('Sorted', event => {
    prefs['search.list.sort_conditions'] = event.detail.conditions;
  });

  $grid.addEventListener('ColumnModified', event => {
    prefs['search.list.columns'] = event.detail.columns.map(col => {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  $grid.addEventListener('Selected', event => {
    // Show Bug in Preview Pane
    let ids = event.detail.ids;
    if (ids.length) {
      this.data.preview_id = Number.toInteger(ids[ids.length - 1]);
    }
  });

  $grid.addEventListener('dblclick', event => {
    let $target = event.originalTarget;
    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      new BzDeck.DetailsPage($target.dataset.id);
    }
  });

  $grid.addEventListener('keydown', event => {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.focused);
    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.focused = members[index - 1];
    }
    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.focused = members[index + 1];
    }
    // [M] toggle read
    if (!modifiers && event.keyCode === event.DOM_VK_M) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = _data._unread !== true;
      }
    }
    // [S] toggle star
    if (!modifiers && event.keyCode === event.DOM_VK_S) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._starred = _data._starred !== true;
      }
    }
  }, true); // use capture
};

BzDeck.SearchPage.prototype.setup_preview_pane = function () {
  let $pane = this.view.panes['preview'] 
            = this.view.tabpanel.querySelector('[id$="-preview-pane"]');

  let ScrollBar = BriteGrid.widget.ScrollBar;
  new ScrollBar($pane.querySelector('[id$="-bug-info"]'));
  new ScrollBar($pane.querySelector('[id$="-bug-timeline"]'));
};

BzDeck.SearchPage.prototype.show_preview = function (oldval, newval) {
  let $pane = this.view.panes['preview'],
      $template = $pane.querySelector('[id$="-preview-bug"]');

  if (!newval) {
    $template.setAttribute('aria-hidden', 'true');
    return;
  }

  BzDeck.model.get_bug_by_id(newval, bug => {
    if (!bug) {
      // Unknown bug
      $template.setAttribute('aria-hidden', 'true');
      return;
    }
    // Show the preview pane
    if ($pane.mozMatchesSelector('[aria-hidden="true"]')) {
      BzDeck.global.show_status('');
      this.view.panes['basic-search'].setAttribute('aria-hidden', 'true');
      $pane.setAttribute('aria-hidden', 'false');
      this.view.buttons['show-details'].data.disabled = false;
      this.view.buttons['show-basic-search-pane'].data.disabled = false;
    }
    // Fill the content
    BzDeck.global.fill_template($template, bug);
    $template.setAttribute('aria-hidden', 'false');
  });
};

BzDeck.SearchPage.prototype.exec_search = function (query) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to search bugs.'); // l10n
    return;
  }

  // Specify fields
  query['include_fields'] = '_default';
  query = BriteGrid.util.request.build_query(query);

  BzDeck.global.show_status('Loading...'); // l10n
  BzDeck.global.update_grid_data(this.view.grid, []); // Clear grid body

  let $grid_body = this.view.panes['result'].querySelector('[class="grid-body"]')
  $grid_body.setAttribute('aria-busy', 'true');

  BzDeck.core.request('GET', 'bug' + query, event => {
    let response = event.target.responseText,
        data = response ? JSON.parse(response) : null;
    if (!data || !Array.isArray(data.bugs)) {
      $grid_body.removeAttribute('aria-busy');
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
      return;
    }
    let num = data.bugs.length,
        status = '';
    if (num > 0) {
      // Save data
      let store = BzDeck.model.db.transaction('bugs', 'readwrite').objectStore('bugs');
      for (let bug of data.bugs) {
        let _bug = bug;
        store.get(bug.id).addEventListener('success', event => {
          if (!event.target.result) {
            store.put(_bug);
          }
        });
      }
      // Show results
      BzDeck.global.update_grid_data(this.view.grid, data.bugs);
      if (num > 1) {
        status = '%d bugs found.'.replace('%d', num); // l10n
      } else {
        status = '1 bug found.'; // l10n
      }
    } else {
      status = 'Zarro Boogs found.'; // l10n
    }
    $grid_body.removeAttribute('aria-busy');
    BzDeck.global.show_status(status);
  });
};
