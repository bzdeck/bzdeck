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
    super(); // This does nothing but is required before using `this`

    this.$$tablist = new this.widgets.TabList(document.querySelector('#main-tablist'));
    this.$$tablist.bind('Selected', event => this.on_tab_selected(event.detail));
    this.$$tablist.bind('Opened', event => this.update_tab_count());
    this.$$tablist.bind('Closed', event => this.update_tab_count());
    this.tab_path_map = new Map([['tab-home', '/home/inbox']]);
  }

  /**
   * Open a new global tab and load the relevant tabpanel content. FIXME: Need refactoring (#232).
   * @param {String} label - Text displayed on the label
   * @param {String} [description] - Optional text displayed as the tooltip of the tab.
   * @param {String} [position] - Where to show the tab: 'next' or 'last' (default).
   * @param {Object} page - Defining page details.
   * @param {String} page.category - Category of the tabpanel content, such as 'details' or 'settings'.
   * @param {(String|Number)} page.id - Unique identifier for the tab. Can be generated with Date.now().
   * @param {Object} page.constructor - View constructor for the tabpanel content.
   * @param {Array} [page.constructor_args] - Arguments used to create a new View instance.
   * @param {Object} controller - Controller instance that requests the tab.
   * @returns {undefined}
   */
  open_tab ({ label, description, position = 'last', page } = {}, controller) {
    let view;
    let pages = BzDeck.views.pages[`${page.category}_list`];
    let id = page.category + (page.id ? '-' + page.id : '');
    let $tab = document.querySelector(`#tab-${CSS.escape(id)}`);
    let $tabpanel = document.querySelector(`#tabpanel-${CSS.escape(id)}`);

    if (!pages) {
      pages = BzDeck.views.pages[`${page.category}_list`] = new Map();
    }

    // Reuse a tabpanel if possible
    if ($tabpanel) {
      view = pages.get(page.id || 'default');
      $tab = $tab || this.$$tablist.add_tab(id, label, description || label, $tabpanel, position);
    } else {
      $tabpanel = this.get_template(`tabpanel-${page.category}-template`, page.id);
      $tab = this.$$tablist.add_tab(id, label, description || label, $tabpanel, position);
      view = controller.view = new page.constructor(...(page.constructor_args || []));
      view.controller = controller;
      pages.set(page.id || 'default', view);

      // Prepare the Back button on the mobile banner
      this.add_back_button($tabpanel);
    }

    this.$$tablist.view.selected = this.$$tablist.view.$focused = $tab
    $tabpanel.focus();

    BzDeck.views.global.update_window_title($tab);
    BzDeck.views.pages[page.category] = view;
    this.tab_path_map.set($tab.id, location.pathname + location.search);
  }

  /**
   * Called whenever a global tab is selected.
   * @param {Object} detail - Event detail.
   * @param {Array.<HTMLElement>} detail.items - Newly selected nodes.
   * @param {Array.<HTMLElement>} detail.oldval - Previously selected nodes.
   * @returns {undefined}
   * @fires BannerView:TabSelected
   */
  on_tab_selected (detail) {
    let { items, oldval } = detail;
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

    this.trigger(':TabSelected', { path });
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
   * @returns {undefined}
   * @fires BannerView:BackButtonClicked
   */
  add_back_button ($parent) {
    let $header = $parent.querySelector('header');
    let $button = document.querySelector('#tabpanel-home .banner-nav-button').cloneNode(true);

    if (this.helpers.env.device.mobile && !$parent.querySelector('.banner-nav-button') && $header) {
      $button.setAttribute('aria-label', 'Back'); // l10n
      $button.addEventListener('touchstart', event => {
        this.trigger(':BackButtonClicked');

        return this.helpers.event.ignore(event);
      });

      $header.insertBefore($button, $header.firstElementChild);
    }
  }
}
