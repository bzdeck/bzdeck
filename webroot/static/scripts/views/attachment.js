/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Attachment = function AttachmentView (attachment, $placeholder) {
  this.$placeholder = $placeholder;
  this.attachment = new BzDeck.models.Attachment(attachment);

  this.show();
};

BzDeck.views.Attachment.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Attachment.prototype.constructor = BzDeck.views.Attachment;

BzDeck.views.Attachment.prototype.show = function () {
  let att = this.attachment,
      $_content = this.get_fragment('details-attachment-content').firstElementChild.cloneNode(true);

  $_content.itemProp.add('attachment');
  this.$placeholder.innerHTML = '';

  let $attachment = this.fill(this.$placeholder.appendChild($_content), {
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
      $outer = $attachment.querySelector('.body'),
      $media,
      $error = document.createElement('p');

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
    $outer.setAttribute('aria-busy', 'true');

    att.get_data().then(result => {
      $media.src = URL.createObjectURL(result.blob);
      $media.itemProp.add('url');
      $outer.appendChild($media);
      $attachment.classList.add('media');
    }, error => {
      $error.classList.add('error');
      $error.textContent = error.message;
      $error = $outer.appendChild($error);
    }).then(() => {
      $outer.removeAttribute('aria-busy');
    });

    return;
  }

  // Render the patch with the Patch Viewer
  if (att.is_patch) {
    $outer.setAttribute('aria-busy', 'true');

    att.get_data('text').then(result => {
      FlareTail.util.event.async(() => $outer.appendChild(new BzDeck.helpers.PatchViewer(result.text)));
      $attachment.classList.add('patch');
    }, error => {
      $error.classList.add('error');
      $error.textContent = error.message;
      $error = $outer.appendChild($error);
    }).then(() => {
      $outer.removeAttribute('aria-busy');
    });

    return;
  }

  // Show a link to the file
  {
    let $link = document.createElement('a');

    $link.href = `${BzDeck.models.server.url}/attachment.cgi?id=${att.id}`;
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
    }[att.content_type] || 'Open the file';
    $outer.appendChild($link);
    $attachment.classList.add('link');
  }
};
