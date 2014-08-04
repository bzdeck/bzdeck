/**
 * BzDeck Details Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.DetailsPage = function (id, bug_list = []) {
  let tablist = BzDeck.toolbar.tablist,
      $existing_tab = document.querySelector('#tab-details-' + id);

  if ($existing_tab) {
    tablist.view.selected = tablist.view.$focused = $existing_tab;

    return;
  }

  this.data = { id, bug_list };

  this.view = {
    '$tab': null,
    '$tabpanel': null
  };

  if (bug_list.length) {
    this.open([for (bug of bug_list) if (bug.id === id) bug][0], bug_list);

    return;
  }

  BzDeck.model.get_bug_by_id(id).then(bug => {
    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      this.fetch_bug(id);
      bug = { id };
    }

    this.open(bug);
  });

  BzDeck.bugzfeed.subscribe([id]);
};

BzDeck.DetailsPage.prototype.open = function (bug, bug_list = []) {
  // If there is an existing tabpanel, reuse it
  let $tabpanel = document.querySelector('#tabpanel-details-' + bug.id);

  // Or prep a new one
  if (!$tabpanel) {
    $tabpanel = this.prep_tabpanel(bug);
    document.querySelector('#main-tabpanels').appendChild($tabpanel);
  }

  this.view.$tabpanel = $tabpanel;
  $tabpanel.setAttribute('aria-hidden', 'false');

  let tablist = BzDeck.toolbar.tablist;

  // Open a new tab
  this.view.$tab = tablist.view.selected = tablist.view.$focused = tablist.add_tab(
    'details-' + bug.id, bug.id, this.get_tab_title(bug), $tabpanel, 'next'
  );

  // Set Back & Forward navigation
  if (bug_list.length) {
    this.setup_navigation($tabpanel, bug_list);
  }

  window.addEventListener('UI:toggle_star', event => {
    if (!$tabpanel) {
      return; // The tabpanel has already been destroyed
    }

    let _bug = event.detail.bug,
        _starred = _bug._starred_comments;

    if (_bug.id === bug.id) {
      $tabpanel.querySelector('[role="button"][data-command="star"]')
               .setAttribute('aria-pressed', !!_starred.size);

      for (let $comment of $tabpanel.querySelectorAll('[itemprop="comment"][data-id]')) {
        $comment.querySelector('[role="button"][data-command="star"]')
                .setAttribute('aria-pressed', _starred.has(Number.parseInt($comment.dataset.id)));
      }
    }
  });

  window.addEventListener('bug:updated', event => {
    if ($tabpanel && this.data.id === event.detail.bug.id) {
      BzDeck.bug.update(this.view.$bug, event.detail.bug, event.detail.changes);
    }
  });
};

BzDeck.DetailsPage.prototype.prep_tabpanel = function (bug) {
  let FTw = FlareTail.widget,
      $tabpanel = document.querySelector('template#tabpanel-details').content
                          .cloneNode(true).firstElementChild,
      $bug = this.view.$bug = $tabpanel.querySelector('article'),
      $star_button = $tabpanel.querySelector('[role="button"][data-command="star"]');

  // Assign unique IDs
  $tabpanel.id = $tabpanel.id.replace(/TID/, bug.id);

  if ($tabpanel.hasAttribute('aria-labelledby')) {
    $tabpanel.setAttribute('aria-labelledby',
                           $tabpanel.getAttribute('aria-labelledby').replace(/TID/, bug.id));
  }

  for (let attr of ['id', 'aria-controls', 'aria-labelledby']) {
    for (let $element of $tabpanel.querySelectorAll('[' + attr +']')) {
      $element.setAttribute(attr, $element.getAttribute(attr).replace(/TID/, bug.id));
    }
  }

  // Star on the header
  (new FTw.Button($star_button)).bind('Pressed', event =>
    BzDeck.core.toggle_star(bug.id, event.detail.pressed));

  for (let $area of $tabpanel.querySelectorAll('.scrollable')) {
    // Custom scrollbar
    let scrollbar = new FTw.ScrollBar($area);

    if (scrollbar && $area.classList.contains('bug-timeline')) {
      scrollbar.onkeydown_extend = BzDeck.bug.timeline.handle_keydown.bind(scrollbar);
    }

    $area.tabIndex = 0;
  }

  BzDeck.bug.fill_data($bug, bug);

  let mobile = FlareTail.util.device.type.startsWith('mobile'),
      phone = FlareTail.util.device.type === 'mobile-phone',
      $tablist = $tabpanel.querySelector('[role="tablist"]'),
      _tablist = new FlareTail.widget.TabList($tablist),
      $article = $tabpanel.querySelector('article'),
      $title = $tabpanel.querySelector('h2'),
      $timeline_content = $tabpanel.querySelector('.bug-timeline .scrollable-area-content'),
      $info_tab = $tabpanel.querySelector('[id$="-tab-info"]'),
      $timeline_tab = $tabpanel.querySelector('[id$="-tab-timeline"]'),
      $bug_info = $tabpanel.querySelector('.bug-info');

  if (mobile) {
    $timeline_content.insertBefore($title, $timeline_content.firstElementChild);
  }

  if (phone) {
    $info_tab.setAttribute('aria-hidden', 'false');
    $tabpanel.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
  } else {
    if (_tablist.view.selected[0] === $info_tab) {
      _tablist.view.selected = _tablist.view.$focused = $timeline_tab;
    }

    $info_tab.setAttribute('aria-hidden', 'true');
    $tabpanel.querySelector('article > div').appendChild($bug_info);
    $tablist.removeAttribute('aria-hidden');
  }

  // Scroll a tabpanel to top when the tab is selected
  _tablist.bind('Selected', event => {
    document.querySelector('#' + event.detail.items[0].getAttribute('aria-controls')
                               + ' > .scrollable').scrollTop = 0;
  });

  // Hide tabs when scrolled down on mobile
  for (let $tabpanel_content of $tabpanel.querySelectorAll('[role="tabpanel"] div')) {
    if (!mobile || !phone && $tabpanel_content.classList.contains('bug-info')) {
      continue;
    }

    let scroll_top = $tabpanel_content.scrollTop,
        tablist_hidden = false;

    $tabpanel_content.addEventListener('scroll', event => {
      let value = event.target.scrollTop - scroll_top > 0;

      if (tablist_hidden !== value) {
        tablist_hidden = value;
        $tablist.setAttribute('aria-hidden', String(value));
      }

      scroll_top = event.target.scrollTop;
    });
  }

  return $tabpanel;
};

BzDeck.DetailsPage.prototype.get_tab_title = function (bug) {
  return 'Bug %d\n%s'.replace('%d', bug.id)
                     .replace('%s', bug.summary || 'Loading...'); // l10n
};

BzDeck.DetailsPage.prototype.setup_navigation = function ($tabpanel, bug_list) {
  let $current_tabpanel = this.view.$tabpanel,
      Button = FlareTail.widget.Button,
      $toolbar = $tabpanel.querySelector('header [role="toolbar"]'),
      btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      bugs = [for (bug of bug_list) bug.id],
      index = bugs.indexOf(this.data.id),
      prev = bugs[index - 1],
      next = bugs[index + 1],
      set_keybind = FlareTail.util.event.set_keybind;

  let preload = id => {
    if (document.querySelector('#tabpanel-details-' + id)) {
      return;
    }

    BzDeck.model.get_bug_by_id(id).then(bug => {
      let $tabpanel = this.prep_tabpanel(bug);

      $tabpanel.setAttribute('aria-hidden', 'true');
      document.querySelector('#main-tabpanels').insertBefore(
        $tabpanel,
        id === prev ? $current_tabpanel : $current_tabpanel.nextElementSibling
      );

      if (!bug.comments) {
        // Prefetch the bug
        BzDeck.model.fetch_bug(bug, false).then(bug => BzDeck.model.save_bug(bug));
      }
    });
  };

  let change_button_tooltip = (id, button) => {
    let bug = [for (bug of bug_list) if (bug.id === id) bug][0];

    if (bug) {
      button.view.$button.title = 'Bug ' + bug.id + '\n' + bug.summary; // l10n
    }
  };

  if (prev) {
    preload(prev);
    change_button_tooltip(prev, btn_back);
    btn_back.data.disabled = false;
    btn_back.bind('Pressed', event => this.navigate(prev));
    // TODO: Add keyboard shortcut
    // set_keybind($tabpanel, 'B', '', event => this.navigate(prev));
  } else {
    btn_back.data.disabled = true;
  }

  if (next) {
    preload(next);
    change_button_tooltip(next, btn_forward);
    btn_forward.data.disabled = false;
    btn_forward.bind('Pressed', event => this.navigate(next));
    // TODO: Add keyboard shortcut
    // set_keybind($tabpanel, 'F', '', event => this.navigate(next));
  } else {
    btn_forward.data.disabled = true;
  }
};

BzDeck.DetailsPage.prototype.fetch_bug = function (id) {
  if (!navigator.onLine) {
    BzDeck.core.show_status('You have to go online to load a bug.'); // l10n

    return;
  }

  BzDeck.core.show_status('Loading...'); // l10n

  BzDeck.model.fetch_bug({ id }).then(bug => {
    // Save in DB
    BzDeck.model.save_bug(bug);

    let $tab = document.querySelector('#tab-details-' + id),
        $tabpanel = this.view.$tabpanel;

    // Check if the tabpanel still exists
    if ($tabpanel) {
      BzDeck.core.show_status('');
      // Update UI
      BzDeck.bug.fill_data(this.view.$bug, bug);
      $tab.title = this.get_tab_title(bug);
    }
  }).catch(bug => {
    BzDeck.core.show_status('ERROR: Failed to load data.'); // l10n
  });
};

BzDeck.DetailsPage.prototype.navigate = function (id) {
  BzDeck.toolbar.tablist.close_tab(this.view.$tab);
  BzDeck.detailspage = new BzDeck.DetailsPage(id, this.data.bug_list);
};

/* ----------------------------------------------------------------------------------------------
 * Attachments
 * ---------------------------------------------------------------------------------------------- */

