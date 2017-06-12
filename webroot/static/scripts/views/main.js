/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Main View that represents the main application region, containing the main tabs and tabpanels.
 * @extends BzDeck.BaseView
 */
BzDeck.MainView = class MainView extends BzDeck.BaseView {
  /**
   * Get a MainView instance.
   * @returns {MainView} New MainView instance.
   */
  constructor () {
    super(); // Assign this.id

    this.$$tablist = new FlareTail.widgets.TabList(document.querySelector('#main-tablist'));
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail));
    this.$$tablist.bind('Opened', event => this.update_tab_count());
    this.$$tablist.bind('Closed', event => this.update_tab_count());
    this.tab_path_map = new Map([['tab-home', '/home/inbox']]);
    this.$preview_pane = document.querySelector('#home-preview-pane');

    Object.defineProperties(this, {
      preview_is_hidden: {
        enumerable: true,
        get: () => !this.$preview_pane.clientHeight
      },
    });

    // Subscribe to events
    this.on('ThreadView#OpeningBugRequested', () => this.request_expanding_bug_container(true), true);
    this.on('NavigatorView#FolderSelected', () => this.request_expanding_bug_container(false), true);
    window.addEventListener('popstate', event => this.onpopstate());

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.main = new BzDeck.MainPresenter(this.id);
    this.container_view = new BzDeck.BugContainerView(this.id, this.$preview_pane);
  }

  /**
   * Open a new global tab and load the relevant tabpanel content.
   * @param {String} label - Text displayed on the label
   * @param {String} [description] - Optional text displayed as the tooltip of the tab.
   * @param {String} category - Category of the tabpanel content, such as 'details' or 'settings'.
   * @param {String} [position] - Where to show the tab: 'next' (default) or 'last'.
   * @param {Object} view - View instance that requests the tab.
   * @todo Need refactoring (#232)
   */
  open_tab ({ label, description, category, position = 'next' } = {}, view) {
    const id = `${category}-${view.id}`;
    const add_tab = () => this.$$tablist.add_tab(id, label, description || label, $tabpanel, position);
    let page;
    let pages = BzDeck.views.pages[`${category}_list`];
    let $tab = document.querySelector(`#tab-${CSS.escape(id)}`);
    let $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(id)}`);

    if (!pages) {
      pages = BzDeck.views.pages[`${category}_list`] = new Map();
    }

    // Reuse a tabpanel if possible
    if ($tabpanel) {
      page = pages.get(view.id);
      $tab = $tab || add_tab();
    } else {
      page = view;
      pages.set(view.id, page);
      $tabpanel = this.get_template(`tabpanel-${category}-template`, view.id);
      $tab = add_tab();

      // Prepare the Back button on the mobile banner
      BzDeck.views.global.add_back_button($tabpanel);
    }

    BzDeck.views.global.update_window_title($tab);
    BzDeck.views.pages[category] = page;
    this.tab_path_map.set($tab.id, location.pathname + location.search);
    this.$$tablist.view.selected = this.$$tablist.view.$focused = $tab;
    $tabpanel.focus();
  }

  /**
   * Called whenever a global tab is selected.
   * @param {Array.<HTMLElement>} items - Newly selected nodes.
   * @param {Array.<HTMLElement>} oldval - Previously selected nodes.
   * @fires MainView#TabSelected
   */
  on_tab_selected ({ items, oldval } = {}) {
    const path = this.tab_path_map.get(items[0].id);
    let prev_tabpanel_id;

    document.documentElement.setAttribute('data-current-tab', path.match(/^\/(\w+)/)[1]);

    // Do not apply transition to the previous tabpanel. This is a tricky part!
    if (!path.startsWith('/home/') && history.state && oldval.length &&
        history.state.previous === this.tab_path_map.get(oldval[0].id)) {
      prev_tabpanel_id = oldval[0].id.replace(/^tab-/, 'tabpanel-');
    }

    for (const $tabpanel of document.querySelectorAll('#main-tabpanels > [role="tabpanel"]')) {
      if ($tabpanel.id === prev_tabpanel_id) {
        $tabpanel.classList.add('fixed');
      } else {
        $tabpanel.classList.remove('fixed');
      }
    }

    this.trigger('#TabSelected', { path });
  }

  /**
   * Called whenever a global tab is opened or closed. Update the data-tab-count attribute on <main>.
   */
  update_tab_count () {
    document.querySelector('main').setAttribute('data-tab-count', this.$$tablist.view.members.length);
  }

  /**
   * Update the document title and tab label.
   * @param {String} title - Title to display.
   */
  update_title (title) {
    if (!location.pathname.startsWith('/home/')) {
      return;
    }

    document.title = document.querySelector('#tab-home').title = title;
    document.querySelector('#tab-home label').textContent =
        document.querySelector('#tabpanel-home h2').textContent =
        document.querySelector('#sidebar-list-panel h3').textContent = title.replace(/\s\(\d+\)$/, '');
  }

  /**
   * Called whenever expanding or collapsing the bug container is requested via other general views. Transfer the event
   * while appending the container ID so that BugContainerView can handle it properly.
   * @listens ThreadView#OpeningBugRequested
   * @listens NavigatorView#FolderSelected
   * @param {Boolean} expanded - Whether the preview should be expanded.
   * @fires AnyView#ExpandingBugContainerRequested
   */
  request_expanding_bug_container (expanded) {
    this.trigger('AnyView#ExpandingBugContainerRequested', { container_id: this.id, expanded });
  }

  /**
   * Called whenever the history state is updated.
   */
  onpopstate () {
    if (location.pathname !== `/home/${BzDeck.presenters.navigator.data.folder_id}` || !history.state) {
      return;
    }

    const { preview_id } = history.state;
    const siblings = BzDeck.views.sidebar_list.get_shown_bugs();

    if (!preview_id) {
      return;
    }

    // Show the bug preview only when the preview pane is visible (on desktop and tablet)
    if (this.preview_is_hidden) {
      BzDeck.router.navigate('/bug/' + preview_id, { siblings });
    } else if (preview_id !== this.preview_id) {
      this.preview_id = preview_id;
      this.container_view.on_adding_bug_requested({ bug_id: preview_id, siblings });
    }
  }
}
