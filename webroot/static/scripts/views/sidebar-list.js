/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the SidebarList View that contains the bug thread.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarListView = class SidebarListView extends BzDeck.BaseView {
  /**
   * Get a SidebarListView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @returns {SidebarListView} New SidebarListView instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.$container = document.querySelector('#sidebar-list-panel');

    // Subscribe to events
    this.on('BugContainerPresenter#navigated', data => this.on_container_navigated(data));
    this.subscribe('PrefCollection#PrefChanged', true);

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.sidebar_list = this.presenter = new BzDeck.SidebarListPresenter(this.id);

    this.add_mobile_tweaks();
    (async () => this.change_layout(await BzDeck.prefs.get('ui.home.layout')))();
  }

  /**
   * Called whenever a preference value is changed by the user. Toggle the layout where necessary.
   * @listens PrefCollection#PrefChanged
   * @param {String} name - Preference name.
   * @param {*} value - New value.
   */
  on_pref_changed ({ name, value } = {}) {
    if (name === 'ui.home.layout') {
      this.change_layout(value, true);
    }
  }

  /**
   * Switch between the Vertical layout and Classic layout.
   * @param {String} pref - User preference for the home page layout.
   * @param {Boolean} [sort_grid=false] - Whether the thread should be sorted after switching the layout. Currently, the
   *  Vertical Thread always sorts bugs by date.
   */
  change_layout (pref, sort_grid = false) {
    const vertical = FlareTail.env.device.mobile || !pref || pref === 'vertical';

    document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');

    if (vertical) {
      this.apply_vertical_layout();
    } else {
      this.apply_classic_layout();
    }

    // Render the thread
    if (BzDeck.presenters.navigator && BzDeck.presenters.navigator.data.folder_id) {
      BzDeck.presenters.navigator.open_folder(BzDeck.presenters.navigator.data.folder_id);
    }
  }

  /**
   * Apply the Vertical layout to the home page.
   */
  apply_vertical_layout () {
    const mql = window.matchMedia('(max-width: 1023px)');
    const $listbox = document.querySelector('#home-vertical-thread [role="listbox"]');

    const show_preview = () => {
      const $$listbox = this.thread.$$listbox;

      if ($$listbox.view.members.length && !BzDeck.views.main.preview_is_hidden && !this.presenter.data.preview_id) {
        $$listbox.view.selected = $$listbox.view.focused = $$listbox.view.selected[0] || $$listbox.view.members[0];
      }
    };

    if (!this.vertical_thread_initialized) {
      // Select the first bug on the list automatically when a folder is opened and no bug is previewed yet. Wait a sec
      // until the listbox is ready. TODO: Remember the last selected bug for each folder
      $listbox.addEventListener('Updated', event => window.setTimeout(() => show_preview(), 500));
      mql.addListener(show_preview);

      // Star button
      $listbox.addEventListener('mousedown', async event => {
        if (event.target.matches('[itemprop="starred"]')) {
          const bug = await BzDeck.collections.bugs.get(Number(event.target.parentElement.dataset.id));

          bug.starred = event.target.matches('[content="false"]');
          event.stopPropagation();
        }
      });

      this.vertical_thread_initialized = true;
    }

    this.thread = new BzDeck.VerticalThreadView(this, 'home', document.querySelector('#home-vertical-thread'), {
      sort_conditions: { key: 'last_change_time', type: 'time', order: 'descending' }
    });
  }

  /**
   * Apply the Classic layout to the home page.
   */
  async apply_classic_layout () {
    const [sort_cond, columns] = await Promise.all([
      BzDeck.prefs.get('sidebar.list.sort_conditions'),
      BzDeck.prefs.get('sidebar.list.columns'),
    ]);

    this.thread = new BzDeck.ClassicThreadView(this, 'home', document.querySelector('#sidebar-list'), columns, {
      date: { simple: false },
      sortable: true,
      reorderable: true,
      sort_conditions: sort_cond || { key: 'id', order: 'ascending' }
    });

    const $$grid = this.thread.$$grid;

    (async () => {
      const layout_pref = await BzDeck.prefs.get('ui.home.layout');
      const vertical = FlareTail.env.device.mobile || !layout_pref || layout_pref === 'vertical';

      $$grid.options.adjust_scrollbar = !vertical;
      $$grid.options.date.simple = vertical;

      // Change the date format on the thread pane
      for (const $time of $$grid.view.$container.querySelectorAll('time')) {
        $time.textContent = FlareTail.util.DateTime.format($time.dateTime, { simple: vertical });
        $time.dataset.simple = vertical;
      }
    })();

    if (!this.classic_thread_initialized) {
      const bugs = await BzDeck.collections.bugs.get_all();

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
    }
  }

  /**
   * Prepare the Menu button on the mobile banner.
   */
  add_mobile_tweaks () {
    if (!FlareTail.env.device.mobile) {
      return;
    }

    const $navigator = document.querySelector('#navigator');

    document.querySelector('#sidebar .banner-nav-button').addEventListener('touchstart', event => {
      const hidden = $navigator.getAttribute('aria-hidden') !== 'true';

      document.querySelector('#navigator').scrollTop = 0;
      document.documentElement.setAttribute('data-navigator-hidden', hidden);
      $navigator.setAttribute('aria-hidden', hidden);

      return FlareTail.util.Event.ignore(event);
    });
  }

  /**
   * Get a list of bugs currently showing on the thread.
   * @returns {Array.<Number>} Bug IDs currently showing.
   * @todo FIXME: This should be smartly done in the presenter.
   */
  get_shown_bugs () {
    const mobile = FlareTail.env.device.mobile;
    const vertical = mobile || document.documentElement.getAttribute('data-home-layout') === 'vertical';
    const items = vertical ? document.querySelectorAll('#home-vertical-thread [role="option"]')
                           : this.thread.$$grid.view.$body.querySelectorAll('[role="row"]:not([aria-hidden="true"])');

    return [...items].map($item => Number($item.dataset.id));
  }

  /**
   * Called whenever navigation occurred in the bug container. Update the selection on the vertical thread if possible.
   * @listens BugContainerPresenter#navigated
   * @param {Number} new_id - ID of bug currently displayed in the container.
   */
  on_container_navigated ({ new_id } = {}) {
    const vertical = document.documentElement.getAttribute('data-home-layout') === 'vertical';
    const $$listbox = this.thread.$$listbox;

    if (vertical) {
      const index = $$listbox.view.members.findIndex($member => Number($member.dataset.id) === new_id);

      if (index) {
        $$listbox.view.selected = $$listbox.view.focused = $$listbox.view.members[index];
      }
    }
  }
}
