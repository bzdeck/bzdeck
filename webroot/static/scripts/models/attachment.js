/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Attachment Model that represents a downloaded or unuploaded bug attachment. Available through the
 * AttachmentCollection.
 * @extends BzDeck.BaseModel
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html}
 */
BzDeck.AttachmentModel = class AttachmentModel extends BzDeck.BaseModel {
  /**
   * Get an AttachmentModel instance.
   * @constructor
   * @param {Object} data - Bugzilla's raw attachment object or unuploaded attachment object.
   * @returns {Proxy} attachment - Proxified AttachmentModel instance, so consumers can seamlessly access attachment
   *  properties via attachment.prop instead of attachment.data.prop.
   */
  constructor(data) {
    super(); // This does nothing but is required before using `this`

    this.id = data.id || data.hash; // Use the hash for unuploaded attachments
    this.data = data;

    return this.proxy();
  }

  /**
   * Retrieve the attachment from Bugzilla.
   * @param {undefined}
   * @returns {Promise.<Proxy>} attachment - Promise to be resolved in the AttachmentModel instance.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#get-attachment}
   */
  fetch () {
    return BzDeck.host.request(`bug/attachment/${this.id}`).then(result => {
      this.data = result.attachments[this.id];

      return Promise.resolve(this.proxy());
    });
  }

  /**
   * Get the attachment raw file data only. If it's not in the cache, retrieve the data from Bugzilla and save it in the
   * local database.
   * @param {undefined}
   * @returns {Promise.<Object>} data - Promise to be resolved in an object containing the Blob and plaintext data, and
   *  this AttachmentModel.
   */
  get_data () {
    let decode = () => new Promise(resolve => {
      let worker = new SharedWorker('/static/scripts/workers/tasks.js');

      worker.port.addEventListener('message', ({ data: { binary, blob }} = {}) => {
        let text = (this.is_patch || this.content_type.startsWith('text/')) ? binary : undefined;

        resolve({ blob, text, attachment: this });
      });

      worker.port.start();
      worker.port.postMessage(['decode', { str: this.data.data, type: this.content_type }]);
    });

    if (this.data.data) {
      return Promise.resolve(decode());
    }

    return BzDeck.host.request(`bug/attachment/${this.id}`, new URLSearchParams('include_fields=data')).then(result => {
      let attachment = result.attachments[this.id];
      let data = attachment && attachment.data ? attachment.data : undefined;

      if (!data) {
        return Promise.reject();
      }

      this.data.data = data;
      BzDeck.collections.attachments.set(this.id, this.data);
      this.save();

      return Promise.resolve(decode());
    }).catch(error => {
      return Promise.reject(new Error(`The attachment ${this.id} could not be retrieved from Bugzilla.`));
    });
  }

  /**
   * Save this attachment as part of the relevant bug.
   * @override
   * @param {undefined}
   * @returns {Promise.<Proxy>} item - Promise to be resolved in the proxified AttachmentModel instance.
   */
  save () {
    return BzDeck.collections.bugs.get(this.data.bug_id).then(bug => {
      if (bug && bug.attachments && bug.attachments.length) {
        for (let [index, att] of bug.attachments.entries()) if (att.id === this.id && !att.data) {
          bug.attachments[index].data = this.data.data;
        }

        bug.save(bug.data);
      }
    }).then(() => this.proxy());
  }
}
