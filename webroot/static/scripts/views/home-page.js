/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Home Page View that represents the Home Page tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.HomePageView = class HomePageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Home Page View. Select the specified Sidebar folder.
   * @constructor
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {Object} view - New HomePageView instance.
   */
  constructor (folder_id) {
    super(); // Assign this.id

    let mobile = FlareTail.helpers.env.device.mobile;
    let $sidebar = document.querySelector('#sidebar');

    this.$preview_pane = document.querySelector('#home-preview-pane');

    Object.defineProperties(this, {
      preview_is_hidden: {
        enumerable: true,
        get: () => !this.$preview_pane.clientHeight
      },
    });

    // Prepare the Menu button on the mobile banner
    if (mobile) {
      document.querySelector('#tabpanel-home .banner-nav-button').addEventListener('touchstart', event => {
        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

        document.querySelector('#sidebar').scrollTop = 0;
        document.documentElement.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);

        return FlareTail.helpers.event.ignore(event);
      });
    }

    BzDeck.prefs.get('ui.home.layout').then(pref => this.change_layout(pref));

    // Subscribe to events
    this.subscribe('PrefCollection#PrefChanged', true);
    this.on_safe('SubscriptionCollection#Updated', data => this.on_subscriptions_updated(), true);
    this.on('BugContainerPresenter#navigated', data => this.on_container_navigated(data));
    this.on('ThreadView#OpeningBugRequested', () => this.request_expanding_bug_container(true), true);
    this.on('SidebarView#FolderSelected', () => this.request_expanding_bug_container(false), true);
    window.addEventListener('popstate', event => this.onpopstate());

    // Initiate the corresponding presenter and sub-view
    this.presenter =  new BzDeck.HomePagePresenter(this.id);
    this.container_view = new BzDeck.BugContainerView(this.id, this.$preview_pane);

    BzDeck.views.pages.home = this;
    this.connect(folder_id);
  }

  /**
   * Called by the app router to reuse the view.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @returns {undefined}
   */
  reactivate (folder_id) {
    this.connect(folder_id);
  }

  /**
   * Select the Home tab and open the specified Sidebar folder.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @fires HomePageView#UnknownFolderSelected
   * @returns {undefined}
   */
  connect (folder_id) {
    let $folder = document.querySelector(`#sidebar-folders--${folder_id}`);
    let $tab = document.querySelector('#tab-home');
    let $$tablist = BzDeck.views.banner.$$tablist;

    if (!$folder) {
      // Unknown folder; ignore
      this.trigger('#UnknownFolderSelected');

      return;
    }

    if (document.documentElement.getAttribute('data-current-tab') !== 'home') {
      $$tablist.view.selected = $$tablist.view.$focused = $tab;
    }

    if (BzDeck.presenters.sidebar.data.folder_id !== folder_id) {
      BzDeck.views.sidebar.$$folders.view.selected = $folder;
      BzDeck.presenters.sidebar.open_folder(folder_id);
    }

    BzDeck.views.banner.tab_path_map.set('tab-home', location.pathname);
    BzDeck.views.global.update_window_title($tab);
  }

  /**
   * Get a list of bugs currently showing on the thread.
   * @param {undefined}
   * @returns {Array.<Number>} ids - Bug IDs currently showing.
   * @todo FIXME: This should be smartly done in the presenter.
   */
  get_shown_bugs () {
    let mobile = FlareTail.helpers.env.device.mobile;
    let vertical = mobile || document.documentElement.getAttribute('data-home-layout') === 'vertical';
    let items = vertical ? document.querySelectorAll('#home-vertical-thread [role="option"]')
                         : this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

    return [...items].map($item => Number($item.dataset.id));
  }

  /**
   * Switch between the Vertical layout and Classic layout.
   * @param {String} pref - User preference for the home page layout.
   * @param {Boolean} [sort_grid=false] - Whether the thread should be sorted after switching the layout. Currently, the
   *  Vertical Thread always sorts bugs by date.
   * @returns {undefined}
   */
  change_layout (pref, sort_grid = false) {
    let vertical = FlareTail.helpers.env.device.mobile || !pref || pref === 'vertical';

    document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');

    if (vertical) {
      this.apply_vertical_layout();
    } else {
      this.apply_classic_layout();
    }

    // Render the thread
    if (BzDeck.presenters.sidebar && BzDeck.presenters.sidebar.data.folder_id) {
      BzDeck.presenters.sidebar.open_folder(BzDeck.presenters.sidebar.data.folder_id);
    }
  }

  /**
   * Apply the Vertical layout to the home page.
   * @param {undefined}
   * @returns {undefined}
   */
  apply_vertical_layout () {
    let mql = window.matchMedia('(max-width: 1023px)');
    let $listbox = document.querySelector('#home-vertical-thread [role="listbox"]');

    let show_preview = () => {
      let $$listbox = this.thread.$$listbox;

      if ($$listbox.view.members.length && !this.preview_is_hidden && !this.presenter.data.preview_id) {
        $$listbox.view.selected = $$listbox.view.focused = $$listbox.view.selected[0] || $$listbox.view.members[0];
      }
    };

    if (!this.vertical_thread_initialized) {
      // Select the first bug on the list automatically when a folder is opened and no bug is previewed yet. Wait a sec
      // until the listbox is ready. TODO: Remember the last selected bug for each folder
      $listbox.addEventListener('Updated', event => window.setTimeout(() => show_preview(), 500));
      mql.addListener(show_preview);

      // Star button
      $listbox.addEventListener('mousedown', event => {
        if (event.target.matches('[itemprop="starred"]')) {
          BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id)).then(bug => {
            bug.starred = event.target.matches('[aria-checked="false"]');
          });

          event.stopPropagation();
        }
      });

      this.init_searchbar();
      this.vertical_thread_initialized = true;
    }

    this.thread = new BzDeck.VerticalThreadView(this, 'home', document.querySelector('#home-vertical-thread'), {
      sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
    });
  }

  /**
   * Apply the Classic layout to the home page.
   * @param {undefined}
   * @returns {undefined}
   */
  apply_classic_layout () {
    Promise.all([
      BzDeck.prefs.get('home.list.sort_conditions'),
      BzDeck.prefs.get('home.list.columns'),
    ]).then(([sort_cond, columns]) => {
      this.thread = new BzDeck.ClassicThreadView(this, 'home', document.querySelector('#home-list'), columns, {
        date: { simple: false },
        sortable: true,
        reorderable: true,
        sort_conditions: sort_cond || { key: 'id', order: 'ascending' }
      });

      let $$grid = this.thread.$$grid;

      BzDeck.prefs.get('ui.home.layout').then(layout_pref => {
        let vertical = FlareTail.helpers.env.device.mobile || !layout_pref || layout_pref === 'vertical';

        $$grid.options.adjust_scrollbar = !vertical;
        $$grid.options.date.simple = vertical;

        // Change the date format on the thread pane
        for (let $time of $$grid.view.$container.querySelectorAll('time')) {
          $time.textContent = FlareTail.helpers.datetime.format($time.dateTime, { simple: vertical });
          $time.dataset.simple = vertical;
        }
      });

      if (!this.classic_thread_initialized) {
        BzDeck.collections.bugs.get_all().then(bugs => {
          // Fill the thread with all saved bugs, and filter the rows later
          this.thread.update(bugs);

          // Select the first bug on the list automatically when a folder is opened
          // TODO: Remember the last selected bug for each folder
          $$grid.bind('Filtered', event => {
            if ($$grid.view.members.length) {
              $$grid.view.selected = $$grid.view.focused = $$grid.view.members[0];
            }
          });

          this.classic_thread_initialized = true;
        });
      }
    });
  }

  /**
   * Initialize the searchbar available in the vertical layout.
   * @listens QuickSearchPresenter#ResultsAvailable
   * @param {undefined}
   * @fires QuickSearchView#QuickSearchRequested
   * @fires QuickSearchView#AdvancedSearchRequested
   * @returns {undefined}
   */
  init_searchbar () {
    let listed_bugs;
    let $searchbar = document.querySelector('#home-list-searchbar');
    let $searchbox = $searchbar.querySelector('[role="searchbox"]');
    let $search_button = $searchbar.querySelector('[role="button"][data-id="search"]');
    let $close_button = $searchbar.querySelector('[role="button"][data-id="close"]');

    $search_button.addEventListener('mousedown', event => {
      if ($searchbar.classList.contains('active')) {
        // TEMP: Use QuickSearchPresenter to open the advanced search page
        // TEMP: Disable the advanced search until further development takes place (#12)
        // this.trigger('QuickSearchView#AdvancedSearchRequested', { input: $searchbox.value });
      } else {
        $searchbar.classList.add('active');
        Promise.resolve().then(() => $searchbox.focus());
      }
    });

    $close_button.addEventListener('mousedown', event => {
      if (listed_bugs) {
        // Restore the bugs previously listed
        this.thread.update(listed_bugs);
        listed_bugs = undefined;
      }

      $searchbar.classList.remove('active');
      document.querySelector('#home-vertical-thread').focus();
    });

    $searchbox.addEventListener('input', event => {
      if ($searchbox.value.trim()) {
        // TEMP: Use QuickSearchPresenter to retrieve search results
        this.trigger('QuickSearchView#QuickSearchRequested', { input: $searchbox.value });
      }
    });

    this.on_safe('QuickSearchPresenter#ResultsAvailable', ({ category, input, results } = {}) => {
      // Check if the search terms have not changed since the search is triggered
      if (category !== 'bugs' || input !== $searchbox.value) {
        return;
      }

      if (!listed_bugs) {
        // Keep the bugs currently listed on the thread
        listed_bugs = this.thread.bugs;
      }

      // Render the results
      BzDeck.collections.bugs.get_some(results.map(result => result.id)).then(bugs => this.thread.update(bugs));
    }, true);
  }

  /**
   * Update the document title and tab label.
   * @param {String} title - Title to display.
   * @returns {undefined}
   */
  update_title (title) {
    if (!location.pathname.startsWith('/home/')) {
      return;
    }

    document.title = document.querySelector('#tab-home').title = title;
    document.querySelector('#tab-home label').textContent =
        document.querySelector('#tabpanel-home h2').textContent = 
        document.querySelector('#home-list-pane h3').textContent = title.replace(/\s\(\d+\)$/, '');
  }

  /**
   * Called whenever a preference value is changed by the user. Toggle the layout where necessary.
   * @listens PrefCollection#PrefChanged
   * @param {String} name - Preference name.
   * @param {*} value - New value.
   * @returns {undefined}
   */
  on_pref_changed ({ name, value } = {}) {
    if (name === 'ui.home.layout') {
      this.change_layout(value, true);
    }
  }

  /**
   * Called whenever navigation occurred in the bug container. Update the selection on the vertical thread if possible.
   * @listens BugContainerPresenter#navigated
   * @param {Number} new_id - ID of bug currently displayed in the container.
   * @returns {undefined}
   */
  on_container_navigated ({ new_id } = {}) {
    let vertical = document.documentElement.getAttribute('data-home-layout') === 'vertical';
    let $$listbox = this.thread.$$listbox;

    if (vertical) {
      let index = $$listbox.view.members.findIndex($member => Number($member.dataset.id) === new_id);

      if (index) {
        $$listbox.view.selected = $$listbox.view.focused = $$listbox.view.members[index];
      }
    }
  }

  /**
   * Called whenever any bug is updated. Refresh the thread. FIXME: add/remove/update each bug when required, instead of
   * refreshing the entire thread unconditionally.
   * @listens SubscriptionCollection#Updated
   * @param {undefined}
   * @returns {undefined}
   */
  on_subscriptions_updated () {
    if (BzDeck.presenters.sidebar) {
      BzDeck.presenters.sidebar.open_folder(BzDeck.presenters.sidebar.data.folder_id);
    }
  }

  /**
   * Called whenever expanding or collapsing the bug container is requested via other general views. Transfer the event
   * while appending the container ID so that BugContainerView can handle it properly.
   * @listens ThreadView#OpeningBugRequested
   * @listens SidebarView#FolderSelected
   * @param {Boolean} expanded - Whether the preview should be expanded.
   * @fires AnyView#ExpandingBugContainerRequested
   * @returns {undefined}
   */
  request_expanding_bug_container (expanded) {
    this.trigger('AnyView#ExpandingBugContainerRequested', { container_id: this.id, expanded });
  }

  /**
   * Called whenever the history state is updated.
   * @param {undefined}
   * @returns {undefined}
   */
  onpopstate () {
    if (location.pathname !== `/home/${BzDeck.presenters.sidebar.data.folder_id}` || !history.state) {
      return;
    }

    let { preview_id } = history.state;
    let siblings = this.get_shown_bugs();

    // Show the bug preview only when the preview pane is visible (on desktop and tablet)
    if (this.preview_is_hidden) {
      BzDeck.router.navigate('/bug/' + preview_id, { siblings });
    } else if (preview_id !== this.preview_id) {
      this.preview_id = preview_id;
      this.container_view.on_adding_bug_requested({ bug_id: preview_id, siblings });
    }
  }
}
