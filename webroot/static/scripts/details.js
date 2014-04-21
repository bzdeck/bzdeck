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

  this.data = {
    id: id,
    bug_list: bug_list
  };

  this.view = {
    $tab: null,
    $tabpanel: null
  };

  if (bug_list.length) {
    this.open([bug for (bug of bug_list) if (bug.id === id)][0], bug_list);

    return;
  }

  BzDeck.model.get_bug_by_id(id, bug => {
    // If no cache found, try to retrieve it from Bugzilla
    if (!bug) {
      this.fetch_bug(id);
      bug = { id: id };
    }

    this.open(bug);
  });
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

    $tabpanel.querySelector('[role="checkbox"][data-field="_starred"]')
             .setAttribute('aria-checked', event.detail.ids.has(bug.id));
  });
};

BzDeck.DetailsPage.prototype.prep_tabpanel = function (bug) {
  let $template = document.querySelector('template#tabpanel-details'),
      $tabpanel = BzDeck.global.fill_template($template.content, bug, true),
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      phone = FlareTail.util.device.type === 'mobile-phone',
      $tablist = $tabpanel.querySelector('[role="tablist"]'),
      _tablist = new FlareTail.widget.TabList($tablist),
      $article = $tabpanel.querySelector('article'),
      $header = $tabpanel.querySelector('header'),
      $timeline_content = $tabpanel.querySelector('.bug-timeline .scrollable-area-content'),
      $info_tab = $tabpanel.querySelector('[id$="-tab-info"]'),
      $timeline_tab = $tabpanel.querySelector('[id$="-tab-timeline"]'),
      $bug_info = $tabpanel.querySelector('.bug-info');

  if (mobile) {
    $timeline_content.insertBefore($header, $timeline_content.firstElementChild);
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
      bugs = [id for ({ id } of bug_list)],
      index = bugs.indexOf(this.data.id),
      prev = bugs[index - 1],
      next = bugs[index + 1],
      set_keybind = FlareTail.util.event.set_keybind;

  let preload = id => {
    if (document.querySelector('#tabpanel-details-' + id)) {
      return;
    }

    BzDeck.model.get_bug_by_id(id, bug => {
      let $tabpanel = this.prep_tabpanel(bug);

      $tabpanel.setAttribute('aria-hidden', 'true');
      document.querySelector('#main-tabpanels').insertBefore(
        $tabpanel,
        id === prev ? $current_tabpanel : $current_tabpanel.nextElementSibling
      );

      if (!bug.comments) {
        this.prefetch_bug(id);
      }
    });
  };

  let change_button_tooltip = (id, button) => {
    let bug = [bug for (bug of bug_list) if (bug.id === id)][0];

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
    BzDeck.global.show_status('You have to go online to load a bug.'); // l10n

    return;
  }

  BzDeck.global.show_status('Loading...'); // l10n

  let api = BzDeck.options.api,
      query = FlareTail.util.request.build_query({
        include_fields: [...api.default_fields, ...api.extra_fields].join(),
        exclude_fields: 'attachments.data'
      });

  BzDeck.core.request('GET', 'bug/' + id + query, bug => {
    if (!bug || !bug.id) {
      BzDeck.global.show_status('ERROR: Failed to load data.'); // l10n

      return;
    }

    // Save in DB
    BzDeck.model.save_bug(bug);

    let $tab = document.querySelector('#tab-details-' + id),
        $tabpanel = this.view.$tabpanel;

    // Check if the tabpanel still exists
    if ($tabpanel) {
      BzDeck.global.show_status('');
      // Update UI
      BzDeck.global.fill_template($tabpanel, bug);
      $tab.title = this.get_tab_title(bug);
    }
  });
};

BzDeck.DetailsPage.prototype.prefetch_bug = function (id) {
  let api = BzDeck.options.api,
      query = FlareTail.util.request.build_query({
        include_fields: [...api.default_fields, ...api.extra_fields].join(),
        exclude_fields: 'attachments.data'
      });

  BzDeck.core.request('GET', 'bug/' + id + query, bug => {
    if (bug && bug.id) {
      BzDeck.model.save_bug(bug);
    }
  });
};

BzDeck.DetailsPage.prototype.navigate = function (id) {
  BzDeck.toolbar.tablist.close_tab(this.view.$tab);
  BzDeck.detailspage = new BzDeck.DetailsPage(id, this.data.bug_list);
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

      let bugs = [bug.id for (bug of BzDeck.detailspage.data.bug_list)],
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