BzDeck.DetailsPage.attachments = {};

BzDeck.DetailsPage.attachments.render = function ($bug, attachments, addition = false) {
  let $placeholder = $bug.querySelector('[data-field="attachments"]');

  if (!$placeholder || !attachments.length) {
    return;
  }

  if (!addition) {
    for (let $attachment of $placeholder.querySelectorAll('[itemprop="attachment"]')) {
      $attachment.remove();
    }
  }

  for (let att of attachments) {
    let $attachment = $placeholder.appendChild(document.querySelector('#details-attachment')
                                                       .content.cloneNode(true).firstElementChild);

    FlareTail.util.content.fill($attachment, {
      'url': '/attachment/' + att.id,
      'description': att.summary,
      'name': att.file_name,
      'contentSize': (att.size / 1024).toFixed(2) + ' KB', // l10n
      'encodingFormat': att.is_patch ? 'Patch' : att.content_type, // l10n
      'uploadDate': att.creation_time,
      'flag': [for (flag of att.flags) {
        'creator': {
          'name': flag.setter
        },
        'name': flag.name,
        'status': flag.status
      }],
      'creator': {
        'name': att.creator
      }
    }, {
      'data-attachment-id': att.id
    });
  }

  $bug.querySelector('[id$="-tab-attachments"]').setAttribute('aria-hidden', 'false');
};

