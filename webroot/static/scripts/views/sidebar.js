/**
 * BzDeck Global Sidebar View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.Sidebar = function SidebarView () {
  let mobile = FlareTail.util.ua.device.mobile,
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  $root.setAttribute('data-sidebar-hidden', mobile);
  $sidebar.setAttribute('aria-hidden', mobile);

  $sidebar.addEventListener('click', event => {
    if (mobile) {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

      $root.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);
    }
  });

  new this.widget.ScrollBar($sidebar.querySelector('div'));

  this.$$folders = new this.widget.ListBox(document.querySelector('#sidebar-folder-list'), BzDeck.config.folders);
  this.$$folders.bind('Selected', event => this.publish(':FolderSelected', { 'id': event.detail.ids[0] }));

  this.subscribe('C:FolderOpened', data => this.open_folder(data.folder_id, data.bugs));
  this.subscribe('C:UnreadToggled', data => this.toggle_unread(data.number));
};

BzDeck.views.Sidebar.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.Sidebar.prototype.constructor = BzDeck.views.Sidebar;

BzDeck.views.Sidebar.prototype.open_folder = function (folder_id, bugs) {
  let home = BzDeck.views.pages.home,
      toolbar = BzDeck.views.toolbar,
      folder_label = [for (f of BzDeck.config.folders) if (f.data.id === folder_id) f][0].label,
      unread = [for (bug of bugs) if (bug._unread) bug].length;

  home.update_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
  home.data.bugs = [...bugs]; // Clone the array or somehow it cannot be saved by Proxy
  home.thread.filter ? home.thread.filter(bugs) : home.thread.update(bugs);
  document.querySelector('#home-list-pane > footer').setAttribute('aria-hidden', bugs.length ? 'true' : 'false');

  // Mobile compact layout
  if (FlareTail.util.ua.device.mobile &&
      toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
    // Select the home tab
    toolbar.$$tablist.view.selected = toolbar.$$tablist.view.members[0];
  }
};

BzDeck.views.Sidebar.prototype.toggle_unread = function (num) {
  let $label = document.querySelector('#sidebar-folders--inbox label'),
      $num = $label.querySelector('span');

  if (num) {
    $num = $num || $label.appendChild(document.createElement('span'));
    $num.textContent = num;
  } else if ($num) {
    $num.remove();
  }
};
