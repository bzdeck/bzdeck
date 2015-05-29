/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Global = function GlobalView () {
  let datetime = FlareTail.util.datetime,
      value,
      theme = BzDeck.prefs.get('ui.theme.selected'),
      FTut = FlareTail.util.theme,
      $root = document.documentElement;

  // Automatically update relative dates on the app
  datetime.options.updater_enabled = true;

  // Date format
  value = BzDeck.prefs.get('ui.date.relative');
  datetime.options.relative = value !== undefined ? value : true;

  // Date timezone
  value = BzDeck.prefs.get('ui.date.timezone');
  datetime.options.timezone = value || 'local';

  // Timeline: Font
  value = BzDeck.prefs.get('ui.timeline.font.family');
  $root.setAttribute('data-ui-timeline-font-family', value || 'proportional');

  // Timeline: Sort order
  value = BzDeck.prefs.get('ui.timeline.sort.order');
  $root.setAttribute('data-ui-timeline-sort-order', value || 'ascending');

  // Timeline: Changes
  value = BzDeck.prefs.get('ui.timeline.show_cc_changes');
  $root.setAttribute('data-ui-timeline-show-cc-changes', value !== undefined ? value : false);

  // Timeline: Attachments
  value = BzDeck.prefs.get('ui.timeline.display_attachments_inline');
  $root.setAttribute('data-ui-timeline-display-attachments-inline', value !== undefined ? value : true);

  // Change the theme
  if (theme && FTut.list.contains(theme)) {
    FTut.selected = theme;
  }

  // Preload images from CSS
  FTut.preload_images();

  // Update user name & image asynchronously
  this.on('UserModel:UserInfoUpdated', data => {
    let user = BzDeck.collections.users.get(data.name, { 'name': data.name });

    for (let $email of [...document.querySelectorAll(`[itemprop="email"][content="${CSS.escape(user.email)}"]`)]) {
      let title = `${user.original_name || user.name}\n${user.email}`,
          $person = $email.closest('[itemtype$="Person"]'),
          $name = $person.querySelector('[itemprop="name"]'),
          $image = $person.querySelector('[itemprop="image"]');

      if ($person.title && $person.title !== title) {
        $person.title = title;
      }

      if ($name && $name.itemValue !== user.name) {
        $name.itemValue = user.name;
      }

      if ($image && $image.itemValue !== user.image) {
        $image.itemValue = user.image; // Blob URL
      }
    }
  }, true);
};

BzDeck.views.Global.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Global.prototype.constructor = BzDeck.views.Global;

BzDeck.views.Global.prototype.toggle_unread = function (bugs, loaded, unread_num) {
  if (document.documentElement.getAttribute('data-current-tab') === 'home') {
    BzDeck.views.pages.home.update_title(document.title.replace(/(\s\(\d+\))?$/, unread_num ? ` (${unread_num})` : ''));
  }

  if (!loaded) {
    return;
  }

  if (bugs.length === 0) {
    BzDeck.views.statusbar.show('No new bugs to download'); // l10n

    return;
  }

  bugs.sort((a, b) => new Date(b.last_change_time) - new Date(a.last_change_time));

  let status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug'; // l10n

  BzDeck.views.statusbar.show(status);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------------------------------------------------ */

window.addEventListener('contextmenu', event => event.preventDefault());
window.addEventListener('dragenter', event => event.preventDefault());
window.addEventListener('dragover', event => event.preventDefault());
window.addEventListener('drop', event => event.preventDefault());
window.addEventListener('wheel', event => event.preventDefault());

window.addEventListener('popstate', event => {
  // Hide sidebar
  if (FlareTail.util.ua.device.mobile) {
    document.documentElement.setAttribute('data-sidebar-hidden', 'true');
    document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
  }
});

window.addEventListener('click', event => {
  let $target = event.target;

  // Discard clicks on the fullscreen dialog
  if ($target === document) {
    return true;
  }

  if ($target.matches('[itemtype$="Person"]')) {
    BzDeck.router.navigate('/profile/' + $target.properties.email[0].itemValue);

    return FlareTail.util.event.ignore(event);
  }

  // Support clicks on the avatar image in a comment
  if ($target.parentElement && $target.parentElement.matches('[itemtype$="Person"]')) {
    BzDeck.router.navigate('/profile/' + $target.parentElement.properties.email[0].itemValue);

    return FlareTail.util.event.ignore(event);
  }

  if ($target.matches(':-moz-any-link, [role="link"]')) {
    // Bug link: open in a new app tab
    if ($target.hasAttribute('data-bug-id')) {
      BzDeck.router.navigate('/bug/' + $target.getAttribute('data-bug-id'));

      return FlareTail.util.event.ignore(event);
    }

    // Attachment link: open in a new app tab
    if ($target.hasAttribute('data-attachment-id')) {
      let props = $target.properties,
          attachment_id = Number($target.getAttribute('data-attachment-id')),
          attachment_type = props.encodingFormat ? props.encodingFormat[0].itemValue : undefined,
          bug_id = [for (bug of BzDeck.collections.bugs.get_all().values())
                    for (att of bug.attachments || []) if (att.id === attachment_id) bug.id][0];

      if (attachment_type && ['text/x-github-pull-request', 'text/x-review-board-request'].includes(attachment_type)) {
        // Open the link directly in a new browser tab
        window.open(`${BzDeck.models.server.url}/attachment.cgi?id=${attachment_id}`);
      } else if (!bug_id || (FlareTail.util.ua.device.mobile && window.matchMedia('(max-width: 1023px)').matches)) {
        BzDeck.router.navigate(`/attachment/${attachment_id}`);
      } else {
        BzDeck.router.navigate(`/bug/${bug_id}`, { attachment_id });
      }

      return FlareTail.util.event.ignore(event);
    }

    // Normal link: open in a new browser tab
    $target.target = '_blank';

    return false;
  }

  return true;
});

window.addEventListener('keydown', event => {
  let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
      tab = event.key === 'Tab';

  // Stop showing the Search Bar in Firefox
  if (!event.target.matches('[role="textbox"], [role="searchbox"]') && !modifiers && !tab) {
    event.preventDefault();
  }
});
