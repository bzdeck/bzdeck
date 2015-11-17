/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Home Page View that represents the Home Page tabpanel content.
 *
 * @constructor
 * @extends BaseView
 * @argument {Object} controller - HomePageController instance.
 * @return {Object} view - New HomePageView instance.
 */
BzDeck.views.HomePage = function HomePageView (controller) {
  let mobile = this.helpers.env.device.mobile,
      $preview_pane = document.querySelector('#home-preview-pane'),
      $sidebar = document.querySelector('#sidebar');

  this.controller = controller;

  Object.defineProperties(this, {
    preview_is_hidden: {
      enumerable: true,
      get: () => !$preview_pane.clientHeight
    },
  });

  // Prepare the Menu button on the mobile banner
  if (mobile) {
    document.querySelector('#tabpanel-home .banner-nav-button').addEventListener('touchstart', event => {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

      document.querySelector('#sidebar .scrollable-area-content').scrollTop = 0;
      document.documentElement.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);

      return this.helpers.event.ignore(event);
    });
  }

  this.setup_splitter();

  let layout_pref = BzDeck.prefs.get('ui.home.layout'),
      vertical = mobile || !layout_pref || layout_pref === 'vertical';

  this.change_layout(layout_pref);

  this.on('SettingsPageView:PrefValueChanged', data => {
    if (data.name === 'ui.home.layout') {
      this.change_layout(data.value, true);
    }
  }, true);

  this.on('C:BugDataUnavailable', data => this.show_preview(undefined));
  this.on('C:BugDataAvailable', data => this.show_preview(data));

  // Refresh the thread when bugs are updated
  // TODO: add/remove/update each bug when required, instead of refreshing the entire thread unconditionally
  this.on('SubscriptionCollection:Updated', data => {
    if (BzDeck.controllers.sidebar) {
      BzDeck.controllers.sidebar.open_folder(BzDeck.controllers.sidebar.data.folder_id);
    }
  }, true);
};

BzDeck.views.HomePage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.HomePage.prototype.constructor = BzDeck.views.HomePage;

/**
 * Select the Home tab and open the specified Sidebar folder.
 *
 * @argument {String} folder_id - One of the folder identifiers defined in the app config.
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.connect = function (folder_id) {
  let $folder = document.querySelector(`#sidebar-folders--${folder_id}`),
      $tab = document.querySelector('#tab-home'),
      $$tablist = BzDeck.views.banner.$$tablist;

  if (!$folder) {
    // Unknown folder; ignore
    this.trigger(':UnknownFolderSelected');

    return;
  }

  if (document.documentElement.getAttribute('data-current-tab') !== 'home') {
    $$tablist.view.selected = $$tablist.view.$focused = $tab;
  }

  if (BzDeck.controllers.sidebar.data.folder_id !== folder_id) {
    BzDeck.views.sidebar.$$folders.view.selected = $folder;
    BzDeck.controllers.sidebar.open_folder(folder_id);
  }

  BzDeck.views.banner.tab_path_map.set('tab-home', location.pathname);
  BzDeck.views.global.update_window_title($tab);
};

/**
 * Set up the movable splitter widget between the Thread Pane and Preview Pane.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.setup_splitter = function () {
  let $$splitter = this.$$preview_splitter = new this.widgets.Splitter(document.querySelector('#home-preview-splitter')),
      prefix = 'ui.home.preview.splitter.position.',
      pref = BzDeck.prefs.get(prefix + $$splitter.data.orientation);

  if (pref) {
    $$splitter.data.position = pref;
  }

  $$splitter.bind('Resized', event => {
    let position = event.detail.position;

    if (position) {
      BzDeck.prefs.set(prefix + $$splitter.data.orientation, position);
    }
  });
};

/**
 * Get a list of bugs currently showing on the thread. FIXME: This should be smartly done in the controller.
 *
 * @argument {Map.<Number, Proxy>} bugs - All bugs prepared for the thread.
 * @return {Map.<Number, Proxy>} bugs - Bugs currently showing.
 */
BzDeck.views.HomePage.prototype.get_shown_bugs = function (bugs) {
  let mobile = this.helpers.env.device.mobile,
      layout_pref = BzDeck.prefs.get('ui.home.layout'),
      vertical = mobile || !layout_pref || layout_pref === 'vertical',
      items = vertical ? document.querySelectorAll('#home-vertical-thread [role="option"]')
                       : this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

  return new Map([...items].map($item => [Number($item.dataset.id), bugs.get(Number($item.dataset.id))]));
};

