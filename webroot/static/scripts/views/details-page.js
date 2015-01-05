/**
 * BzDeck Details Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.views = BzDeck.views || {};

BzDeck.views.DetailsPage = function DetailsPageView (id, ids = []) {
  let $tab = document.querySelector(`#tab-details-${id}`),
      $tabpanel = document.querySelector(`#tabpanel-details-${id}`);

  this.data = { id, ids };
  this.view = { $tab, $tabpanel };

  $tabpanel.setAttribute('aria-busy', 'true');

  FlareTail.util.event.async(() => {
    BzDeck.models.bugs.get_bug_by_id(id).then(bug => {
      // If no cache found, try to retrieve it from Bugzilla
      if (!bug) {
        this.fetch_bug(id);
        bug = { id };
      }

      // Prepare the newly opened tabpanel
      if (!$tabpanel.querySelector('[itemprop="id"]').itemValue) {
        this.prep_tabpanel($tabpanel, bug, ids);
        $tabpanel.removeAttribute('aria-busy');
        $tab.title = this.get_tab_title(bug);
        BzDeck.views.core.update_window_title($tab);
      }

      BzDeck.controllers.bugs.toggle_unread(id, false);
    });
  });

  BzDeck.controllers.bugzfeed.subscribe([id]);
};

BzDeck.views.DetailsPage.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.DetailsPage.prototype.constructor = BzDeck.views.DetailsPage;

BzDeck.views.DetailsPage.prototype.prep_tabpanel = function ($tabpanel, bug, ids) {
  $tabpanel = $tabpanel || this.get_fragment('tabpanel-details-template', bug.id).firstElementChild;

  this.$$bug = new BzDeck.views.Bug($tabpanel.querySelector('article'));
  this.$$bug.fill(bug);

  let mobile = FlareTail.util.ua.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)'),
      $tablist = $tabpanel.querySelector('[role="tablist"]'),
      $$tablist = new this.widget.TabList($tablist),
      $article = $tabpanel.querySelector('article'),
      $title = $tabpanel.querySelector('h2'),
      $timeline_content = $tabpanel.querySelector('.bug-timeline .scrollable-area-content'),
      $info_tab = $tabpanel.querySelector('[id$="-tab-info"]'),
      $timeline_tab = $tabpanel.querySelector('[id$="-tab-timeline"]'),
      $bug_info = $tabpanel.querySelector('.bug-info');

  if (mobile) {
    $timeline_content.insertBefore($title.cloneNode(true), $timeline_content.firstElementChild);
  }

  let change_layout = mql => {
    if (mql.matches) {  // Mobile layout
      $info_tab.setAttribute('aria-hidden', 'false');
      $tabpanel.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
    } else {
      if ($$tablist.view.selected[0] === $info_tab) {
        $$tablist.view.selected = $$tablist.view.$focused = $timeline_tab;
      }

      $info_tab.setAttribute('aria-hidden', 'true');
      $tabpanel.querySelector('article > div').appendChild($bug_info);
      $tablist.removeAttribute('aria-hidden');
    }
  };

  mql.addListener(change_layout);
  change_layout(mql);

  // Scroll a tabpanel to top when the tab is selected
  $$tablist.bind('Selected', event => {
    let $tabpanel = document.querySelector(`#${event.detail.items[0].getAttribute('aria-controls')}`);

    $tabpanel.querySelector('[role="region"]').scrollTop = 0; // Mobile
    $tabpanel.querySelector('.scrollable-area-content').scrollTop = 0; // Desktop
  });

  // Hide tabs when scrolled down on mobile
  if (mobile) {
    for (let $content of $tabpanel.querySelectorAll('.scrollable-area-content')) {
      let info = $content.parentElement.matches('.bug-info'),
          top = 0,
          hidden = false;

      $content.addEventListener('scroll', event => {
        if (!mql.matches && info) {
          return;
        }

        let _top = event.target.scrollTop,
            _hidden = top < _top;

        if (hidden !== _hidden) {
          hidden = _hidden;
          $tablist.setAttribute('aria-hidden', hidden);
        }

        top = _top;
      });
    }
  }

  // Set Back & Forward navigation
  if (ids.length) {
    this.setup_navigation($tabpanel, ids);
  }

  return $tabpanel;
};

BzDeck.views.DetailsPage.prototype.get_tab_title = function (bug) {
  return `Bug ${bug.id}\n${bug.summary || 'Loading...'}`; // l10n
};

BzDeck.views.DetailsPage.prototype.setup_navigation = function ($tabpanel, ids) {
  let $current_tabpanel = this.view.$tabpanel,
      Button = this.widget.Button,
      $toolbar = $tabpanel.querySelector('header [role="toolbar"]'),
      $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      index = ids.indexOf(this.data.id),
      prev = ids[index - 1],
      next = ids[index + 1],
      assign_key_binding = (key, command) => FlareTail.util.kbd.assign($tabpanel, { key: command });

  let change_button_tooltip = (id, $$button) => {
    BzDeck.models.bugs.get_bug_by_id(id).then(bug => {
      if (bug && bug.summary) {
        $$button.view.$button.title = `Bug ${id}\n${bug.summary}`; // l10n
      }
    });
  };

  if (prev) {
    change_button_tooltip(prev, $$btn_back);
    $$btn_back.data.disabled = false;
    $$btn_back.bind('Pressed', event => this.navigate(prev));
    assign_key_binding('B', event => this.navigate(prev));
  } else {
    $$btn_back.data.disabled = true;
  }

  if (next) {
    change_button_tooltip(next, $$btn_forward);
    $$btn_forward.data.disabled = false;
    $$btn_forward.bind('Pressed', event => this.navigate(next));
    assign_key_binding('F', event => this.navigate(next));
  } else {
    $$btn_forward.data.disabled = true;
  }
};

BzDeck.views.DetailsPage.prototype.fetch_bug = function (id) {
  if (!navigator.onLine) {
    BzDeck.views.statusbar.show('You have to go online to load the bug.'); // l10n

    return;
  }

  BzDeck.views.statusbar.show('Loading...'); // l10n

  BzDeck.controllers.bugs.fetch_bug(id).then(bug => {
    // Save in DB
    BzDeck.models.bugs.save_bug(bug);

    let $tab = document.querySelector(`#tab-details-${id}`),
        $tabpanel = this.view.$tabpanel;

    // Check if the tabpanel still exists
    if ($tabpanel) {
      BzDeck.views.statusbar.show('');
      // Update UI
      this.$$bug.fill(bug);
      $tab.title = this.get_tab_title(bug);
    }
  }).catch(bug => {
    BzDeck.views.statusbar.show('ERROR: Failed to load data.'); // l10n
  });
};

BzDeck.views.DetailsPage.prototype.navigate = function (id) {
  let $current_tab = this.view.$tab;

  BzDeck.router.navigate('/bug/' + id, { 'ids': this.data.ids });
  BzDeck.views.toolbar.$$tablist.close_tab($current_tab);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Attachments
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.DetailsPage.attachments = {};

BzDeck.views.DetailsPage.attachments.render = function ($bug, attachments, addition = false) {
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
    let $attachment = $placeholder.appendChild(
      FlareTail.util.content.get_fragment('details-attachment').firstElementChild);

    FlareTail.util.content.render($attachment, {
      'url': `/attachment/${att.id}`,
      'description': att.summary,
      'name': att.file_name,
      'contentSize': `${(att.size / 1024).toFixed(2)} KB`, // l10n
      'encodingFormat': att.is_patch ? 'Patch' : att.content_type, // l10n
      'uploadDate': att.creation_time,
      'flag': [for (flag of att.flags) {
        'creator': {
          'image': 'https://secure.gravatar.com/avatar/' + md5(flag.setter) + '?d=mm',
          'name': flag.setter, // email
          'email': flag.setter
        },
        'name': flag.name,
        'status': flag.status
      }],
      'creator': {
        'image': 'https://secure.gravatar.com/avatar/' + md5(att.creator) + '?d=mm',
        'name': att.creator, // email
        'email': att.creator
      }
    }, {
      'data-attachment-id': att.id
    });
  }

  $bug.querySelector('[id$="-tab-attachments"]').setAttribute('aria-disabled', 'false');
};

/* ------------------------------------------------------------------------------------------------------------------
 * History
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.DetailsPage.history = {};

BzDeck.views.DetailsPage.history.render = function ($bug, history, addition = false) {
  let $placeholder = $bug.querySelector('[data-field="history"]');

  if (!$placeholder || !history.length) {
    return;
  }

  let datetime = FlareTail.util.datetime,
      conf_field = BzDeck.models.data.server.config.field,
      $tbody = $placeholder.querySelector('tbody'),
      $template = document.querySelector('#details-change');

  let cell_content = (field, content) =>
        ['blocks', 'depends_on'].includes(field)
                ? content.replace(/(\d+)/g, '<a href="/bug/$1" data-bug-id="$1">$1</a>')
                : content.replace('@', '&#8203;@'); // ZERO WIDTH SPACE

  if (!addition) {
    $tbody.innerHTML = ''; // Remove the table rows
  }

  for (let hist of history) {
    for (let [i, change] of hist.changes.entries()) {
      let $row = $tbody.appendChild($template.content.cloneNode(true).firstElementChild),
          $cell = field => $row.querySelector(`[data-field="${field}"]`);

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
                   // Bug 1078009 - Changes/history now include some wrong field names
                   conf_field[{
                     'flagtypes.name': 'flag',
                     'attachments.description': 'attachment.description',
                     'attachments.ispatch': 'attachment.is_patch',
                     'attachments.isobsolete': 'attachment.is_obsolete',
                     'attachments.isprivate': 'attachment.is_private',
                     'attachments.mimetype': 'attachment.content_type',
                   }[change.field_name]] ||
                   // If the Bugzilla config is outdated, the field name can be null
                   change;

      $cell('what').textContent = _field.description || _field.field_name;
      $cell('removed').innerHTML = cell_content(change.field_name, change.removed);
      $cell('added').innerHTML = cell_content(change.field_name, change.added);
    }
  }

  $bug.querySelector('[id$="-tab-history"]').setAttribute('aria-disabled', 'false');
};

/* ------------------------------------------------------------------------------------------------------------------
 * Swipe navigation
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.DetailsPage.swipe = {};

BzDeck.views.DetailsPage.swipe.init = function () {
  let $tabpanels = document.querySelector('#main-tabpanels');

  $tabpanels.addEventListener('touchstart', this);
  $tabpanels.addEventListener('touchmove', this);
  $tabpanels.addEventListener('touchend', this);
};

BzDeck.views.DetailsPage.swipe.add_tabpanel = function (id, ids, position) {
  if (document.querySelector(`#tabpanel-details-${id}`)) {
    return;
  }

  BzDeck.models.bugs.get_bug_by_id(id).then(bug => {
    let page = BzDeck.views.pages.details,
        $tabpanel = page.prep_tabpanel(undefined, bug, ids),
        $ref = position === 'prev' ? page.view.$tabpanel : page.view.$tabpanel.nextElementSibling;

    $tabpanel.style.display = 'none';
    document.querySelector('#main-tabpanels').insertBefore($tabpanel, $ref);

    if (!bug.comments) {
      // Prefetch the bug
      BzDeck.controllers.bugs.fetch_bug(bug.id, false).then(bug_details => { // Exclude metadata
        bug = Object.assign(bug, bug_details); // Merge data
        BzDeck.models.bugs.save_bug(bug);
      });
    }
  });
};

BzDeck.views.DetailsPage.swipe.handleEvent = function (event) {
  let touch,
      delta,
      page = BzDeck.views.pages.details;

  if (!BzDeck.views.toolbar.$$tablist.view.selected[0].id.startsWith('tab-details') ||
      !page || !page.data || !page.data.ids.length) {
    return;
  }

  let ids = page.data.ids,
      index = ids.indexOf(page.data.id),
      prev_id = ids[index - 1],
      next_id = ids[index + 1];

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

    if (prev_id) {
      this.add_tabpanel(prev_id, ids, 'prev');
    }

    if (next_id) {
      this.add_tabpanel(next_id, ids, 'next');
    }
  }

  if (event.type === 'touchmove' || event.type === 'touchend') {
    delta = touch.pageX - this.startX;

    if (!this.initialized) {
      // Exclude minor or vertical scroll
      if (Math.abs(delta) < 35 || Math.abs(delta) < Math.abs(touch.pageY - this.startY)) {
        return;
      }

      this.initialized = true;
      this.$target = page.view.$tabpanel;
      this.$prev = document.querySelector(`#tabpanel-details-${prev_id}`);
      this.$next = document.querySelector(`#tabpanel-details-${next_id}`);
      this.$sibling = null;
      this.sibling_id = undefined;

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
      this.sibling_id = prev_id;
    }

    if (this.$next && delta < 0) {
      this.$sibling = this.$next;
      this.sibling_id = next_id;
    }

    if (!this.$sibling) {
      return;
    }
  }

  if (event.type === 'touchmove') {
    this.$target.style.left = `${delta}px`;
    this.$sibling.style.left = `calc(${this.$sibling === this.$prev ? '-100%' : '100%'} + ${delta}px)`;
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
      page.navigate(this.sibling_id);
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
