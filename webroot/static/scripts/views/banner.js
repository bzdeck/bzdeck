/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Banner View that represents the global application header, containing the Quick Search bar (currently
 * disabled) and global tabs.
 * @extends BzDeck.BaseView
 */
BzDeck.BannerView = class BannerView extends BzDeck.BaseView {
  /**
   * Get a BannerView instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New BannerView instance.
   */
  constructor () {
    super(); // Assign this.id

    this.$$tablist = new FlareTail.widgets.TabList(document.querySelector('#main-tablist'));
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail));
    this.$$tablist.bind('Opened', event => this.update_tab_count());
    this.$$tablist.bind('Closed', event => this.update_tab_count());
    this.tab_path_map = new Map([['tab-home', '/home/inbox']]);

    // Initiate the corresponding presenter and sub-view
    BzDeck.presenters.banner = new BzDeck.BannerPresenter(this.id),
    BzDeck.views.quick_search = new BzDeck.QuickSearchView(this.id);
  }

  /**
   * Open a new global tab and load the relevant tabpanel content.
   * @param {String} label - Text displayed on the label
   * @param {String} [description] - Optional text displayed as the tooltip of the tab.
   * @param {String} category - Category of the tabpanel content, such as 'details' or 'settings'.
   * @param {String} [position] - Where to show the tab: 'next' (default) or 'last'.
   * @param {Object} view - View instance that requests the tab.
   * @returns {undefined}
   * @todo Need refactoring (#232)
   */
  open_tab ({ label, description, category, position = 'next' } = {}, view) {
    let page;
    let pages = BzDeck.views.pages[`${category}_list`];
    let id = `${category}-${view.id}`;
    let $tab = document.querySelector(`#tab-${CSS.escape(id)}`);
    let $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(id)}`);
    let add_tab = () => this.$$tablist.add_tab(id, label, description || label, $tabpanel, position);

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
      this.add_back_button($tabpanel);
    }

    this.$$tablist.view.selected = this.$$tablist.view.$focused = $tab;
    $tabpanel.focus();

    BzDeck.views.global.update_window_title($tab);
    BzDeck.views.pages[category] = page;
    this.tab_path_map.set($tab.id, location.pathname + location.search);
  }

  /**
   * Called whenever a global tab is selected.
   * @param {Array.<HTMLElement>} items - Newly selected nodes.
   * @param {Array.<HTMLElement>} oldval - Previously selected nodes.
   * @fires BannerView#TabSelected
   * @returns {undefined}
   */
  on_tab_selected ({ items, oldval } = {}) {
    let path = this.tab_path_map.get(items[0].id);
    let prev_tabpanel_id;

    document.documentElement.setAttribute('data-current-tab', path.match(/^\/(\w+)/)[1]);

    // Do not apply transition to the previous tabpanel. This is a tricky part!
    if (!path.startsWith('/home/') && history.state && oldval.length &&
        history.state.previous === this.tab_path_map.get(oldval[0].id)) {
      prev_tabpanel_id = oldval[0].id.replace(/^tab-/, 'tabpanel-');
    }

    for (let $tabpanel of document.querySelectorAll('#main-tabpanels > [role="tabpanel"]')) {
      if ($tabpanel.id === prev_tabpanel_id) {
        $tabpanel.classList.add('fixed');
      } else {
        $tabpanel.classList.remove('fixed');
      }
    }

    this.trigger('#TabSelected', { path });
  }

  /**
   * Called whenever a global tab is opened or closed. Update the data-tab-count attribute on <html>.
   * @param {undefined}
   * @returns {undefined}
   */
  update_tab_count () {
    document.documentElement.setAttribute('data-tab-count', this.$$tablist.view.members.length);
  }

  /**
   * Add the Back button to the header of each page. Only on mobile, and the header is actually not in the global
   * banner.
   * @param {HTMLElement} $parent - Tabpanel that contains the header.
   * @fires BannerView#BackButtonClicked
   * @returns {undefined}
   */
  add_back_button ($parent) {
    let $header = $parent.querySelector('header');
    let $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

    if (FlareTail.helpers.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
      $button.setAttribute('aria-label', 'Back'); // l10n
      $button.addEventListener('touchstart', event => {
        this.trigger('#BackButtonClicked');

        return FlareTail.helpers.event.ignore(event);
      });

      $header.insertAdjacentElement('afterbegin', $button);
    }
  }
}
