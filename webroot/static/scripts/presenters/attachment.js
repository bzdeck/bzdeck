/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Attachment Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.AttachmentPresenter = class AttachmentPresenter extends BzDeck.BasePresenter {
  /**
   * Get a AttachmentPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @param {(Number|String)} att_id - Numeric ID for an existing file or md5 hash for an unuploaded file.
   * @returns {AttachmentPresenter} New AttachmentPresenter instance.
   */
  constructor (id, att_id) {
    super(id); // Assign this.id

    this.att_id = att_id;
  }

  /**
   * Prepare attachment data for the view. Find it from the local database or remote Bugzilla instance, then notify the
   * result regardless of the availability.
   * @fires AttachmentPresenter#LoadingStarted
   * @fires AttachmentPresenter#LoadingComplete
   * @fires AttachmentPresenter#AttachmentAvailable
   * @fires AttachmentPresenter#AttachmentUnavailable
   */
  async get_attachment () {
    const collection = BzDeck.collections.attachments;

    try {
      if (!navigator.onLine) {
        throw new Error('You have to go online to load the bug.');
      }

      this.trigger('#LoadingStarted');

      let att = await collection.get(this.att_id);

      if (!att) {
        att = await collection.get(this.att_id, { id: this.att_id });
        att = await att.fetch();
      }

      if (!att || att.error) {
        throw new Error(att.error || 'Unknown Error');
      }

      this.attachment = att;

      this.trigger('#AttachmentAvailable');
    } catch (error) {
      this.trigger('#AttachmentUnavailable', { message: error.message });
    }

    this.trigger('#LoadingComplete');
  }
}
