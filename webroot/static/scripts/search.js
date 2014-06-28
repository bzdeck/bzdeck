/**
 * BzDeck Search Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.SearchPage = function () {
  let tablist = BzDeck.toolbar.tablist,
      $content = document.querySelector('template#tabpanel-search').content.cloneNode(true),
      id_suffix = this.id = Date.now();

  // Assign unique IDs
  for (let $element of $content.querySelectorAll('[id]')) {
    $element.id = $element.id.replace(/TID/, id_suffix);
  }

  this.view = {
    $tabpanel: $content.querySelector('[role="tabpanel"]'),
    $status: $content.querySelector('[role="status"]'),
    buttons: {},
    panes: {}
  };

  this.data = new Proxy({
    bug_list: [],
    preview_id: null
  },
  {
    get: (obj, prop) => {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};

        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }

        return [for (row of this.view.grid.data.rows) bugs[row.data.id]];
      }

      return obj[prop];
    },
    set: (obj, prop, newval) => {
      let oldval = obj[prop];

      if (oldval === newval &&
          this.view.panes['preview'].getAttribute('aria-hidden') === 'false') {
        return;
      }

      if (prop === 'preview_id' && !FlareTail.util.device.type.startsWith('mobile')) {
        FlareTail.util.event.async(() => {
          this.show_preview(oldval, newval);
        });
      }

      obj[prop] = newval;
    }
  });

  let $tab = tablist.add_tab(
    'search-' + id_suffix,
    'Search', // l10n
    'Search & Browse Bugs', // l10n
    this.view.$tabpanel
  );

  tablist.view.selected = tablist.view.$focused = $tab;
  this.view.$tabpanel.focus();

  this.setup_basic_search_pane();
  this.setup_result_pane();
  this.setup_preview_pane();
  this.setup_toolbar();

  window.addEventListener('UI:toggle_star', event => {
    if (!$tabpanel) {
      return; // The tabpanel has already been destroyed
    }

    // Thread
    for (let $row of $tabpanel.querySelectorAll('[id*="result-row"]')) {
      $row.querySelector('[data-id="_starred"] [role="checkbox"]')
          .setAttribute('aria-checked', event.detail.ids.has(Number.parseInt($row.dataset.id)));
    }

    // Preview
    $tabpanel.querySelector('[role="article"] [role="checkbox"][data-field="_starred"]')
             .setAttribute('aria-checked', event.detail.ids.has(this.data.preview_id));
  });
};

BzDeck.SearchPage.prototype.setup_toolbar = function () {
  let buttons = this.view.buttons,
      panes = this.view.panes;

  let handler = event => {
    switch (event.target.dataset.command) {
      case 'show-details': {
        BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
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

  for (let $button of this.view.$tabpanel.querySelectorAll('header [role="button"]')) {
    let button = buttons[$button.dataset.command] = new FlareTail.widget.Button($button);
    button.bind('Pressed', handler);
  }
};

BzDeck.SearchPage.prototype.setup_basic_search_pane = function () {
  let $pane = this.view.panes['basic-search']
            = this.view.$tabpanel.querySelector('[id$="-basic-search-pane"]'),
      config = BzDeck.data.bugzilla_config;

  // Custom scrollbar
  for (let $outer of $pane.querySelectorAll('[id$="-list-outer"]')) {
    new FlareTail.widget.ScrollBar($outer, true);
  }

  let $classification_list = $pane.querySelector('[id$="-browse-classification-list"]'),
      $product_list = $pane.querySelector('[id$="-browse-product-list"]'),
      $component_list = $pane.querySelector('[id$="-browse-component-list"]'),
      $status_list = $pane.querySelector('[id$="-browse-status-list"]'),
      $resolution_list = $pane.querySelector('[id$="-browse-resolution-list"]');

  let classifications = Object.keys(config.classification).sort().map((value, index) => {
    return {
      id: $classification_list.id + 'item-' + index,
      label: value
    };
  });

  let products = Object.keys(config.product).sort().map((value, index) => {
    return {
      id: $product_list.id + 'item-' + index,
      label: value
    };
  });

  let components = [];

  for (let [key, { component: cs }] of Iterator(config.product)) {
    components.push(...[for (c of Object.keys(cs)) if (components.indexOf(c) === -1) c]);
  }

  components = components.sort().map((value, index) => {
    return {
      id: $component_list.id + 'item-' + index,
      label: value
    };
  });

  let statuses = config.field.status.values.map((value, index) => {
    return {
      id: $status_list.id + 'item-' + index,
      label: value
    };
  });

  let resolutions = config.field.resolution.values.map((value, index) => {
    return {
      id: $resolution_list.id + 'item-' + index,
      label: value || '---',
      selected: !value // Select '---' to search open bugs
    };
  });

  let ListBox = FlareTail.widget.ListBox,
      classification_list = new ListBox($classification_list, classifications),
      product_list = new ListBox($product_list, products),
      component_list = new ListBox($component_list, components),
      status_list = new ListBox($status_list, statuses),
      resolution_list = new ListBox($resolution_list, resolutions);

  classification_list.bind('Selected', event => {
    let products = [],
        components = [];

    for (let classification of event.detail.labels) {
      products.push(...config.classification[classification].products);
    }

    for (let product of products) {
      components.push(...Object.keys(config.product[product].component));
    }

    product_list.filter(products);
    component_list.filter(components);
  });

  product_list.bind('Selected', event => {
    let components = [];

    for (let product of event.detail.labels) {
      components.push(...Object.keys(config.product[product].component));
    }

    component_list.filter(components);
  });

  let $textbox = $pane.querySelector('.text-box [role="textbox"]'),
      button = new FlareTail.widget.Button($pane.querySelector('.text-box [role="button"]'));

  button.bind('Pressed', event => {
    let params = new URLSearchParams(),
        map = {
          classification: $classification_list,
          product: $product_list,
          component: $component_list,
          status: $status_list,
          resolution: $resolution_list
        };

    for (let [name, list] of Iterator(map)) {
      for (let $opt of list.querySelectorAll('[aria-selected="true"]')) {
        params.append(name, $opt.textContent);
      }
    }

    if ($textbox.value) {
      params.append('summary', $textbox.value);
      params.append('summary_type', 'contains_all');
    }

    this.exec_search(params);
  });
};

BzDeck.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.view.panes['result']
            = this.view.$tabpanel.querySelector('[id$="-result-pane"]'),
      $grid = $pane.querySelector('[role="grid"]'),
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      prefs = BzDeck.data.prefs,
      columns = prefs['search.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new FlareTail.widget.Grid($grid, {
    rows: [],
    columns: columns.map(col => {
      // Add labels
      col.label = {
        'id': 'ID', // Instead of Bug ID; l10n
        '_starred': 'Starred', // l10n
        '_unread': 'Unread' // l10n
      }[col.id] || field[col.id].description;

      return col;
    })
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: mobile ? { key: 'last_change_time', order: 'descending' }
                            : prefs['home.list.sort_conditions'] ||
                              { key: 'id', order: 'ascending' }
  });

  // Force to change the sort condition when switched to the mobile layout
  if (mobile) {
    let cond = grid.options.sort_conditions;
    cond.key = 'last_change_time';
    cond.order = 'descending';
  }

  grid.bind('Sorted', event => {
    prefs['search.list.sort_conditions'] = event.detail.conditions;
  });

  grid.bind('ColumnModified', event => {
    prefs['search.list.columns'] = event.detail.columns.map(col => {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  grid.bind('Selected', event => {
    let ids = event.detail.ids;

    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = Number.parseInt(ids[ids.length - 1]);

      // Mobile compact layout
      if (mobile) {
        BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
      }
    }
  });

  grid.bind('dblclick', event => {
    let $target = event.originalTarget;

    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.detailspage = new BzDeck.DetailsPage(Number.parseInt($target.dataset.id),
                                                  this.data.bug_list);
    }
  });

  grid.bind('keydown', event => {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.$focused);

    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.$focused = members[index - 1];
    }

    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.$focused = members[index + 1];
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

  $pane.addEventListener('transitionend', event => {
    let selected = this.view.grid.view.selected;

    if (event.propertyName === 'bottom' && selected.length) {
      this.view.grid.ensure_row_visibility(selected[selected.length - 1]);
    }
  });
};

BzDeck.SearchPage.prototype.setup_preview_pane = function () {
  let FTw = FlareTail.widget,
      ScrollBar = FTw.ScrollBar,
      $pane = this.view.panes['preview']
            = this.view.$tabpanel.querySelector('[id$="-preview-pane"]'),
      $bug = $pane.querySelector('article'),
      $info = document.querySelector('#preview-bug-info').content.cloneNode(true).firstElementChild;

  $bug.appendChild($info).id = $bug.id + '-info';

  // Star on the header
  let $star_checkbox = $pane.querySelector('[role="checkbox"][data-field="_starred"]');
  (new FTw.Checkbox($star_checkbox)).bind('Toggled', event => {
    BzDeck.core.toggle_star(this.data.preview_id, event.detail.checked);
  });

  // Custom scrollbar (info)
  new ScrollBar($info);

  // Custom scrollbar (timeline)
  let scrollbar = new ScrollBar($pane.querySelector('[id$="-bug-timeline"]'));

  if (scrollbar) {
    scrollbar.onkeydown_extend = BzDeck.timeline.handle_keydown.bind(scrollbar);
  }
};

BzDeck.SearchPage.prototype.show_preview = function (oldval, newval) {
  let $pane = this.view.panes['preview'],
      $bug = $pane.querySelector('[id$="-preview-bug"]');

  if (!newval) {
    $bug.setAttribute('aria-hidden', 'true');
    return;
  }

  BzDeck.model.get_bug_by_id(newval, bug => {
    if (!bug) {
      // Unknown bug
      $bug.setAttribute('aria-hidden', 'true');
      return;
    }

    // Show the preview pane
    if ($pane.mozMatchesSelector('[aria-hidden="true"]')) {
      this.hide_status();
      this.view.panes['basic-search'].setAttribute('aria-hidden', 'true');
      $pane.setAttribute('aria-hidden', 'false');
      this.view.buttons['show-details'].data.disabled = false;
      this.view.buttons['show-basic-search-pane'].data.disabled = false;
    }

    // Fill the content
    BzDeck.bug.fill_data($bug, bug);
    $bug.setAttribute('aria-hidden', 'false');
  });
};

BzDeck.SearchPage.prototype.exec_search = function (params) {
  if (!navigator.onLine) {
    this.show_status('You have to go online to search bugs.'); // l10n
    return;
  }

  // Specify fields
  params.append('include_fields', BzDeck.options.api.default_fields.join());

  let $grid = this.view.panes['result'].querySelector('[role="grid"]');

  $grid.removeAttribute('aria-hidden');
  $grid.setAttribute('aria-busy', 'true');
  this.hide_status();

  FlareTail.util.event.async(() => {
    BzDeck.global.update_grid_data(this.view.grid, []); // Clear grid body
  });

  BzDeck.core.request('GET', 'bug', params, null, data => {
    if (!data || !Array.isArray(data.bugs)) {
      $grid.removeAttribute('aria-busy');
      this.show_status('ERROR: Failed to load data.'); // l10n

      return;
    }

    if (data.bugs.length > 0) {
      this.data.bug_list = data.bugs;

      // Save data
      BzDeck.model.get_all_bugs(bugs => {
        let saved_ids = new Set([for (bug of bugs) bug.id]);
        BzDeck.model.save_bugs([for (bug of data.bugs) if (!saved_ids.has(bug.id)) bug]);
      });

      // Show results
      FlareTail.util.event.async(() => {
        BzDeck.global.update_grid_data(this.view.grid, data.bugs);
        $grid.removeAttribute('aria-busy');
        this.hide_status();
      });
    } else {
      $grid.removeAttribute('aria-busy');
      this.show_status('Zarro Boogs found.'); // l10n
    }
  });
};

BzDeck.SearchPage.prototype.show_status = function (str) {
  this.view.$status.firstElementChild.textContent = str;
  this.view.$status.setAttribute('aria-hidden', str === '');
  this.view.panes['result'].querySelector('[role="grid"]').setAttribute('aria-hidden', str !== '');
};

BzDeck.SearchPage.prototype.hide_status = function () {
  this.show_status('');
};
