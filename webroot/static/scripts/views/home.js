/**
 * BzDeck Home Page
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.views = BzDeck.views || {};

BzDeck.views.HomePage = function HomePage () {
  let FTw = FlareTail.widget,
      mobile = FlareTail.util.ua.device.mobile,
      prefs = BzDeck.model.data.prefs,
      $preview_pane = document.querySelector('#home-preview-pane'),
      $sidebar = document.querySelector('#sidebar');

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
  {
    let $$splitter = this.$$preview_splitter = new FTw.Splitter(document.querySelector('#home-preview-splitter')),
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
  }

  let $bug = document.querySelector('#home-preview-pane article'),
      $info = FlareTail.util.content.get_fragment('preview-bug-info').firstElementChild;

  $bug.appendChild($info).id = 'home-preview-bug-info';

  this.view = {};

  let layout_pref = prefs['ui.home.layout'],
      vertical = mobile || !layout_pref || layout_pref === 'vertical';

  this.change_layout(layout_pref);

  // Show Details button
  let $button = document.querySelector('#home-preview-bug [data-command="show-details"]'),
      $$button = this.view.$$details_button = new FlareTail.widget.Button($button),
      open_tab = () => BzDeck.router.navigate('/bug/' + this.data.preview_id,
                                              { 'ids': [for (bug of this.data.bugs) bug.id] });

  $$button.bind('Pressed', event => open_tab());

  // Assign keyboard shortcuts
  FlareTail.util.kbd.assign($bug.querySelector('.bug-timeline'), {
    // [B] previous bug or [F] next bug: handle on the home thread
    'B|F': event => {
      let vertical = mobile || !prefs['ui.home.layout'] || prefs['ui.home.layout'] === 'vertical',
          $target = document.querySelector(vertical ? '#home-vertical-thread [role="listbox"]' : '#home-list');

      FlareTail.util.kbd.dispatch($target, event.keyCode);
    },
    // Open the bug in a new tab
    'O': event => open_tab(),
  });

  this.data = new Proxy({
    'bugs': [],
    'preview_id': null
  },
  {
    'get': (obj, prop) => {
      if (prop === 'bugs') {
        // Return a sorted bug list
        let bugs = new Map([for (bug of obj.bugs) [bug.id, bug]]),
            items = vertical ? document.querySelectorAll('#home-vertical-thread [role="option"]')
                             : this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

        return [for ($item of items) bugs.get(Number($item.dataset.id))];
      }

      return obj[prop];
    },
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        // Show the bug preview only when the preview pane is visible (on desktop and tablet)
        if (!$preview_pane.clientHeight) {
          BzDeck.router.navigate('/bug/' + newval, { 'ids': [for (bug of this.data.bugs) bug.id] });

          return; // Do not save the value
        }

        if (oldval !== newval) {
          FlareTail.util.event.async(() => this.show_preview(oldval, newval));
          BzDeck.bugzfeed.subscribe([newval]);
        }
      }

      obj[prop] = newval;
    }
  });
};

BzDeck.views.HomePage.route = '/home/(\\w+)';

BzDeck.views.HomePage.connect = function (folder_id) {
  let $folder = document.querySelector(`#sidebar-folders--${folder_id}`),
      $tab = document.querySelector('#tab-home'),
      $$tablist = BzDeck.toolbar.$$tablist;

  if (!$folder) {
    // Unknown folder; ignore
    BzDeck.router.navigate('/home/inbox');

    return;
  }

  if (document.documentElement.getAttribute('data-current-tab') !== 'home') {
    $$tablist.view.selected = $$tablist.view.$focused = $tab;
  }

  if (BzDeck.sidebar.data.folder_id !== folder_id) {
    BzDeck.sidebar.$$folders.view.selected = $folder;
    BzDeck.sidebar.open_folder(folder_id);
  }

  BzDeck.toolbar.tab_path_map.set('tab-home', location.pathname);
  BzDeck.core.update_window_title($tab);
};

BzDeck.views.HomePage.prototype.show_preview = function (oldval, newval) {
  let $pane = document.querySelector('#home-preview-pane'),
      $bug = document.querySelector('#home-preview-bug'),
      $$button = this.view.$$details_button;

  // Remove the current preview if exists

  if (!newval) {
    $bug.setAttribute('aria-hidden', 'true');
    $$button.data.disabled = true;

    return;
  }

  BzDeck.model.get_bug_by_id(newval).then(bug => {
    if (!bug) {
      $bug.setAttribute('aria-hidden', 'true');
      $$button.data.disabled = true;

      return;
    }

    if (!this.$$bug) {
      this.$$bug = new BzDeck.views.Bug($bug);
    }

    // Fill the content
    this.$$bug.fill(bug);
    BzDeck.core.toggle_unread(bug.id, false);
    $bug.setAttribute('aria-hidden', 'false');
    $$button.data.disabled = false;

    if (FlareTail.util.ua.device.mobile) {
      let $timeline_content = $bug.querySelector('.bug-timeline .scrollable-area-content'),
          $_title = $timeline_content.querySelector('h3'),
          $title = $bug.querySelector('h3');

      if ($_title) {
        $timeline_content.replaceChild($title.cloneNode(true), $_title);
      } else {
        $timeline_content.insertBefore($title.cloneNode(true), $timeline_content.firstElementChild);
      }
    }
  });
};

BzDeck.views.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = FlareTail.util.ua.device.mobile || !pref || pref === 'vertical',
      prefs = BzDeck.model.data.prefs,
      mql = window.matchMedia('(max-width: 1023px)'),
      $$splitter = this.$$preview_splitter;

  document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');

  if (vertical) {
    let $listbox = document.querySelector('#home-vertical-thread [role="listbox"]');

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
          BzDeck.core.toggle_star(Number(event.target.parentElement.dataset.id),
                                  event.target.getAttribute('aria-checked') === 'false');
          event.stopPropagation();
        }
      });

      this.vertical_thread_initialized = true;
    }

    this.thread = new BzDeck.views.VerticalThread(this, 'home', document.querySelector('#home-vertical-thread'), {
      'sort_conditions': { 'key': 'last_change_time', 'type': 'time', 'order': 'descending' }
    });
  } else {
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
      BzDeck.model.get_all_bugs().then(bugs => this.thread.update(bugs));

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
  }

  // Render the thread
  if (BzDeck.sidebar) {
    BzDeck.sidebar.open_folder(BzDeck.sidebar.data.folder_id);
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

BzDeck.views.HomePage.prototype.update_window_title = function (title) {
  if (!location.pathname.startsWith('/home/')) {
    return;
  }

  document.title = document.querySelector('#tab-home').title = title;
  document.querySelector('#tab-home label').textContent =
      document.querySelector('#tabpanel-home h2').textContent = title.replace(/\s\(\d+\)$/, '');
};
