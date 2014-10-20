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
      phone = FlareTail.util.device.type === 'mobile-phone',
      $$tablist = this.$$tablist = new FTw.TabList(document.querySelector('#main-tablist')),
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  $$tablist.bind('Selected', event => {
    let $tab = event.detail.items[0],
        sidebar = BzDeck.sidebar.data,
        path = '/' + $tab.id.substr(4).replace(/^details-/, 'bug/').replace(/^(search)-/, '$1/');

    if (path === '/home') {
      sidebar.folder_id = sidebar.folder_id || 'inbox';
      path += '/' + sidebar.folder_id;
    }

    if (location.pathname !== path) {
      BzDeck.core.navigate(path);
    }
  });

  new FTw.MenuBar(document.querySelector('#main-menu'));

  let $app_menu = document.querySelector('#main-menu--app-menu');

  $app_menu.addEventListener('MenuItemSelected', event => {
    switch (event.detail.command) {
      case 'show-settings': {
        BzDeck.SettingsPage.open();

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

  $app_menu.addEventListener('MenuClosed', event => {
    if (mobile) {
      // Keep the menu open
      $app_menu.removeAttribute('aria-expanded');
      // Hide the sidebar
      $root.setAttribute('data-sidebar-hidden', 'true');
      $sidebar.setAttribute('aria-hidden', 'true');
    }
  });

  $app_menu.setAttribute('aria-expanded', mobile);

  if (FTu.app.fullscreen_enabled) {
    {
      let $menuitem = document.querySelector('#main-menu--app--fullscreen');

      $menuitem.removeAttribute('aria-hidden');

      // A workaround for Bug 779324
      $menuitem.addEventListener('mousedown', event => {
        document.mozFullScreenElement ? document.mozCancelFullScreen() : document.body.mozRequestFullScreen();
      });
      $menuitem.addEventListener('keydown', event => {
        if (event.keyCode === event.DOM_VK_RETURN) {
          document.mozFullScreenElement ? document.mozCancelFullScreen() : document.body.mozRequestFullScreen();
        }
      });

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

  let tabs = this.$$tablist.view,
      $tab_home = document.querySelector('#tab-home');

  document.querySelector('[role="banner"] h1').addEventListener('click', event => {
    if (mobile) {
      if (phone && tabs.selected[0] === $tab_home) {
        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

        document.querySelector('#sidebar > div').scrollTop = 0;
        $root.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);
      } else {
        tabs.selected = $tab_home;
      }
    }
  });

  $root.setAttribute('data-current-tab', 'home');

  // Account label & avatar
  {
    let account = BzDeck.model.data.account,
        label = `${account.real_name ? `<strong>${account.real_name}</strong><br>` : ''}${account.name}`,
        $menu_label = document.querySelector('#main-menu--app label'),
        $account_label = document.querySelector('#main-menu--app--account label'),
        $img = new Image();

    $account_label.innerHTML = label;
    $img.addEventListener('load', event =>
        $menu_label.style.backgroundImage = $account_label.style.backgroundImage = `url(${event.target.src})`);
    $img.src = `https://www.gravatar.com/avatar/${md5(account.name)}?d=404`;
  }

  FTu.app.can_install(BzDeck.config.app.manifest).then(() => {
    document.querySelector('#main-menu--app--install').removeAttribute('aria-hidden');
  }).catch(error => {});

  let $banner = document.querySelector('[role="banner"]'),
      $search_box = document.querySelector('[role="banner"] [role="search"] input'),
      $search_button = document.querySelector('[role="banner"] [role="search"] [role="button"]'),
      $search_dropdown = document.querySelector('#quicksearch-dropdown');

  this.$$search_dropdown = new FlareTail.widget.Menu($search_dropdown);

  let cleanup = () => {
    this.$$search_dropdown.close();
    $banner.classList.remove('search');
    $search_box.value = '';
    $search_button.focus();
  };

  let exec_search = () => {
    let page = BzDeck.SearchPage.open(),
        params = new URLSearchParams(),
        terms = $search_box.value;

    if (terms) {
      page.view.panes['basic-search'].querySelector('.text-box [role="textbox"]').value = terms;
      params.append('short_desc', terms);
      params.append('short_desc_type', 'allwordssubstr');
      params.append('resolution', '---'); // Search only open bugs
      page.exec_search(params);
    }

    cleanup();
  };

  window.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_K && (event.metaKey || event.ctrlKey)) {
      $search_box.focus();
      event.preventDefault();
    }
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

  $search_box.addEventListener('keydown', event => {
    if ((event.keyCode === event.DOM_VK_UP || event.keyCode === event.DOM_VK_DOWN) &&
        event.target.value.trim() && this.$$search_dropdown.closed) {
      this.quicksearch(event);
    }

    if (event.keyCode === event.DOM_VK_RETURN) {
      this.$$search_dropdown.close();
      exec_search();
    }
  });

  $search_box.addEventListener('mousedown', event => event.stopPropagation());

  $search_button.addEventListener('keydown', event => {
    if (event.keyCode === event.DOM_VK_RETURN || event.keyCode === event.DOM_VK_SPACE) {
      exec_search();
    }
  });

  $search_button.addEventListener('mousedown', event => {
    event.stopPropagation();

    if (mobile) {
      if (!$banner.matches('.search')) {
        $banner.classList.add('search');
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
      BzDeck.DetailsPage.open(Number.parseInt(id));
      cleanup();
    }

    if ($target.matches('#quicksearch-dropdown-more')) {
      exec_search();
    }
  });

  // Suppress context menu
  $search_box.addEventListener('contextmenu', event => FTu.event.ignore(event), true); // use capture
};

BzDeck.Toolbar.prototype.quicksearch = function (event) {
  let words = [for (word of event.target.value.trim().split(/\s+/)) word.toLowerCase()];

  BzDeck.model.get_all_bugs().then(bugs => {
    let results = bugs.filterPar(bug => {
      return (words.every(word => bug.summary.toLowerCase().contains(word)) ||
              words.length === 1 && !Number.isNaN(words[0]) && String(bug.id).contains(words[0])) &&
              BzDeck.model.data.server.config.field.status.open.contains(bug.status);
    });

    let data = [{
      'id': 'quicksearch-dropdown-header',
      'label': results.length ? 'Local Search' : 'Local Search: No Results', // l10n
      'disabled': true
    }];

    for (let bug of results.reverse().slice(0, 20)) {
      data.push({
        'id': `quicksearch-dropdown-${bug.id}`,
        'label': `${bug.id} - ${bug.summary}`,
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