/**
 * Show the preview of a selected bug on the Preview Pane.
 *
 * @argument {Object} data - Preview data.
 * @argument {Proxy}  data.bug - Bug to show.
 * @argument {Object} data.controller - New BugController instance for that bug.
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.show_preview = function (data) {
  let mobile = this.helpers.env.device.mobile,
      $pane = document.querySelector('#home-preview-pane');

  $pane.innerHTML = '';

  let $bug = $pane.appendChild(this.get_template('home-preview-bug-template')),
      $info = $bug.appendChild(this.get_template('preview-bug-info'));

  // Activate the toolbar buttons
  new this.widgets.Button($bug.querySelector('[data-command="show-details"]'))
      .bind('Pressed', event => this.trigger(':OpeningTabRequested'));

  // Assign keyboard shortcuts
  this.helpers.kbd.assign($bug, {
    // [B] previous bug or [F] next bug: handle on the home thread
    'B|F': event => {
      let pref = BzDeck.prefs.get('ui.home.layout'),
          vertical = mobile || !pref || pref === 'vertical',
          $target = document.querySelector(vertical ? '#home-vertical-thread [role="listbox"]' : '#home-list');

      this.helpers.kbd.dispatch($target, event.key);
    },
    // Open the bug in a new tab
    O: event => this.trigger(':OpeningTabRequested'),
  });

  // Fill the content
  this.$$bug = new BzDeck.views.Bug(data.controller.id, data.bug, $bug);
  $info.id = 'home-preview-bug-info';
  $bug.removeAttribute('aria-hidden');
};

/**
 * Switch between the Vertical layout and Classic layout.
 *
 * @argument {String} pref - User preference for the home page layout.
 * @argument {Boolean} [sort_grid=false] - Whether the thread should be sorted after switching the layout. Currently,
 *  the Vertical Thread always sorts bugs by date.
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = this.helpers.env.device.mobile || !pref || pref === 'vertical',
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
        pref = BzDeck.prefs.get(`ui.home.preview.splitter.position.${orientation}`);

    $$splitter.data.orientation = orientation;

    if (pref) {
      $$splitter.data.position = pref;
    }
  }
};

/**
 * Apply the Vertical layout to the home page.
 *
 * @argument {undefined}
 * @return {undefined}
 */
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
      if (event.target.matches('[itemprop="starred"]')) {
        BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id))
                          .starred = event.target.matches('[aria-checked="false"]');
        event.stopPropagation();
      }
    });

    this.vertical_thread_initialized = true;
  }

  this.thread = new BzDeck.views.VerticalThread(this, 'home', document.querySelector('#home-vertical-thread'), {
    sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
  });
};

/**
 * Apply the Classic layout to the home page.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.apply_classic_layout = function () {
  let layout_pref = BzDeck.prefs.get('ui.home.layout'),
      vertical = this.helpers.env.device.mobile || !layout_pref || layout_pref === 'vertical';
  this.thread = new BzDeck.views.ClassicThread(this, 'home', document.querySelector('#home-list'), {
    date: { simple: false },
    sortable: true,
    reorderable: true,
    sort_conditions: BzDeck.prefs.get('home.list.sort_conditions') ||
                       { key: 'id', order: 'ascending' }
  });

  let $$grid = this.thread.$$grid;

  $$grid.options.adjust_scrollbar = !vertical;
  $$grid.options.date.simple = vertical;

  if (!this.classic_thread_initialized) {
    // Fill the thread with all saved bugs, and filter the rows later
    this.thread.update(BzDeck.collections.bugs.get_all());

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
    $time.textContent = this.helpers.datetime.format($time.dateTime, { simple: vertical });
    $time.dataset.simple = vertical;
  }
};

/**
 * Update the document title and tab label.
 *
 * @argument {String} title - Title to display.
 * @return {undefined}
 */
BzDeck.views.HomePage.prototype.update_title = function (title) {
  if (!location.pathname.startsWith('/home/')) {
    return;
  }

  document.title = document.querySelector('#tab-home').title = title;
  document.querySelector('#tab-home label').textContent =
      document.querySelector('#tabpanel-home h2').textContent = title.replace(/\s\(\d+\)$/, '');
};
