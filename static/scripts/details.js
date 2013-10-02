/**
 * BzDeck Details Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.DetailsPage = function (id, bug_list = []) {
  let tablist = BzDeck.toolbar.tablist,
      existing_tab = tablist.view.members.filter(tab => tab.id === 'tab-details-' + id)[0];

  if (existing_tab) {
    tablist.view.selected = tablist.view.focused = existing_tab;
    return;
  }

  this.data = {
    id: id,
    bug_list: bug_list
  };

  this.view = {
    tab: null,
    tabpanel: null
  };

  if (bug_list.length) {
    this.open(bug_list.filter(bug => bug.id === id)[0], bug_list);
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
  let $tabpanel = document.getElementById('tabpanel-details-' + bug.id);

  // Or prep a new one
  if (!$tabpanel) {
    $tabpanel = this.prep_tabpanel(bug);
    document.getElementById('main-tabpanels').appendChild($tabpanel);
  }

  // Desktop Layout
  if (window.matchMedia("(min-width: 980px)").matches) {
    $tabpanel.querySelector('[id$="-tab-info"]').setAttribute('aria-hidden', 'true');
    let $info_tp = $tabpanel.querySelector('[id$="-tabpanel-info"]');
    $info_tp.removeAttribute('aria-hidden');
    $tabpanel.querySelector('div').appendChild($info_tp);
  }

  this.view.tabpanel = $tabpanel;
  $tabpanel.setAttribute('aria-hidden', 'false');

  // Open a new tab
  let tablist = BzDeck.toolbar.tablist;
  let $tab = this.view.tab = tablist.add_tab(
    'details-' + bug.id,
    'Bug %d'.replace('%d', bug.id), // l10n
    this.get_tab_title(bug),
    $tabpanel,
    'next'
  );
  tablist.view.selected = tablist.view.focused = $tab;

  // Set Back & Forward navigation
  if (bug_list.length) {
    this.setup_navigation($tabpanel, bug_list);
  }
};

BzDeck.DetailsPage.prototype.prep_tabpanel = function (bug) {
  return BzDeck.global.fill_template(
    document.querySelector('template#tabpanel-details').content,
    bug, true
  );
};

BzDeck.DetailsPage.prototype.get_tab_title = function (bug) {
  return 'Bug %d\n%s'.replace('%d', bug.id)
                     .replace('%s', bug.summary || 'Loading...'); // l10n
};

BzDeck.DetailsPage.prototype.setup_navigation = function ($tabpanel, bug_list) {
  let tablist = BzDeck.toolbar.tablist,
      $current_tab = this.view.tab,
      $current_tabpanel = this.view.tabpanel,
      Button = BriteGrid.widget.Button,
      $toolbar = $tabpanel.querySelector('header [role="toolbar"]'),
      btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      bugs = bug_list.map(bug => bug.id),
      index = bugs.indexOf(this.data.id),
      prev = bugs[index - 1],
      next = bugs[index + 1],
      set_keybind = BriteGrid.util.event.set_keybind;

  let preload = function (id) {
    if (document.getElementById('tabpanel-details-' + id)) {
      return;
    }

    BzDeck.model.get_bug_by_id(id, bug => {
      let $tabpanel = this.prep_tabpanel(bug);

      $tabpanel.setAttribute('aria-hidden', 'true');
      document.getElementById('main-tabpanels').insertBefore(
        $tabpanel,
        (id === prev) ? $current_tabpanel : $current_tabpanel.nextElementSibling
      );

      if (!bug.comments) {
        this.prefetch_bug(id);
      }
    });
  }.bind(this); // Why this is needed?

  let navigate = function (id) {
    tablist.close_tab($current_tab);
    BzDeck.detailspage = new BzDeck.DetailsPage(id, bug_list);
  };

  if (prev) {
    preload(prev);
    btn_back.data.disabled = false;
    btn_back.view.button.addEventListener('Pressed', event => navigate(prev));
    // TODO: Add keyboard shortcut
    // set_keybind($tabpanel, 'B', '', event => navigate(prev));
  } else {
    btn_back.data.disabled = true;
  }

  if (next) {
    preload(next);
    btn_forward.data.disabled = false;
    btn_forward.view.button.addEventListener('Pressed', event => navigate(next));
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

  let query = BriteGrid.util.request.build_query({
    include_fields: '_default,' + BzDeck.options.api.extra_fields.join(','),
    exclude_fields: 'attachments.data'
  });

  BzDeck.core.request('GET', 'bug/' + id + query, event => {
    let response = event.target.responseText,
        bug = response ? JSON.parse(response) : null;

    if (!bug || !bug.id) {
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n
      return;
    }

    // Save in DB
    BzDeck.model.save_bug(bug);

    let $tab = document.getElementById('tab-details-' + id),
        $tabpanel = this.view.tabpanel;

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
  let query = BriteGrid.util.request.build_query({
    include_fields: '_default,' + BzDeck.options.api.extra_fields.join(','),
    exclude_fields: 'attachments.data'
  });

  BzDeck.core.request('GET', 'bug/' + id + query, event => {
    let response = event.target.responseText,
        bug = response ? JSON.parse(response) : null;

    if (bug && bug.id) {
      BzDeck.model.save_bug(bug);
    }
  });
};
