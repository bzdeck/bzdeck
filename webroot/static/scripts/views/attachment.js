/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Attachment View.
 *
 * [argument] attachment (Proxy) AttachmentModel instance
 * [argument] $placeholder (Element) node to show the attachment
 * [return] view (Object) AttachmentView instance, when called with `new`
 */
BzDeck.views.Attachment = function AttachmentView (attachment, $placeholder) {
  let att = this.attachment = attachment,
      get_person = name => BzDeck.collections.users.get(name, { name }).properties;

  this.bug = BzDeck.collections.bugs.get(att.bug_id);
  this.$placeholder = $placeholder;

  this.$attachment = this.fill(this.get_template('details-attachment-content'), {
    summary: att.summary,
    file_name: att.file_name,
    size: `${(att.size / 1024).toFixed(2)} KB`, // l10n
    content_type: att.content_type,
    is_patch: !!att.is_patch,
    is_obsolete: !!att.is_obsolete,
    creation_time: att.creation_time,
    last_change_time: att.last_change_time,
    creator: get_person(att.creator),
  }, {
    'data-att-id': att.id, // existing attachment
    'data-att-hash': att.hash, // unuploaded attachment
    'data-content-type': att.content_type,
  });

  this.$outer = this.$attachment.querySelector('.body');

  new BzDeck.views.BugFlags(this.bug, att).render(this.$attachment.querySelector('.flags'), 6);

  this.activate();
  this.render();
};

BzDeck.views.Attachment.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Attachment.prototype.constructor = BzDeck.views.Attachment;

/**
 * Activate the editable widgets.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.Attachment.prototype.activate = function () {
  let { id, hash } = this.attachment;

  for (let $prop of this.$attachment.querySelectorAll('[itemprop]')) {
    // Check if the element is in the same itemscope
    if ($prop.parentElement.closest('[itemscope]') !== this.$attachment) {
      continue;
    }

    let prop = $prop.getAttribute('itemprop'),
        trigger = value => this.trigger('AttachmentView:EditAttachment', { id, hash, prop, value });

    if ($prop.matches('[role="textbox"]')) {
      let $$textbox = new this.widgets.TextBox($prop);

      $$textbox.bind('Edited', event => {
        let value = event.detail.value;

        if (value) {
          trigger(value);
        } else {
          // The property value cannot be empty; fill the default value
          $$textbox.value = this.attachment[prop];
        }
      });
    }

    if ($prop.matches('[role="checkbox"]')) {
      (new this.widgets.CheckBox($prop)).bind('Toggled', event => trigger(event.detail.checked));
    }
  }
};

/**
 * Render the attachment on the placeholder.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.Attachment.prototype.render = function () {
  let media_type = this.attachment.content_type.split('/')[0];

  this.$attachment.setAttribute('itemprop', 'attachment');
  this.$placeholder.innerHTML = '';
  this.$placeholder.appendChild(this.$attachment);

  if (media_type === 'image') {
    this.$media = new Image();
    this.$media.alt = '';
  }

  if (media_type === 'audio' || media_type === 'video') {
    this.$media = document.createElement(media_type);
    this.$media.controls = true;

    if (this.$media.canPlayType(this.attachment.content_type) === '') {
      delete this.$media; // Cannot play the media
    }
  }

  if (this.$media) {
    this.render_media();
  } else if (this.attachment.is_patch) {
    this.render_patch();
  } else {
    this.render_link();
  }
};

/**
 * Render the image, video or audio.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.Attachment.prototype.render_media = function () {
  this.$outer.setAttribute('aria-busy', 'true');

  this.attachment.get_data().then(result => {
    this.$media.src = URL.createObjectURL(result.blob);
    this.$media.setAttribute('itemprop', 'url');
    this.$outer.appendChild(this.$media);
    this.$attachment.classList.add('media');
  }, error => {
    this.render_error(error);
  }).then(() => {
    this.$outer.removeAttribute('aria-busy');
  });
};

/**
 * Render the patch with the Patch Viewer.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.Attachment.prototype.render_patch = function () {
  this.$outer.setAttribute('aria-busy', 'true');

  this.attachment.get_data('text').then(result => {
    this.helpers.event.async(() => this.$outer.appendChild(new BzDeck.views.PatchViewer(result.text)));
    this.$attachment.classList.add('patch');
  }, error => {
    this.render_error(error);
  }).then(() => {
    this.$outer.removeAttribute('aria-busy');
  });
};

/**
 * Render a link to the file.
 *
 * [argument] none
 * [return] none
 */
BzDeck.views.Attachment.prototype.render_link = function () {
  let $link = document.createElement('a');

  $link.href = `${BzDeck.models.server.url}/attachment.cgi?id=${this.attachment.id || this.attachment.hash}`;
  $link.text = {
    'text/x-github-pull-request': 'See the GitHub pull request',
    'text/x-review-board-request': 'See the Review Board request',
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
  }[this.attachment.content_type] || 'Open the file';

  this.$outer.appendChild($link);
  this.$attachment.classList.add('link');
};

/**
 * Render an error message when the attachment cannot be retrieved.
 *
 * [argument] error (Error) error object
 * [return] none
 */
BzDeck.views.Attachment.prototype.render_error = function (error) {
  let $error = document.createElement('p');

  $error.textContent = error.message;
  this.$outer.appendChild($error);
  this.$attachment.classList.add('error');
};