/* ----------------------------------------------------------------------------------------------
 * History
 * ---------------------------------------------------------------------------------------------- */

BzDeck.DetailsPage.history = {};

BzDeck.DetailsPage.history.render = function ($bug, history, addition = false) {
  let $placeholder = $bug.querySelector('[data-field="history"]');

  if (!$placeholder || !history.length) {
    return;
  }

  let datetime = FlareTail.util.datetime,
      conf_field = BzDeck.model.data.server.config.field,
      $tbody = $placeholder.querySelector('tbody'),
      $template = document.querySelector('#details-change');

  let cell_content = (field, content) =>
        ['blocks', 'depends_on'].indexOf(field) > -1
                ? content.replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>')
                : content.replace('@', '&#8203;@'); // ZERO WIDTH SPACE

  if (!addition) {
    $tbody.innerHTML = ''; // Remove the table rows
  }

  for (let hist of history) {
    for (let [i, change] of hist.changes.entries()) {
      let $row = $tbody.appendChild($template.content.cloneNode(true).firstElementChild),
          $cell = field => $row.querySelector('[data-field="' + field + '"]');

      if (i === 0) {
        $cell('who').innerHTML = hist.who.replace('@', '&#8203;@');
        $cell('who').rowSpan = $cell('when').rowSpan = hist.changes.length;
        datetime.fill_element($cell('when').appendChild(document.createElement('time')),
                              hist.when, { 'relative': false });
      } else {
        $cell('when').remove();
        $cell('who').remove();
      }

      let _field = conf_field[change.field_name] ||
                   // Bug 909055 - Field name mismatch in history: group vs groups
                   conf_field[change.field_name.replace(/s$/, '')] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change.field_name;

      $cell('what').textContent = _field.description;
      $cell('removed').innerHTML = cell_content(change.field_name, change.removed);
      $cell('added').innerHTML = cell_content(change.field_name, change.added);
    }
  }

  $bug.querySelector('[id$="-tab-history"]').setAttribute('aria-hidden', 'false');
};

