/**
 * BzDeck Home Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.HomePage = function HomePageView (prefs, controller) {
  let mobile = FlareTail.util.ua.device.mobile,
      $preview_pane = document.querySelector('#home-preview-pane'),
      $sidebar = document.querySelector('#sidebar');

  this.controller = controller;

  Object.defineProperties(this, {
    'preview_is_hidden': {
      'enumerable': true,
      'get': () => !$preview_pane.clientHeight
    },
  });

  // Prepare the Menu button on the mobile banner
  if (mobile) {
    document.querySelector('#tabpanel-home .banner-nav-button').addEventListener('touchstart', event => {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

      document.querySelector('#sidebar .scrollable-area-content').scrollTop = 0;
      document.documentElement.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);

      return FlareTail.util.event.ignore(event);
    });
  }

  // A movable splitter between the thread pane and preview pane
  this.setup_splitter(prefs);

  let layout_pref = prefs['ui.home.layout'],
      vertical = mobile || !layout_pref || layout_pref === 'vertical';

  this.change_layout(layout_pref);

  this.on('SettingsPageView:PrefValueChanged', data => {
    if (data.name === 'ui.home.layout') {
      this.change_layout(data.value, true);
    }
  });

  this.on('C:BugDataUnavailable', data => this.show_preview(undefined, prefs));
  this.on('C:BugDataAvailable', data => this.show_preview(data.bug, prefs));

  // Refresh the thread when bugs are updated
  // TODO: add/remove/update each bug when required, instead of refreshing the entire thread unconditionally
  this.on('Bugs:Updated', data => {
    if (BzDeck.controllers.sidebar) {
      BzDeck.controllers.sidebar.open_folder(BzDeck.controllers.sidebar.data.folder_id);
    }
  });
};

BzDeck.views.HomePage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.HomePage.prototype.constructor = BzDeck.views.HomePage;

BzDeck.views.HomePage.prototype.connect = function (folder_id) {
  let $folder = document.querySelector(`#sidebar-folders--${folder_id}`),
      $tab = document.querySelector('#tab-home'),
      $$tablist = BzDeck.views.toolbar.$$tablist;

  if (!$folder) {
    // Unknown folder; ignore
    BzDeck.router.navigate('/home/inbox');

    return;
  }

  if (document.documentElement.getAttribute('data-current-tab') !== 'home') {
    $$tablist.view.selected = $$tablist.view.$focused = $tab;
  }

  if (BzDeck.controllers.sidebar.data.folder_id !== folder_id) {
    BzDeck.views.sidebar.$$folders.view.selected = $folder;
    BzDeck.controllers.sidebar.open_folder(folder_id);
  }

  BzDeck.views.toolbar.tab_path_map.set('tab-home', location.pathname);
  this.update_window_title($tab);
};

BzDeck.views.HomePage.prototype.setup_splitter = function (prefs) {
  let $$splitter = this.$$preview_splitter = new this.widget.Splitter(document.querySelector('#home-preview-splitter')),
      prefix = 'ui.home.preview.splitter.position.',
      pref = prefs[prefix + $$splitter.data.orientation];

  if (pref) {
    $$splitter.data.position = pref;
  }

  $$splitter.bind('Resized', event => {
    let position = event.detail.position;

    if (position) {
      prefs[prefix + $$splitter.data.orientation] = position;
    }
  });
};

BzDeck.views.HomePage.prototype.get_shown_bugs = function (bugs, prefs) {
  let mobile = FlareTail.util.ua.device.mobile,
      layout_pref = prefs['ui.home.layout'],
      vertical = mobile || !layout_pref || layout_pref === 'vertical',
      items = vertical ? document.querySelectorAll('#home-vertical-thread [role="option"]')
                       : this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

  return new Map([for ($item of items) [Number($item.dataset.id), bugs.get(Number($item.dataset.id))]]);
};

BzDeck.views.HomePage.prototype.show_preview = function (bug, prefs) {
  let mobile = FlareTail.util.ua.device.mobile,
      $pane = document.querySelector('#home-preview-pane');

  $pane.innerHTML = '';

  if (!bug) {
    return;
  }

  let $bug = $pane.appendChild(this.get_fragment('home-preview-bug-template').firstElementChild),
      $info = $bug.appendChild(this.get_fragment('preview-bug-info').firstElementChild);

  // Activate the toolbar buttons
  new this.widget.Button($bug.querySelector('[data-command="show-details"]'))
      .bind('Pressed', event => this.trigger(':OpeningTabRequested'));

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign($bug, {
    // [B] previous bug or [F] next bug: handle on the home thread
    'B|F': event => {
      let vertical = mobile || !prefs['ui.home.layout'] || prefs['ui.home.layout'] === 'vertical',
          $target = document.querySelector(vertical ? '#home-vertical-thread [role="listbox"]' : '#home-list');

      FlareTail.util.kbd.dispatch($target, event.key);
    },
    // Open the bug in a new tab
    'O': event => this.trigger(':OpeningTabRequested'),
  });

  // Fill the content
  this.$$bug = new BzDeck.views.Bug($bug, bug);
  $info.id = 'home-preview-bug-info';
  $bug.removeAttribute('aria-hidden');
};

BzDeck.views.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = FlareTail.util.ua.device.mobile || !pref || pref === 'vertical',
      prefs = BzDeck.models.prefs.data,
      $$splitter = this.$$preview_splitter;

  document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');

  if (vertical) {
    this.apply_vertical_layout();
  } else {
    this.apply_classic_layout();
  }

  // Render the thread
  if (BzDeck.controllers.sidebar && BzDeck.controllers.sidebar.data.folder_id) {
    BzDeck.controllers.sidebar.open_folder(BzDeck.controllers.sidebar.data.folder_id);
  }

  if ($$splitter) {
    let orientation = vertical ? 'vertical' : 'horizontal',
        pref = prefs[`ui.home.preview.splitter.position.${orientation}`];

    $$splitter.data.orientation = orientation;

    if (pref) {
      $$splitter.data.position = pref;
    }
  }
};

BzDeck.views.HomePage.prototype.apply_vertical_layout = function () {
  let mql = window.matchMedia('(max-width: 1023px)'),
      $listbox = document.querySelector('#home-vertical-thread [role="listbox"]');

  let show_preview = mql => {
    let $$listbox = this.thread.$$listbox;

    if ($$listbox.view.members.length && document.querySelector('#home-preview-pane').clientHeight) {
      $$listbox.view.selected = $$listbox.view.focused = $$listbox.view.selected[0] || $$listbox.view.members[0];
    }
  };

  if (!this.vertical_thread_initialized) {
    // Select the first bug on the list automatically when a folder is opened
    // TODO: Remember the last selected bug for each folder
    $listbox.addEventListener('Updated', event => show_preview(mql));
    mql.addListener(show_preview);

    // Star button
    $listbox.addEventListener('mousedown', event => {
      if (event.target.matches('[data-field="_starred"]')) {
        BzDeck.models.bugs.get(event.target.parentElement.dataset.id)
                          .starred = event.target.matches('[aria-checked="false"]');
        event.stopPropagation();
      }
    });

    this.vertical_thread_initialized = true;
  }

  this.thread = new BzDeck.views.VerticalThread(this, 'home', document.querySelector('#home-vertical-thread'), {
    'sort_conditions': { 'key': 'last_change_time', 'type': 'time', 'order': 'descending' }
  });
};

BzDeck.views.HomePage.prototype.apply_classic_layout = function () {
  let prefs = BzDeck.models.prefs.data;

  this.thread = new BzDeck.views.ClassicThread(this, 'home', document.querySelector('#home-list'), {
    'date': { 'simple': false },
    'sortable': true,
    'reorderable': true,
    'sort_conditions': prefs['home.list.sort_conditions'] || { 'key': 'id', 'order': 'ascending' }
  });

  let $$grid = this.thread.$$grid;

  $$grid.options.adjust_scrollbar = !vertical;
  $$grid.options.date.simple = vertical;

  if (!this.classic_thread_initialized) {
    // Fill the thread with all saved bugs, and filter the rows later
    this.thread.update(BzDeck.models.bugs.get_all());

    // Select the first bug on the list automatically when a folder is opened
    // TODO: Remember the last selected bug for each folder
    $$grid.bind('Filtered', event => {
      if ($$grid.view.members.length) {
        $$grid.view.selected = $$grid.view.focused = $$grid.view.members[0];
      }
    });

    this.classic_thread_initialized = true;
  }

  // Change the date format on the thread pane
  for (let $time of $$grid.view.$container.querySelectorAll('time')) {
    $time.textContent = FlareTail.util.datetime.format($time.dateTime, { 'simple': vertical });
    $time.dataset.simple = vertical;
  }
};

BzDeck.views.HomePage.prototype.update_title = function (title) {
  if (!location.pathname.startsWith('/home/')) {
    return;
  }

  document.title = document.querySelector('#tab-home').title = title;
  document.querySelector('#tab-home label').textContent =
      document.querySelector('#tabpanel-home h2').textContent = title.replace(/\s\(\d+\)$/, '');
};
