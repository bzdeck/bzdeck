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
    '$tabpanel': $content.querySelector('[role="tabpanel"]'),
    '$status': $content.querySelector('[role="status"]'),
    'buttons': {},
    'panes': {}
  };

  this.data = new Proxy({
    'bug_list': [],
    'preview_id': null
  },
  {
    'get': (obj, prop) => {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};

        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }

        return [for (row of this.thread.grid.data.rows) bugs[row.data.id]];
      }

      return obj[prop];
    },
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      if (oldval === newval &&
          this.view.panes['preview'].getAttribute('aria-hidden') === 'false') {
        return;
      }

      if (prop === 'preview_id') {
        if (!FlareTail.util.device.type.startsWith('mobile')) {
          FlareTail.util.event.async(() => {
            this.show_preview(oldval, newval);
          });
        }

        BzDeck.bugzfeed.subscribe([newval]);
      }

      obj[prop] = newval;
    }
  });

  let $tabpanel = this.view.$tabpanel;

  let $tab = tablist.add_tab(
    `search-${id_suffix}`,
    'Search', // l10n
    'Search & Browse Bugs', // l10n
    $tabpanel
  );

  tablist.view.selected = tablist.view.$focused = $tab;
  $tabpanel.focus();

  this.setup_basic_search_pane();
  this.setup_result_pane();
  this.setup_preview_pane();
  this.setup_toolbar();

  window.addEventListener('UI:toggle_star', event => {
    let _bug = event.detail.bug,
        _starred = _bug._starred_comments;

    if ($tabpanel && this.data.preview_id === _bug.id) {
      $tabpanel.querySelector('[role="article"] [role="button"][data-command="star"]')
               .setAttribute('aria-pressed', !!_starred.size);

      for (let $comment of $tabpanel.querySelectorAll('[role="article"] [itemprop="comment"][data-id]')) {
        $comment.querySelector('[role="button"][data-command="star"]')
                .setAttribute('aria-pressed', _starred.has(Number.parseInt($comment.dataset.id)));
      }
    }
  });

  window.addEventListener('bug:updated', event => {
    if ($tabpanel && this.data.preview_id === event.detail.bug.id) {
      BzDeck.bug.update($tabpanel.querySelector('article'), event.detail.bug, event.detail.changes);
    }
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
      config = BzDeck.model.data.server.config;

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
      'id': `${$classification_list.id}item-${index}`,
      'label': value
    };
  });

  let products = Object.keys(config.product).sort().map((value, index) => {
    return {
      'id': `${$product_list.id}item-${index}`,
      'label': value
    };
  });

  let components = [];

  for (let [key, { 'component': cs }] of Iterator(config.product)) {
    components.push(...[for (c of Object.keys(cs)) if (components.indexOf(c) === -1) c]);
  }

  components = components.sort().map((value, index) => {
    return {
      'id': `${$component_list.id}item-${index}`,
      'label': value
    };
  });

  let statuses = config.field.status.values.map((value, index) => {
    return {
      'id': `${$status_list.id}item-${index}`,
      'label': value
    };
  });

  let resolutions = config.field.resolution.values.map((value, index) => {
    return {
      'id': `${$resolution_list.id}item-${index}`,
      'label': value || '---',
      'selected': !value // Select '---' to search open bugs
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

    this.exec_search(params);
  });
};

BzDeck.SearchPage.prototype.setup_result_pane = function () {
  let $pane = this.view.panes['result']
            = this.view.$tabpanel.querySelector('[id$="-result-pane"]'),
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      prefs = BzDeck.model.data.prefs;

  this.thread = new BzDeck.Thread(this, 'search', $pane.querySelector('[role="grid"]'), {
    'sortable': true,
    'reorderable': true,
    'sort_conditions': mobile ? { 'key': 'last_change_time', 'order': 'descending' }
                              : prefs['home.list.sort_conditions'] ||
                                { 'key': 'id', 'order': 'ascending' }
  });

  let grid = this.thread.grid;

  // Force to change the sort condition when switched to the mobile layout
  if (mobile) {
    let cond = grid.options.sort_conditions;

    cond.key = 'last_change_time';
    cond.order = 'descending';
  }

  $pane.addEventListener('transitionend', event => {
    let selected = grid.view.selected;

    if (event.propertyName === 'bottom' && selected.length) {
      grid.ensure_row_visibility(selected[selected.length - 1]);
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

  $bug.appendChild($info).id = `${$bug.id}-info`;

  // Star on the header
  let $star_button = $pane.querySelector('[role="button"][data-command="star"]');

  (new FTw.Button($star_button)).bind('Pressed', event =>
    BzDeck.core.toggle_star(this.data.preview_id, event.detail.pressed));

  // Custom scrollbar (info)
  new ScrollBar($info);

  // Custom scrollbar (timeline)
  let scrollbar = new ScrollBar($pane.querySelector('[id$="-bug-timeline"]'));

  if (scrollbar) {
    scrollbar.onkeydown_extend = BzDeck.bug.timeline.handle_keydown.bind(scrollbar);
  }
};

BzDeck.SearchPage.prototype.show_preview = function (oldval, newval) {
  let $pane = this.view.panes['preview'],
      $bug = $pane.querySelector('[id$="-preview-bug"]');

  if (!newval) {
    $bug.setAttribute('aria-hidden', 'true');

    return;
  }

  BzDeck.model.get_bug_by_id(newval).then(bug => {
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

  let $grid = this.view.panes['result'].querySelector('[role="grid"]');

  $grid.removeAttribute('aria-hidden');
  $grid.setAttribute('aria-busy', 'true');
  this.hide_status();

  FlareTail.util.event.async(() => {
    this.thread.update([]); // Clear grid body
  });

  BzDeck.model.request('GET', 'bug', params).then(result => {
    if (result.bugs.length > 0) {
      this.data.bug_list = result.bugs;

      // Save data
      BzDeck.model.get_all_bugs().then(bugs => {
        let saved_ids = new Set([for (bug of bugs) bug.id]);

        BzDeck.model.save_bugs([for (bug of result.bugs) if (!saved_ids.has(bug.id)) bug]);
      });

      // Show results
      this.thread.update(result.bugs);
      this.hide_status();
    } else {
      this.show_status('Zarro Boogs found.'); // l10n
    }
  }).catch(error => {
    this.show_status(error.message);
  }).then(() => {
    $grid.removeAttribute('aria-busy');
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
