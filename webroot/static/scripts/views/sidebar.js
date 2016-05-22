/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar View that represents the global application sidebar.
 * @extends BzDeck.BaseView
 */
BzDeck.SidebarView = class SidebarView extends BzDeck.BaseView {
  /**
   * Get a SidebarView instance.
   * @constructor
   * @param {Proxy} user - UserModel instance of the application user.
   * @returns {Object} view - New SidebarView instance.
   * @fires SidebarView#FolderSelected
   * @fires SidebarView#AppMenuItemSelected
   */
  constructor (user) {
    super(); // This does nothing but is required before using `this`

    let mobile = this.helpers.env.device.mobile;
    let $root = document.documentElement; // <html>
    let $sidebar = document.querySelector('#sidebar');

    $root.setAttribute('data-sidebar-hidden', mobile);
    $sidebar.setAttribute('aria-hidden', mobile);

    $sidebar.addEventListener('click', event => {
      if (mobile) {
        let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

        $root.setAttribute('data-sidebar-hidden', hidden);
        $sidebar.setAttribute('aria-hidden', hidden);
      }
    });

    new this.widgets.ScrollBar($sidebar.querySelector('div'));

    this.$$folders = new this.widgets.ListBox(document.querySelector('#sidebar-folder-list'), BzDeck.config.folders);
    this.$$folders.view.members.forEach($option => $option.setAttribute('aria-label', $option.textContent));
    this.$$folders.bind('Selected', event => this.trigger('#FolderSelected', { id: event.detail.ids[0] }));

    this.on_safe('C#FolderOpened', data => this.open_folder(data.folder_id, data.bugs));
    this.on('C#UnreadToggled', data => this.toggle_unread(data.number));

    (new this.widgets.Button(document.querySelector('#main-menu--app--account'))).bind('Pressed', event => {
      this.trigger('#AppMenuItemSelected', { command: 'show-profile' });
    });

    this.$app_menu = document.querySelector('#main-menu--app-menu');
    this.$$app_menu = new this.widgets.Menu(this.$app_menu);

    this.$app_menu.addEventListener('MenuItemSelected', event => {
      this.trigger('#AppMenuItemSelected', { command: event.detail.command });
    });

    this.$app_menu.addEventListener('MenuClosed', event => {
      // Keep the menu open. Need a better way to handle this
      this.$app_menu.removeAttribute('aria-expanded');

      if (this.helpers.env.device.mobile) {
        // Hide the sidebar
        document.documentElement.setAttribute('data-sidebar-hidden', 'true');
        document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
      }
    });

    this.setup_account_label(user);
  }

  /**
   * Open a specified folder by updating the document title and rendering the home page thread.
   * @listens SidebarController#FolderOpened
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @param {Map.<Number, Proxy>} bugs - List of bugs to render.
   * @returns {undefined}
   */
  open_folder (folder_id, bugs) {
    let home = BzDeck.views.pages.home;
    let toolbar = BzDeck.views.banner;
    let folder_label = BzDeck.config.folders.find(f => f.data.id === folder_id).label;
    let unread = [...bugs.values()].filter(bug => bug.unread).length;

    home.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
    home.thread.filter ? home.thread.filter(bugs) : home.thread.update(bugs);
    document.querySelector('#home-list-pane > footer').setAttribute('aria-hidden', !!bugs.size);

    // Mobile compact layout
    if (this.helpers.env.device.mobile &&
        toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
      // Select the home tab
      toolbar.$$tablist.view.selected = toolbar.$$tablist.view.members[0];
    }
  }

  /**
   * Show the number of unread bugs on the Inbox option.
   * @listens SidebarController#UnreadToggled
   * @param {Number} num - Number of unread bugs.
   * @returns {undefined}
   */
  toggle_unread (num) {
    let $label = document.querySelector('#sidebar-folders--inbox label');
    let $num = $label.querySelector('span');

    if (num) {
      $num = $num || $label.appendChild(document.createElement('span'));
      $num.textContent = num;
    } else if ($num) {
      $num.remove();
    }
  }

  /**
   * Set up the account label & avatar.
   * @listens SidebarController#GravatarProfileFound
   * @param {Object} user - User info.
   * @param {String} user.name - User's full name.
   * @param {String} user.email - User's email address.
   * @param {String} user.image - User's avatar image URL.
   * @returns {undefined}
   */
  setup_account_label (user) {
    this.fill(document.querySelector('#main-menu--app--account label'), user);

    this.on('C#GravatarProfileFound', data => {
      document.querySelector('#sidebar-account').style['background-image'] = data.style['background-image'];
    });
  }
}