/* ----------------------------------------------------------------------------------------------
 * Swipe navigation
 * ---------------------------------------------------------------------------------------------- */

BzDeck.DetailsPage.swipe = {};

BzDeck.DetailsPage.swipe.init = function () {
  let $tabpanels = document.querySelector('#main-tabpanels');

  $tabpanels.addEventListener('touchstart', this);
  $tabpanels.addEventListener('touchmove', this);
  $tabpanels.addEventListener('touchend', this);
};

BzDeck.DetailsPage.swipe.handleEvent = function (event) {
  let touch,
      delta;

  if (!BzDeck.toolbar.tablist.view.selected[0].id.startsWith('tab-details') ||
      !BzDeck.detailspage || !BzDeck.detailspage.data || !BzDeck.detailspage.data.bug_list.length) {
    return;
  }

  if (event.type.startsWith('touch')) {
    if (this.transitioning || event.changedTouches.length > 1) {
      return;
    }

    touch = event.changedTouches[0];
  }

  if (event.type === 'touchstart') {
    this.startX = touch.pageX;
    this.startY = touch.pageY;
    this.initialized = false;
  }

  if (event.type === 'touchmove' || event.type === 'touchend') {
    delta = touch.pageX - this.startX;

    if (!this.initialized) {
      // Exclude minor or vertical scroll
      if (Math.abs(delta) < 35 || Math.abs(delta) < Math.abs(touch.pageY - this.startY)) {
        return;
      }

      let bugs = [for (bug of BzDeck.detailspage.data.bug_list) bug.id],
          index = bugs.indexOf(BzDeck.detailspage.data.id);

      this.initialized = true;
      this.$target = BzDeck.detailspage.view.$tabpanel;
      this.$prev = document.querySelector('#tabpanel-details-' + bugs[index - 1]),
      this.$next = document.querySelector('#tabpanel-details-' + bugs[index + 1]);
      this.$sibling = null;

      if (this.$prev) {
        this.$prev.style.display = 'block';
        this.$prev.style.left = '-100%';
      }

      if (this.$next) {
        this.$next.style.display = 'block';
        this.$next.style.left = '100%';
      }
    }

    if (this.$prev && delta > 0) {
      this.$sibling = this.$prev;
    }

    if (this.$next && delta < 0) {
      this.$sibling = this.$next;
    }

    if (!this.$sibling) {
      return;
    }
  }

  if (event.type === 'touchmove') {
    this.$target.style.left = delta + 'px';
    this.$sibling.style.left = 'calc(' + (this.$sibling === this.$prev ? '-' : '') + '100% + '
                                       + delta + 'px)';
  }

  let cleanup = () => {
    if (!this.transitioning) {
      return;
    }

    this.$target.removeEventListener('transitionend', this);
    this.$target.removeAttribute('style');

    if (this.$prev) {
      this.$prev.removeAttribute('style');
    }

    if (this.$next) {
      this.$next.removeAttribute('style');
    }

    if (this.$sibling) {
      BzDeck.detailspage.navigate(Number.parseInt(this.$sibling.dataset.id));
    }

    delete this.startX;
    delete this.startY;
    delete this.initialized;
    delete this.transitioning;
    delete this.$target;
    delete this.$prev;
    delete this.$next;
    delete this.$sibling;
  };

  if (event.type === 'touchend') {
    this.transitioning = true;
    this.$target.addEventListener('transitionend', this);
    this.$target.style.left = delta > 0 ? '100%' : '-100%';
    this.$sibling.style.left = '0';

    // Sometimes the transitionend event doesn't get called. We should cleanup anyway.
    window.setTimeout(() => cleanup(), 600);
  }  

  if (event.type === 'transitionend' && event.propertyName === 'left') {
    cleanup();
  }
};
