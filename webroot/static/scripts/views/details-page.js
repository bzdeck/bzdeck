/**
 * BzDeck Details Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.DetailsPage = function DetailsPageView (id, ids = []) {
  this.id = id;
  this.ids = ids;

  this.$tab = document.querySelector(`#tab-details-${id}`);
  this.$tabpanel = document.querySelector(`#tabpanel-details-${id}`);
  this.$tabpanel.setAttribute('aria-busy', 'true');

  this.on('C:BugDataReady', data => {
    // Prepare the newly opened tabpanel
    if (!this.$bug) {
      this.prep_tabpanel(this.$tabpanel, data.bug, this.ids);
      this.$tabpanel.removeAttribute('aria-busy');
      this.$tab.title = this.get_tab_title(data.bug);
      this.update_window_title(this.$tab);
    }
  });

  this.on('C:Offline', data => {
    BzDeck.views.statusbar.show('You have to go online to load the bug.'); // l10n
  });

  this.on('C:LoadingStarted', data => {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  });

  this.on('C:LoadingComplete', data => {
    // Check if the tabpanel still exists
    if (this.$tabpanel) {
      BzDeck.views.statusbar.show('');
      // Update UI
      this.$$bug.bug = data.bug;
      this.$$bug.render();
      this.$tab.title = this.get_tab_title(data.bug);
    }
  });

  this.on('C:LoadingError', data => {
    BzDeck.views.statusbar.show('ERROR: Failed to load data.'); // l10n
  });
};

BzDeck.views.DetailsPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.DetailsPage.prototype.constructor = BzDeck.views.DetailsPage;

BzDeck.views.DetailsPage.prototype.prep_tabpanel = function ($tabpanel, bug, ids) {
  $tabpanel = $tabpanel || this.get_fragment('tabpanel-details-template', bug.id).firstElementChild;

  this.$bug = $tabpanel.appendChild(this.get_fragment('bug-details-template', bug.id).firstElementChild);
  this.$$bug = new BzDeck.views.Bug(this.$bug, bug);
  this.$bug.removeAttribute('aria-hidden');

  let mobile = FlareTail.util.ua.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)'),
      $tablist = $tabpanel.querySelector('[role="tablist"]'),
      $$tablist = new this.widget.TabList($tablist),
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
  let $current_tabpanel = this.$tabpanel,
      Button = this.widget.Button,
      $toolbar = $tabpanel.querySelector('header [role="toolbar"]'),
      $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
      $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
      index = ids.indexOf(this.id),
      prev = ids[index - 1],
      next = ids[index + 1],
      assign_key_binding = (key, command) => FlareTail.util.kbd.assign($tabpanel, { key: command });

  let change_button_tooltip = (id, $$button) => {
    BzDeck.models.bugs.get(id).then(bug => {
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

BzDeck.views.DetailsPage.prototype.navigate = function (id) {
  let $current_tab = this.$tab;

  BzDeck.router.navigate('/bug/' + id, { 'ids': this.ids });
  BzDeck.views.toolbar.$$tablist.close_tab($current_tab);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Attachments
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.DetailsPageAttachments = function DetailsPageAttachmentsView ($bug, attachments, addition = false) {
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

    this.fill($attachment, {
      'url': `/attachment/${att.id}`,
      'description': att.summary,
      'name': att.file_name,
      'contentSize': `${(att.size / 1024).toFixed(2)} KB`, // l10n
      'encodingFormat': att.is_patch ? 'Patch' : att.content_type, // l10n
      'uploadDate': att.creation_time,
      'creator': BzDeck.controllers.users.get(att.creator).properties,
      'flag': [for (flag of att.flags) {
        'creator': BzDeck.controllers.users.get(flag.setter).properties,
        'name': flag.name,
        'status': flag.status
      }],
    }, {
      'data-attachment-id': att.id
    });
  }

  $bug.querySelector('[id$="-tab-attachments"]').setAttribute('aria-disabled', 'false');
};

BzDeck.views.DetailsPageAttachments.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.DetailsPageAttachments.prototype.constructor = BzDeck.views.DetailsPageAttachments;

/* ------------------------------------------------------------------------------------------------------------------
 * History
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.DetailsPageHistory = function DetailsPageHistoryView ($bug, history, addition = false) {
  let $placeholder = $bug.querySelector('[data-field="history"]');

  if (!$placeholder || !history.length) {
    return;
  }

  let datetime = FlareTail.util.datetime,
      conf_field = BzDeck.models.server.data.config.field,
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

BzDeck.views.DetailsPageHistory.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.DetailsPageHistory.prototype.constructor = BzDeck.views.DetailsPageHistory;
