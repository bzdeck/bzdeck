/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Toolbar = function ToolbarView (user) {
  let mobile = this.helpers.env.device.mobile,
      $$tablist = this.$$tablist = new this.widgets.TabList(document.querySelector('#main-tablist')),
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  this.tab_path_map = new Map([['tab-home', '/home/inbox']]);

  $$tablist.bind('Selected', event => {
    let path = this.tab_path_map.get(event.detail.items[0].id);

    $root.setAttribute('data-current-tab', path.match(/^\/(\w+)/)[1]);

    // Do not apply transition to the previous tabpanel. This is a tricky part!
    {
      let prev_tabpanel_id;

      if (!path.startsWith('/home/') && history.state && event.detail.oldval.length &&
          history.state.previous === this.tab_path_map.get(event.detail.oldval[0].id)) {
        prev_tabpanel_id = event.detail.oldval[0].id.replace(/^tab-/, 'tabpanel-');
      }

      for (let $tabpanel of document.querySelectorAll('#main-tabpanels > [role="tabpanel"]')) {
        if ($tabpanel.id === prev_tabpanel_id) {
          $tabpanel.classList.add('fixed');
        } else {
          $tabpanel.classList.remove('fixed');
        }
      }
    }

    if (location.pathname + location.search !== path) {
      BzDeck.router.navigate(path);
    }
  });

  // Make the logo clickable
  document.querySelector('[role="banner"] h1')
          .addEventListener('mousedown', event => BzDeck.router.navigate('/home/inbox'));

  new this.widgets.MenuBar(document.querySelector('#main-menu'));

  let $app_menu = document.querySelector('#main-menu--app-menu');

  $app_menu.addEventListener('MenuItemSelected', event => {
    this.trigger(':AppMenuItemSelected', { command: event.detail.command });
  });

  // Switch to the mobile layout
  if (mobile) {
    document.querySelector('#sidebar-account').appendChild(document.querySelector('#main-menu--app--account'));
    document.querySelector('#sidebar-menu').appendChild($app_menu);
    document.querySelector('#tabpanel-home [role="toolbar"]')
            .appendChild(document.querySelector('#quicksearch'));
    document.querySelector('#tabpanel-home [role="toolbar"]')
            .appendChild(document.querySelector('#toolbar-buttons'));

    $app_menu.addEventListener('MenuClosed', event => {
      // Keep the menu open
      $app_menu.removeAttribute('aria-expanded');
      // Hide the sidebar
      $root.setAttribute('data-sidebar-hidden', 'true');
      $sidebar.setAttribute('aria-hidden', 'true');
    });
  }

  $app_menu.setAttribute('aria-expanded', mobile);

  if (this.helpers.app.fullscreen_enabled) {
    {
      let $menuitem = document.querySelector('#main-menu--app--fullscreen');

      let toggle_fullScreen = () => {
        document.mozFullScreenElement ? document.mozCancelFullScreen() : document.body.mozRequestFullScreen();
      };

      $menuitem.removeAttribute('aria-hidden');

      // A workaround for Bug 779324
      $menuitem.addEventListener('mousedown', event => toggle_fullScreen());
      this.helpers.kbd.assign($menuitem, { Enter: event => toggle_fullScreen() });

      window.addEventListener('mozfullscreenchange', event => {
        $menuitem.querySelector('label').textContent = document.mozFullScreenElement ? 'Exit Full Screen'
                                                                                     : 'Enter Full Screen'; // l10n
      });
    }
  }

  // Show the Quit menu item if the app runs on WebAppRT
  if (!window.locationbar.visible) {
    document.querySelector('#main-menu--app--quit').removeAttribute('aria-hidden');
  }

  // Account label & avatar
  {
    let label = `<strong>${user.name}</strong><br>${user.email}`,
        $menu_label = document.querySelector('#main-menu--app label'),
        $account_label = document.querySelector('#main-menu--app--account label');

    $account_label.innerHTML = label;
    $account_label.style['background-image'] = $menu_label.style['background-image'] = `url(${user.image})`;

    this.on('C:GravatarProfileFound', data => {
      document.querySelector('#sidebar-account').style['background-image'] = data.style['background-image'];
    });
  }

  // App install
  {
    let $menuitem = document.querySelector('#main-menu--app--install');

    this.on('AppInstalled', () => $menuitem.setAttribute('aria-disabled', 'true'), true)
    this.helpers.app.can_install().then(() => $menuitem.removeAttribute('aria-hidden')).catch(error => {});
  }

  this.setup_searchbar();
};

BzDeck.views.Toolbar.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Toolbar.prototype.constructor = BzDeck.views.Toolbar;

