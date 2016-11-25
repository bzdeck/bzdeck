/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Attachment Model that represents a downloaded or unuploaded bug attachment. Available through the
 * AttachmentCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html Bugzilla API}
 */
BzDeck.AttachmentModel = class AttachmentModel extends BzDeck.BaseModel {
  /**
   * Get an AttachmentModel instance.
   * @constructor
   * @param {Object} data - Bugzilla's raw attachment object or unuploaded attachment object.
   * @returns {Proxy} Proxified AttachmentModel instance, so consumers can seamlessly access attachment
   *  properties via attachment.prop instead of attachment.data.prop.
   */
  constructor (data) {
    super(data.id || data.hash); // Assign this.id; use the hash for unuploaded attachments

    this.data = data;

    // Delete old attachment data in the database
    if (this.data.data) {
      (async () => {
        const bug = await BzDeck.collections.bugs.get(this.data.bug_id);
        const index = bug && bug.attachments ? bug.attachments.findIndex(att => att.id === this.id) : -1;

        if (index > -1) {
          delete bug.attachments[index].data;
          bug.save();
        }
      })();
    }

    return this.proxy();
  }

  /**
   * Retrieve the attachment from Bugzilla.
   * @returns {Promise.<Proxy>} AttachmentModel instance.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#get-attachment Bugzilla API}
   */
  async fetch () {
    const result = await BzDeck.host.request(`bug/attachment/${this.id}`);

    this.data = result.attachments[this.id];

    return this.proxy();
  }

  /**
   * Get the attachment raw file data only. If it's not in the cache, retrieve the data from Bugzilla and save it in the
   * local database.
   * @returns {Promise.<Object>} Object containing the Blob and plaintext data, and this AttachmentModel.
   */
  async get_data () {
    const decode = data => new Promise(resolve => {
      const worker = new SharedWorker('/static/scripts/workers/tasks.js');

      worker.port.addEventListener('message', ({ data: { binary, blob }} = {}) => {
        const text = (this.is_patch || this.content_type.startsWith('text/')) ? binary : undefined;

        resolve({ blob, text, attachment: this });
      });

      worker.port.start();
      worker.port.postMessage(['decode', { str: data, type: this.content_type }]);
    });

    try {
      const result = await BzDeck.host.request(`bug/attachment/${this.id}`, new URLSearchParams('include_fields=data'));
      const attachment = result.attachments[this.id];
      const data = attachment && attachment.data ? attachment.data : undefined;

      if (!data) {
        throw new Error();
      }

      return decode(data);
    } catch (error) {
      throw new Error(`The attachment ${this.id} could not be retrieved from Bugzilla.`);
    }
  }

  /**
   * This method does nothing because attachment data is stored in the cache, but is required to avoid errors.
   * @override
   * @returns {Promise.<Proxy>} Proxified AttachmentModel instance.
   */
  async save () {
    return this.proxy();
  }
}
