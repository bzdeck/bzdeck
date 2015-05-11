/**
 * BzDeck Bug Details View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.BugDetails = function BugDetailsView ($bug, bug) {
  let mql = window.matchMedia('(max-width: 1023px)');

  this.bug = bug;
  this.$bug = $bug;
  this.$tablist = this.$bug.querySelector('[role="tablist"]');
  this.$$tablist = new this.widget.TabList(this.$tablist);

  this.$$tablist.bind('Selected', event => {
    let $selected = event.detail.items[0],
        $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

    // Scroll a tabpanel to top when the tab is selected
    $tabpanel.querySelector('[role="region"]').scrollTop = 0; // Mobile
    $tabpanel.querySelector('.scrollable-area-content').scrollTop = 0; // Desktop

    // Desktop: Show the info pane only when the timeline tab is selected
    if (!mql.matches && FlareTail.util.ua.device.desktop) {
      this.$bug.querySelector('.bug-info').setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
    }
  });

  // Call BzDeck.views.Bug.prototype.init
  this.init();

  mql.addListener(mql => this.change_layout(mql));
  this.change_layout(mql);

  if (FlareTail.util.ua.device.mobile) {
    this.add_mobile_tweaks();
  }
};

BzDeck.views.BugDetails.prototype = Object.create(BzDeck.views.Bug.prototype);
BzDeck.views.BugDetails.prototype.constructor = BzDeck.views.BugDetails;

BzDeck.views.BugDetails.prototype.change_layout = function (mql) {
  let $info_tab = this.$bug.querySelector('[id$="-tab-info"]'),
      $participants_tab = this.$bug.querySelector('[id$="-tab-participants"]'),
      $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]'),
      $bug_info = this.$bug.querySelector('.bug-info'),
      $bug_participants = this.$bug.querySelector('.bug-participants');

  if (mql.matches || FlareTail.util.ua.device.mobile) {  // Mobile layout
    $info_tab.setAttribute('aria-hidden', 'false');
    $participants_tab.setAttribute('aria-hidden', 'false');
    this.$bug.querySelector('[id$="-tabpanel-info"]').appendChild($bug_info);
    this.$bug.querySelector('[id$="-tabpanel-participants"]').appendChild($bug_participants);
  } else {
    if ([$info_tab, $participants_tab].includes(this.$$tablist.view.selected[0])) {
      this.$$tablist.view.selected = this.$$tablist.view.$focused = $timeline_tab;
    }

    $info_tab.setAttribute('aria-hidden', 'true');
    $participants_tab.setAttribute('aria-hidden', 'true');
    this.$bug.querySelector('article > div').appendChild($bug_info);
    this.$bug.querySelector('article > div').appendChild($bug_participants);
    this.$tablist.removeAttribute('aria-hidden');
  }
};

BzDeck.views.BugDetails.prototype.add_mobile_tweaks = function () {
  let mql = window.matchMedia('(max-width: 1023px)');

  // Hide tabs when scrolled down on mobile
  for (let $content of this.$bug.querySelectorAll('.scrollable-area-content')) {
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
        this.$tablist.setAttribute('aria-hidden', hidden);
      }

      top = _top;
    });
  }
};

BzDeck.views.BugDetails.prototype.render_attachments = function (attachments) {
  let $attachments = this.$bug.querySelector('[data-field="attachments"]');

  if (!$attachments) {
    return;
  }

  if (!attachments) {
    attachments = this.bug.attachments;

    for (let $attachment of $attachments.querySelectorAll('[itemprop="attachment"]')) {
      $attachment.remove();
    }
  }

  let len = attachments.length;

  if (!len) {
    return;
  }

  let mobile = FlareTail.util.ua.device.mobile,
      mql = window.matchMedia('(max-width: 1023px)'),
      $show_obsolete_checkbox = $attachments.querySelector('.list [role="checkbox"]'),
      $$show_obsolete_checkbox = new this.widget.Checkbox($show_obsolete_checkbox),
      $listbox = $attachments.querySelector('[role="listbox"]'),
      $fragment = new DocumentFragment(),
      $title = $attachments.querySelector('h4'),
      $listitem = FlareTail.util.content.get_fragment('details-attachment-listitem').firstElementChild,
      $content = FlareTail.util.content.get_fragment('details-attachment-content').firstElementChild;

  if (!this.$$attachment_list) {
    this.$$attachment_list = new this.widget.ListBox($listbox, []);

    this.$$attachment_list.bind('click', event => {
      let $selected = this.$$attachment_list.view.selected[0];

      if ($selected && mobile && mql.matches) {
        window.open(`${BzDeck.models.server.url}/attachment.cgi?id=${$selected.dataset.id}`);
      }
    });

    this.$$attachment_list.bind('Selected', event => {
      if (!event.detail.items[0] || (mobile && mql.matches)) {
        return;
      }

      let att = [for (att of attachments) if (att.id === Number.parseInt(event.detail.items[0].dataset.id)) att][0],
          $placeholder = $attachments.querySelector('.content');

      $placeholder.innerHTML = '';

      let $attachment = this.fill($placeholder.appendChild($content.cloneNode(true)), {
        'url': `/attachment/${att.id}`,
        'description': att.summary,
        'name': att.file_name,
        'contentSize': `${(att.size / 1024).toFixed(2)} KB`, // l10n
        'encodingFormat': att.is_patch ? 'text/x-patch' : att.content_type,
        'is_obsolete': att.is_obsolete ? 'true' : 'false',
        'dateCreated': att.creation_time,
        'dateModified': att.last_change_time,
        'creator': BzDeck.collections.users.get(att.creator, { 'name': att.creator }).properties,
        'flag': [for (flag of att.flags) {
          'creator': BzDeck.collections.users.get(flag.setter, { 'name': flag.setter }).properties,
          'name': flag.name,
          'status': flag.status
        }],
      }, {
        'data-attachment-id': att.id,
        'data-content-type': att.is_patch ? 'text/x-patch' : att.content_type,
      });

      let media_type = att.content_type.split('/')[0],
          $body = $attachment.querySelector('.body'),
          $scrollable,
          $media,
          $error = document.createElement('p');

      this.scrollbars.add(new this.widget.ScrollBar($body));
      $scrollable = $body.querySelector('.scrollable-area-content');

      if (media_type === 'image') {
        $media = new Image();
        $media.alt = '';
      }

      if (media_type === 'audio' || media_type === 'video') {
        $media = document.createElement(media_type);
        $media.controls = true;
    
        if ($media.canPlayType(att.content_type) === '') {
          $media = null; // Cannot play the media
        }
      }

      // Render the image, video or audio
      if ($media) {
        $body.setAttribute('aria-busy', 'true');

        this.bug.get_attachment_data(att.id).then(result => {
          $media.src = URL.createObjectURL(result.blob);
          $media.itemProp.add('url');
          $scrollable.appendChild($media);
          $body.classList.add('media');
        }, error => {
          $error.classList.add('error');
          $error.textContent = error.message;
          $error = $scrollable.appendChild($error);
        }).then(() => {
          $body.removeAttribute('aria-busy');
        });

        return;
      }

      // Render the patch with the Patch Viewer
      if (att.is_patch) {
        $body.setAttribute('aria-busy', 'true');

        this.bug.get_attachment_data(att.id, 'text').then(result => {
          FlareTail.util.event.async(() => $scrollable.appendChild(new BzDeck.helpers.PatchViewer(result.text)));
          $body.classList.add('patch');
        }, error => {
          $error.classList.add('error');
          $error.textContent = error.message;
          $error = $scrollable.appendChild($error);
        }).then(() => {
          $body.removeAttribute('aria-busy');
          FlareTail.util.event.async(() => this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height()));
        });

        return;
      }

      // Show a link to the file
      {
        let $link = document.createElement('a');

        $link.href = `/attachment/${att.id}`;
        $link.text = {
          'text/x-github-pull-request': 'See the GitHub Pull Request',
          'text/x-review-board-request': 'See the Review Board Request',
          'application/pdf': 'Open the PDF file',
          'application/msword': 'Open the Word file',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'Open the Word file',
          'application/vnd.ms-excel': 'Open the Excel file',
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'Open the Excel file',
          'application/vnd.ms-powerpoint': 'Open the PowerPoint file',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation': 'Open the PowerPoint file',
          'application/zip': 'Open the zip archive',
          'application/gzip': 'Open the gzip archive',
          'application/x-gzip': 'Open the gzip archive',
          'application/x-bzip2': 'Open the bzip2 archive',
        }[att.content_type] || 'Open the file';
        $link.setAttribute('data-attachment-id', att.id);

        $scrollable.appendChild($link);
        $body.classList.add('link');
      }
    });
  }

  for (let att of attachments) {
    this.fill($fragment.appendChild($listitem.cloneNode(true)), {
      'id': att.id,
      'description': att.summary,
      'dateModified': att.last_change_time,
      'creator': BzDeck.collections.users.get(att.creator, { 'name': att.creator }).properties,
      'encodingFormat': att.is_patch ? 'text/x-patch' : att.content_type, // l10n
      'is_obsolete': att.is_obsolete ? 'true' : 'false',
    }, {
      'id': `bug-${att.bug_id}-attachment-${att.id}`,
      'aria-disabled': !!att.is_obsolete,
      'data-id': att.id,
      'data-obsolete': att.is_obsolete ? 'true' : 'false',
    });
  }

  $title.textContent = len === 1 ? `${len} attachment` : `${len} attachments`; // l10n

  $show_obsolete_checkbox.setAttribute('aria-hidden', ![for (att of attachments) if (att.is_obsolete) att].length);
  $$show_obsolete_checkbox.bind('Toggled', event => {
    let checked = event.detail.checked;

    for (let $att of $listbox.querySelectorAll('[role="option"]')) {
      $att.setAttribute('aria-disabled', checked ? 'false' : $att.properties.is_obsolete[0].itemValue);
    }

    this.$$attachment_list.update_members();
    FlareTail.util.event.async(() => this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height()));
  });

  $listbox.appendChild($fragment);
  $listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$attachment_list.update_members();

  let $first_attachment = $listbox.querySelector('[role="option"][aria-disabled="false"]');

  // Select the first non-obsolete attachment
  if ($first_attachment && !mobile && !mql.matches) {
    this.$$attachment_list.view.selected = $first_attachment;
  }

  this.$bug.querySelector('[id$="-tab-attachments"]').setAttribute('aria-disabled', 'false');

  // Force updating the scrollbars because sometimes those are not automatically updated
  FlareTail.util.event.async(() => this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height()));
};

BzDeck.views.BugDetails.prototype.render_history = function (history) {
  let $placeholder = this.$bug.querySelector('[data-field="history"]');

  if (!$placeholder) {
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

  if (!history) {
    history = this.bug.history;
    $tbody.innerHTML = ''; // Remove the table rows
  }

  if (!history.length) {
    return;
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

  this.$bug.querySelector('[id$="-tab-history"]').setAttribute('aria-disabled', 'false');
};
