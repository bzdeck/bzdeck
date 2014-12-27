/**
 * BzDeck Global Toolbar
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.Toolbar = function Toolbar () {
  let FTw = FlareTail.widget,
      FTu = FlareTail.util,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      $$tablist = this.$$tablist = new FTw.TabList(document.querySelector('#main-tablist')),
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  this.tab_path_map = new Map([['tab-home', '/home/inbox']]);

  $$tablist.bind('Selected', event => {
    let path = this.tab_path_map.get(event.detail.items[0].id);

    $root.setAttribute('data-current-tab', path.match(/^\/(\w+)/)[1]);

    if (location.pathname + location.search !== path) {
      BzDeck.router.navigate(path);
    }
  });

  new FTw.MenuBar(document.querySelector('#main-menu'));

  let $app_menu = document.querySelector('#main-menu--app-menu');

  $app_menu.addEventListener('MenuItemSelected', event => {
    switch (event.detail.command) {
      case 'show-profile': {
        BzDeck.router.navigate('/profile/' + BzDeck.model.data.account.name);

        break;
      }

      case 'show-settings': {
        BzDeck.router.navigate('/settings');

        break;
      }

      case 'toggle-fullscreen': {
        // Fullscreen requests from custom events are denied due to Bug 779324. A workaround below
        // FTu.app.toggle_fullscreen();
        break;
      }

      case 'install-app': {
        BzDeck.core.install_app();

        break;
      }

      case 'logout': {
        BzDeck.session.logout();

        break;
      }

      case 'quit': {
        window.close();

        break;
      }
    }
  });

  // Switch to the mobile layout
  if (mobile) {
    document.querySelector('#sidebar-account').appendChild(document.querySelector('#main-menu--app--account'));
    document.querySelector('#sidebar-menu').appendChild($app_menu);
    document.querySelector('#tabpanel-home [role="toolbar"]')
            .appendChild(document.querySelector('#toolbar--search-menu'));

    $app_menu.addEventListener('MenuClosed', event => {
      // Keep the menu open
      $app_menu.removeAttribute('aria-expanded');
      // Hide the sidebar
      $root.setAttribute('data-sidebar-hidden', 'true');
      $sidebar.setAttribute('aria-hidden', 'true');
    });
  }

  $app_menu.setAttribute('aria-expanded', mobile);

  if (FTu.app.fullscreen_enabled) {
    {
      let $menuitem = document.querySelector('#main-menu--app--fullscreen');

      let toggle_fullScreen = () => {
        document.mozFullScreenElement ? document.mozCancelFullScreen() : document.body.mozRequestFullScreen();
      };

      $menuitem.removeAttribute('aria-hidden');

      // A workaround for Bug 779324
      $menuitem.addEventListener('mousedown', event => toggle_fullScreen());
      FlareTail.util.event.assign_key_binding($menuitem, 'RETURN', event => toggle_fullScreen());

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
    let account = BzDeck.model.data.account,
        label = `${account.real_name ? `<strong>${account.real_name}</strong><br>` : ''}${account.name}`,
        $menu_label = document.querySelector('#main-menu--app label'),
        $account_label = document.querySelector('#main-menu--app--account label'),
        gravatar = new BzDeck.services.Gravatar(account.name);

    $account_label.innerHTML = label;
    $account_label.style.backgroundImage = $menu_label.style.backgroundImage = `url(${gravatar.avatar_url})`;

    gravatar.get_profile().then(entry => {
      if (entry.profileBackground && entry.profileBackground.url) {
        document.querySelector('#sidebar-account').style.backgroundImage = `url(${entry.profileBackground.url})`;
      }
    });
  }

  FTu.app.can_install(BzDeck.config.app.manifest).then(() => {
    document.querySelector('#main-menu--app--install').removeAttribute('aria-hidden');
  }).catch(error => {});

  let $search_box = document.querySelector('#quicksearch [role="textbox"]'),
      $search_button = document.querySelector('#quicksearch [role="button"]'),
      $search_dropdown = document.querySelector('#quicksearch-dropdown');

  this.$$search_dropdown = new FlareTail.widget.Menu($search_dropdown);

  let cleanup = () => {
    this.$$search_dropdown.close();
    $root.removeAttribute('data-quicksearch');
    $search_box.value = '';
    $search_button.focus();
  };

  let exec_search = () => {
    let params = new URLSearchParams(),
        terms = $search_box.value;

    if (terms) {
      params.append('short_desc', terms);
      params.append('short_desc_type', 'allwordssubstr');
      params.append('resolution', '---'); // Search only open bugs
    }

    BzDeck.router.navigate('/search/' + Date.now(), { 'params' : params.toString() });

    cleanup();
  };

  FlareTail.util.event.assign_key_bindings(window, {
    'CTRL+K|META+K': event => {
      $search_box.focus();
      event.preventDefault();
    },
  });

  window.addEventListener('mousedown', event => cleanup());
  window.addEventListener('popstate', event => cleanup());

  $search_box.addEventListener('input', event => {
    if (event.target.value.trim()) {
      this.quicksearch(event);
    } else {
      this.$$search_dropdown.close();
    }
  });

  FlareTail.util.event.assign_key_bindings($search_box, {
    'UP|DOWN': event => {
      if (event.target.value.trim() && this.$$search_dropdown.closed) {
        this.quicksearch(event);
      }
    },
    'RETURN': event => {
      this.$$search_dropdown.close();
      exec_search();
    },
  });

  $search_box.addEventListener('mousedown', event => event.stopPropagation());

  FlareTail.util.event.assign_key_bindings($search_button, {
    'RETURN|SPACE': event => exec_search(),
  });

  $search_button.addEventListener('mousedown', event => {
    event.stopPropagation();

    if (mobile) {
      if (!$root.hasAttribute('data-quicksearch')) {
        $root.setAttribute('data-quicksearch', 'activated');
        // Somehow moving focus doesn't work, so use the async function here
        FlareTail.util.event.async(() => $search_box.focus());
      } else if ($search_box.value) {
        exec_search();
      }
    } else {
      exec_search();
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
      exec_search();
    }
  });

  // Suppress context menu
  $search_box.addEventListener('contextmenu', event => FTu.event.ignore(event), true); // use capture
};

BzDeck.Toolbar.prototype.open_tab = function (options) {
  let page,
      page_category = options.page_category,
      page_id = options.page_id,
      page_constructor = options.page_constructor,
      page_constructor_args = options.page_constructor_args || [],
      pages = BzDeck.pages[`${page_category}_list`],
      $$tablist = BzDeck.toolbar.$$tablist,
      tab_id = options.page_category + (page_id ? '-' + page_id : ''),
      tab_label = options.tab_label,
      tab_desc = options.tab_desc || tab_label,
      tab_position = options.tab_position || 'last',
      $tab = document.querySelector(`#tab-${CSS.escape(tab_id)}`),
      $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(tab_id)}`);

  // Do not transition the current tabpanel if the new tab is a profile or settings
  if (['profile', 'settings'].includes(page_category)) {
    document.getElementById($$tablist.view.selected[0].getAttribute('aria-controls')).classList.add('fixed');
  } else {
    for (let $tabpanel of document.querySelectorAll('#main-tabpanels > [role="tabpanel"]')) {
      $tabpanel.classList.remove('fixed');
    }
  }

  if (!pages) {
    pages = BzDeck.pages[`${page_category}_list`] = new Map();
  }

  // Reuse a tabpanel if possible
  if ($tabpanel) {
    page = pages.get(page_id || 'default');
    $tab = $tab || $$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
  } else {
    $tabpanel = FlareTail.util.content.get_fragment(`tabpanel-${page_category}-template`, page_id).firstElementChild;
    $tab = $$tablist.add_tab(tab_id, tab_label, tab_desc, $tabpanel, tab_position);
    page = new page_constructor(...page_constructor_args);
    pages.set(page_id || 'default', page);

    // Prepare the Back button on the mobile banner
    if (FlareTail.util.device.type.startsWith('mobile') && !$tabpanel.querySelector('.banner-nav-button')) {
      let $header = $tabpanel.querySelector('header'),
          $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

      $button.setAttribute('aria-label', 'Back'); // l10n
      $button.addEventListener('touchstart', event => {
        if (history.state && history.state.previous) {
          history.back();
        } else {
          BzDeck.router.navigate('/home/inbox');
        }

        return FlareTail.util.event.ignore(event);
      });
      $header.insertBefore($button, $header.firstElementChild);
    }
  }

  $$tablist.view.selected = $$tablist.view.$focused = $tab
  $tabpanel.focus();

  BzDeck.core.update_window_title($tab);
  BzDeck.pages[page_category] = page;
  this.tab_path_map.set($tab.id, location.pathname + location.search);
};

BzDeck.Toolbar.prototype.quicksearch = function (event) {
  let words = [for (word of event.target.value.trim().split(/\s+/)) word.toLowerCase()],
      // Support for multiple aliases on Bugzilla 5.0+
      get_aliases = bug => bug.alias ? (Array.isArray(bug.alias) ? bug.alias : [bug.alias]) : [];

  BzDeck.model.get_all_bugs().then(bugs => {
    let results = bugs.filter(bug => {
      return words.every(word => bug.summary.toLowerCase().includes(word)) ||
             words.every(word => get_aliases(bug).join().toLowerCase().includes(word)) ||
             words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).includes(words[0]);
    });

    let data = [{
      'id': 'quicksearch-dropdown-header',
      'label': results.length ? 'Local Search' : 'Local Search: No Results', // l10n
      'disabled': true
    }];

    for (let bug of results.reverse().slice(0, 20)) {
      let aliases = get_aliases(bug);

      data.push({
        'id': `quicksearch-dropdown-${bug.id}`,
        'label': bug.id + ' - ' + (aliases.length ? '(' + aliases.join(', ') + ') ' : '') + bug.summary,
        'data': { 'id': bug.id }
      });
    }

    data.push({ 'type': 'separator' });
    data.push({ 'id': 'quicksearch-dropdown-more', 'label': 'Search All Bugs...' }); // l10n

    let $$dropdown = this.$$search_dropdown;

    $$dropdown.build(data);
    $$dropdown.view.$container.scrollTop = 0;
    $$dropdown.open();
  });
};
