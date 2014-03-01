/**
 * BzDeck Details Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.DetailsPage = function (id, bug_list = []) {
  let tablist = BzDeck.toolbar.tablist,
      $existing_tab = document.querySelector('#tab-details-' + id);

  if ($existing_tab) {
    tablist.view.selected = tablist.view.$focused = $existing_tab;

    return;
  }

  this.data = {
    id: id,
    bug_list: bug_list
  };

  this.view = {
    $tab: null,
    $tabpanel: null
  };

  if (bug_list.length) {
    this.open([bug for (bug of bug_list) if (bug.id === id)][0], bug_list);

    return;
  }

  BzDeck.model.get_bug_by_id(id, bug => {
    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      this.fetch_bug(id);
      bug = { id: id };
    }

    this.open(bug);
  });
};

BzDeck.DetailsPage.prototype.open = function (bug, bug_list = []) {
  // If there is an existing tabpanel, reuse it
  let $tabpanel = document.querySelector('#tabpanel-details-' + bug.id);

  // Or prep a new one
  if (!$tabpanel) {
    $tabpanel = this.prep_tabpanel(bug);
    document.querySelector('#main-tabpanels').appendChild($tabpanel);
  }

  let mobile_mql = FlareTail.util.device.mobile.mql,
      $tablist = $tabpanel.querySelector('[role="tablist"]'),
      _tablist = new FlareTail.widget.TabList($tablist),
      $article = $tabpanel.querySelector('article'),
      $header = $tabpanel.querySelector('header'),
      $timeline = $tabpanel.querySelector('.bug-timeline'),
      $info_tab = $tabpanel.querySelector('[id$="-tab-info"]'),
      $timeline_tab = $tabpanel.querySelector('[id$="-tab-timeline"]'),
      $bug_info = $tabpanel.querySelector('.bug-info');

  let mobile_mql_listener = mql => {
    if (mql.matches) { // Mobile
      $timeline.insertBefore($header, $timeline.firstElementChild);
      $info_tab.setAttribute('aria-hidden', 'false');
      $tabpanel.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);

      return;
    }

    if (_tablist.view.selected[0] === $info_tab) {
      _tablist.view.selected = _tablist.view.$focused = $timeline_tab;
    }

    $article.insertBefore($header, $article.firstElementChild);
    $info_tab.setAttribute('aria-hidden', 'true');
    $tabpanel.querySelector('header + div').appendChild($bug_info);
    $tablist.removeAttribute('aria-hidden');
  };

  mobile_mql.addListener(mobile_mql_listener);
  mobile_mql_listener(mobile_mql);

  // Scroll a tabpanel to top when the tab is selected
  _tablist.bind('Selected', event => {
    document.querySelector('#' + event.detail.items[0].getAttribute('aria-controls')
                               + ' > .scrollable').scrollTop = 0;
  });

  // Hide tabs when scrolled down on mobile
  for (let $tabpanel_content of $tabpanel.querySelectorAll('[role="tabpanel"] div')) {
    let scroll_top = $tabpanel_content.scrollTop;

    $tabpanel_content.addEventListener('scroll', event => {
      if (mobile_mql.matches) {
        let value = String(event.target.scrollTop - scroll_top > 0);

        if ($tablist.getAttribute('aria-hidden') !== value) {
          $tablist.setAttribute('aria-hidden', value);
        }

        scroll_top = event.target.scrollTop;
      }
    });
  }

  this.view.$tabpanel = $tabpanel;
  $tabpanel.setAttribute('aria-hidden', 'false');

  // Open a new tab
  let tablist = BzDeck.toolbar.tablist,
      $tab = this.view.$tab = tablist.add_tab(
        'details-' + bug.id,
        bug.id,
        this.get_tab_title(bug),
        $tabpanel,
        'next'
      );

  tablist.view.selected = tablist.view.$focused = $tab;

  // Set Back & Forward navigation
  if (bug_list.length) {
    this.setup_navigation($tabpanel, bug_list);
  }
};

BzDeck.DetailsPage.prototype.prep_tabpanel = function (bug) {
  return BzDeck.global.fill_template(document.querySelector('template#tabpanel-details').content,
                                     bug, true);
};

BzDeck.DetailsPage.prototype.get_tab_title = function (bug) {
  return 'Bug %d\n%s'.replace('%d', bug.id)
                     .replace('%s', bug.summary || 'Loading...'); // l10n
};

BzDeck.DetailsPage.prototype.setup_navigation = function ($tabpanel, bug_list) {
  let tablist = BzDeck.toolbar.tablist,
      $current_tab = this.view.$tab,
      $current_tabpanel = this.view.$tabpanel,
      Button = FlareTail.widget.Button,
      $toolbar = $tabpanel.querySelector('header [role="toolbar"]'),
      btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      bugs = [id for ({ id } of bug_list)],
      index = bugs.indexOf(this.data.id),
      prev = bugs[index - 1],
      next = bugs[index + 1],
      set_keybind = FlareTail.util.event.set_keybind;

  let preload = id => {
    if (document.querySelector('#tabpanel-details-' + id)) {
      return;
    }

    BzDeck.model.get_bug_by_id(id, bug => {
      let $tabpanel = this.prep_tabpanel(bug);

      $tabpanel.setAttribute('aria-hidden', 'true');
      document.querySelector('#main-tabpanels').insertBefore(
        $tabpanel,
        id === prev ? $current_tabpanel : $current_tabpanel.nextElementSibling
      );

      if (!bug.comments) {
        this.prefetch_bug(id);
      }
    });
  };

  let navigate = id => {
    tablist.close_tab($current_tab);
    BzDeck.detailspage = new BzDeck.DetailsPage(id, bug_list);
  };

  if (prev) {
    preload(prev);
    btn_back.data.disabled = false;
    btn_back.bind('Pressed', event => navigate(prev));
    // TODO: Add keyboard shortcut
    // set_keybind($tabpanel, 'B', '', event => navigate(prev));
  } else {
    btn_back.data.disabled = true;
  }

  if (next) {
    preload(next);
    btn_forward.data.disabled = false;
    btn_forward.bind('Pressed', event => navigate(next));
    // TODO: Add keyboard shortcut
    // set_keybind($tabpanel, 'F', '', event => navigate(next));
  } else {
    btn_forward.data.disabled = true;
  }
};

BzDeck.DetailsPage.prototype.fetch_bug = function (id) {
  if (!navigator.onLine) {
    BzDeck.global.show_status('You have to go online to load a bug.'); // l10n

    return;
  }

  BzDeck.global.show_status('Loading...'); // l10n

  let api = BzDeck.options.api,
      query = FlareTail.util.request.build_query({
        include_fields: [...api.default_fields, ...api.extra_fields].join(),
        exclude_fields: 'attachments.data'
      });

  BzDeck.core.request('GET', 'bug/' + id + query, bug => {
    if (!bug || !bug.id) {
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

      return;
    }

    // Save in DB
    BzDeck.model.save_bug(bug);

    let $tab = document.querySelector('#tab-details-' + id),
        $tabpanel = this.view.$tabpanel;

    // Check if the tabpanel still exists
    if ($tabpanel) {
      BzDeck.global.show_status('');
      // Update UI
      BzDeck.global.fill_template($tabpanel, bug);
      $tab.title = this.get_tab_title(bug);
    }
  });
};

BzDeck.DetailsPage.prototype.prefetch_bug = function (id) {
  let api = BzDeck.options.api,
      query = FlareTail.util.request.build_query({
        include_fields: [...api.default_fields, ...api.extra_fields].join(),
        exclude_fields: 'attachments.data'
      });

  BzDeck.core.request('GET', 'bug/' + id + query, bug => {
    if (bug && bug.id) {
      BzDeck.model.save_bug(bug);
    }
  });
};