BzDeck.views.Toolbar.prototype.setup_searchbar = function () {
  let $root = document.documentElement, // <html>
      $search_box = document.querySelector('#quicksearch [role="searchbox"]'),
      $search_button = document.querySelector('#quicksearch [role="button"]'),
      $search_dropdown = document.querySelector('#quicksearch-dropdown');

  this.$$search_dropdown = new this.widgets.Menu($search_dropdown);

  let cleanup = () => {
    if ($root.hasAttribute('data-quicksearch')) {
      this.$$search_dropdown.close();
      $root.removeAttribute('data-quicksearch');
      $search_box.value = '';
    }
  };

  let exec_quick_search = () => {
    this.trigger(':QuickSearchRequested', { terms: $search_box.value });
  };

  let exec_advanced_search = () => {
    this.trigger(':AdvancedSearchRequested', { terms: $search_box.value });
    cleanup();
  };

  this.helpers.kbd.assign(window, {
    'Accel+K': event => {
      $search_box.focus();
      event.preventDefault();
    },
  });

  window.addEventListener('mousedown', event => cleanup());
  window.addEventListener('popstate', event => cleanup());

  $search_box.addEventListener('input', event => {
    if (event.target.value.trim()) {
      exec_quick_search();
    } else {
      this.$$search_dropdown.close();
    }
  });

  this.helpers.kbd.assign($search_box, {
    'ArrowUp|ArrowDown': event => {
      if (event.target.value.trim() && this.$$search_dropdown.closed) {
        exec_quick_search();
      }
    },
    Enter: event => {
      this.$$search_dropdown.close();
      exec_advanced_search();
    },
  });

  $search_box.addEventListener('mousedown', event => event.stopPropagation());

  this.helpers.kbd.assign($search_button, {
    'Enter|Space': event => exec_advanced_search(),
  });

  $search_button.addEventListener('mousedown', event => {
    event.stopPropagation();

    if (this.helpers.env.device.mobile) {
      if (!$root.hasAttribute('data-quicksearch')) {
        $root.setAttribute('data-quicksearch', 'activated');
        // Somehow moving focus doesn't work, so use the async function here
        this.helpers.event.async(() => $search_box.focus());
      } else if ($search_box.value) {
        exec_advanced_search();
      }
    } else {
      exec_advanced_search();
    }
  });

  $search_dropdown.addEventListener('MenuItemSelected', event => {
    // Show the bug or search results
    let $target = event.detail.target,
        id = $target.dataset.id;

    if (id) {
      BzDeck.router.navigate('/bug/' + id);
      cleanup();
    }

    if ($target.matches('#quicksearch-dropdown-more')) {
      exec_advanced_search();
    }
  });

  // Suppress context menu
  $search_box.addEventListener('contextmenu', event => this.helpers.event.ignore(event), true); // use capture

  this.on('C:QuickSearchResultsAvailable', data => this.show_quick_search_results(data.results));
};

BzDeck.views.Toolbar.prototype.show_quick_search_results = function (results) {
  let $$dropdown = this.$$search_dropdown;

  let data = [{
    id: 'quicksearch-dropdown-header',
    label: results.length ? 'Local Search' : 'Local Search: No Results', // l10n
    disabled: true
  }];

  for (let bug of results.reverse().slice(0, 20)) {
    data.push({
      id: 'quicksearch-dropdown-' + bug.id,
      label: bug.id + ' - ' + (bug.aliases.length ? '(' + bug.aliases.join(', ') + ') ' : '') + bug.summary,
      data: { id: bug.id }
    });
  }

  data.push({ type: 'separator' });
  data.push({ id: 'quicksearch-dropdown-more', label: 'Search All Bugs...' }); // l10n

  $$dropdown.build(data);
  $$dropdown.view.$container.scrollTop = 0;
  $$dropdown.open();
};

BzDeck.views.Toolbar.prototype.open_tab = function (options, controller) {
  let page,
      page_category = options.page_category,
      page_id = options.page_id,
      page_constructor = options.page_constructor,
      page_constructor_args = options.page_constructor_args || [],
      pages = BzDeck.views.pages[`${page_category}_list`],
      $$tablist = BzDeck.views.toolbar.$$tablist,
      tab_id = options.page_category + (page_id ? '-' + page_id : ''),
      tab_label = options.tab_label,
      tab_desc = options.tab_desc || tab_label,
      tab_position = options.tab_position || 'last',
      $tab = document.querySelector(`#tab-${CSS.escape(tab_id)}`),
      $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(tab_id)}`);

  if (!pages) {
    pages = BzDeck.views.pages[`${page_category}_list`] = new Map();
  }

  // Reuse a tabpanel if possible
  if ($tabpanel) {
    page = pages.get(page_id || 'default');
    $tab = $tab || $$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
  } else {
    $tabpanel = this.get_template(`tabpanel-${page_category}-template`, page_id);
    $tab = $$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
    page = controller.view = new page_constructor(...page_constructor_args);
    page.controller = controller;
    pages.set(page_id || 'default', page);

    // Prepare the Back button on the mobile banner
    this.add_back_button($tabpanel);
  }

  $$tablist.view.selected = $$tablist.view.$focused = $tab
  $tabpanel.focus();

  BzDeck.views.global.update_window_title($tab);
  BzDeck.views.pages[page_category] = page;
  this.tab_path_map.set($tab.id, location.pathname + location.search);
};

BzDeck.views.Toolbar.prototype.add_back_button = function ($parent) {
  let $header = $parent.querySelector('header'),
      $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

  if (this.helpers.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
    $button.setAttribute('aria-label', 'Back'); // l10n
    $button.addEventListener('touchstart', event => {
      if (history.state && history.state.previous) {
        history.back();
      } else {
        BzDeck.router.navigate('/home/inbox');
      }

      return this.helpers.event.ignore(event);
    });

    $header.insertBefore($button, $header.firstElementChild);
  }
};
