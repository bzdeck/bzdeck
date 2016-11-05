/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Attachment View that represents an attachment displayed in the Bug Details page or Attachment page.
 * @extends BzDeck.BaseView
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#get-attachment}
 */
BzDeck.AttachmentView = class AttachmentView extends BzDeck.BaseView {
  /**
   * Get a AttachmentView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {(Number|String)} att_id - Numeric ID for an existing file or md5 hash for an unuploaded file.
   * @param {HTMLElement} $placeholder - Node to show the attachment.
   * @returns {Object} view - New AttachmentView instance.
   */
  constructor (id, att_id, $placeholder) {
    super(id); // Assign this.id

    this.att_id = att_id;
    this.$placeholder = $placeholder;

    // Subscribe to events
    this.subscribe_safe('P#AttachmentAvailable');
    this.subscribe_safe('P#AttachmentUnavailable');
    this.subscribe('P#LoadingStarted');
    this.subscribe('P#LoadingError');

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.AttachmentPresenter(this.id, this.att_id);

    this.presenter.get_attachment();
  }

  /**
   * Called when the attachment is found. Render it on the page.
   * @listens AttachmentPresenter#AttachmentAvailable
   * @param {Proxy} attachment - Prepared attachment data.
   * @returns {undefined}
   */
  on_attachment_available ({ attachment } = {}) {
    this.attachment = attachment;

    this.$attachment = this.fill(this.get_template('details-attachment-content'), attachment, {
      'data-att-id': attachment.id, // existing attachment
      'data-att-hash': attachment.hash, // unuploaded attachment
      'data-content-type': attachment.content_type,
    });

    this.activate_widgets();
    this.render();
  }

  /**
   * Called when the attachment is not found. Show an error message on the page.
   * @listens AttachmentPresenter#AttachmentUnavailable
   * @param {String} message - Error message.
   * @returns {undefined}
   */
  on_attachment_unavailable ({ message } = {}) {
    const id = this.att_id;

    BzDeck.views.statusbar.show(`The attachment ${id} could not be retrieved. ${message}`); // l10n
  }

  /**
   * Called when loading the attachment started. Show a message accordingly.
   * @listens AttachmentPresenter#LoadingStarted
   * @param {undefined}
   * @returns {undefined}
   */
  on_loading_started () {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  }

  /**
   * Activate the editable widgets including textboxes and checkboxes.
   * @param {undefined}
   * @fires AttachmentView#EditAttachment
   * @returns {undefined}
   */
  activate_widgets () {
    const { id, hash } = this.attachment;

    for (const $prop of this.$attachment.querySelectorAll('[itemprop]')) {
      // Check if the element is in the same itemscope
      if ($prop.parentElement.closest('[itemscope]') !== this.$attachment) {
        continue;
      }

      const prop = $prop.getAttribute('itemprop');
      const trigger = value => this.trigger('AttachmentView#EditAttachment', { id, hash, prop, value });

      if ($prop.matches('[role="textbox"]')) {
        const $$textbox = new FlareTail.widgets.TextBox($prop);

        $$textbox.bind('Edited', event => {
          const value = event.detail.value;

          if (value) {
            trigger(value);
          } else {
            // The property value cannot be empty; fill the default value
            $$textbox.value = this.attachment[prop];
          }
        });
      }

      if ($prop.matches('[role="checkbox"]')) {
        (new FlareTail.widgets.CheckBox($prop)).bind('Toggled', event => trigger(event.detail.checked));
      }
    }

    new FlareTail.widgets.ScrollBar($attachment);
    new BzDeck.BugFlagsView(this.id, this.attachment.bug, this.attachment)
        .render(this.$attachment.querySelector('.flags'), 6);
  }

  /**
   * Start rendering the attachment in the placeholder.
   * @param {undefined}
   * @returns {undefined}
   */
  render () {
    const media_type = this.attachment.content_type.split('/')[0];

    this.$attachment.setAttribute('itemprop', 'attachment');
    this.$placeholder.innerHTML = '';
    this.$placeholder.appendChild(this.$attachment);

    this.$outer = this.$attachment.querySelector('.body');

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
  }

  /**
   * Render an image, video or audio.
   * @param {undefined}
   * @returns {Promise.<undefined>}
   */
  async render_media () {
    this.$outer.setAttribute('aria-busy', 'true');

    try {
      const result = await this.attachment.get_data();

      this.$media.src = URL.createObjectURL(result.blob);
      this.$media.setAttribute('itemprop', 'url');
      this.$outer.appendChild(this.$media);
      this.$attachment.classList.add('media');
    } catch (error) {
      this.render_error(error);
    }

    this.$outer.removeAttribute('aria-busy');
  }

  /**
   * Render a patch with the Patch Viewer.
   * @param {undefined}
   * @returns {Promise.<undefined>}
   */
  async render_patch () {
    this.$outer.setAttribute('aria-busy', 'true');

    try {
      const result = await this.attachment.get_data('text');

      (async () => this.$outer.appendChild(new BzDeck.PatchViewerView(this.id, result.text)))();
      this.$attachment.classList.add('patch');
    } catch (error) {
      this.render_error(error);
    }

    this.$outer.removeAttribute('aria-busy');
  }

  /**
   * Render a link to the binary file, GitHub pull request or Review Board request.
   * @param {undefined}
   * @returns {undefined}
   */
  render_link () {
    const $link = document.createElement('a');

    $link.href = `${BzDeck.host.origin}/attachment.cgi?id=${this.attachment.id || this.attachment.hash}`;
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
  }

  /**
   * Render an error message when the attachment data could not be retrieved from the cache nor Bugzilla.
   * @param {Error} error - Error object.
   * @returns {undefined}
   */
  render_error (error) {
    const $error = document.createElement('p');

    $error.textContent = error.message;
    this.$outer.appendChild($error);
    this.$attachment.classList.add('error');
  }
}
